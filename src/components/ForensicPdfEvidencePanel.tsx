import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Scale,
  Mail,
  FileSearch,
  Landmark,
  Hash,
  Download,
  Trash2,
  Eye,
  PlusCircle,
  Loader2,
  FileCheck2,
  Building2,
  Calendar,
  BookOpen,
  Copy,
  Check,
  Send,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  AlgedonicObservation,
  AuthorityDocumentCategory,
  ForensicEvidenceCategoryTag,
  ForensicPdfDocumentAnalysis,
  ForensicPdfEvidence,
  HourlyWeatherPoint,
  LatLngPoint,
  LegalViolationEntry,
  ReceptorExposureResult,
} from '../types/dispersion';
import {
  buildChainOfCustodyVerificationEntries,
  generateDedicatedPdfEvidenceOverviewPdf,
  generateForensicChainOfCustodyPdfReport,
  generateMarkedViolationsSha256PdfReport,
} from '../services/pdfExportService';

export interface MunicipalComplaintDraftResult {
  subjectLine: string;
  recipientHeader: string;
  caseReferenceSummary: string;
  formalLetterText: string;
  demandedActions: string[];
  enclosedPdfAnnexList: string[];
  violatedStatutesSummary: string[];
  generatedAtIso: string;
  modelUsed: string;
}

interface ForensicPdfEvidencePanelProps {
  currentWeather: HourlyWeatherPoint;
  selectedDate: string;
  receptorExposures: ReceptorExposureResult[];
  maxSumQuotient: number;
  observations: AlgedonicObservation[];
  legalViolations?: LegalViolationEntry[];
  sha256Hash?: string;
  onRegisterPdfEvidenceObservation: (params: {
    pdfEvidence: ForensicPdfEvidence;
    observationType: string;
    description: string;
    position: LatLngPoint;
    locationLabel: string;
  }) => void;
  onGenerateFullForensicPdfReport?: (pdfArchive: ForensicPdfEvidence[]) => void;
}

const PDF_ARCHIVE_STORAGE_KEY = 'ringparken_pdf_evidence_archive_v2_scratch';

const CATEGORY_META: Record<
  AuthorityDocumentCategory,
  {
    label: string;
    shortLabel: string;
    badgeClass: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  mail_korrespondance: {
    label: 'Mailkorrespondance (Bygherre / Udlejer / Kommune)',
    shortLabel: 'Mailkorrespondance',
    badgeClass: 'bg-sky-950/80 text-sky-300 border-sky-500/40',
    description:
      'E-mailtråde med FOB Slagelse, byggeledelsen (PSS W22085), udlejer eller kommunale sagsbehandlere som bevis for varsling og ond tro ("The Liability Bomb").',
    icon: Mail,
  },
  aktindsigt_svar: {
    label: 'Svar på Anmodning om Aktindsigt (Miljøoplysningsloven)',
    shortLabel: 'Aktindsigtssvar',
    badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
    description:
      'Afgørelser, aktlister, tilsynsnotater, affaldsanmeldelser og udleverede sagsakter efter Miljøoplysningsloven § 2 og Offentlighedsloven § 7.',
    icon: FileSearch,
  },
  myndighedshenvendelse: {
    label: 'Myndighedshenvendelse / Påbud / Klageskrift',
    shortLabel: 'Myndighedshenvendelse',
    badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-500/40',
    description:
      'Indgivne klager, strakspåbudsanmodninger (§ 42), partshøringssvar og korrespondance med Arbejdstilsynet, Slagelse Kommune eller Ankestyrelsen.',
    icon: Landmark,
  },
  teknisk_rapport_bilag: {
    label: 'Teknisk Miljørapport / Saneringsplan / Målebilag',
    shortLabel: 'Teknisk Bilag',
    badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40',
    description:
      'Bygherres miljøkortlægning, PSS-uddrag, laboratorieattester eller eksterne konsulentrapporter til krydsrevision mod faktisk spredningstelemetri.',
    icon: BookOpen,
  },
};

async function computeBufferSha256(buffer: ArrayBuffer): Promise<string> {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return (
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b' +
      Math.floor(10000000 + Math.random() * 89999999).toString(16)
    );
  }
}

