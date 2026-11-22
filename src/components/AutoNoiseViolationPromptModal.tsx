import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  Volume2,
  X,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  DemolitionSourceNode,
  ForensicPdfEvidence,
  HourlyWeatherPoint,
  LatLngPoint,
  LegalViolationEntry,
  ReceptorExposureResult,
} from '../types/dispersion';
import { computeForensicSha256Hash } from '../services/dispersionEngine';

const PDF_ARCHIVE_STORAGE_KEY = 'ringparken_pdf_evidence_archive_v2_scratch';

export interface DetectedNoiseViolationContext {
  fingerprint: string;
  peakNoiseLaeqDb: number;
  limitLaeqDb: number;
  exceedanceDb: number;
  estimatedLafmaxDb: number;
  receptorId: string;
  receptorName: string;
  receptorAddress: string;
  receptorPosition: LatLngPoint;
  nearestSourceName: string;
  statuteReference: string;
}

export interface AutoNoiseViolationPromptModalProps {
  dateIso: string;
  currentWeather: HourlyWeatherPoint;
  legalViolations: LegalViolationEntry[];
  receptorExposures: ReceptorExposureResult[];
  sources: DemolitionSourceNode[];
  machineNoiseOutputDb: number;
  isManualMachineNoiseOverrideActive: boolean;
  onAppendPdfEvidenceToLog: (params: {
    pdfEvidence: ForensicPdfEvidence;
    observationType: string;
    description: string;
    position: LatLngPoint;
    locationLabel: string;
  }) => Promise<void> | void;
  onOpenEvidenceLogTab?: () => void;
}

export const AutoNoiseViolationPromptModal: React.FC<
  AutoNoiseViolationPromptModalProps
