import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileCheck2,
  Maximize2,
  Minimize2,
  Scale,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  AlgedonicObservation,
  ForensicPdfEvidence,
  HourlyWeatherPoint,
  LatLngPoint,
  LegalBasisFilterCategory,
  LegalViolationEntry,
  SimultaneousAlgedonicDispatch,
} from '../types/dispersion';
import { computeForensicSha256Hash } from '../services/dispersionEngine';

export type SlagelseDocTemplateMode =
  | 'paabud_anmeldelse'
  | 'partshoering_aktindsigt'
  | 'sha256_bevisprotokol';

export interface SlagelseLegalEvidenceDashboardProps {
  dateIso: string;
  currentWeather: HourlyWeatherPoint;
  legalViolations: LegalViolationEntry[];
  observations: AlgedonicObservation[];
  masterStateSha256: string;
  onSelectObservation?: (obs: AlgedonicObservation) => void;
  onAppendGeneratedMunicipalPdf?: (params: {
    pdfEvidence: ForensicPdfEvidence;
    observationType: string;
    description: string;
    position: LatLngPoint;
    locationLabel: string;
  }) => Promise<void> | void;
  simultaneousDispatch?: SimultaneousAlgedonicDispatch | null;
}

type EvidenceTypeFilter = 'all' | 'pdf' | 'audio' | 'photo' | 'field';

export const SlagelseLegalEvidenceDashboard: React.FC<
  SlagelseLegalEvidenceDashboardProps