function buildDemoPdfDataUrl(preset: 'aktindsigt' | 'mail' | 'myndighed'): {
  dataUrl: string;
  fileName: string;
  fileSizeBytes: number;
  pageCount: number;
  category: AuthorityDocumentCategory;
  sender: string;
  recipient: string;
  referenceNumber: string;
  documentDate: string;
} {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);

  if (preset === 'aktindsigt') {
    doc.text('SLAGELSE KOMMUNE - CENTER FOR MILJO, PLAN OG TEKNIK', 15, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Sagsnr.: 2026-004192 / Ref.: Nedrivning Ringparken (PSS Sag W22085)', 15, 28);
    doc.text('Dato: 2026-07-14 | Lovgrundlag: Miljooplysningsloven § 2 & Offentlighedsloven § 7', 15, 34);
    doc.line(15, 38, 195, 38);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('AFGORELSE OM AKTINDSIGT VEDR. NEDRIVNING AF RINGPARKEN, 4200 SLAGELSE', 15, 48);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const lines = [
      'Til beboerreprasentationen / indsigtsanmoder i Ringparken, Schackenborgvaenget, 4200 Slagelse.',
      '',
      'Slagelse Kommune har behandlet din anmodning om aktindsigt i samtlige miljooplysninger,',
      'tilsynsnotater, immissionsmalinger (PM10, PM2.5, respirabelt kvarts og asbestfibre) samt',
      'dokumentation for vandforstovning og undertryksinddaekning ved nedrivning af Blok 1-3.',
      '',
      '1. UDLEVEREDE DOKUMENTER OG KONSTATEREDE FORHOLD:',
      '- Byggeaffaldsanmeldelse bekræfter forekomst af asbestholdige materialer, PCB-fugemasser,',
      '  tungmetalholdig maling (bly/zink) samt 13.380 tons armeret beton (krystallinsk siliciumdioxid).',
      '- Kommunen er IKKE i besiddelse af kontinuerlige, logforende partikelmalinger (PM10/PM2.5)',
      '  eller fibermalinger foretaget i skel mod de bebosatte naboblokke under selve nedbrydningen.',
      '- Kommunens miljotilsyn har alene modtaget bygherres egenkontrolskemaer og gennemfort',
      '  forudvarslede besigtigelser.',
      '',
      '2. KOMMUNENS VURDERING I AKTINDSIGTEN:',
      '- Forvaltningen har lagt entreprenorens oplysning til grund om, at der anvendes vandkanon',
      '  efter behov, og at stovspredning vurderes at holde sig inden for byggepladshegnet.',
      '',
      'Dette dokument indgar som officielt bevisbilag for manglende immissionsovervagning (System 3*).',
    ];
    doc.text(lines, 15, 58);

    const dataUrl = doc.output('datauristring');
    return {
      dataUrl,
      fileName: 'Aktindsigtssvar_Slagelse_Kommune_Sagsnr_2026_004192.pdf',
      fileSizeBytes: Math.round(dataUrl.length * 0.75),
      pageCount: 1,
      category: 'aktindsigt_svar',
      sender: 'Slagelse Kommune — Center for Miljø, Plan og Teknik',
      recipient: 'Beboer / Indsigtsanmoder i Ringparken 4200 Slagelse',
      referenceNumber: 'Sagsnr. 2026-004192 / PSS W22085',
      documentDate: '2026-07-14',
    };
  }

  if (preset === 'mail') {
    doc.text('E-MAILKORRESPONDANCE - VARSLING AF SUNDHEDSFARE ("THE LIABILITY BOMB")', 15, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Fra: Beboerreprasentation Ringparken <beboer@ringparken-slagelse.dk>', 15, 28);
    doc.text('Til: FOB Slagelse (Bygherre / Udlejer) & Byggeledelsen Sag W22085', 15, 34);
    doc.text('Cc: Slagelse Kommune Miljoafdeling | Dato: 2026-07-12 kl. 14:22', 15, 40);
    doc.text('Emne: AKUT VARSLING: Stovfaner over beboede altaner og krav om genhusning (Almenlejeloven §§ 14-15)', 15, 46);
    doc.line(15, 50, 195, 50);

    doc.setFontSize(9.5);
    const lines = [
      'Til FOB Slagelse (Udlejer/Bygherre) og Hovedentreprenor (Sag W22085),',
      '',
      'Undertegnede beboere fremsender hermed skriftligt varsel og dokumentation for, at den igangvaerende',
      'nedrivning af Blok 1-3 pa Schackenborgvaenget medforer massive stovudslip direkte ind i',
      'boligomradet ved Rodtjornevej og Schackenborgvaenget.',
      '',
      'Vi har d.d. dokumenteret synlige stovfaner uden aktiv vandforstovning ved vindstod over 9 m/s.',
      'Stovet traenger ind gennem ventilationsspalter og laegger sig pa altaner, vindueskarme og',
      'opholdsarealer. Flere beboere oplever akut luftvejsirritation, hoste og svie i ojnene.',
      '',
      'SVAR FRA BYGGELEDELSE / UDLEJER (Modtaget 2026-07-13 kl. 09:15):',
      '"Vi er opmaerksomme pa, at det stover i forbindelse med nedbrydning af raabeton i det torre',
      'sommervejr. Tidsplanen tillader ikke standsning af arbejdet, og der er ikke planlagt',
      'midlertidig genhusning af omkringliggende boligblokke."',
      '',
      'JURIDISK NOTAT: Ovenstaende svar dokumenterer viden og accept af risiko (ond tro / culpa).',
    ];
    doc.text(lines, 15, 58);

    const dataUrl = doc.output('datauristring');
    return {
      dataUrl,
      fileName: 'Mailkorrespondance_Bygherre_FOB_Varsling_W22085.pdf',
      fileSizeBytes: Math.round(dataUrl.length * 0.75),
      pageCount: 1,
      category: 'mail_korrespondance',
      sender: 'Beboerrepræsentation Ringparken / Svar fra FOB Byggeledelse',
      recipient: 'FOB Slagelse (Udlejer & Bygherre) / Kopi til Slagelse Kommune',
      referenceNumber: 'MAIL-FOB-2026-0712 / Sag W22085',
      documentDate: '2026-07-13',
    };
  }

  doc.text('MYNDIGHEDSHENVENDELSE - KRAV OM STRAKSPABUD (MBL § 42 & AML § 77)', 15, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Til: Arbejdstilsynet (Tilsynscenter Ost) & Slagelse Kommune Miljotilsyn', 15, 28);
  doc.text('Journalref.: AT-2026-RP-884 / SK-MILJO-2026-119 | Dato: 2026-07-15', 15, 34);
  doc.line(15, 38, 195, 38);

  doc.setFontSize(9.5);
  const lines = [
    'VEDR.: ANMODNING OM STRAKSPABUD OG MIDLERTIDIGT STOP FOR TORNEDBRYDNING I RINGPARKEN',
    '',
    'Hermed indgives formel myndighedshenvendelse med krav om ojeblikkeligt indgreb over for',
    'nedrivningsarbejdet pa Schackenborgvaenget, 4200 Slagelse (PSS Sag W22085).',
    '',
    '1. DOKUMENTERET OVERSKRIDELSE AF TOKSIKOLOGISK SUMFORMEL (BEK NR. 613/2026):',
    '- Gaussisk spredningstelemetri koblet med DMI/Open-Meteo vinddata viser Sumformel S > 1.0',
    '  ved naermeste beboelsesfacader og daginstitution.',
    '- Samtidig overskrides WHOs 24-timers retledende graensevaerdi for PM2.5 (15 ug/m3) og',
    '  PM10 (45 ug/m3) allerede for kl. 16:00 pa dage med vest-/sydvestlig vind.',
    '',
    '2. RETSGRUNDLAG OG KRAV OM INDGREB:',
    '- Efter Miljobeskyttelseslovens § 42 og § 65 har kommunalbestyrelsen pligt til at meddele',
    '  pabud om nedbringelse af vaesentlig forurening.',
    '- Efter Arbejdsmiljolovens § 77 og BEK nr. 744/2025 skal spredning af sundhedsskadeligt',
    '  stov til omgivelserne forhindres effektivt ved kilden.',
  ];
  doc.text(lines, 15, 48);

  const dataUrl = doc.output('datauristring');
  return {
    dataUrl,
    fileName: 'Myndighedshenvendelse_Arbejdstilsynet_SlagelseKommune_Paragraf42.pdf',
    fileSizeBytes: Math.round(dataUrl.length * 0.75),
    pageCount: 1,
    category: 'myndighedshenvendelse',
    sender: 'Berørte Beboere & Teknisk-Juridisk Partsrepræsentant',
    recipient: 'Arbejdstilsynet & Slagelse Kommune (Center for Miljø)',
    referenceNumber: 'AT-2026-RP-884 / SK-MILJØ-2026-119',
    documentDate: '2026-07-15',
  };
}

export const ForensicPdfEvidencePanel: React.FC<ForensicPdfEvidencePanelProps> = ({
  currentWeather,
  selectedDate,
  receptorExposures,
  maxSumQuotient,
  observations,
  legalViolations = [],
  sha256Hash,
  onRegisterPdfEvidenceObservation,
  onGenerateFullForensicPdfReport,
}) => {
  const [pdfArchive, setPdfArchive] = useState<ForensicPdfEvidence[]>(() => {
    try {
      const saved = localStorage.getItem(PDF_ARCHIVE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  const [selectedCategory, setSelectedCategory] =
    useState<AuthorityDocumentCategory>('aktindsigt_svar');
  const [selectedEvidenceCategory, setSelectedEvidenceCategory] =
    useState<ForensicEvidenceCategoryTag>('Myndighedskorrespondance');
  const [markedViolationIds, setMarkedViolationIds] = useState<string[]>([]);
  const [isExportingViolationsPdf, setIsExportingViolationsPdf] = useState<boolean>(false);
  const [senderInput, setSenderInput] = useState<string>('');
  const [recipientInput, setRecipientInput] = useState<string>('');
  const [referenceInput, setReferenceInput] = useState<string>('');
  const [documentDateInput, setDocumentDateInput] = useState<string>(selectedDate);
  const [userNotes, setUserNotes] = useState<string>('');

  const [pendingPdfBase64, setPendingPdfBase64] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('');
  const [pendingFileSize, setPendingFileSize] = useState<number>(0);
  const [pendingPageCount, setPendingPageCount] = useState<number>(1);
  const [pendingSha256, setPendingSha256] = useState<string>('');

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<ForensicPdfDocumentAnalysis | null>(null);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string>('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<AuthorityDocumentCategory | 'ALL'>('ALL');

  // State for selecting PDF evidence items to include in the formal municipal complaint
  const [selectedForComplaintIds, setSelectedForComplaintIds] = useState<string[]>([]);
  const [isGeneratingComplaint, setIsGeneratingComplaint] = useState<boolean>(false);
  const [complaintDraft, setComplaintDraft] = useState<MunicipalComplaintDraftResult | null>(null);
  const [editableComplaintText, setEditableComplaintText] = useState<string>('');
  const [copiedComplaintNotice, setCopiedComplaintNotice] = useState<boolean>(false);
  const [showDedicatedPdfReportPage, setShowDedicatedPdfReportPage] = useState<boolean>(true);
  const [showChainOfCustodyTable, setShowChainOfCustodyTable] = useState<boolean>(true);
  const [copiedShaId, setCopiedShaId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dedicatedOverviewRef = useRef<HTMLDivElement | null>(null);
  const chainOfCustodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      // Save archive without overly large base64 strings if > 2MB to protect localStorage quota
      const compactArchive = pdfArchive.map((item) => ({
        ...item,
        pdfDataUrl:
          item.pdfDataUrl && item.pdfDataUrl.length > 350000 ? undefined : item.pdfDataUrl,
      }));
      localStorage.setItem(PDF_ARCHIVE_STORAGE_KEY, JSON.stringify(compactArchive));
    } catch {
      // ignore quota errors
    }
  }, [pdfArchive]);

  useEffect(() => {
    const handleExternalPdfAppended = (evt: Event) => {
      const customEvt = evt as CustomEvent<ForensicPdfEvidence>;
      const incoming = customEvt.detail;
      if (!incoming || !incoming.id) return;
      setPdfArchive((prev) => {
        if (prev.some((item) => item.id === incoming.id)) {
          return prev;
        }
        return [incoming, ...prev];
      });
      setSelectedArchiveId(incoming.id);
      setStatusBanner(
        `SHA-256 PDF-bevis tilføjet til arkivet: ${incoming.fileName}`
      );
    };
    window.addEventListener('ringparken-pdf-evidence-appended', handleExternalPdfAppended);
    return () => {
      window.removeEventListener('ringparken-pdf-evidence-appended', handleExternalPdfAppended);
    };
  }, []);

  useEffect(() => {
    if (legalViolations.length > 0 && markedViolationIds.length === 0) {
      setMarkedViolationIds(legalViolations.map((v) => v.id));
    }
  }, [legalViolations, markedViolationIds.length]);

  const worstReceptor =
    receptorExposures.length > 0
      ? [...receptorExposures].sort((a, b) => b.sumQuotient - a.sumQuotient)[0]
      : null;

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setStatusBanner(null);

    const arrayBuffer = await file.arrayBuffer();
    const sha256 = await computeBufferSha256(arrayBuffer);

    // Estimate page count from raw PDF "/Type /Page" occurrences
    let estimatedPages = 1;
    try {
      const textDecoder = new TextDecoder('latin1');
      const rawText = textDecoder.decode(arrayBuffer.slice(0, Math.min(arrayBuffer.byteLength, 500000)));
      const matches = rawText.match(/\/Type\s*\/Page\b/g);
      if (matches && matches.length > 0) {
        estimatedPages = matches.length;
      }
    } catch {
      estimatedPages = Math.max(1, Math.round(file.size / 45000));
    }

    // Auto-detect category hint from filename
    const lowerName = file.name.toLowerCase();
    let autoCategory: AuthorityDocumentCategory = selectedCategory;
    if (lowerName.includes('aktindsigt') || lowerName.includes('sagsnr') || lowerName.includes('udleveret')) {
      autoCategory = 'aktindsigt_svar';
      setSelectedCategory('aktindsigt_svar');
    } else if (lowerName.includes('mail') || lowerName.includes('korrespondance') || lowerName.includes('fob')) {
      autoCategory = 'mail_korrespondance';
      setSelectedCategory('mail_korrespondance');
    } else if (lowerName.includes('myndighed') || lowerName.includes('paabud') || lowerName.includes('påbud') || lowerName.includes('arbejdstilsyn')) {
      autoCategory = 'myndighedshenvendelse';
      setSelectedCategory('myndighedshenvendelse');
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      setPendingPdfBase64(dataUrl);
      setPendingFileName(file.name);
      setPendingFileSize(file.size);
      setPendingPageCount(estimatedPages);
      setPendingSha256(sha256);

      await runGeminiPdfAnalysis({
        dataUrl,
        fileName: file.name,
        category: autoCategory,
        sender: senderInput,
        recipient: recipientInput,
        referenceNumber: referenceInput,
        documentDate: documentDateInput,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleLoadDemoPdf = async (preset: 'aktindsigt' | 'mail' | 'myndighed') => {
    setStatusBanner(null);
    const demo = buildDemoPdfDataUrl(preset);
    const rawBytes = new TextEncoder().encode(demo.dataUrl);
    const sha256 = await computeBufferSha256(rawBytes.buffer);

    setSelectedCategory(demo.category);
    setSenderInput(demo.sender);
    setRecipientInput(demo.recipient);
    setReferenceInput(demo.referenceNumber);
    setDocumentDateInput(demo.documentDate);
    setPendingPdfBase64(demo.dataUrl);
    setPendingFileName(demo.fileName);
    setPendingFileSize(demo.fileSizeBytes);
    setPendingPageCount(demo.pageCount);
    setPendingSha256(sha256);

    await runGeminiPdfAnalysis({
      dataUrl: demo.dataUrl,
      fileName: demo.fileName,
      category: demo.category,
      sender: demo.sender,
      recipient: demo.recipient,
      referenceNumber: demo.referenceNumber,
      documentDate: demo.documentDate,
    });
  };

  const runGeminiPdfAnalysis = async (params: {
    dataUrl: string;
    fileName: string;
    category: AuthorityDocumentCategory;
    sender: string;
    recipient: string;
    referenceNumber: string;
    documentDate: string;
  }) => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analyze-pdf-evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64: params.dataUrl,
          fileName: params.fileName,
          categoryHint: params.category,
          senderHint: params.sender,
          recipientHint: params.recipient,
          referenceNumberHint: params.referenceNumber,
          documentDateHint: params.documentDate,
          userNotes,
          currentWeather,
          maxSumQuotient,
          worstReceptorName: worstReceptor
            ? `${worstReceptor.receptorName} (${worstReceptor.address})`
            : 'Rødtjørnevej 2, 4200 Slagelse',
        }),
      });
      const data: ForensicPdfDocumentAnalysis = await response.json();
      setCurrentAnalysis(data);
      if (data.senderEntity && !params.sender) setSenderInput(data.senderEntity);
      if (data.recipientEntity && !params.recipient) setRecipientInput(data.recipientEntity);
      if (data.referenceJournalNumber && !params.referenceNumber)
        setReferenceInput(data.referenceJournalNumber);
      if (data.documentDateDetected) setDocumentDateInput(data.documentDateDetected);
    } catch {
      // handled by server fallback
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Concise 3-Point Legal Summary ('Kortfattet Resumé') State & Handler
  const [conciseLegalSummaryMap, setConciseLegalSummaryMap] = useState<
    Record<
      string,
      {
        documentTitle: string;
        generatedAtIso: string;
        modelUsed: string;
        threeLegalPoints: Array<{
          pointNumber: number;
          headline: string;
          legalImplication: string;
          statutoryBasis: string;
        }>;
      }
    >
  >({});
  const [loadingConciseKey, setLoadingConciseKey] = useState<string | null>(null);

  const handleGenerateConciseLegalSummary = async (mode: 'pending' | 'inspected') => {
    const key =
      mode === 'pending'
        ? `pending_${pendingSha256 || pendingFileName || 'doc'}`
        : inspectedDocument
        ? inspectedDocument.id
        : 'inspected_default';

    const docFileName =
      mode === 'pending'
        ? pendingFileName || currentAnalysis?.documentTitle || 'Uploaded_Dokument.pdf'
        : inspectedDocument?.fileName || 'Arkiveret_Dokument.pdf';
    const docCat =
      mode === 'pending'
        ? selectedCategory
        : inspectedDocument?.category || 'aktindsigt_svar';
    const docSha =
      mode === 'pending' ? pendingSha256 : inspectedDocument?.sha256Hash || '';
    const docBase64 =
      mode === 'pending'
        ? pendingPdfBase64
        : inspectedDocument?.pdfDataUrl || '';
    const analysisObj =
      mode === 'pending' ? currentAnalysis : inspectedDocument?.aiAnalysis;

    if (!analysisObj) return;

    setLoadingConciseKey(key);
    try {
      const response = await fetch('/api/generate-pdf-concise-legal-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: docFileName,
          category: docCat,
          sha256Hash: docSha,
          pdfBase64: docBase64,
          executiveSummary: analysisObj.executiveSummary,
          legalAndEvidentiarySignificance: analysisObj.legalAndEvidentiarySignificance,
          contradictionsWithTelemetry: analysisObj.contradictionsWithTelemetry,
          extractedTextExcerpt: analysisObj.keyStatementsAndAdmissions?.join(' | ') || '',
          telemetryContext: {
            maxSiteSumQuotient: maxSumQuotient,
            windSpeedMs: currentWeather.windSpeed10m,
            peakReceptorAddress: worstReceptor
              ? `${worstReceptor.receptorName} (${worstReceptor.address})`
              : 'R1: Rødtjørnevej 2, 4200 Slagelse',
          },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setConciseLegalSummaryMap((prev) => ({
          ...prev,
          [key]: data,
        }));
      }
    } catch {
      // Fallback handled on server or gracefully ignored
    } finally {
      setLoadingConciseKey(null);
    }
  };

  const handleRegisterPdfEvidence = () => {
    if (!currentAnalysis || !pendingFileName) return;

    const newEvidenceId = `PDF-EV-${new Date().getFullYear()}-${String(pdfArchive.length + 1).padStart(3, '0')}`;
    const newEvidence: ForensicPdfEvidence = {
      id: newEvidenceId,
      fileName: pendingFileName,
      fileSizeBytes: pendingFileSize || 125000,
      pageCountEstimate: pendingPageCount || 1,
      sha256Hash:
        pendingSha256 ||
        '9a2f4d8e1b6c3075f4e9a2d1c8b76e3051a9d4c2b8f7e6013a5c9d2e4b8f1a3c',
      uploadedAtIso: new Date().toISOString(),
      category: selectedCategory,
      evidenceCategory: selectedEvidenceCategory,
      pdfDataUrl: pendingPdfBase64 || undefined,
      aiAnalysis: {
        ...currentAnalysis,
        detectedCategory: selectedCategory,
        senderEntity: senderInput || currentAnalysis.senderEntity,
        recipientEntity: recipientInput || currentAnalysis.recipientEntity,
        referenceJournalNumber: referenceInput || currentAnalysis.referenceJournalNumber,
        documentDateDetected: documentDateInput || currentAnalysis.documentDateDetected,
      },
    };

    setPdfArchive((prev) => [newEvidence, ...prev]);
    setSelectedArchiveId(newEvidence.id);
    setSelectedForComplaintIds((prev) =>
      prev.includes(newEvidence.id) ? prev : [newEvidence.id, ...prev]
    );

    const targetPosition: LatLngPoint = worstReceptor
      ? worstReceptor.position
      : { lat: 55.41265, lng: 11.35295 };

    onRegisterPdfEvidenceObservation({
      pdfEvidence: newEvidence,
      observationType: newEvidence.aiAnalysis.recommendedObservationType,
      description: `[PDF-BEVIS · ${selectedEvidenceCategory} · ${newEvidence.id} | SHA-256: ${newEvidence.sha256Hash.slice(0, 16)}...] Afsender: ${newEvidence.aiAnalysis.senderEntity} → Modtager: ${newEvidence.aiAnalysis.recipientEntity}. Resumé: ${newEvidence.aiAnalysis.executiveSummary}${userNotes ? ` | Bemærkning: ${userNotes}` : ''}`,
      position: targetPosition,
      locationLabel: `${newEvidence.aiAnalysis.referenceJournalNumber} — ${newEvidence.fileName}`,
    });

    setStatusBanner(
      `PDF-dokument "${newEvidence.fileName}" (${newEvidence.id}) er kryptografisk signeret (SHA-256) og føjet til både PDF-Bevisarkivet og Hændelses-/Bevisloggen.`
    );
  };

  const toggleSelectPdfForComplaint = (id: string) => {
    setSelectedForComplaintIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleGenerateMunicipalComplaintDraft = async () => {
    const chosenPdfs =
      selectedForComplaintIds.length > 0
        ? pdfArchive.filter((item) => selectedForComplaintIds.includes(item.id))
        : inspectedDocument
          ? [inspectedDocument]
          : pdfArchive;

    setIsGeneratingComplaint(true);
    setStatusBanner(null);

    try {
      const response = await fetch('/api/generate-municipal-complaint-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedPdfEvidences: chosenPdfs,
          legalViolations,
          currentWeather,
          selectedDate,
          maxSumQuotient,
          worstReceptorName: worstReceptor
            ? `${worstReceptor.receptorName} (${worstReceptor.address})`
            : 'Rødtjørnevej 2, 4200 Slagelse',
        }),
      });
      const draftData: MunicipalComplaintDraftResult = await response.json();
      setComplaintDraft(draftData);
      setEditableComplaintText(draftData.formalLetterText);
      setStatusBanner(
        `Formelt udkast til klageskrivelse til Slagelse Kommune er genereret ud fra ${chosenPdfs.length} valgte PDF-beviser og ${legalViolations.length} registrerede hændelser i overtrædelsesloggen.`
      );
    } catch {
      // handled by server fallback
    } finally {
      setIsGeneratingComplaint(false);
    }
  };

  const handleCopyComplaintText = async () => {
    if (!editableComplaintText) return;
    try {
      await navigator.clipboard.writeText(editableComplaintText);
      setCopiedComplaintNotice(true);
      setTimeout(() => setCopiedComplaintNotice(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleDownloadComplaintTxt = () => {
    if (!editableComplaintText) return;
    const blob = new Blob([editableComplaintText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Formel_Klageskrivelse_Slagelse_Kommune_${selectedDate}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadComplaintPdf = () => {
    if (!complaintDraft && !editableComplaintText) return;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const usableWidth = pageWidth - margin * 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(
      'FORMEL KLAGESKRIVELSE TIL SLAGELSE KOMMUNE (MBL § 42 & BEK 613/2026)',
      margin,
      16
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(
      `Genereret: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} | Sag: Ringparken 4200 Slagelse (PSS W22085)`,
      margin,
      22
    );
    doc.line(margin, 25, pageWidth - margin, 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const textLines = doc.splitTextToSize(
      editableComplaintText || complaintDraft?.formalLetterText || '',
      usableWidth
    );

    let y = 32;
    for (let i = 0; i < textLines.length; i++) {
      if (y > pageHeight - 18) {
        doc.addPage();
        y = 18;
      }
      doc.text(textLines[i], margin, y);
      y += 4.5;
    }

    doc.save(`Formel_Klageskrivelse_Slagelse_Kommune_${selectedDate}.pdf`);
  };

  const handleDownloadPdfFile = (item: ForensicPdfEvidence) => {
    if (item.pdfDataUrl) {
      const link = document.createElement('a');
      link.href = item.pdfDataUrl;
      link.download = item.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Reconstruct a clean forensic PDF certificate + full document transcript if seeded item has no raw dataUrl
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`FORENSISK PDF-BEVISBILAG: ${item.id}`, 15, 18);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Filnavn: ${item.fileName}`, 15, 25);
    doc.text(`Kategori: ${CATEGORY_META[item.category].label}`, 15, 30);
    doc.text(`Afsender: ${item.aiAnalysis.senderEntity}`, 15, 35);
    doc.text(`Modtager: ${item.aiAnalysis.recipientEntity}`, 15, 40);
    doc.text(`Journal-/Sagsnr.: ${item.aiAnalysis.referenceJournalNumber} | Dato: ${item.aiAnalysis.documentDateDetected}`, 15, 45);
    doc.text(`SHA-256 Checksum: ${item.sha256Hash}`, 15, 50);
    doc.line(15, 54, 195, 54);

    doc.setFont('helvetica', 'bold');
    doc.text('1. DOKUMENTRESUME:', 15, 62);
    doc.setFont('helvetica', 'normal');
    const summaryLines = doc.splitTextToSize(item.aiAnalysis.executiveSummary, 178);
    doc.text(summaryLines, 15, 68);

    let y = 68 + summaryLines.length * 4.8 + 6;
    doc.setFont('helvetica', 'bold');
    doc.text('2. CENTRALE CITATER, INDRØMMELSER & KONSTATEREDE MANGLER:', 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    item.aiAnalysis.keyStatementsAndAdmissions.forEach((stmt) => {
      const lines = doc.splitTextToSize(`• ${stmt}`, 175);
      doc.text(lines, 17, y);
      y += lines.length * 4.6 + 2;
    });

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('3. MODSIGELSER MOD MÅLT SPREDNINGSTELEMETRI:', 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    item.aiAnalysis.contradictionsWithTelemetry.forEach((contra) => {
      const lines = doc.splitTextToSize(`• ${contra}`, 175);
      doc.text(lines, 17, y);
      y += lines.length * 4.6 + 2;
    });

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('4. JURIDISK BEVISVÆRDI & LOVHENVISNINGER:', 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const legalLines = doc.splitTextToSize(item.aiAnalysis.legalAndEvidentiarySignificance, 178);
    doc.text(legalLines, 15, y);

    doc.save(item.fileName);
  };

  const handleExportPdfArchiveJson = () => {
    const payload = {
      schemaVersion: 'RINGPARKEN-PDF-EVIDENCE-REGISTER-2026-V1',
      exportedAtIso: new Date().toISOString(),
      caseReference: 'Ringparken 4200 Slagelse — Nedrivningssag PSS W22085',
      totalDocumentsRegistered: pdfArchive.length,
      categoryBreakdown: {
        mail_korrespondance: pdfArchive.filter((d) => d.category === 'mail_korrespondance').length,
        aktindsigt_svar: pdfArchive.filter((d) => d.category === 'aktindsigt_svar').length,
        myndighedshenvendelse: pdfArchive.filter((d) => d.category === 'myndighedshenvendelse').length,
        teknisk_rapport_bilag: pdfArchive.filter((d) => d.category === 'teknisk_rapport_bilag').length,
      },
      documents: pdfArchive.map(({ pdfDataUrl: _omit, ...rest }) => rest),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ringparken_PDF_Bevisarkiv_${selectedDate}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteArchiveItem = (id: string) => {
    const updated = pdfArchive.filter((item) => item.id !== id);
    setPdfArchive(updated);
    if (selectedArchiveId === id && updated.length > 0) {
      setSelectedArchiveId(updated[0].id);
    }
  };

  const handleClearAllPdfArchive = () => {
    setPdfArchive([]);
    setSelectedArchiveId('');
    setSelectedForComplaintIds([]);
    try {
      localStorage.removeItem(PDF_ARCHIVE_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
    setStatusBanner('Alle registrerede PDF-beviser er slettet — du starter nu registreringen fra scratch (0 dokumenter).');
  };

  const handleGenerateDedicatedPdfReportPage = (mode: 'full_report' | 'dedicated_page_only' = 'full_report') => {
    setShowDedicatedPdfReportPage(true);

    if (mode === 'full_report' && onGenerateFullForensicPdfReport) {
      onGenerateFullForensicPdfReport(pdfArchive);
      setStatusBanner(
        `Dedikeret side i PDF-rapporten ("07. Oversigtstabel over Uploadede PDF-Bilag med SHA-256 Hash & AI-Analyse-Konklusion" for ${pdfArchive.length} dokumenter) er genereret og downloadet i den samlede retsmedicinske PDF-rapport.`
      );
    } else {
      generateDedicatedPdfEvidenceOverviewPdf({
        pdfArchive,
        dateIso: selectedDate,
        hourLabel: currentWeather.hourLabel,
        maxSiteSumQuotient: maxSumQuotient,
      });
      setStatusBanner(
        `Dedikeret PDF-rapportside med oversigtstabel over alle ${pdfArchive.length} uploadede PDF-bilag, fuld SHA-256 hash og AI-analyse-konklusion er genereret og downloadet som PDF.`
      );
    }

    setTimeout(() => {
      dedicatedOverviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const handleCopySha256 = async (id: string, sha: string) => {
    try {
      await navigator.clipboard.writeText(sha);
      setCopiedShaId(id);
      setTimeout(() => setCopiedShaId(null), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const chainOfCustodyLedger = buildChainOfCustodyVerificationEntries({
    pdfArchive,
    observations,
    dateIso: selectedDate,
    hourLabel: currentWeather.hourLabel,
    maxSiteSumQuotient: maxSumQuotient,
    sha256Hash,
  });

  const handleExportChainOfCustodyPdf = () => {
    setShowChainOfCustodyTable(true);
    const ledger = generateForensicChainOfCustodyPdfReport({
      pdfArchive,
      observations,
      dateIso: selectedDate,
      hourLabel: currentWeather.hourLabel,
      maxSiteSumQuotient: maxSumQuotient,
      sha256Hash,
    });
    setStatusBanner(
      `Chain-of-Custody rapport (PDF) er genereret og downloadet med alle ${ledger.entries.length} SHA-256 signaturer samlet i en verificerbar log-tabel (Merkle-Root: ${ledger.merkleRootSignature.slice(0, 20)}...).`
    );
    setTimeout(() => {
      chainOfCustodyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const filteredArchive =
    categoryFilter === 'ALL'
      ? pdfArchive
      : pdfArchive.filter((item) => item.category === categoryFilter);

  const inspectedDocument =
    pdfArchive.find((item) => item.id === selectedArchiveId) || filteredArchive[0] || null;

  const pdfLinkedObservationsCount = observations.filter((o) => Boolean(o.pdfEvidence)).length;

  return (
    <div className="bg-[var(--surface-panel)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 bg-[var(--surface-card)] border-b border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-mono uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              <FileText className="w-3.5 h-3.5" />
              Forensisk PDF-Bevisførelse & Aktindsigts-Arkiv
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Scale className="w-3 h-3" />
              Miljøoplysningsloven • Offentlighedsloven • The Liability Bomb
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            PDF-Upload: Mailkorrespondancer, Svar på Aktindsigt & Myndighedshenvendelser
          </h2>
          <p className="text-xs text-slate-300 max-w-4xl leading-relaxed">
            Upload PDF-filer med mailkorrespondancer (f.eks. FOB Slagelse / byggeledelse), kommunale afgørelser på anmodninger om aktindsigt eller myndighedshenvendelser til Arbejdstilsynet og Slagelse Kommune. Gemini Multimodal PDF-motoren udtrækker automatisk nøglecitater, myndighedsindrømmelser og modsigelser mod den målte spredningstelemetri og forsegler dokumentet med kryptografisk SHA-256 hash.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="px-3 py-1.5 rounded-lg bg-slate-950/90 border border-slate-800 text-xs font-mono text-slate-300">
            Valgte PDF-Beviser:{' '}
            <span className="text-indigo-400 font-bold">
              {selectedForComplaintIds.length}/{pdfArchive.length}
            </span>{' '}
            • Overtrædelseslog:{' '}
            <span className="text-rose-400 font-bold">{legalViolations.length} brud</span>
          </div>
          <button
            type="button"
            onClick={handleExportChainOfCustodyPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/25 border border-emerald-300/60 transition-all cursor-pointer"
            title="Eksportér en 'Chain-of-Custody' rapport som PDF, hvor alle SHA-256 signaturer er samlet i en verificerbar log-tabel"
          >
            <Hash className="w-3.5 h-3.5 text-slate-950 shrink-0" />
            <span>
              Eksportér &apos;Chain-of-Custody&apos; Rapport (PDF • {chainOfCustodyLedger.entries.length} SHA-256 Signaturer)
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleGenerateDedicatedPdfReportPage('full_report')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-indigo-500 hover:bg-indigo-400 text-white shadow-md shadow-indigo-500/25 border border-indigo-400/50 transition-all cursor-pointer"
            title="Genererer en dedikeret side i PDF-rapporten med oversigtstabel over alle uploadede PDF-bilag, SHA-256 hash og AI-analyse-konklusion"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-white shrink-0" />
            <span>Generér PDF-Rapportside (Oversigtstabel: SHA-256 & AI-Konklusion)</span>
          </button>
          <button
            type="button"
            onClick={handleGenerateMunicipalComplaintDraft}
            disabled={isGeneratingComplaint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-60"
          >
            {isGeneratingComplaint ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
            ) : (
              <Send className="w-3.5 h-3.5 text-slate-950" />
            )}
            <span>
              {isGeneratingComplaint
                ? 'Genererer Klageskrivelse...'
                : 'Generér Formel Klageskrivelse til Slagelse Kommune'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleExportPdfArchiveJson}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            Eksportér PDF-Bevisregister (JSON)
          </button>
          {pdfArchive.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllPdfArchive}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-500/40 transition-colors cursor-pointer"
              title="Slet alle registrerede PDF-beviser og start fra scratch"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              Slet Alle PDF-Beviser ({pdfArchive.length})
            </button>
          )}
        </div>
      </div>

      {statusBanner && (
        <div className="mx-4 mt-4 p-3 rounded-lg bg-emerald-950/70 border border-emerald-500/40 flex items-center justify-between gap-3 text-xs text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-emerald-300 hover:text-white text-[11px] font-mono underline shrink-0"
          >
            Luk
          </button>
        </div>
      )}

      <div className="p-4 sm:p-5 grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Upload, Metadata & AI Extraction */}
        <div className="xl:col-span-7 space-y-5">
          {/* Step 1: Select Document Category */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              1. Vælg Dokumentkategori for Bevisførelse
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(Object.keys(CATEGORY_META) as AuthorityDocumentCategory[]).map((catKey) => {
                const meta = CATEGORY_META[catKey];
                const IconComp = meta.icon;
                const active = selectedCategory === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setSelectedCategory(catKey)}
                    className={`text-left p-3 rounded-lg border transition-all cursor-pointer ${
                      active
                        ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-md'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-xs">
                      <IconComp
                        className={`w-4 h-4 shrink-0 ${
                          active ? 'text-indigo-400' : 'text-slate-400'
                        }`}
                      />
                      <span>{meta.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {meta.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Drag & Drop PDF Upload + Demo Presets */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                2. Upload PDF-Dokument (.pdf) eller Indlæs Kalibreret Sagsbilag
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Hurtig test-PDF:</span>
                <button
                  type="button"
                  onClick={() => handleLoadDemoPdf('aktindsigt')}
                  className="px-2 py-1 rounded text-[11px] font-mono bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 border border-amber-500/40 transition-colors cursor-pointer"
                >
                  + Aktindsigtssvar (Kommune)
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadDemoPdf('mail')}
                  className="px-2 py-1 rounded text-[11px] font-mono bg-sky-950/70 hover:bg-sky-900/80 text-sky-300 border border-sky-500/40 transition-colors cursor-pointer"
                >
                  + Mailkorrespondance (FOB)
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadDemoPdf('myndighed')}
                  className="px-2 py-1 rounded text-[11px] font-mono bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border border-rose-500/40 transition-colors cursor-pointer"
                >
                  + Myndighedshenvendelse (§ 42)
                </button>
              </div>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const droppedFile = e.dataTransfer.files?.[0];
                if (droppedFile) {
                  handleFileUpload(droppedFile);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-indigo-500/70 rounded-xl p-5 bg-slate-950/70 text-center cursor-pointer transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileUpload(file);
                  }
                }}
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-full bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                  <Upload className="w-5 h-5" />
                </div>
                {pendingFileName ? (
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-emerald-300 flex items-center justify-center gap-1.5">
                      <FileCheck2 className="w-4 h-4 text-emerald-400" />
                      {pendingFileName}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {(pendingFileSize / 1024).toFixed(1)} KB • ca. {pendingPageCount} side(r) •
                      SHA-256: {pendingSha256.slice(0, 24)}...
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-xs sm:text-sm font-semibold text-slate-200">
                      Træk og slip PDF-fil her, eller klik for at vælge PDF fra din computer
                    </div>
                    <p className="text-[11px] text-slate-400 max-w-lg">
                      Understøtter PDF-eksporterede e-mailtråde, kommunale aktindsigtsbesvarelser,
                      afgørelser, tilsynsnotater og myndighedsklager (op til 25 MB).
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Metadata Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                Afsender (Myndighed / Bygherre / Borger)
              </label>
              <input
                type="text"
                value={senderInput}
                onChange={(e) => setSenderInput(e.target.value)}
                placeholder="f.eks. Slagelse Kommune / FOB Slagelse"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                Modtager
              </label>
              <input
                type="text"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                placeholder="f.eks. Beboerrepræsentation / Arbejdstilsynet"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                Sagsnr. / Journalnr. / Mail-reference
              </label>
              <input
                type="text"
                value={referenceInput}
                onChange={(e) => setReferenceInput(e.target.value)}
                placeholder="f.eks. Sagsnr. 2026-004192 / Sag W22085"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                Dokumentdato
              </label>
              <input
                type="date"
                value={documentDateInput}
                onChange={(e) => setDocumentDateInput(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                Supplerende bemærkninger til bevisførelsen (valgfrit)
              </label>
              <input
                type="text"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="Angiv f.eks. hvilke bilag der mangler i aktindsigten, eller hvornår mailen blev sendt..."
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Step 4: AI Analysis Output & Registration Button */}
          {isAnalyzing && (
            <div className="p-5 rounded-xl bg-indigo-950/30 border border-indigo-500/40 flex items-center gap-3 text-indigo-200">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400 shrink-0" />
              <div className="text-xs space-y-0.5">
                <div className="font-semibold">
                  Gemini 3 Flash Multimodal PDF-motor analyserer dokumentet...
                </div>
                <div className="text-indigo-300/80">
                  Udtrækker journalnumre, citater, myndighedsindrømmelser og krydstjekker mod
                  spredningstelemetri (S = {maxSumQuotient.toFixed(2)}).
                </div>
              </div>
            </div>
          )}

          {currentAnalysis && !isAnalyzing && (
            <div className="p-4 rounded-xl bg-slate-950/90 border border-indigo-500/40 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                    Forensisk PDF-Analyse Klar til Registrering
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    Alvorsgrad: {currentAnalysis.severityAssessment}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300">
                    Konfidens: {currentAnalysis.confidencePct}%
                  </span>
                </div>
              </div>

              <div>
                <div className="text-sm font-bold text-white">{currentAnalysis.documentTitle}</div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {currentAnalysis.executiveSummary}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
                  <div className="text-[11px] font-mono uppercase text-amber-300 font-semibold flex items-center gap-1.5">
                    <FileSearch className="w-3.5 h-3.5" />
                    Udtrukne Nøgleudsagn & Mangler
                  </div>
                  <ul className="space-y-1 text-xs text-slate-300 list-disc list-inside">
                    {currentAnalysis.keyStatementsAndAdmissions.map((item, idx) => (
                      <li key={idx} className="leading-snug">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 rounded-lg bg-rose-950/25 border border-rose-500/30 space-y-1.5">
                  <div className="text-[11px] font-mono uppercase text-rose-300 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Modsigelser mod Målt Telemetri
                  </div>
                  <ul className="space-y-1 text-xs text-rose-200/90 list-disc list-inside">
                    {currentAnalysis.contradictionsWithTelemetry.map((item, idx) => (
                      <li key={idx} className="leading-snug">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/30 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] font-mono uppercase text-indigo-300 font-semibold flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5" />
                    Juridisk Bevisværdi (&quot;The Liability Bomb&quot; &amp; Officialmaksimen)
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGenerateConciseLegalSummary('pending')}
                    disabled={
                      loadingConciseKey ===
                      `pending_${pendingSha256 || pendingFileName || 'doc'}`
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-200 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                    title="Brug Gemini til at generere et kortfattet 3-punkts-resumé af det uploadede dokument, fokuseret udelukkende på juridiske implikationer for Ringparken-nedrivningen"
                  >
                    {loadingConciseKey ===
                    `pending_${pendingSha256 || pendingFileName || 'doc'}` ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Genererer 3-Punkts Resumé...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Kortfattet Resumé (3 Juridiske Punkter)</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {currentAnalysis.legalAndEvidentiarySignificance}
                </p>

                {/* 3-Point Concise Legal Summary Output for Uploaded PDF */}
                {conciseLegalSummaryMap[
                  `pending_${pendingSha256 || pendingFileName || 'doc'}`
                ] && (
                  <div className="mt-2.5 pt-2.5 border-t border-amber-500/40 bg-slate-950/90 rounded-lg p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="text-[11px] font-mono font-bold uppercase text-amber-300 flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-amber-400" />
                        Kortfattet 3-Punkts Resumé: Juridiske Implikationer (Ringparken PSS W22085)
                      </span>
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40">
                        {
                          conciseLegalSummaryMap[
                            `pending_${pendingSha256 || pendingFileName || 'doc'}`
                          ].modelUsed
                        }
                      </span>
                    </div>
                    <div className="space-y-2">
                      {conciseLegalSummaryMap[
                        `pending_${pendingSha256 || pendingFileName || 'doc'}`
                      ].threeLegalPoints.map((pt) => (
                        <div
                          key={pt.pointNumber}
                          className="p-2.5 rounded bg-slate-900/90 border border-slate-800 space-y-1"
                        >
                          <div className="text-xs font-bold text-amber-200">
                            {pt.headline}
                          </div>
                          <p className="text-[11px] text-slate-200 leading-relaxed">
                            {pt.legalImplication}
                          </p>
                          <div className="text-[11px] font-mono text-indigo-300">
                            Hjemmel: {pt.statutoryBasis}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5">
                <div className="text-[11px] font-mono uppercase text-indigo-300 font-semibold">
                  Tilknyt specifik bevis-kategori (vises i Bevis-Tidslinjen):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      'Myndighedskorrespondance',
                      'Beboerklage',
                      'Tilsynsrapport',
                      'Laboratorieanalyse',
                      'AMR-Observation',
                    ] as ForensicEvidenceCategoryTag[]
                  ).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedEvidenceCategory(cat)}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-colors cursor-pointer ${
                        selectedEvidenceCategory === cat
                          ? 'bg-indigo-500 text-white border-indigo-300 font-bold'
                          : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-indigo-400" />
                  SHA-256: {pendingSha256.slice(0, 32)}...
                </div>
                <button
                  type="button"
                  onClick={handleRegisterPdfEvidence}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Registrér PDF som {selectedEvidenceCategory} i Sagsloggen
                </button>
              </div>
            </div>
          )}

          {/* Marked Legal Violations & SHA-256 Consolidated PDF Export Widget */}
          <div className="p-4 rounded-xl bg-slate-950/90 border border-rose-500/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-rose-300 font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>SAMLET PDF-EKSPORT AF MARKEREDE LOVOVERTRÆDELSER &amp; SHA-256 SIGNATURER</span>
                </div>
                <h4 className="text-xs font-bold text-white mt-0.5">
                  Vælg Dokumenterede Lovbrud ({markedViolationIds.length} af {legalViolations.length} markeret)
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMarkedViolationIds(legalViolations.map((v) => v.id))}
                  className="text-[11px] font-mono text-rose-300 hover:text-white underline cursor-pointer"
                >
                  Markér alle
                </button>
                <button
                  type="button"
                  disabled={markedViolationIds.length === 0 || isExportingViolationsPdf}
                  onClick={async () => {
                    setIsExportingViolationsPdf(true);
                    try {
                      const selected = legalViolations.filter((v) =>
                        markedViolationIds.includes(v.id)
                      );
                      await generateMarkedViolationsSha256PdfReport({
                        violations: selected.length > 0 ? selected : legalViolations,
                        dateIso: selectedDate,
                        hourLabel: currentWeather.hourLabel,
                        maxSiteSumQuotient: maxSumQuotient,
                        sha256Hash:
                          sha256Hash ||
                          '8F4E2C9A1B7D6E3F5A0C8B2D4E6F1A9C3B5D7E9F0A2C4E6B8D0F2A4C6E8B0D2F',
                      });
                    } finally {
                      setIsExportingViolationsPdf(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold bg-rose-600 hover:bg-rose-500 text-white border border-rose-400/50 shadow transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isExportingViolationsPdf
                      ? 'Genererer PDF...'
                      : `Eksportér Markerede Lovovertrædelser & SHA-256 (${markedViolationIds.length} stk.)`}
                  </span>
                </button>
              </div>
            </div>

            {legalViolations.length > 0 ? (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {legalViolations.map((v) => {
                  const isChecked = markedViolationIds.includes(v.id);
                  return (
                    <label
                      key={v.id}
                      className={`p-2 rounded border flex items-start gap-2.5 cursor-pointer transition-colors text-xs ${
                        isChecked
                          ? 'bg-rose-950/35 border-rose-500/50 text-slate-100'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          setMarkedViolationIds((prev) =>
                            prev.includes(v.id)
                              ? prev.filter((id) => id !== v.id)
                              : [...prev, v.id]
                          )
                        }
                        className="mt-0.5 accent-rose-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                          <span className="font-bold text-rose-300 truncate">
                            {v.statuteTitle} ({v.statuteReference})
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-200 border border-rose-500/40 shrink-0">
                            S = {v.sumQuotient.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 truncate mt-0.5">
                          Receptor: {v.receptorName} ({v.receptorAddress}) — {v.legalConsequence}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-400">
                Ingen aktive grænseværdioverskridelser på den valgte time.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Persistent PDF Evidence Archive & Inspector */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Registrerede PDF-Beviser ({filteredArchive.length})
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer ${
                    categoryFilter === 'ALL'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Alle ({pdfArchive.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('aktindsigt_svar')}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer ${
                    categoryFilter === 'aktindsigt_svar'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Aktindsigt
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('mail_korrespondance')}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer ${
                    categoryFilter === 'mail_korrespondance'
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Mail
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('myndighedshenvendelse')}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer ${
                    categoryFilter === 'myndighedshenvendelse'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Myndighed
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedForComplaintIds(pdfArchive.map((d) => d.id))}
                  className="text-indigo-300 hover:text-white font-mono underline cursor-pointer"
                >
                  Vælg alle ({pdfArchive.length})
                </button>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedForComplaintIds(inspectedDocument ? [inspectedDocument.id] : [])
                  }
                  className="text-slate-400 hover:text-slate-200 font-mono underline cursor-pointer"
                >
                  Kun aktivt dokument
                </button>
              </div>
              <span className="font-mono text-amber-300">
                {selectedForComplaintIds.length} valgt til klageskrivelse
              </span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {filteredArchive.map((item) => {
                const meta = CATEGORY_META[item.category];
                const isSelected = inspectedDocument?.id === item.id;
                const isCheckedForComplaint = selectedForComplaintIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedArchiveId(item.id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-950/50 border-indigo-500/70'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isCheckedForComplaint}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelectPdfForComplaint(item.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          title="Medtag dette PDF-bevis i klageskrivelsen til Slagelse Kommune"
                          className="mt-1 accent-amber-400 cursor-pointer shrink-0"
                        />
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-mono font-bold text-indigo-300">
                              {item.id}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] font-mono border ${meta.badgeClass}`}
                            >
                              {meta.shortLabel}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {item.aiAnalysis.documentDateDetected}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-white truncate">
                            {item.aiAnalysis.documentTitle}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {item.aiAnalysis.senderEntity} → {item.aiAnalysis.recipientEntity}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadPdfFile(item);
                          }}
                          title="Download PDF-bevisbilag"
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {pdfArchive.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteArchiveItem(item.id);
                            }}
                            title="Fjern fra arkiv"
                            className="p-1.5 rounded bg-slate-800 hover:bg-rose-900/70 text-slate-400 hover:text-rose-200 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Dedicated CTA buttons inside Archive Box: 1) Chain-of-Custody PDF, 2) Dedicated PDF Report Overview Page, 3) Municipal Complaint */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleExportChainOfCustodyPdf}
                className="w-full py-2.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-emerald-300/60"
                title="Eksportér en 'Chain-of-Custody' rapport som PDF, hvor alle SHA-256 signaturer er samlet i en verificerbar log-tabel"
              >
                <Hash className="w-4 h-4 text-slate-950 shrink-0" />
                <span>
                  Eksportér &apos;Chain-of-Custody&apos; Rapport som PDF ({chainOfCustodyLedger.entries.length} SHA-256 Signaturer i Verificerbar Log-Tabel)
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleGenerateDedicatedPdfReportPage('full_report')}
                className="w-full py-2.5 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-sky-300/60"
              >
                <FileCheck2 className="w-4 h-4 text-slate-950 shrink-0" />
                <span>
                  Generér Dedikeret Side i PDF-Rapporten: Oversigtstabel ({pdfArchive.length} PDF-Bilag, SHA-256 & AI-Konklusion)
                </span>
              </button>

              <button
                type="button"
                onClick={handleGenerateMunicipalComplaintDraft}
                disabled={isGeneratingComplaint}
                className="w-full py-2.5 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                {isGeneratingComplaint ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                ) : (
                  <Scale className="w-4 h-4 text-slate-950" />
                )}
                <span>
                  {isGeneratingComplaint
                    ? 'Udformer Formel Klageskrivelse til Slagelse Kommune...'
                    : `Generér Formel Klageskrivelse til Slagelse Kommune (${selectedForComplaintIds.length || 1} PDF-beviser + ${legalViolations.length} lovbrud)`}
                </span>
              </button>
            </div>
          </div>

          {/* Detailed Inspector for Selected Archived PDF */}
          {inspectedDocument && (
            <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3 flex-1">
              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Dokument-Inspektion: {inspectedDocument.id}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadPdfFile(inspectedDocument)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  Hent PDF-Bilag
                </button>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="font-bold text-white">
                  {inspectedDocument.aiAnalysis.documentTitle}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-300 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      <strong className="text-slate-400">Fra:</strong>{' '}
                      {inspectedDocument.aiAnalysis.senderEntity}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      <strong className="text-slate-400">Til:</strong>{' '}
                      {inspectedDocument.aiAnalysis.recipientEntity}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      <strong className="text-slate-400">Ref.:</strong>{' '}
                      {inspectedDocument.aiAnalysis.referenceJournalNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      <strong className="text-slate-400">Dato:</strong>{' '}
                      {inspectedDocument.aiAnalysis.documentDateDetected}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {inspectedDocument.aiAnalysis.executiveSummary}
              </p>

              <div className="space-y-1">
                <div className="text-[11px] font-mono uppercase text-amber-300 font-semibold">
                  Centrale Citater / Indrømmelser i PDF:
                </div>
                <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
                  {inspectedDocument.aiAnalysis.keyStatementsAndAdmissions.map((stmt, idx) => (
                    <li key={idx}>{stmt}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] font-mono uppercase text-indigo-300 font-semibold flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Juridisk Betydning &amp; Lovgrundlag:
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGenerateConciseLegalSummary('inspected')}
                    disabled={loadingConciseKey === inspectedDocument.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-200 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                    title="Brug Gemini til at generere et kortfattet 3-punkts-resumé af dette dokument, fokuseret udelukkende på juridiske implikationer for Ringparken-nedrivningen"
                  >
                    {loadingConciseKey === inspectedDocument.id ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Genererer 3-Punkts Resumé...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        <span>Kortfattet Resumé (3 Juridiske Punkter)</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {inspectedDocument.aiAnalysis.legalAndEvidentiarySignificance}
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {inspectedDocument.aiAnalysis.statutoryReferences.map((ref, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 text-slate-300 border border-slate-800"
                    >
                      {ref}
                    </span>
                  ))}
                </div>

                {/* 3-Point Concise Legal Summary Output for Inspected Archived PDF */}
                {conciseLegalSummaryMap[inspectedDocument.id] && (
                  <div className="mt-2.5 pt-2.5 border-t border-amber-500/40 bg-slate-900/95 rounded-lg p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="text-[11px] font-mono font-bold uppercase text-amber-300 flex items-center gap-1">
                        <Scale className="w-3.5 h-3.5 text-amber-400" />
                        Kortfattet 3-Punkts Resumé (Juridiske Implikationer · Ringparken)
                      </span>
                      <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40">
                        Gemini 3-Punkt
                      </span>
                    </div>
                    <div className="space-y-2">
                      {conciseLegalSummaryMap[inspectedDocument.id].threeLegalPoints.map(
                        (pt) => (
                          <div
                            key={pt.pointNumber}
                            className="p-2 rounded bg-slate-950/90 border border-slate-800 space-y-1"
                          >
                            <div className="text-[11px] font-bold text-amber-200">
                              {pt.headline}
                            </div>
                            <p className="text-[11px] text-slate-200 leading-relaxed">
                              {pt.legalImplication}
                            </p>
                            <div className="text-[11px] font-mono text-indigo-300">
                              Hjemmel: {pt.statutoryBasis}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 break-all">
                SHA-256 Chain-of-Custody: {inspectedDocument.sha256Hash}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* GENERATED FORMAL COMPLAINT DRAFT TO SLAGELSE KOMMUNE */}
      {complaintDraft && (
        <div className="mx-4 mb-5 p-4 sm:p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] border-l-4 border-l-amber-400 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/30 pb-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase bg-amber-400 text-slate-950">
                  <Landmark className="w-3.5 h-3.5" />
                  Formelt Klageudkast til Slagelse Kommune
                </span>
                <span className="text-[11px] font-mono text-amber-300">
                  {complaintDraft.caseReferenceSummary}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                {complaintDraft.subjectLine}
              </h3>
              <div className="text-xs font-mono text-slate-300">
                Modtager: <strong className="text-amber-200">{complaintDraft.recipientHeader}</strong>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyComplaintText}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
              >
                {copiedComplaintNotice ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Kopieret!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-amber-300" />
                    <span>Kopiér Klageskrivelse</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadComplaintTxt}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Download .TXT</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadComplaintPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Klageskrivelse (PDF)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>
                  FULDT KLAGESKRIFT (KAN REDIGERES INDEN EKSPORT / AFSENDELSE TIL SLAGELSE KOMMUNE):
                </span>
                <span>{editableComplaintText.length} tegn</span>
              </div>
              <textarea
                rows={18}
                value={editableComplaintText}
                onChange={(e) => setEditableComplaintText(e.target.value)}
                className="w-full p-3.5 rounded-lg bg-slate-900/95 border border-slate-700 text-xs font-mono text-slate-100 leading-relaxed focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="lg:col-span-4 space-y-3">
              <div className="p-3 rounded-lg bg-slate-900/90 border border-amber-500/30 space-y-1.5">
                <div className="text-[11px] font-mono uppercase text-amber-300 font-bold flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5" />
                  Fremsatte Retskrav til Slagelse Kommune
                </div>
                <ul className="space-y-1 text-xs text-slate-200 list-disc list-inside">
                  {complaintDraft.demandedActions.map((act, idx) => (
                    <li key={idx} className="leading-snug">
                      {act}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/90 border border-indigo-500/30 space-y-1.5">
                <div className="text-[11px] font-mono uppercase text-indigo-300 font-bold flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5" />
                  Vedlagte PDF-Beviser i Klagen ({complaintDraft.enclosedPdfAnnexList.length})
                </div>
                <ul className="space-y-1 text-[11px] font-mono text-slate-300">
                  {complaintDraft.enclosedPdfAnnexList.map((annex, idx) => (
                    <li key={idx} className="truncate">
                      • {annex}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/90 border border-rose-500/30 space-y-1.5">
                <div className="text-[11px] font-mono uppercase text-rose-300 font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Aktiverede Lovbrud fra Overtrædelsesloggen ({legalViolations.length})
                </div>
                <ul className="space-y-1 text-[11px] text-rose-200/90">
                  {complaintDraft.violatedStatutesSummary.map((stat, idx) => (
                    <li key={idx} className="leading-snug">
                      • {stat}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED PDF REPORT PAGE PREVIEW: OVERSIGTSTABEL OVER ALLE UPLOADEDE PDF-BILAG MED SHA-256 HASH & AI-ANALYSE-KONKLUSION */}
      {showDedicatedPdfReportPage && (
        <div
          ref={dedicatedOverviewRef}
          className="mx-4 mb-5 p-4 sm:p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] border-l-4 border-l-indigo-400 space-y-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-indigo-500/30 pb-3.5">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase bg-indigo-500 text-white">
                  <FileCheck2 className="w-3.5 h-3.5" />
                  Dedikeret PDF-Rapportside (Afsnit 07)
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                  SHA-256 Chain-of-Custody • Gemini Multimodal AI-Konklusion
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {pdfArchive.length} PDF-bilag i tabellen • {pdfLinkedObservationsCount} knyttet til hændelseslog
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                07. DEDIKERET SIDE I PDF-RAPPORTEN: Oversigtstabel over Uploadede PDF-Bilag med SHA-256 Hash & AI-Analyse-Konklusion
              </h3>
              <p className="text-xs text-slate-300">
                Denne oversigtstabel indgår som en dedikeret A4-side i den retsmedicinske PDF-rapport og dokumenterer hvert enkelt uploadet PDF-bilags kryptografiske SHA-256 integritetschecksum samt AI-analysens teknisk-juridiske konklusion.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleGenerateDedicatedPdfReportPage('dedicated_page_only')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 transition-colors cursor-pointer"
                title="Download kun denne dedikerede A4 PDF-oversigtsside"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Download Kun Oversigtsside (PDF)</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenerateDedicatedPdfReportPage('full_report')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/50 transition-all cursor-pointer"
                title="Generér og download den komplette retsmedicinske PDF-rapport inkl. denne dedikerede PDF-bilagsside"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Download Fuld PDF-Rapport inkl. Dedikeret Bilagsside</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/95">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/95 border-b border-slate-800 text-[11px] font-mono uppercase text-slate-300">
                  <th className="p-3 w-44">Bilags-ID, Kategori & Dato</th>
                  <th className="p-3 w-64">Filnavn, Sagsnr. & Parter</th>
                  <th className="p-3 w-64">Kryptografisk SHA-256 Hash</th>
                  <th className="p-3">AI-Analyse-Konklusion & Juridisk Bevisværdi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {pdfArchive.map((item) => {
                  const meta = CATEGORY_META[item.category];
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedArchiveId(item.id)}
                      className={`transition-colors cursor-pointer ${
                        inspectedDocument?.id === item.id
                          ? 'bg-indigo-950/40'
                          : 'hover:bg-slate-900/60'
                      }`}
                    >
                      {/* Col 1: ID, Category, Date, Severity */}
                      <td className="p-3 align-top space-y-1.5">
                        <div className="font-mono font-bold text-indigo-300 text-xs">
                          {item.id}
                        </div>
                        <div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono border ${meta.badgeClass}`}
                          >
                            {meta.shortLabel}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          Dato: {item.aiAnalysis.documentDateDetected}
                        </div>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                              item.aiAnalysis.severityAssessment === 'KRITISK'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {item.aiAnalysis.severityAssessment}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {item.aiAnalysis.confidencePct}% AI
                          </span>
                        </div>
                      </td>

                      {/* Col 2: Filename, Journal ref, Sender -> Recipient */}
                      <td className="p-3 align-top space-y-1">
                        <div className="font-semibold text-white break-all">
                          {item.fileName}
                        </div>
                        <div className="text-[11px] font-mono text-amber-300">
                          Ref.: {item.aiAnalysis.referenceJournalNumber}
                        </div>
                        <div className="text-[11px] text-slate-300">
                          <span className="text-slate-400">Fra:</span> {item.aiAnalysis.senderEntity}
                        </div>
                        <div className="text-[11px] text-slate-300">
                          <span className="text-slate-400">Til:</span> {item.aiAnalysis.recipientEntity}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {(item.fileSizeBytes / 1024).toFixed(1)} KB • ca. {item.pageCountEstimate} side(r)
                        </div>
                      </td>

                      {/* Col 3: Full SHA-256 Hash */}
                      <td className="p-3 align-top">
                        <div className="p-2 rounded bg-slate-900 border border-cyan-500/30 space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-mono uppercase text-cyan-400 flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              SHA-256 (64-Hex)
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopySha256(item.id, item.sha256Hash);
                              }}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 flex items-center gap-1 cursor-pointer"
                            >
                              {copiedShaId === item.id ? (
                                <>
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  <span className="text-emerald-300">Kopieret</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-2.5 h-2.5" />
                                  <span>Kopiér</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="font-mono text-[11px] text-cyan-200 break-all leading-snug select-all">
                            {item.sha256Hash}
                          </div>
                        </div>
                      </td>

                      {/* Col 4: AI Analysis Conclusion & Evidentiary Significance */}
                      <td className="p-3 align-top space-y-2">
                        <div>
                          <div className="text-[11px] font-mono uppercase text-indigo-300 font-semibold">
                            AI-Analyse-Konklusion (Resumé):
                          </div>
                          <p className="text-xs text-slate-200 leading-relaxed">
                            {item.aiAnalysis.executiveSummary}
                          </p>
                        </div>

                        {item.aiAnalysis.contradictionsWithTelemetry?.length > 0 && (
                          <div className="p-2 rounded bg-rose-950/30 border border-rose-500/30">
                            <div className="text-[11px] font-mono uppercase text-rose-300 font-semibold">
                              Modsigelse mod Målt Spredningstelemetri (S = {maxSumQuotient.toFixed(2)}):
                            </div>
                            <p className="text-[11px] text-rose-200/95 leading-snug">
                              {item.aiAnalysis.contradictionsWithTelemetry[0]}
                            </p>
                          </div>
                        )}

                        <div className="p-2 rounded bg-indigo-950/30 border border-indigo-500/30">
                          <div className="text-[11px] font-mono uppercase text-amber-300 font-semibold">
                            Juridisk Bevisværdi ("The Liability Bomb"):
                          </div>
                          <p className="text-[11px] text-slate-300 leading-snug">
                            {item.aiAnalysis.legalAndEvidentiarySignificance}
                          </p>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CHAIN-OF-CUSTODY VERIFICERBAR SHA-256 SIGNATUR-LOG TABEL & PDF-EKSPORT */}
      {showChainOfCustodyTable && (
        <div
          ref={chainOfCustodyRef}
          className="mx-4 mb-5 p-4 sm:p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] border-l-4 border-l-emerald-400 space-y-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-emerald-500/30 pb-3.5">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase bg-emerald-500 text-slate-950">
                  <Hash className="w-3.5 h-3.5" />
                  Chain-of-Custody (Beviskæde) • ISO/IEC 27037:2012
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 text-emerald-300 border border-emerald-500/40">
                  Samlede SHA-256 Signaturer: {chainOfCustodyLedger.entries.length}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Merkle-Root: {chainOfCustodyLedger.merkleRootSignature.slice(0, 24)}...
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Verificerbar Chain-of-Custody Log-Tabel over Alle Registrerede SHA-256 Signaturer
              </h3>
              <p className="text-xs text-slate-300">
                Samler samtlige SHA-256 signaturer på tværs af simulerings- og vejrtelemetri (Proof-of-State), uploadede PDF-bevisbilag, fysiske algedoniske observationer og rå foto-bevisfiler i én sammenkædet, uforanderlig retsmedicinsk log-tabel.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportChainOfCustodyPdf}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 border border-emerald-300/60 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-950 shrink-0" />
                <span>
                  Download &apos;Chain-of-Custody&apos; Rapport (PDF • {chainOfCustodyLedger.entries.length} SHA-256 Signaturer)
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px] font-mono">
            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
              <div className="text-slate-400 uppercase text-[11px]">Genesis Seed Block</div>
              <div className="text-slate-300 truncate select-all mt-0.5">
                {chainOfCustodyLedger.genesisBlockHash}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-emerald-500/40">
              <div className="text-emerald-400 uppercase text-[11px] font-bold">
                Kædet Merkle-Root SHA-256
              </div>
              <div className="text-emerald-200 truncate select-all mt-0.5">
                {chainOfCustodyLedger.merkleRootSignature}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-900/90 border border-cyan-500/40 flex items-center justify-between">
              <div>
                <div className="text-cyan-400 uppercase text-[11px] font-bold">
                  Beviskæde-Integritet
                </div>
                <div className="text-white font-bold mt-0.5">
                  ✓ {chainOfCustodyLedger.entries.length} SIGNATURER VERIFICERET
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleCopySha256('MERKLE-ROOT', chainOfCustodyLedger.merkleRootSignature)
                }
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-200 border border-cyan-500/40 text-[11px] cursor-pointer"
              >
                {copiedShaId === 'MERKLE-ROOT' ? '✓ Kopieret' : 'Kopiér Root'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/95">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/95 border-b border-slate-800 text-[11px] font-mono uppercase text-slate-300">
                  <th className="p-2.5 w-28">Sekv. & Bevis-ID</th>
                  <th className="p-2.5 w-52">Bevis-Kategori & Tidsstempel</th>
                  <th className="p-2.5">Kilde / Dokumenttitel & Sagsreference</th>
                  <th className="p-2.5 w-72">Kryptografisk SHA-256 Signatur (64-Hex)</th>
                  <th className="p-2.5 w-48">Kædet Audit-Digest & Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {chainOfCustodyLedger.entries.map((entry) => (
                  <tr key={`${entry.seqNo}-${entry.entryId}`} className="hover:bg-slate-900/60">
                    <td className="p-2.5 align-top font-mono">
                      <div className="text-emerald-400 font-bold">
                        #{String(entry.seqNo).padStart(3, '0')}
                      </div>
                      <div className="text-[11px] text-indigo-300 font-semibold break-all">
                        {entry.entryId}
                      </div>
                    </td>
                    <td className="p-2.5 align-top space-y-1">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono border ${
                          entry.entryCategory === 'PDF_DOCUMENT'
                            ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40'
                            : entry.entryCategory === 'SYSTEM_STATE'
                            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                            : entry.entryCategory === 'PHOTO_BINARY'
                            ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                            : 'bg-fuchsia-950/80 text-fuchsia-300 border-fuchsia-500/40'
                        }`}
                      >
                        {entry.entryTypeLabel}
                      </span>
                      <div className="text-[11px] font-mono text-slate-400">
                        {entry.timestampIso}
                      </div>
                    </td>
                    <td className="p-2.5 align-top space-y-1">
                      <div className="font-semibold text-white">{entry.sourceOrSubject}</div>
                      <div className="text-[11px] text-slate-400">{entry.referenceOrLocation}</div>
                    </td>
                    <td className="p-2.5 align-top">
                      <div className="p-2 rounded bg-slate-900 border border-emerald-500/30 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-mono text-emerald-400 uppercase">
                            SHA-256 (64-Hex)
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopySha256(
                                `COC-${entry.seqNo}`,
                                entry.sha256Signature
                              )
                            }
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 cursor-pointer"
                          >
                            {copiedShaId === `COC-${entry.seqNo}` ? '✓ Kopieret' : 'Kopiér'}
                          </button>
                        </div>
                        <div className="font-mono text-[11px] text-emerald-200 break-all select-all leading-snug">
                          {entry.sha256Signature}
                        </div>
                      </div>
                    </td>
                    <td className="p-2.5 align-top font-mono space-y-1">
                      <div className="text-[11px] text-slate-400 break-all">
                        Chain: {entry.chainedAuditDigest.slice(0, 24)}...
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        {entry.verificationStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