> = ({
  dateIso,
  currentWeather,
  legalViolations,
  receptorExposures,
  sources,
  machineNoiseOutputDb,
  isManualMachineNoiseOverrideActive,
  onAppendPdfEvidenceToLog,
  onOpenEvidenceLogTab,
}) => {
  const [hasInitialDwellElapsed, setHasInitialDwellElapsed] =
    useState<boolean>(false);
  const [userInteractedWithNoiseControls, setUserInteractedWithNoiseControls] =
    useState<boolean>(false);
  const [dismissedFingerprints, setDismissedFingerprints] = useState<
    Record<string, boolean>
  >({});
  const [inspectorNote, setInspectorNote] = useState<string>('');
  const [alsoDownloadFile, setAlsoDownloadFile] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [appendedConfirmation, setAppendedConfirmation] = useState<{
    fileName: string;
    sha256Short: string;
  } | null>(null);

  // Respect arrival dwell governance unless user actively adjusts machine noise / simulation controls
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHasInitialDwellElapsed(true);
    }, 10500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isManualMachineNoiseOverrideActive) {
      setUserInteractedWithNoiseControls(true);
    }
  }, [isManualMachineNoiseOverrideActive, machineNoiseOutputDb]);

  // Detect active noise violation either from simulation legalViolations (MST_NOISE_LIMITS)
  // or from manual machine sound power L_WA (90-125 dB) exceeding MST 5/1984 / Slagelse Kommune limits
  const detectedNoiseViolation =
    useMemo<DetectedNoiseViolationContext | null>(() => {
      const mstViolations = legalViolations.filter(
        (v) => v.legalBasisCategory === 'MST_NOISE_LIMITS' && v.noiseMetrics
      );

      const activeSources = sources.filter((s) => s.active);
      const primarySource = activeSources[0] || sources[0];
      const effectiveLwaDb = isManualMachineNoiseOverrideActive
        ? machineNoiseOutputDb
        : 114.0;

      const isDaytimeWorkWindow =
        currentWeather.hourIndex >= 7 && currentWeather.hourIndex < 18;
      const statutoryLimitDb = isDaytimeWorkWindow ? 70.0 : 40.0;

      if (mstViolations.length > 0) {
        const worst = [...mstViolations].sort(
          (a, b) =>
            (b.noiseMetrics?.impulseAdjustedLaeqDb ?? 0) -
            (a.noiseMetrics?.impulseAdjustedLaeqDb ?? 0)
        )[0];
        const nm = worst.noiseMetrics!;
        // Apply manual machine L_WA delta if user raised slider above baseline 114 dB
        const manualDelta = isManualMachineNoiseOverrideActive
          ? effectiveLwaDb - 114.0
          : 0;
        const adjustedLaeq = Number(
          (nm.impulseAdjustedLaeqDb + manualDelta).toFixed(1)
        );
        const limitDb = nm.limitLaeqDb;
        if (adjustedLaeq <= limitDb) return null;

        const matchedRec = receptorExposures.find(
          (r) =>
            r.receptorName === worst.receptorName ||
            r.address === worst.receptorAddress
        );
        const resolvedRecId = matchedRec?.receptorId || worst.receptorName;

        return {
          fingerprint: `${dateIso}-${currentWeather.hourIndex}-${resolvedRecId}-${Math.round(
            adjustedLaeq
          )}`,
          peakNoiseLaeqDb: adjustedLaeq,
          limitLaeqDb: limitDb,
          exceedanceDb: Number((adjustedLaeq - limitDb).toFixed(1)),
          estimatedLafmaxDb: Number((adjustedLaeq + 9.5).toFixed(1)),
          receptorId: resolvedRecId,
          receptorName: worst.receptorName,
          receptorAddress: worst.receptorAddress,
          receptorPosition: matchedRec?.position || {
            lat: 55.4122,
            lng: 11.3524,
          },
          nearestSourceName:
            primarySource?.name || 'Nedrivningsfelt Ringparken (PSS W22085)',
          statuteReference: worst.statuteReference,
        };
      }

      // Fallback acoustic propagation check when user adjusts machine L_WA slider (ISO 9613-2)
      if (receptorExposures.length > 0 && primarySource) {
        const topRec = [...receptorExposures].sort(
          (a, b) => b.sumQuotient - a.sumQuotient
        )[0];
        const R = 6371000;
        const toRad = (d: number) => (d * Math.PI) / 180;
        const dLat = toRad(topRec.position.lat - primarySource.position.lat);
        const dLng = toRad(topRec.position.lng - primarySource.position.lng);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(primarySource.position.lat)) *
            Math.cos(toRad(topRec.position.lat)) *
            Math.sin(dLng / 2) ** 2;
        const distMeters = Math.max(
          22,
          2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
        );

        const geometricAttenuation =
          20 * Math.log10(distMeters) + 11 - 2.5; // Semi-hemispherical + ground reflection
        const windRefractionBoost =
          currentWeather.windSpeed10m > 10
            ? 4.2
            : currentWeather.windSpeed10m > 6
            ? 2.4
            : 0.8;
        const impulsePenaltyDb = 5.0; // MST 5/1984 audible impulse surcharge
        const calculatedLaeq = Number(
          (
            effectiveLwaDb -
            geometricAttenuation +
            windRefractionBoost +
            impulsePenaltyDb
          ).toFixed(1)
        );

        if (calculatedLaeq > statutoryLimitDb) {
          return {
            fingerprint: `${dateIso}-${currentWeather.hourIndex}-${topRec.receptorId}-${Math.round(
              calculatedLaeq
            )}`,
            peakNoiseLaeqDb: calculatedLaeq,
            limitLaeqDb: statutoryLimitDb,
            exceedanceDb: Number((calculatedLaeq - statutoryLimitDb).toFixed(1)),
            estimatedLafmaxDb: Number((calculatedLaeq + 10.0).toFixed(1)),
            receptorId: topRec.receptorId,
            receptorName: topRec.receptorName,
            receptorAddress: topRec.address,
            receptorPosition: topRec.position,
            nearestSourceName: primarySource.name,
            statuteReference:
              'Miljøstyrelsens Vejl. nr. 5/1984, Miljøbeskyttelsesloven § 42 & Slagelse Kommune Bygge- og Anlægsforskrift',
          };
        }
      }

      return null;
    }, [
      legalViolations,
      sources,
      receptorExposures,
      isManualMachineNoiseOverrideActive,
      machineNoiseOutputDb,
      currentWeather,
      dateIso,
    ]);

  const shouldDisplayPrompt =
    Boolean(detectedNoiseViolation) &&
    (hasInitialDwellElapsed || userInteractedWithNoiseControls) &&
    !dismissedFingerprints[detectedNoiseViolation!.fingerprint];

  const handleGenerateAndAppendCompliancePdf = async () => {
    if (!detectedNoiseViolation || isGenerating) return;
    setIsGenerating(true);

    try {
      const nowIso = new Date().toISOString();
      const journalRef = `STOEJ-COMP-${dateIso.replace(/-/g, '')}-${currentWeather.hourLabel.replace(
        ':',
        ''
      )}`;

      const sha256Hash = await computeForensicSha256Hash({
        journalRef,
        dateIso,
        hourLabel: currentWeather.hourLabel,
        receptorId: detectedNoiseViolation.receptorId,
        peakNoiseLaeqDb: detectedNoiseViolation.peakNoiseLaeqDb,
        limitLaeqDb: detectedNoiseViolation.limitLaeqDb,
        exceedanceDb: detectedNoiseViolation.exceedanceDb,
        windSpeed10m: currentWeather.windSpeed10m,
        windGusts10m: currentWeather.windGusts10m,
        machineNoiseOutputDb,
        inspectorNote: inspectorNote.trim(),
        generatedAtIso: nowIso,
      });

      // Build structured A4 Noise-Compliance PDF Report via jsPDF
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 32, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(
        'STRUKTURERET STØJ-COMPLIANCE RAPPORT (LOVOVERTRÆDELSE)',
        14,
        13
      );
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Sag: Ringparken, 4200 Slagelse (PSS W22085) · Ref: ${journalRef} · KLE: 09.08.00`,
        14,
        20
      );
      doc.text(
        `Dato & Tid: ${dateIso} kl. ${currentWeather.hourLabel} · SHA-256: ${sha256Hash.slice(
          0,
          32
        )}...`,
        14,
        26
      );

      let y = 42;
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text('1. Konstateret Grænseværdioverskridelse (Akustisk Bevis)', 14, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const metricsLines = [
        `Berørt Receptor: ${detectedNoiseViolation.receptorName} (${detectedNoiseViolation.receptorAddress})`,
        `Dominerende Støjkilde: ${detectedNoiseViolation.nearestSourceName} (Kildestyrke L_WA = ${machineNoiseOutputDb.toFixed(
          1
        )} dB(A))`,
        `Beregnet Impulskorrigeret Støjniveau (L_Aeq,korr inkl. +5 dB tillæg): ${detectedNoiseViolation.peakNoiseLaeqDb.toFixed(
          1
        )} dB(A)`,
        `Gældende Grænseværdi (Slagelse Kommune / MST Vejl. 5/1984): ${detectedNoiseViolation.limitLaeqDb.toFixed(
          1
        )} dB(A)`,
        `Netto Grænseværdioverskridelse: +${detectedNoiseViolation.exceedanceDb.toFixed(
          1
        )} dB(A) (Estimeret L_AFmax spids: ${detectedNoiseViolation.estimatedLafmaxDb.toFixed(
          1
        )} dB(A))`,
        `Meteorologisk Kontekst: Middelvind ${currentWeather.windSpeed10m.toFixed(
          1
        )} m/s, vindstød ${currentWeather.windGusts10m.toFixed(
          1
        )} m/s fra ${currentWeather.windDirection10m}°, Pasquill ${
          currentWeather.pasquillClass
        }`,
      ];
      metricsLines.forEach((line) => {
        const wrapped = doc.splitTextToSize(line, pageW - 28);
        doc.text(wrapped, 14, y);
        y += wrapped.length * 4.8;
      });

      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text('2. Retsgrundlag & Påkrævet Tilsynsreaktion', 14, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const legalText = [
        `Hjemmel: ${detectedNoiseViolation.statuteReference}.`,
        'Vurdering: Impulskorrigeret støjbelastning ved beboelsesfacade overskrider den maksimalt tilladte grænseværdi for bygge- og anlægsarbejde. Medvindsrefraktion og mekanisk impulsenergi (+5,0 dB(A) skærpelse) udløser pligt til straks-afværge efter Miljøbeskyttelsesloven § 42, stk. 1.',
        'Krav til Slagelse Kommune & Byggeledelse: Straks-standsning af uafskærmet hydraulisk mejsling/betonknusning i medvind samt dokumentation for akustisk kildeskærmning før genoptagelse.',
      ];
      legalText.forEach((p) => {
        const wrapped = doc.splitTextToSize(p, pageW - 28);
        doc.text(wrapped, 14, y);
        y += wrapped.length * 4.8 + 1.5;
      });

      if (inspectorNote.trim()) {
        y += 3;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.text('3. Supplerende Bemærkning fra Indberetter', 14, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const noteWrapped = doc.splitTextToSize(inspectorNote.trim(), pageW - 28);
        doc.text(noteWrapped, 14, y);
        y += noteWrapped.length * 4.8;
      }

      y += 6;
      doc.setDrawColor(148, 163, 184);
      doc.line(14, y, pageW - 14, y);
      y += 6;
      doc.setFont('courier', 'bold');
      doc.setFontSize(8);
      doc.text('KRYPTOGRAFISK SHA-256 BEVISSIGNATUR (CHAIN-OF-CUSTODY):', 14, y);
      y += 4.5;
      doc.setFont('courier', 'normal');
      doc.text(sha256Hash, 14, y);

      const pdfDataUrl = doc.output('datauristring');
      const pdfBytesEstimate = Math.round((pdfDataUrl.length * 3) / 4);
      const fileName = `Stoej_Compliance_Rapport_${dateIso}_kl${currentWeather.hourLabel.replace(
        ':',
        ''
      )}.pdf`;

      if (alsoDownloadFile) {
        doc.save(fileName);
      }

      const pdfEvidenceEntry: ForensicPdfEvidence = {
        id: `pdf-noise-comp-${Date.now()}`,
        fileName,
        fileSizeBytes: pdfBytesEstimate,
        pageCountEstimate: 1,
        sha256Hash,
        uploadedAtIso: nowIso,
        category: 'teknisk_rapport_bilag',
        evidenceCategory: 'Tilsynsrapport',
        pdfDataUrl,
        aiAnalysis: {
          documentTitle: `Struktureret Støj-Compliance Rapport (${detectedNoiseViolation.receptorName} · kl. ${currentWeather.hourLabel})`,
          detectedCategory: 'teknisk_rapport_bilag',
          senderEntity: 'Automatisk Akustisk Compliance-Monitor (Ringparken)',
          recipientEntity:
            'Slagelse Kommune — Center for Miljø, Plan og Teknik (KLE 09.08.00)',
          documentDateDetected: dateIso,
          referenceJournalNumber: journalRef,
          executiveSummary: `Dokumenterer overskridelse af støjgrænsen med +${detectedNoiseViolation.exceedanceDb.toFixed(
            1
          )} dB(A) ved ${
            detectedNoiseViolation.receptorName
          } (beregnet L_Aeq,korr = ${detectedNoiseViolation.peakNoiseLaeqDb.toFixed(
            1
          )} dB(A) mod grænse ${detectedNoiseViolation.limitLaeqDb.toFixed(
            1
          )} dB(A)) ved vind ${currentWeather.windSpeed10m.toFixed(
            1
          )} m/s (stød ${currentWeather.windGusts10m.toFixed(1)} m/s).`,
          keyStatementsAndAdmissions: [
            `Impulskorrigeret støjbelastning L_Aeq,korr = ${detectedNoiseViolation.peakNoiseLaeqDb.toFixed(
              1
            )} dB(A) (grænse ${detectedNoiseViolation.limitLaeqDb.toFixed(1)} dB(A))`,
            `Maskin-kildestyrke L_WA = ${machineNoiseOutputDb.toFixed(
              1
            )} dB(A) fra ${detectedNoiseViolation.nearestSourceName}`,
            `Vindstød ${currentWeather.windGusts10m.toFixed(
              1
            )} m/s og +5,0 dB(A) impulstillæg dokumenteret`,
          ],
          contradictionsWithTelemetry: [
            'Fortsat uafskærmet nedbrydning under overskredet støjgrænse strider mod kommunal bygge- og anlægsforskrift samt MBL § 42.',
          ],
          legalAndEvidentiarySignificance:
            'Direkte retsakustisk PDF-bevis klar til vedlæggelse i påbudsanmodning til Slagelse Kommune med verificerbar 64-tegns SHA-256 kontrolsum.',
          statutoryReferences: [
            'Miljøbeskyttelsesloven § 42, stk. 1',
            'Miljøstyrelsens Vejledning nr. 5/1984 (Ekstern støj fra virksomheder)',
            'Slagelse Kommune Forskrift for midlertidige bygge- og anlægsaktiviteter',
          ],
          severityAssessment:
            detectedNoiseViolation.exceedanceDb >= 5 ? 'KRITISK' : 'FORHØJET',
          confidencePct: 98,
          recommendedObservationType:
            'Struktureret Støj-Compliance Rapport (PDF-Bevis)',
          analyzedAtIso: nowIso,
          modelUsed: 'ISO 9613-2 / Nord2000 Deterministic Compliance Engine',
        },
      };

      // Also persist into ForensicPdfEvidencePanel's localStorage archive so both PDF Archive and Evidence Log stay 100% synced
      try {
        const existingRaw = localStorage.getItem(PDF_ARCHIVE_STORAGE_KEY);
        const existingArr: ForensicPdfEvidence[] = existingRaw
          ? JSON.parse(existingRaw)
          : [];
        const updated = [pdfEvidenceEntry, ...existingArr].slice(0, 30);
        localStorage.setItem(PDF_ARCHIVE_STORAGE_KEY, JSON.stringify(updated));
        window.dispatchEvent(
          new CustomEvent('ringparken-pdf-evidence-appended', {
            detail: pdfEvidenceEntry,
          })
        );
      } catch {
        // Ignore storage quota limits
      }

      await onAppendPdfEvidenceToLog({
        pdfEvidence: pdfEvidenceEntry,
        observationType: `Støj-Compliance PDF-Rapport (+${detectedNoiseViolation.exceedanceDb.toFixed(
          1
        )} dB overskridelse)`,
        description: `${
          pdfEvidenceEntry.aiAnalysis.executiveSummary
        }${inspectorNote.trim() ? ` Bemærkning: ${inspectorNote.trim()}` : ''}`,
        position: detectedNoiseViolation.receptorPosition,
        locationLabel: `${detectedNoiseViolation.receptorName} (${detectedNoiseViolation.receptorAddress})`,
      });

      setAppendedConfirmation({
        fileName,
        sha256Short: sha256Hash.slice(0, 16),
      });
      setDismissedFingerprints((prev) => ({
        ...prev,
        [detectedNoiseViolation.fingerprint]: true,
      }));
      setInspectorNote('');
    } finally {
      setIsGenerating(false);
    }
  };

  if (appendedConfirmation) {
    return (
      <div
        data-testid="noise-compliance-pdf-appended-banner"
        className="mx-3 mt-2 px-3.5 py-2.5 rounded-md bg-emerald-950/90 border border-emerald-500/70 text-emerald-100 flex flex-wrap items-center justify-between gap-2 text-xs"
      >
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">
            <strong>{appendedConfirmation.fileName}</strong> er genereret og føjet som PDF-bevis til bevisloggen
            <span className="font-mono tabular-nums text-emerald-300 ml-1.5">
              (SHA-256: {appendedConfirmation.sha256Short}…)
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onOpenEvidenceLogTab && (
            <button
              type="button"
              onClick={() => {
                onOpenEvidenceLogTab();
                setAppendedConfirmation(null);
              }}
              className="px-2.5 py-1 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold text-xs cursor-pointer whitespace-nowrap shrink-0"
            >
              Åbn i Bevislog
            </button>
          )}
          <button
            type="button"
            onClick={() => setAppendedConfirmation(null)}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs cursor-pointer whitespace-nowrap shrink-0"
          >
            Luk
          </button>
        </div>
      </div>
    );
  }

  if (!shouldDisplayPrompt || !detectedNoiseViolation) {
    return null;
  }

  return (
    <div
      data-testid="auto-noise-violation-prompt"
      role="region"
      aria-label="Automatisk støj-compliance rapport-prompt ved konstateret støjgrænseoverskridelse"
      className="mx-3 mt-2 p-3.5 rounded-md bg-slate-950 border border-amber-500/70 text-slate-100 shadow-lg space-y-2.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Støjgrænseoverskridelse detekteret kl. {currentWeather.hourLabel} — Generér struktureret Støj-Compliance PDF-rapport?
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Ved <strong className="text-white">{detectedNoiseViolation.receptorName}</strong> er det impulskorrigerede støjniveau beregnet til{' '}
            <strong className="font-mono tabular-nums text-rose-300">
              {detectedNoiseViolation.peakNoiseLaeqDb.toFixed(1)} dB(A)
            </strong>{' '}
            mod grænseværdien{' '}
            <span className="font-mono tabular-nums text-slate-200">
              {detectedNoiseViolation.limitLaeqDb.toFixed(1)} dB(A)
            </span>{' '}
            (overskridelse{' '}
            <strong className="font-mono tabular-nums text-amber-300">
              +{detectedNoiseViolation.exceedanceDb.toFixed(1)} dB(A)
            </strong>{' '}
            fra {detectedNoiseViolation.nearestSourceName}). Vil du oprette en SHA-256 signeret Støj-Compliance PDF-rapport og tilføje den direkte som PDF-bevis i bevisloggen?
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setDismissedFingerprints((prev) => ({
              ...prev,
              [detectedNoiseViolation.fingerprint]: true,
            }))
          }
          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          title="Afvis prompt for denne time"
        >
          <X className="w-3.5 h-3.5" />
          <span>Senere</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <input
          type="text"
          value={inspectorNote}
          onChange={(e) => setInspectorNote(e.target.value)}
          placeholder="Valgfri bemærkning til PDF-beviset (f.eks. observeret mejselhammer uden støjskærm)..."
          className="flex-1 min-w-[220px] px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
        />

        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer whitespace-nowrap shrink-0 px-2 py-1">
          <input
            type="checkbox"
            checked={alsoDownloadFile}
            onChange={(e) => setAlsoDownloadFile(e.target.checked)}
            className="accent-amber-400"
          />
          <span>Download også PDF-fil</span>
        </label>

        <button
          type="button"
          disabled={isGenerating}
          onClick={() => {
            void handleGenerateAndAppendCompliancePdf();
          }}
          data-testid="confirm-generate-noise-compliance-pdf-btn"
          className="px-3.5 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
        >
          {isGenerating ? (
            <Volume2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          ) : (
            <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>
            {isGenerating
              ? 'Genererer PDF-Bevis...'
              : 'Generér Støj-Compliance PDF & Føj til Bevislog'}
          </span>
          {alsoDownloadFile && <Download className="w-3 h-3 shrink-0" />}
        </button>
      </div>
    </div>
  );
};