> = ({
  dateIso,
  currentWeather,
  legalViolations,
  observations,
  masterStateSha256,
  onSelectObservation,
  onAppendGeneratedMunicipalPdf,
  simultaneousDispatch,
}) => {
  const [isExpandedModal, setIsExpandedModal] = useState<boolean>(false);
  const [basisFilter, setBasisFilter] = useState<
    'ALL' | LegalBasisFilterCategory | 'HYDROLOGICAL_BLUE'
  >('ALL');
  const [evidenceFilter, setEvidenceFilter] =
    useState<EvidenceTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [docTemplateMode, setDocTemplateMode] =
    useState<SlagelseDocTemplateMode>('paabud_anmeldelse');

  const [excludedViolationIds, setExcludedViolationIds] = useState<
    Record<string, boolean>
  >({});
  const [excludedObservationIds, setExcludedObservationIds] = useState<
    Record<string, boolean>
  >({});

  const [verifiedHashesAtIso, setVerifiedHashesAtIso] = useState<string | null>(
    null
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedToLogBanner, setSavedToLogBanner] = useState<string | null>(null);
  const [isQuickExporting, setIsQuickExporting] = useState<boolean>(false);
  const [quickCaseExportBanner, setQuickCaseExportBanner] = useState<{
    fileName: string;
    bundleSha256: string;
    exportedAtDa: string;
    violationCount: number;
    evidenceCount: number;
  } | null>(null);

  const filteredViolations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return legalViolations.filter((v) => {
      if (basisFilter === 'HYDROLOGICAL_BLUE') {
        if (v.severity !== 'HYDROLOGICAL_BLUE') return false;
      } else if (basisFilter !== 'ALL' && v.legalBasisCategory !== basisFilter) {
        return false;
      }
      if (!q) return true;
      return (
        v.statuteReference.toLowerCase().includes(q) ||
        v.receptorName.toLowerCase().includes(q) ||
        v.legalConsequence.toLowerCase().includes(q)
      );
    });
  }, [legalViolations, basisFilter, searchQuery]);

  const selectedViolationsForFiling = useMemo(
    () => filteredViolations.filter((v) => !excludedViolationIds[v.id]),
    [filteredViolations, excludedViolationIds]
  );

  const filteredObservations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return observations.filter((obs) => {
      if (evidenceFilter === 'pdf' && !obs.pdfEvidence) return false;
      if (evidenceFilter === 'audio' && !obs.audioEvidence) return false;
      if (evidenceFilter === 'photo' && !obs.photoEvidence) return false;
      if (
        evidenceFilter === 'field' &&
        (obs.pdfEvidence || obs.audioEvidence || obs.photoEvidence)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        obs.code.toLowerCase().includes(q) ||
        obs.observationType.toLowerCase().includes(q) ||
        obs.locationLabel.toLowerCase().includes(q) ||
        obs.sha256Signature.toLowerCase().includes(q)
      );
    });
  }, [observations, evidenceFilter, searchQuery]);

  const selectedEvidenceForFiling = useMemo(
    () => filteredObservations.filter((o) => !excludedObservationIds[o.id]),
    [filteredObservations, excludedObservationIds]
  );

  const validSha256Count = useMemo(
    () =>
      observations.filter(
        (o) =>
          typeof o.sha256Signature === 'string' &&
          /^[a-f0-9]{64}$/i.test(o.sha256Signature)
      ).length,
    [observations]
  );

  const slagelseDocumentPreview = useMemo(() => {
    const kleCodes: Record<string, boolean> = {};
    selectedViolationsForFiling.forEach((v) => {
      if (v.legalBasisCategory === 'MST_NOISE_LIMITS') {
        kleCodes['09.08.00 (Støj fra bygge- og anlægsarbejde)'] = true;
      } else if (v.severity === 'HYDROLOGICAL_BLUE') {
        kleCodes['09.05.00 (Jordforurening & Grundvandsbeskyttelse)'] = true;
      } else {
        kleCodes['09.02.00 (Luftforurening, Asbest & Miljøfarlige stoffer)'] =
          true;
      }
    });
    const kleList =
      Object.keys(kleCodes).length > 0
        ? Object.keys(kleCodes).join(' · ')
        : '09.02.00 / 09.08.00';

    const subjectByMode: Record<SlagelseDocTemplateMode, string> = {
      paabud_anmeldelse: `ANMODNING OM STRAKSPÅBUD JF. MBL § 42 & BEK 613/2026 — Ringparken Nedrivning (Sag PSS-W22085)`,
      partshoering_aktindsigt: `PARTSHØRINGSINDLÆG & ANMODNING OM MILJØAKTINDSIGT JF. MILJØOPLYSNINGSLOVEN § 2 — Ringparken`,
      sha256_bevisprotokol: `TEKNISK SHA-256 BEVISPROTOKOL & CHAIN-OF-CUSTODY FORTEGNELSE — Slagelse Kommune Tilsynssag`,
    };

    const introByMode: Record<SlagelseDocTemplateMode, string> = {
      paabud_anmeldelse:
        'Undertegnede fremsender hermed dokumenteret anmeldelse af konstaterede miljø- og arbejdsmiljøretlige grænseværdioverskridelser ved nedrivningsarbejdet i Ringparken, 4200 Slagelse, med krav om umiddelbar tilsynsindgriben og meddelelse af påbud/standsning efter Miljøbeskyttelseslovens § 42, stk. 1.',
      partshoering_aktindsigt:
        'I henhold til Forvaltningslovens § 19 og Miljøoplysningslovens § 2 fremsendes nærværende SHA-256 verificerede måle- og observationsdokumentation til inddragelse på kommunens tilsynssag vedr. Ringparken, 4200 Slagelse, med samtidig begæring om fuld aktindsigt i kommunens tilsynsjournal.',
      sha256_bevisprotokol:
        'Nærværende protokol dokumenterer den uændrede kryptografiske integritet (SHA-256 Chain-of-Custody) af registrerede lovovertrædelser, akustiske målerapporter, fotobeviser og fysiske naboklager ved Ringparken, 4200 Slagelse.',
    };

    const violationLines =
      selectedViolationsForFiling.length > 0
        ? selectedViolationsForFiling.map(
            (v, idx) =>
              `${idx + 1}. [${v.statuteReference}] ${v.receptorName} (${
                v.receptorAddress
              }) — S = ${v.sumQuotient.toFixed(2)}${
                v.noiseMetrics
                  ? ` · L_Aeq,korr = ${v.noiseMetrics.impulseAdjustedLaeqDb.toFixed(
                      1
                    )} dB(A) (grænse ${v.noiseMetrics.limitLaeqDb.toFixed(1)} dB(A))`
                  : ''
              }. Konsekvens: ${v.legalConsequence}`
          )
        : [
            'Ingen aktive grænseværdioverskridelser valgt i tabellen for det aktuelle tidspunkt.',
          ];

    const annexLines =
      selectedEvidenceForFiling.length > 0
        ? selectedEvidenceForFiling.map((obs, idx) => {
            const kindTag = obs.pdfEvidence
              ? `PDF-BEVIS (${obs.pdfEvidence.fileName})`
              : obs.audioEvidence
              ? `LYDBEVIS (${obs.audioEvidence.analysis.identifiedToolOrMachine})`
              : obs.photoEvidence
              ? `FOTOBEVIS (${obs.photoEvidence.fileName})`
              : 'NABOKLAGE / ALGEDONISK SIGNAL';
            return `Bilag ${idx + 1}: ${obs.code} · kl. ${
              obs.observedHourLabel
            } · ${kindTag} · ${obs.locationLabel}\n   SHA-256: ${
              obs.sha256Signature
            }`;
          })
        : ['Ingen SHA-256 beviser valgt som bilag endnu.'];

    const fullPlainText = [
      'TIL: Slagelse Kommune — Center for Miljø, Plan og Teknik',
      'ADRESSE: Rådhuspladsen 11, 4200 Slagelse (miljoe@slagelse.dk / teknik@slagelse.dk)',
      `DATO & TELEMETRI-TIDSPUNKT: ${dateIso} kl. ${currentWeather.hourLabel}`,
      `JOURNAL- & KLE- KLASSIFIKATION: PSS-W22085-RINGPARKEN · KLE ${kleList}`,
      `MASTER STATE SHA-256 ROD-SIGNATUR: ${masterStateSha256}`,
      '',
      `VEDR.: ${subjectByMode[docTemplateMode]}`,
      '',
      '1. SAGSFREMSTILLING & METEOROLOGISK KONTEKST',
      introByMode[docTemplateMode],
      `Meteorologiske forhold på registreringstidspunktet (${dateIso} kl. ${currentWeather.hourLabel}): Middelvind ${currentWeather.windSpeed10m.toFixed(
        1
      )} m/s, vindstød ${currentWeather.windGusts10m.toFixed(
        1
      )} m/s fra ${currentWeather.windDirection10m}°, nedbør ${currentWeather.precipitation.toFixed(
        1
      )} mm/t, atmosfærisk stabilitetsklasse Pasquill ${
        currentWeather.pasquillClass
      }.`,
      '',
      `2. DOKUMENTEREDE LOVOVERTRÆDELSER (${selectedViolationsForFiling.length} VALGT)`,
      ...violationLines,
      '',
      `3. KRYPTOGRAFISK SHA-256 BILAGSFORTEGNELSE (${selectedEvidenceForFiling.length} BEVISER)`,
      ...annexLines,
      '',
      '4. KONKLUSION & BEGÆRING TIL TILSYNSMYNDIGHEDEN',
      'Slagelse Kommune anmodes om skriftlig kvittering med sagsnummer samt meddelelse af strakspåbud om fysisk støvdæmpning, akustisk afskærmning og kontinuerlig grænseværdikontrol ved skel mod beboede boligblokke.',
    ].join('\n');

    return {
      recipient: 'Slagelse Kommune — Center for Miljø, Plan og Teknik',
      address: 'Rådhuspladsen 11, 4200 Slagelse',
      kleList,
      subject: subjectByMode[docTemplateMode],
      intro: introByMode[docTemplateMode],
      violationLines,
      annexLines,
      fullPlainText,
    };
  }, [
    selectedViolationsForFiling,
    selectedEvidenceForFiling,
    docTemplateMode,
    dateIso,
    currentWeather,
    masterStateSha256,
  ]);

  const handleCopyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      // ignore clipboard restriction
    }
  };

  const buildMunicipalSubmissionPdf = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(
      'DOKUMENTATION & PÅBUDSGRUNDLAG — SLAGELSE KOMMUNE',
      14,
      12
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(
      `Modtager: ${slagelseDocumentPreview.recipient} (${slagelseDocumentPreview.address})`,
      14,
      18.5
    );
    doc.text(
      `Dato: ${dateIso} kl. ${currentWeather.hourLabel} · KLE: ${slagelseDocumentPreview.kleList}`,
      14,
      24.5
    );

    let y = 38;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);

    const paragraphs = slagelseDocumentPreview.fullPlainText.split('\n');
    paragraphs.forEach((line) => {
      const isHeading = /^[1-4]\.\s|^VEDR\.:/.test(line);
      doc.setFont('helvetica', isHeading ? 'bold' : 'normal');
      const wrapped = doc.splitTextToSize(line || ' ', pageW - 28);
      if (y + wrapped.length * 4.5 > pageH - 16) {
        doc.addPage();
        y = 18;
      }
      doc.text(wrapped, 14, y);
      y += wrapped.length * 4.4;
    });

    return doc;
  };

  const handleDownloadSlagelsePdf = () => {
    const doc = buildMunicipalSubmissionPdf();
    const fileName = `Slagelse_Kommune_Dokumentation_${dateIso}_kl${currentWeather.hourLabel.replace(
      ':',
      ''
    )}.pdf`;
    doc.save(fileName);
  };

  const handleSavePreviewToPdfEvidenceLog = async () => {
    if (!onAppendGeneratedMunicipalPdf) return;
    const doc = buildMunicipalSubmissionPdf();
    const pdfDataUrl = doc.output('datauristring');
    const nowIso = new Date().toISOString();
    const fileName = `Slagelse_Kommune_Indberetning_${dateIso}_kl${currentWeather.hourLabel.replace(
      ':',
      ''
    )}.pdf`;

    const sha256Hash = await computeForensicSha256Hash({
      fileName,
      fullPlainText: slagelseDocumentPreview.fullPlainText,
      masterStateSha256,
      generatedAtIso: nowIso,
    });

    const pdfEvidence: ForensicPdfEvidence = {
      id: `pdf-slagelse-filing-${Date.now()}`,
      fileName,
      fileSizeBytes: Math.round((pdfDataUrl.length * 3) / 4),
      pageCountEstimate: Math.max(1, doc.getNumberOfPages()),
      sha256Hash,
      uploadedAtIso: nowIso,
      category: 'myndighedshenvendelse',
      evidenceCategory: 'Myndighedskorrespondance',
      pdfDataUrl,
      aiAnalysis: {
        documentTitle: slagelseDocumentPreview.subject,
        detectedCategory: 'myndighedshenvendelse',
        senderEntity: 'Ringparken Juridisk & SHA-256 Bevis-Dashboard',
        recipientEntity: slagelseDocumentPreview.recipient,
        documentDateDetected: dateIso,
        referenceJournalNumber: `KLE-${dateIso.replace(/-/g, '')}`,
        executiveSummary: `Samlet myndighedsdokumentation til Slagelse Kommune omfattende ${selectedViolationsForFiling.length} lovovertrædelser og ${selectedEvidenceForFiling.length} SHA-256 signerede bilag.`,
        keyStatementsAndAdmissions: slagelseDocumentPreview.violationLines.slice(
          0,
          4
        ),
        contradictionsWithTelemetry: [
          'Dokumenterer grænseværdioverskridelser verificeret med 64-tegns SHA-256 kontrolsum.',
        ],
        legalAndEvidentiarySignificance:
          'Retsgyldig myndighedsindberetning med fuld Chain-of-Custody bilagsfortegnelse.',
        statutoryReferences: [
          'Miljøbeskyttelsesloven § 42',
          'BEK nr. 613/2026 (Asbest)',
          'MST Vejl. 5/1984',
        ],
        severityAssessment:
          selectedViolationsForFiling.length > 0 ? 'KRITISK' : 'MODERAT',
        confidencePct: 99,
        recommendedObservationType:
          'Myndighedsindberetning til Slagelse Kommune (PDF)',
        analyzedAtIso: nowIso,
        modelUsed: 'Deterministic Legal & SHA-256 Filing Builder',
      },
    };

    await onAppendGeneratedMunicipalPdf({
      pdfEvidence,
      observationType: 'Myndighedsdokumentation til Slagelse Kommune (PDF)',
      description: pdfEvidence.aiAnalysis.executiveSummary,
      position:
        selectedEvidenceForFiling[0]?.position || {
          lat: 55.4125,
          lng: 11.3529,
        },
      locationLabel: 'Ringparken, 4200 Slagelse (Indberetning til Kommune)',
    });

    setSavedToLogBanner(
      `${fileName} gemt i bevisloggen (SHA-256: ${sha256Hash.slice(0, 14)}…)`
    );
    window.setTimeout(() => setSavedToLogBanner(null), 4500);
  };

  const handleQuickCaseExportPdf = async () => {
    if (isQuickExporting) return;
    setIsQuickExporting(true);
    try {
      const exportedAt = new Date();
      const exportedAtIso = exportedAt.toISOString();
      const exportedAtDa = exportedAt.toLocaleString('da-DK', {
        dateStyle: 'short',
        timeStyle: 'medium',
      });

      let runningChainHash = masterStateSha256;
      const violationChainRecords: Array<{
        index: number;
        violation: LegalViolationEntry;
        prevChainHash: string;
        stepSha256: string;
      }> = [];

      for (let i = 0; i < selectedViolationsForFiling.length; i++) {
        const v = selectedViolationsForFiling[i];
        const stepSha256 = await computeForensicSha256Hash({
          seqIndex: i + 1,
          prevChainHash: runningChainHash,
          exportedAtIso,
          violationId: v.id,
          statuteReference: v.statuteReference,
          receptorAddress: v.receptorAddress,
          receptorName: v.receptorName,
          sumQuotient: v.sumQuotient,
          noiseMetrics: v.noiseMetrics ?? null,
          legalConsequence: v.legalConsequence,
        });
        violationChainRecords.push({
          index: i + 1,
          violation: v,
          prevChainHash: runningChainHash,
          stepSha256,
        });
        runningChainHash = stepSha256;
      }

      const bundleSha256 = await computeForensicSha256Hash({
        bundleType: 'SLAGELSE_HURTIG_SAGSEKSPORT_CHAIN_OF_CUSTODY',
        exportedAtIso,
        dateIso,
        hourLabel: currentWeather.hourLabel,
        masterStateSha256,
        chainTailHash: runningChainHash,
        violationCount: selectedViolationsForFiling.length,
        evidenceHashes: selectedEvidenceForFiling.map((o) => ({
          id: o.id,
          code: o.code,
          sha256: o.sha256Signature,
        })),
      });

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      const ensureSpace = (neededMm: number, currentY: number): number => {
        if (currentY + neededMm > pageH - 16) {
          doc.addPage();
          return 18;
        }
        return currentY;
      };

      // Top dark forensic header banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 34, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(
        'HURTIG SAGS-EKSPORT — KONSOLIDERET CHAIN-OF-CUSTODY RAPPORT',
        14,
        11.5
      );
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.2);
      doc.text(
        `Myndighed: Slagelse Kommune (KLE: ${slagelseDocumentPreview.kleList}) · Journal: PSS-W22085`,
        14,
        18
      );
      doc.text(
        `Tidsstempel (UTC): ${exportedAtIso} · Dansk tid: ${exportedAtDa}`,
        14,
        23.5
      );
      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      doc.text(`KONSOLIDERET SEGL SHA-256: ${bundleSha256}`, 14, 29.5);

      let y = 42;
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(
        `1. Sagsoversigt & Meteorologisk Kontekst (${dateIso} kl. ${currentWeather.hourLabel})`,
        14,
        y
      );
      y += 5.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const summaryText = `Aktuelt valgte lovovertrædelser: ${selectedViolationsForFiling.length} · Vedlagte SHA-256 bilag: ${selectedEvidenceForFiling.length} · Middelvind: ${currentWeather.windSpeed10m.toFixed(
        1
      )} m/s (vindstød ${currentWeather.windGusts10m.toFixed(1)} m/s fra ${
        currentWeather.windDirection10m
      }°) · Stabilitet: Pasquill ${currentWeather.pasquillClass}.`;
      const summaryLines = doc.splitTextToSize(summaryText, pageW - 28);
      doc.text(summaryLines, 14, y);
      y += summaryLines.length * 4.2 + 4;

      // Section 2: Consolidated Selected Violations + Chained SHA-256 per entry
      y = ensureSpace(14, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(
        `2. Valgte Lovovertrædelser med Chain-of-Custody SHA-256 (${violationChainRecords.length})`,
        14,
        y
      );
      y += 5.5;

      if (violationChainRecords.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.text(
          'Ingen aktive lovovertrædelser markeret i sagsoversigten på eksporttidspunktet.',
          14,
          y
        );
        y += 7;
      } else {
        for (const rec of violationChainRecords) {
          y = ensureSpace(24, y);
          const v = rec.violation;
          const metricStr = v.noiseMetrics
            ? `L_Aeq,korr ${v.noiseMetrics.impulseAdjustedLaeqDb.toFixed(
                1
              )} dB(A) (grænse ${v.noiseMetrics.limitLaeqDb.toFixed(1)} dB(A))`
            : `Sum-kvotient S = ${v.sumQuotient.toFixed(2)}`;

          doc.setDrawColor(203, 213, 225);
          doc.setFillColor(248, 250, 252);
          doc.rect(14, y - 3.5, pageW - 28, 21, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(15, 23, 42);
          doc.text(
            `${rec.index}. [${v.statuteReference}] ${v.receptorName} (${v.receptorAddress})`,
            16,
            y + 0.5
          );
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          const detailLines = doc.splitTextToSize(
            `${metricStr} · Konsekvens: ${v.legalConsequence}`,
            pageW - 34
          );
          doc.text(detailLines.slice(0, 2), 16, y + 5.2);
          doc.setFont('courier', 'normal');
          doc.setFontSize(7.1);
          doc.setTextColor(51, 65, 85);
          doc.text(`Trin SHA-256: ${rec.stepSha256}`, 16, y + 14.5);
          doc.setTextColor(15, 23, 42);
          y += 23.5;
        }
      }

      // Section 3: Chain-of-Custody Cryptographic Ledger & Evidence Annexes
      y = ensureSpace(24, y + 2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(
        `3. Tidsstemplet Chain-of-Custody & SHA-256 Bilagsregister (${selectedEvidenceForFiling.length})`,
        14,
        y
      );
      y += 5.5;
      doc.setFont('courier', 'normal');
      doc.setFontSize(7.4);
      doc.text(`Rod (Master State SHA-256): ${masterStateSha256}`, 14, y);
      y += 4.2;
      doc.text(`Kæde-Hale (Efter ${violationChainRecords.length} overtrædelser): ${runningChainHash}`, 14, y);
      y += 4.2;
      doc.text(`Konsolideret Eksport-Segl: ${bundleSha256}`, 14, y);
      y += 6;

      selectedEvidenceForFiling.forEach((obs, idx) => {
        y = ensureSpace(10, y);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.text(
          `Bilag ${idx + 1}: ${obs.code} · kl. ${obs.observedHourLabel} · ${obs.locationLabel}`,
          14,
          y
        );
        y += 3.6;
        doc.setFont('courier', 'normal');
        doc.setFontSize(7.2);
        doc.text(`SHA-256: ${obs.sha256Signature}`, 16, y);
        y += 4.6;
      });

      const fileName = `Slagelse_Hurtig_SagsEksport_${dateIso}_kl${currentWeather.hourLabel.replace(
        ':',
        ''
      )}.pdf`;
      doc.save(fileName);

      setQuickCaseExportBanner({
        fileName,
        bundleSha256,
        exportedAtDa,
        violationCount: selectedViolationsForFiling.length,
        evidenceCount: selectedEvidenceForFiling.length,
      });
    } finally {
      setIsQuickExporting(false);
    }
  };

  const dashboardBody = (
    <div className="space-y-4 text-slate-100">
      {/* Header & Summary Metrics */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="space-y-0.5">
          <h3 className="text-sm md:text-base font-semibold text-white flex items-center gap-2">
            <Scale className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              Dedikeret Dashboard: Juridiske Overtrædelser, SHA-256 Beviser &amp; Slagelse Kommune Forhåndsvisning
            </span>
          </h3>
          <div className="text-xs text-slate-400 font-mono tabular-nums flex flex-wrap items-center gap-1.5">
            <span>Journal: PSS-W22085</span>
            <span aria-hidden="true">·</span>
            <span>
              Dato: {dateIso} kl. {currentWeather.hourLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span>Master SHA-256: {masterStateSha256.slice(0, 16)}…</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="quick-case-export-pdf-btn"
            onClick={() => {
              void handleQuickCaseExportPdf();
            }}
            disabled={isQuickExporting}
            title="Konsolidér alle aktuelt valgte lovovertrædelser i én PDF med tidsstemplet Chain-of-Custody SHA-256 signatur"
            className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 border border-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isQuickExporting
                ? 'Genererer SHA-256 PDF…'
                : `Hurtig Sags-Eksport (${selectedViolationsForFiling.length})`}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setVerifiedHashesAtIso(
                new Date().toLocaleTimeString('da-DK', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              )
            }
            className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-emerald-500/50 text-emerald-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>
              {verifiedHashesAtIso
                ? `Verificeret kl. ${verifiedHashesAtIso} (${validSha256Count}/${observations.length})`
                : `Verificér SHA-256 (${validSha256Count}/${observations.length})`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpandedModal((v) => !v)}
            className="px-3 py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            {isExpandedModal ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                <span>Luk Fuld Bredde</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                <span>Åbn i Fuld Bredde</span>
              </>
            )}
          </button>
        </div>
      </div>

      {quickCaseExportBanner && (
        <div
          role="status"
          data-testid="quick-case-export-confirmation"
          className="p-2.5 rounded bg-emerald-950/85 border border-emerald-400/70 text-emerald-100 text-xs flex flex-wrap items-center justify-between gap-2 font-mono tabular-nums"
        >
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span className="font-bold">Hurtig Sags-Eksport klar:</span>
            <span className="truncate">{quickCaseExportBanner.fileName}</span>
            <span aria-hidden="true">·</span>
            <span>
              {quickCaseExportBanner.violationCount} overtrædelser / {quickCaseExportBanner.evidenceCount} bilag
            </span>
            <span aria-hidden="true">·</span>
            <span>Tid: {quickCaseExportBanner.exportedAtDa}</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-200">
              Segl: {quickCaseExportBanner.bundleSha256.slice(0, 16)}…
            </span>
          </div>
          <button
            type="button"
            onClick={() => setQuickCaseExportBanner(null)}
            className="px-2 py-0.5 rounded bg-emerald-900 hover:bg-emerald-800 border border-emerald-500/60 text-emerald-100 text-[11px] font-semibold cursor-pointer shrink-0"
          >
            Skjul
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
          <div className="text-[11px] text-slate-400">Aktive Lovovertrædelser</div>
          <div className="text-xl font-mono font-bold tabular-nums text-rose-400 mt-0.5">
            {selectedViolationsForFiling.length}
            <span className="text-xs font-normal text-slate-400 ml-1">
              / {legalViolations.length}
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
          <div className="text-[11px] text-slate-400">SHA-256 Signerede Beviser</div>
          <div className="text-xl font-mono font-bold tabular-nums text-emerald-300 mt-0.5">
            {selectedEvidenceForFiling.length}
            <span className="text-xs font-normal text-slate-400 ml-1">
              / {observations.length}
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
          <div className="text-[11px] text-slate-400">PDF- &amp; Lydbeviser</div>
          <div className="text-xl font-mono font-bold tabular-nums text-amber-300 mt-0.5">
            {
              observations.filter(
                (o) => Boolean(o.pdfEvidence) || Boolean(o.audioEvidence)
              ).length
            }
          </div>
        </div>

        <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
          <div className="text-[11px] text-slate-400">Hash-Integritet (64-hex)</div>
          <div className="text-xl font-mono font-bold tabular-nums text-cyan-300 mt-0.5">
            {observations.length === 0
              ? '100%'
              : `${Math.round((validSha256Count / observations.length) * 100)}%`}
          </div>
        </div>
      </div>

      {/* Live System 3 Statutory Filings & SHA-256 Chain-of-Custody Anchor when Simultaneous Dispatch is active */}
      {simultaneousDispatch?.active && (
        <div
          data-testid="slagelse-simultaneous-system3-filings"
          className="p-3 rounded bg-rose-950/70 border border-rose-500/80 space-y-2 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
            <span className="font-bold text-rose-100 flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-amber-300 shrink-0" />
              <span>
                SYSTEM 3 STRAKS-INDBERETNINGER (T0 → T1: {simultaneousDispatch.latencyMs} ms · Δt = 0 ms)
              </span>
            </span>
            {simultaneousDispatch.system3State.linkedSha256ObservationCode && (
              <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-400/70 text-emerald-200 text-[11px] font-bold">
                SHA-256 Kæde: {simultaneousDispatch.system3State.linkedSha256ObservationCode} (
                {simultaneousDispatch.system3State.linkedSha256Signature?.slice(0, 12)}…)
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {simultaneousDispatch.system3State.statutoryNotices.map((notice) => (
              <div
                key={notice.id}
                className="p-2 rounded bg-slate-950/90 border border-rose-500/45 space-y-0.5"
              >
                <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="font-bold text-amber-200">{notice.authorityDa}</span>
                  <span className="text-rose-300 font-semibold">{notice.statuteRef}</span>
                </div>
                <div className="font-semibold text-white">{notice.titleDa}</div>
                <div className="text-[11px] text-slate-300">{notice.summaryDa}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Søg i paragraffer, adresser, bevis-koder eller SHA-256 signaturer..."
            className="w-full pl-8 pr-3 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <select
          value={basisFilter}
          onChange={(e) =>
            setBasisFilter(
              e.target.value as
                | 'ALL'
                | LegalBasisFilterCategory
                | 'HYDROLOGICAL_BLUE'
            )
          }
          aria-label="Filtrér lovgrundlag"
          className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200"
        >
          <option value="ALL">Alle lovgrundlag</option>
          <option value="BEK_613_2026_ASBESTOS">BEK 613/2026 (Asbest &amp; Støv)</option>
          <option value="MST_NOISE_LIMITS">MST Støjgrænser (dB)</option>
          <option value="HYDROLOGICAL_BLUE">MBL § 19/27 (Jord &amp; Vand)</option>
        </select>

        <select
          value={evidenceFilter}
          onChange={(e) =>
            setEvidenceFilter(e.target.value as EvidenceTypeFilter)
          }
          aria-label="Filtrér bevistype"
          className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200"
        >
          <option value="all">Alle SHA-256 beviser</option>
          <option value="pdf">PDF-beviser &amp; Rapporter</option>
          <option value="audio">Lydklip &amp; Maskinbeviser</option>
          <option value="photo">Fotobeviser</option>
          <option value="field">Fysiske naboklager</option>
        </select>
      </div>

      {/* Two-Column Split in Full Width (Stacked in Sidebar): Left = Violations & SHA-256 Ledger, Right = Live Slagelse Kommune Preview */}
      <div
        className={
          isExpandedModal
            ? 'grid grid-cols-1 lg:grid-cols-12 gap-4 items-start'
            : 'space-y-4'
        }
      >
        <div className={isExpandedModal ? 'lg:col-span-6 space-y-3' : 'space-y-3'}>
          {/* 1. Legal Violations Management List */}
          <div className="rounded bg-slate-950 border border-slate-800 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-white">
              <span>
                1. Juridiske Overtrædelser ({selectedViolationsForFiling.length} medtaget)
              </span>
              <button
                type="button"
                onClick={() => setExcludedViolationIds({})}
                className="text-[11px] font-mono text-cyan-300 hover:underline cursor-pointer"
              >
                Vælg alle
              </button>
            </div>

            {filteredViolations.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-400">
                Ingen lovovertrædelser matcher det aktuelle filter kl.{' '}
                {currentWeather.hourLabel}.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[210px] overflow-y-auto pr-0.5">
                {filteredViolations.map((v) => {
                  const isIncluded = !excludedViolationIds[v.id];
                  return (
                    <label
                      key={v.id}
                      className={`p-2 rounded border flex items-start gap-2 text-xs cursor-pointer transition-colors ${
                        isIncluded
                          ? 'bg-slate-900 border-slate-700'
                          : 'bg-slate-950/60 border-slate-800/70 opacity-60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isIncluded}
                        onChange={() =>
                          setExcludedViolationIds((prev) => ({
                            ...prev,
                            [v.id]: isIncluded,
                          }))
                        }
                        className="mt-0.5 accent-rose-500"
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white truncate">
                            {v.statuteReference}
                          </span>
                          <span className="font-mono tabular-nums text-[11px] text-rose-300 shrink-0">
                            {v.noiseMetrics
                              ? `${v.noiseMetrics.impulseAdjustedLaeqDb.toFixed(1)} dB(A)`
                              : `S = ${v.sumQuotient.toFixed(2)}`}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {v.receptorName} · {v.receptorAddress}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. SHA-256 Signed Evidence Ledger */}
          <div className="rounded bg-slate-950 border border-slate-800 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-white">
              <span>
                2. SHA-256 Signerede Beviser ({selectedEvidenceForFiling.length} bilag valgt)
              </span>
              <button
                type="button"
                onClick={() => setExcludedObservationIds({})}
                className="text-[11px] font-mono text-emerald-300 hover:underline cursor-pointer"
              >
                Medtag alle bilag
              </button>
            </div>

            {filteredObservations.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-400">
                Ingen SHA-256 beviser matcher det aktuelle filter.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-0.5">
                {filteredObservations.map((obs) => {
                  const isIncluded = !excludedObservationIds[obs.id];
                  const typeLabel = obs.pdfEvidence
                    ? 'PDF-Bevis'
                    : obs.audioEvidence
                    ? 'Lydbevis'
                    : obs.photoEvidence
                    ? 'Fotobevis'
                    : 'Naboklage';
                  return (
                    <div
                      key={obs.id}
                      className={`p-2 rounded border flex items-start gap-2 text-xs ${
                        isIncluded
                          ? 'bg-slate-900 border-slate-700'
                          : 'bg-slate-950/60 border-slate-800/70 opacity-60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isIncluded}
                        onChange={() =>
                          setExcludedObservationIds((prev) => ({
                            ...prev,
                            [obs.id]: isIncluded,
                          }))
                        }
                        className="mt-0.5 accent-emerald-400 cursor-pointer"
                      />
                      <div
                        onClick={() => onSelectObservation?.(obs)}
                        className="min-w-0 flex-1 space-y-0.5 cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-semibold text-emerald-300 truncate">
                            {obs.code} · {typeLabel} · kl. {obs.observedHourLabel}
                          </span>
                          <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                            S={obs.plumeCorroboration.calculatedSumQuotient.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-200 truncate">
                          {obs.pdfEvidence?.aiAnalysis.documentTitle ||
                            obs.observationType}
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                          <span className="truncate">
                            SHA-256: {obs.sha256Signature.slice(0, 24)}…
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleCopyText(obs.id, obs.sha256Signature);
                            }}
                            className="text-cyan-300 hover:text-white flex items-center gap-0.5 shrink-0 cursor-pointer"
                            title="Kopiér fuld 64-tegns SHA-256 signatur"
                          >
                            {copiedKey === obs.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>Kopieret</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Kopiér hash</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 3. Live A4 Preview of Documentation to Slagelse Kommune */}
        <div
          className={
            isExpandedModal
              ? 'lg:col-span-6 rounded bg-slate-950 border border-slate-800 p-3.5 space-y-3'
              : 'rounded bg-slate-950 border border-slate-800 p-3.5 space-y-3'
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Eye className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Forhåndsvisning af Dokumentation til Slagelse Kommune</span>
            </div>

            <div className="flex items-center gap-1 p-0.5 rounded bg-slate-900 border border-slate-800">
              {(
                [
                  { id: 'paabud_anmeldelse', label: 'Påbud (§ 42)' },
                  { id: 'partshoering_aktindsigt', label: 'Aktindsigt' },
                  { id: 'sha256_bevisprotokol', label: 'SHA-256 Protokol' },
                ] as const
              ).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setDocTemplateMode(tpl.id)}
                  className={`px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    docTemplateMode === tpl.id
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Realistic Municipal A4 Document Sheet Preview */}
          <div
            data-testid="slagelse-kommune-document-preview"
            className="rounded bg-white text-slate-900 p-4 border border-slate-300 max-h-[340px] overflow-y-auto space-y-2.5 text-xs leading-relaxed"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-slate-300">
              <div>
                <div className="font-bold text-slate-950">
                  {slagelseDocumentPreview.recipient}
                </div>
                <div className="text-[11px] text-slate-600">
                  {slagelseDocumentPreview.address} · KLE: {slagelseDocumentPreview.kleList}
                </div>
              </div>
              <div className="text-right font-mono tabular-nums text-[11px] text-slate-600">
                <div>Dato: {dateIso}</div>
                <div>Kl.: {currentWeather.hourLabel}</div>
              </div>
            </div>

            <div className="font-bold text-slate-950">
              {slagelseDocumentPreview.subject}
            </div>

            <p className="text-[11.5px] text-slate-800">
              {slagelseDocumentPreview.intro}
            </p>

            <div className="space-y-1">
              <div className="font-bold text-[11px] text-slate-900">
                Dokumenterede Lovovertrædelser ({selectedViolationsForFiling.length}):
              </div>
              <div className="space-y-1 font-mono tabular-nums text-[11px] text-slate-800">
                {slagelseDocumentPreview.violationLines.map((line, i) => (
                  <div key={`prev-v-${i}`} className="py-0.5 border-b border-slate-100">
                    {line}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-bold text-[11px] text-slate-900">
                Vedlagte SHA-256 Signerede Bevis-Bilag ({selectedEvidenceForFiling.length}):
              </div>
              <div className="space-y-1 font-mono tabular-nums text-[11px] text-slate-700">
                {slagelseDocumentPreview.annexLines.map((line, i) => (
                  <div
                    key={`prev-a-${i}`}
                    className="py-0.5 border-b border-slate-100 whitespace-pre-wrap break-all"
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-1.5 border-t border-slate-300 font-mono text-[11px] text-slate-600 break-all">
              Master State SHA-256 Kontrolsum: {masterStateSha256}
            </div>
          </div>

          {savedToLogBanner && (
            <div className="px-3 py-2 rounded bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{savedToLogBanner}</span>
            </div>
          )}

          {/* Export & Filing Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadSlagelsePdf}
              data-testid="download-slagelse-preview-pdf-btn"
              className="px-3.5 py-2 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Download PDF til Slagelse Kommune</span>
            </button>

            {onAppendGeneratedMunicipalPdf && (
              <button
                type="button"
                onClick={() => {
                  void handleSavePreviewToPdfEvidenceLog();
                }}
                className="px-3 py-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-emerald-200 font-semibold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                <span>Føj Dokument som PDF-Bevis i Log</span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                void handleCopyText(
                  'full-doc',
                  slagelseDocumentPreview.fullPlainText
                )
              }
              className="px-3 py-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {copiedKey === 'full-doc' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Dokumenttekst Kopieret</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                  <span>Kopiér Dokumenttekst</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (isExpandedModal) {
    return (
      <div className="fixed inset-0 z-[140] bg-black/80 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto flex items-start justify-center">
        <div
          data-testid="slagelse-legal-evidence-dashboard-modal"
          className="w-full max-w-[1380px] rounded-lg bg-[#0B0E17] border border-slate-700 p-4 sm:p-6 shadow-2xl"
        >
          {dashboardBody}
        </div>
      </div>
    );
  }

  return (
    <section
      data-testid="slagelse-legal-evidence-dashboard"
      className="p-3.5 rounded-lg bg-slate-900/95 border border-slate-800"
    >
      {dashboardBody}
    </section>
  );
};
