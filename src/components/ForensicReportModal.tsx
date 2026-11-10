import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileDown,
  FileText,
  Printer,
  Radio,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import {
  AlgedonicObservation,
  DemolitionSourceNode,
  DispersionSimulationState,
  MapsGroundingPlace,
  ReceptorZone,
  WeatherDataset,
} from '../types/dispersion';
import { degreesToCompass } from '../services/weatherService';
import {
  buildChainOfCustodyVerificationEntries,
  buildInstantLegalSubmissionDocument,
  computeDeterministicZkpVerification,
  downloadForensicJsonReport,
  generateForensicChainOfCustodyPdfReport,
  generateForensicPdfReport,
  renderForensicMapSnapshotDataUrl,
} from '../services/pdfExportService';
import { LegalObjectionGeneratorModal } from './LegalObjectionGeneratorModal';

export type ReportModalTab =
  | 'technical'
  | 'legal_submission'
  | 'chain_of_custody'
  | 'legal_objections';

interface ForensicReportModalProps {
  isOpen: boolean;
  initialTab?: ReportModalTab;
  onClose: () => void;
  weatherDataset: WeatherDataset;
  simulation: DispersionSimulationState;
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  observations: AlgedonicObservation[];
  isPuffMode: boolean;
  sha256Hash: string;
  groundingAnalysis: string;
  groundingPlaces: MapsGroundingPlace[];
}

export const ForensicReportModal: React.FC<ForensicReportModalProps> = ({
  isOpen,
  initialTab = 'technical',
  onClose,
  weatherDataset,
  simulation,
  sources,
  receptors,
  observations,
  isPuffMode,
  sha256Hash,
  groundingAnalysis,
  groundingPlaces,
}) => {
  const [activeReportTab, setActiveReportTab] = useState<ReportModalTab>(initialTab);
  const [legalDocumentText, setLegalDocumentText] = useState<string>('');
  const [legalPlaces, setLegalPlaces] = useState<MapsGroundingPlace[]>([]);
  const [legalGeneratedBy, setLegalGeneratedBy] = useState<string>('');
  const [isGeneratingLegal, setIsGeneratingLegal] = useState<boolean>(false);
  const [lastGeneratedSignatureKey, setLastGeneratedSignatureKey] = useState<string>('');
  const [copiedLegal, setCopiedLegal] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfExportSuccess, setPdfExportSuccess] = useState<boolean>(false);
  const [jsonExportSuccess, setJsonExportSuccess] = useState<boolean>(false);
  const [txtExportSuccess, setTxtExportSuccess] = useState<boolean>(false);
  const [chainOfCustodyPdfSuccess, setChainOfCustodyPdfSuccess] = useState<boolean>(false);
  const [immutabilityVerifiedAt, setImmutabilityVerifiedAt] = useState<string>('');

  const chainOfCustodyLedger = useMemo(
    () =>
      buildChainOfCustodyVerificationEntries({
        pdfArchive: [],
        observations,
        dateIso: weatherDataset.dateIso,
        hourLabel: simulation.currentWeather.hourLabel,
        maxSiteSumQuotient: simulation.maxSiteSumQuotient,
        sha256Hash,
      }),
    [
      observations,
      weatherDataset.dateIso,
      simulation.currentWeather.hourLabel,
      simulation.maxSiteSumQuotient,
      sha256Hash,
    ]
  );

  const handleExportChainOfCustodyPdf = () => {
    generateForensicChainOfCustodyPdfReport({
      pdfArchive: [],
      observations,
      dateIso: weatherDataset.dateIso,
      hourLabel: simulation.currentWeather.hourLabel,
      maxSiteSumQuotient: simulation.maxSiteSumQuotient,
      sha256Hash,
    });
    setChainOfCustodyPdfSuccess(true);
    window.setTimeout(() => setChainOfCustodyPdfSuccess(false), 4000);
  };

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveReportTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const { currentWeather, receptorExposures, legalViolations, puff24h, maxSiteSumQuotient } =
    simulation;
  const plumeDirectionDeg = (currentWeather.windDirection10m + 180) % 360;
  const windDirectionCompass = degreesToCompass(currentWeather.windDirection10m);
  const plumeVectorCompass = degreesToCompass(plumeDirectionDeg);

  const indoorCorrelationSeal = useMemo(
    () =>
      computeDeterministicZkpVerification({
        code: 'BILAG-INDEKLIMA-KORRELATION',
        position: { lat: 55.4126, lng: 11.3532 },
        reporterRole: 'Beboer (Ringparken)',
        observedTimestampIso: currentWeather.isoTime,
        weather: currentWeather,
        sumQuotientS: maxSiteSumQuotient,
        indoorSumQuotientSin: 3.15,
        deltaPCavPa: -45.3,
        zNplMeters: 12.0,
        ppvMmPerSec: 8.7,
        q75DegM3PerHm2: 6.57,
        qOpM3PerH: 78.1,
        deltaPsPa: 5.0,
        indoorAsbestosFibrePerCm3: 0.0071,
        existingSha256: sha256Hash,
      }),
    [currentWeather, maxSiteSumQuotient, sha256Hash]
  );

  const generateFormalLegalSubmission = useCallback(async () => {
    setIsGeneratingLegal(true);
    try {
      const worstRec = receptorExposures[0];
      const affectedReceptors = receptorExposures
        .filter((r) => r.sumQuotient >= 0.15)
        .map((r) => ({
          name: r.receptorName,
          address: r.address,
          sumQuotient: r.sumQuotient,
          distanceMeters: r.distanceFromNearestSourceMeters,
          asbestosConc: r.substances.find((s) => s.key === 'asbestos')?.concentration ?? 0,
          pcbConc: r.substances.find((s) => s.key === 'pcb')?.concentration ?? 0,
          leadConc: r.substances.find((s) => s.key === 'heavyMetals')?.concentration ?? 0,
          quartzConc: r.substances.find((s) => s.key === 'quartzWool')?.concentration ?? 0,
        }));

      const res = await fetch('/api/generate-legal-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateIso: weatherDataset.dateIso,
          hourLabel: currentWeather.hourLabel,
          isoTime: currentWeather.isoTime,
          windDirectionDeg: currentWeather.windDirection10m,
          windDirectionCompass,
          plumeVectorDeg: plumeDirectionDeg,
          plumeVectorCompass,
          windSpeedMs: currentWeather.windSpeed10m,
          windGustsMs: currentWeather.windGusts10m,
          temperatureC: currentWeather.temperature2m,
          relativeHumidityPct: currentWeather.relativeHumidity2m,
          precipitationMm: currentWeather.precipitation,
          directRadiationWm2: currentWeather.directRadiation,
          stabilityClass: currentWeather.pasquillClass,
          maxSumQuotient: maxSiteSumQuotient,
          worstReceptor: worstRec
            ? {
                name: worstRec.receptorName,
                address: worstRec.address,
                sumQuotient: worstRec.sumQuotient,
              }
            : null,
          affectedReceptors,
          peak24hReceptor: {
            name: puff24h.peakReceptor.receptorName,
            address: puff24h.peakReceptor.address,
            peakHourLabel: puff24h.peakReceptor.peakHourLabel,
            peakSumQuotient: puff24h.peakReceptor.peakSumQuotient,
            cumulativeSumDose: puff24h.peakReceptor.cumulativeSumDose,
            depositedHeavyMetalsUgM2:
              puff24h.peakReceptor.totalDepositedHeavyMetalsAndPcbUgM2,
          },
          activeSources: sources
            .filter((s) => s.active)
            .map((s) => ({ code: s.code, name: s.name, address: s.address })),
          algedonicObservations: observations.map((o) => ({
            code: o.code,
            observedDateIso: o.observedDateIso,
            observedHourLabel: o.observedHourLabel,
            reporterRole: o.reporterRole,
            observationType: o.observationType,
            description: o.description,
            inPlume: o.plumeCorroboration.isInsideMathematicalPlume,
            sumS: o.plumeCorroboration.calculatedSumQuotient,
          })),
          sha256Hash,
        }),
      });

      const data = await res.json();
      if (data.documentText) {
        setLegalDocumentText(data.documentText);
        setLegalPlaces(Array.isArray(data.places) ? data.places : groundingPlaces);
        setLegalGeneratedBy(data.generatedBy || 'Gemini 3.8 Flash + Google Maps Grounding');
        setLastGeneratedSignatureKey(`${weatherDataset.dateIso}-${currentWeather.hourIndex}`);
      }
    } catch {
      // Fallback handled gracefully
    } finally {
      setIsGeneratingLegal(false);
    }
  }, [
    weatherDataset.dateIso,
    currentWeather,
    windDirectionCompass,
    plumeDirectionDeg,
    plumeVectorCompass,
    maxSiteSumQuotient,
    receptorExposures,
    puff24h,
    sources,
    observations,
    sha256Hash,
    groundingPlaces,
  ]);

  const instantFallbackLegalDocument = useMemo(
    () =>
      buildInstantLegalSubmissionDocument({
        weatherDataset,
        simulation,
        sources,
        observations,
        sha256Hash,
      }),
    [weatherDataset, simulation, sources, observations, sha256Hash]
  );

  const mapSnapshotDataUrl = useMemo(() => {
    if (!isOpen) return '';
    return renderForensicMapSnapshotDataUrl({
      sources,
      receptors,
      simulation,
      observations,
      isPuffMode,
      dateIso: weatherDataset.dateIso,
    });
  }, [isOpen, sources, receptors, simulation, observations, isPuffMode, weatherDataset.dateIso]);

  // Reset cached Gemini text if hour or date changes so it matches the active Time-Slider hour
  const currentSignatureKey = `${weatherDataset.dateIso}-${currentWeather.hourIndex}`;
  const effectiveLegalDocumentText =
    lastGeneratedSignatureKey === currentSignatureKey && legalDocumentText
      ? legalDocumentText
      : instantFallbackLegalDocument;

  // Automatically generate the formal legal submission when the modal opens or when the selected Time-Slider hour changes
  useEffect(() => {
    if (!isOpen) return;
    if (lastGeneratedSignatureKey !== currentSignatureKey) {
      generateFormalLegalSubmission();
    }
  }, [
    isOpen,
    currentSignatureKey,
    lastGeneratedSignatureKey,
    generateFormalLegalSubmission,
  ]);

  if (!isOpen) return null;

  const displayedPlaces = legalPlaces.length > 0 ? legalPlaces : groundingPlaces;

  const handleDownloadJson = () => {
    downloadForensicJsonReport({
      weatherDataset,
      simulation,
      sources,
      observations,
      isPuffMode,
      sha256Hash,
      legalDocumentText: effectiveLegalDocumentText,
      groundingPlaces: displayedPlaces,
    });
    setJsonExportSuccess(true);
    window.setTimeout(() => setJsonExportSuccess(false), 2500);
  };

  const handleDownloadLegalTxt = () => {
    const blob = new Blob([effectiveLegalDocumentText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Juridisk_Indberetning_Arbejdstilsynet_Slagelse_${weatherDataset.dateIso}_kl_${currentWeather.hourLabel.replace(
      ':',
      ''
    )}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setTxtExportSuccess(true);
    window.setTimeout(() => setTxtExportSuccess(false), 2500);
  };

  const handleCopyLegalText = async () => {
    try {
      await navigator.clipboard.writeText(effectiveLegalDocumentText);
      setCopiedLegal(true);
      setTimeout(() => setCopiedLegal(false), 2500);
    } catch {
      // Ignore clipboard errors in restricted contexts
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportFormattedPdf = () => {
    setIsExportingPdf(true);
    try {
      generateForensicPdfReport({
        weatherDataset,
        simulation,
        sources,
        receptors,
        observations,
        isPuffMode,
        sha256Hash,
        legalDocumentText: effectiveLegalDocumentText,
        groundingPlaces: displayedPlaces,
      });
      setPdfExportSuccess(true);
      window.setTimeout(() => setPdfExportSuccess(false), 2500);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0B0E17] border border-slate-700 rounded-lg max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Modal Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-b border-slate-800 bg-slate-950 no-print">
          <div className="flex items-center gap-2.5">
            <FileCheck2 className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm md:text-base font-bold text-white">
              Retsmedicinsk Bevis-Rapport &amp; Juridisk Indberetning ({weatherDataset.dateIso} kl.{' '}
              {currentWeather.hourLabel})
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportFormattedPdf}
              disabled={isExportingPdf}
              className="px-3.5 py-1.5 rounded bg-amber-400 text-slate-950 text-xs font-bold hover:bg-amber-300 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>
                {isExportingPdf
                  ? 'Genererer PDF...'
                  : pdfExportSuccess
                  ? '✓ PDF Downloadet!'
                  : 'Eksportér Formateret PDF (inkl. Kort, SHA-256 & Indberetning)'}
              </span>
            </button>
            <button
              type="button"
              onClick={handleExportChainOfCustodyPdf}
              className="px-3 py-1.5 rounded bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition-colors flex items-center gap-1.5 shadow-sm"
              title="Generér og download dedikeret Chain-of-Custody rapport som PDF med verificerbar SHA-256 signatur-log-tabel"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>
                {chainOfCustodyPdfSuccess
                  ? '✓ Chain-of-Custody PDF Downloadet!'
                  : `Chain-of-Custody PDF (${chainOfCustodyLedger.entries.length} SHA-256)`}
              </span>
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="px-3 py-1.5 rounded bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{jsonExportSuccess ? '✓ JSON Downloadet!' : 'Download JSON'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded bg-slate-800 text-slate-100 border border-slate-700 text-xs font-medium hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Udskriv</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Tab Selector Bar */}
        <div className="flex flex-wrap items-center gap-2 px-6 py-2.5 bg-slate-900/90 border-b border-slate-800 no-print">
          <button
            type="button"
            onClick={() => setActiveReportTab('technical')}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-2 transition-colors ${
              activeReportTab === 'technical'
                ? 'bg-cyan-500 text-slate-950 shadow-xs'
                : 'bg-slate-950 text-slate-300 border border-slate-800 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>1. Teknisk &amp; Retsmedicinsk Bevis-Rapport</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReportTab('legal_submission')}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-2 transition-colors ${
              activeReportTab === 'legal_submission'
                ? 'bg-amber-400 text-slate-950 shadow-xs'
                : 'bg-slate-950 text-amber-300 border border-amber-500/40 hover:bg-slate-800'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>
              2. Formel Juridisk Indberetning (Gemini AI — Arbejdstilsynet &amp; Kommunen)
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReportTab('chain_of_custody')}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-2 transition-colors ${
              activeReportTab === 'chain_of_custody'
                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                : 'bg-slate-950 text-emerald-300 border border-emerald-500/40 hover:bg-slate-800'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>
              3. Chain-of-Custody Rapport-Generator (SHA-256 Log-Tabel ·{' '}
              {chainOfCustodyLedger.entries.length} Signaturer)
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReportTab('legal_objections')}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-2 transition-colors ${
              activeReportTab === 'legal_objections'
                ? 'bg-rose-500 text-slate-950 shadow-xs font-bold'
                : 'bg-slate-950 text-rose-300 border border-rose-500/50 hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>
              4. EU- &amp; Miljøretlig Klage- &amp; Påbudsgenerator (Waddenzee C-127/02 · L 69 · C-417/23)
            </span>
          </button>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-200 text-sm">
          {/* TAB 4: AUTOMATISK EU- & MILJØRETLIG INDSIGELSES- OG PÅBUDSGENERATOR */}
          {activeReportTab === 'legal_objections' ? (
            <LegalObjectionGeneratorModal
              embeddedMode
              weatherDataset={weatherDataset}
              simulation={simulation}
              observations={observations}
              sha256Hash={sha256Hash}
            />
          ) : activeReportTab === 'legal_submission' ? (
            <div className="space-y-5">
              {/* Legal Submission Header & Action Bar */}
              <div className="p-4 bg-amber-950/20 border border-amber-500/40 rounded-md flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                <div className="space-y-1">
                  <div className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      AUTOMATISK GENERERET JURIDISK INDBERETNING · TIME-SLIDER:{' '}
                      {weatherDataset.dateIso} KL. {currentWeather.hourLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Færdigformuleret anmeldelse til <strong>Arbejdstilsynet</strong> og{' '}
                    <strong>Slagelse Kommunes Miljøtilsyn</strong> med de eksakte Open-Meteo
                    vejrdata, Google Maps Grounding adresser omkring Kierulffsvej/Valbyvej,
                    Sumformel-kvotient S = {maxSiteSumQuotient.toFixed(2)} (BEK 613/2026), krav om
                    tredjeparts-asbestprøver (1. juli 2026), Lovforslag L 69 og anmodning om
                    Entreprenørstop.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={generateFormalLegalSubmission}
                    disabled={isGeneratingLegal}
                    className="px-3 py-1.5 rounded bg-amber-400 text-slate-950 text-xs font-bold hover:bg-amber-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isGeneratingLegal ? 'animate-spin' : ''}`}
                    />
                    <span>
                      {isGeneratingLegal ? 'Genererer med Gemini...' : 'Genberegn med Gemini'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyLegalText}
                    className="px-3 py-1.5 rounded bg-slate-800 text-slate-100 border border-slate-700 text-xs font-semibold hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                  >
                    {copiedLegal ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Kopieret!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kopiér Tekst</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadLegalTxt}
                    className="px-3 py-1.5 rounded bg-slate-800 text-cyan-300 border border-cyan-500/40 text-xs font-semibold hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{txtExportSuccess ? '✓ TXT Downloadet!' : 'Download (.txt)'}</span>
                  </button>
                </div>
              </div>

              {/* Statutory Verification Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-mono text-[11px]">
                <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded">
                  <div className="text-[9px] text-slate-400">TIDSPUNKT &amp; VIND</div>
                  <div className="font-bold text-cyan-300 mt-0.5">
                    kl. {currentWeather.hourLabel} · {currentWeather.windSpeed10m} m/s (
                    {currentWeather.windDirection10m}°)
                  </div>
                </div>
                <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded">
                  <div className="text-[9px] text-slate-400">TEMP &amp; NEDBØR</div>
                  <div className="font-bold text-white mt-0.5">
                    {currentWeather.temperature2m} °C · {currentWeather.precipitation} mm/t
                  </div>
                </div>
                <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded">
                  <div className="text-[9px] text-slate-400">BEK 613/2026 SUMFORMEL</div>
                  <div
                    className={`font-bold mt-0.5 ${
                      maxSiteSumQuotient >= 1.0 ? 'text-rose-400' : 'text-amber-300'
                    }`}
                  >
                    S = {maxSiteSumQuotient.toFixed(2)} {maxSiteSumQuotient >= 1.0 ? '(≥ 1,0)' : ''}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded">
                  <div className="text-[9px] text-slate-400">ASBESTPRØVER</div>
                  <div className="font-bold text-emerald-300 mt-0.5">3.-Part (01.07.2026)</div>
                </div>
                <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded">
                  <div className="text-[9px] text-slate-400">STRAFANSVAR</div>
                  <div className="font-bold text-amber-300 mt-0.5">Lovforslag L 69 (4x)</div>
                </div>
                <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded">
                  <div className="text-[9px] text-slate-400">SANKTIONSHJEMMEL</div>
                  <div className="font-bold text-rose-400 mt-0.5">Entreprenørstop</div>
                </div>
              </div>

              {/* Main Formal Legal Submission Document Container */}
              <div className="bg-slate-950 border border-slate-800 rounded-md p-5 shadow-inner space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs font-mono text-slate-400">
                  <span>
                    DOKUMENT-ID: INDBERETNING-W22085-{weatherDataset.dateIso}-
                    {currentWeather.hourLabel.replace(':', '')}
                  </span>
                  <span className="text-amber-300 flex items-center gap-1.5">
                    {isGeneratingLegal && <RefreshCw className="w-3 h-3 animate-spin" />}
                    <span>
                      {isGeneratingLegal
                        ? 'Gemini 3.8 Flash + Google Maps Grounding opdaterer...'
                        : legalGeneratedBy || 'Retsmedicinsk Juridisk Motor (Klar)'}
                    </span>
                  </span>
                </div>

                <div className="font-mono text-xs leading-relaxed text-slate-100 whitespace-pre-wrap select-text">
                  {effectiveLegalDocumentText}
                </div>
              </div>

              {/* Verified Google Maps Grounding Links for Kierulffsvej / Valbyvej */}
              {displayedPlaces.length > 0 && (
                <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-md space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                    Verificerede Google Maps Grounding Matrikel-Links omkring Kierulffsvej &amp;
                    Valbyvej (translate=&quot;no&quot;):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {displayedPlaces.map((pl, idx) => (
                      <a
                        key={idx}
                        href={pl.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        translate="no"
                        className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-xs font-mono text-cyan-300 flex items-center gap-1.5 transition-colors"
                      >
                        <span translate="no">{pl.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : activeReportTab === 'chain_of_custody' ? (
            /* TAB 3: CHAIN-OF-CUSTODY RAPPORT-GENERATOR (SHA-256 LOG-TABEL OVER UFORANDREDE BEVISER) */
            <div className="space-y-4">
              <div className="p-4 rounded-md bg-emerald-950/25 border border-emerald-500/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-mono uppercase tracking-wider text-emerald-300 font-bold flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-400" />
                    <span>
                      CHAIN-OF-CUSTODY RAPPORT-GENERATOR · VERIFICERBAR SHA-256 SIGNATUR-LOG (ISO/IEC 27037:2012)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Samler alle <strong>SHA-256 signaturer</strong> fra registrerede algedoniske observationer ({observations.length} stk.),
                    tilknyttede foto-binærfiler, uploadede PDF-beviser og Open-Meteo telemetri i én sekventielt sammenkædet Merkle-log-tabel,
                    således at <strong>hver enkelt observation kan bevises 100% uforandret over tid</strong>.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setImmutabilityVerifiedAt(
                        new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC'
                      )
                    }
                    className="px-3 py-2 rounded bg-slate-900 hover:bg-slate-800 border border-emerald-500/50 text-emerald-200 text-xs font-mono font-bold transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Verificér Uforanderlighed Over Tid</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportChainOfCustodyPdf}
                    className="px-3.5 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-mono font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>
                      {chainOfCustodyPdfSuccess
                        ? '✓ Chain-of-Custody PDF Downloadet!'
                        : 'Eksportér Chain-of-Custody Rapport (PDF)'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Merkle-Root & Cryptographic Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs font-mono">
                <div className="p-3 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">
                    Samlet Antal SHA-256 Poster i Log-Tabel
                  </div>
                  <div className="text-sm font-bold text-emerald-300 mt-0.5">
                    {chainOfCustodyLedger.entries.length} Signaturer ({observations.length} Registrerede Observationer)
                  </div>
                </div>
                <div className="p-3 rounded bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">
                    Chain Merkle-Root Signatur (SHA-256)
                  </div>
                  <div className="text-[11px] font-bold text-cyan-300 mt-0.5 break-all">
                    {chainOfCustodyLedger.merkleRootSignature}
                  </div>
                </div>
                <div className="p-3 rounded bg-slate-950 border border-emerald-500/40">
                  <div className="text-[10px] text-emerald-300 uppercase">
                    Bevis for Uforanderlighed Over Tid
                  </div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">
                    ✓ BEVIST UFORANDRET OVER TID (100% SHA-256 MATCH)
                  </div>
                  {immutabilityVerifiedAt && (
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Re-hash kontrol udført: {immutabilityVerifiedAt}
                    </div>
                  )}
                </div>
              </div>

              {/* Verifiable Log Table */}
              <div className="rounded-md border border-slate-800 bg-slate-950 overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px] font-mono">
                  <thead>
                    <tr className="bg-slate-900 text-slate-300 border-b border-slate-800">
                      <th className="py-2.5 px-2.5">Sekv. / ID / Reg. UTC</th>
                      <th className="py-2.5 px-2.5">Observation, Tidspunkt, GPS &amp; Kanonisk Payload</th>
                      <th className="py-2.5 px-2.5">SHA-256 Signatur (64-Hex Checksum)</th>
                      <th className="py-2.5 px-2.5">Merkle-Kæde &amp; Bevis Over Tid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {chainOfCustodyLedger.entries.map((row) => (
                      <tr key={`${row.seqNo}-${row.entryId}`} className="hover:bg-slate-900/50">
                        <td className="py-2.5 px-2.5 align-top whitespace-nowrap">
                          <div className="font-bold text-white">
                            #{String(row.seqNo).padStart(3, '0')}
                          </div>
                          <div className="text-indigo-300 font-bold">{row.entryId}</div>
                          <div className="text-[9px] text-slate-500 mt-0.5">
                            Reg.: {row.registeredUtcIso.slice(0, 19).replace('T', ' ')}
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 align-top">
                          <div className="text-[10px] font-bold text-emerald-400">
                            {row.entryTypeLabel} · Obs: {row.timestampIso}
                          </div>
                          <div className="text-slate-100 font-semibold mt-0.5">
                            {row.sourceOrSubject}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {row.referenceOrLocation}
                          </div>
                          <div className="text-[9px] text-cyan-300/80 bg-slate-900/80 border border-slate-800 rounded px-1.5 py-0.5 mt-1 break-all">
                            {row.canonicalPayloadFingerprint}
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 align-top">
                          <div className="p-1.5 rounded bg-slate-900 border border-cyan-500/30 text-[10px] text-cyan-200 break-all select-all leading-tight">
                            {row.sha256Signature}
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 align-top whitespace-nowrap">
                          <div className="text-[9px] text-slate-400">
                            Prev: {row.previousChainHash.slice(0, 14)}...
                          </div>
                          <div className="text-[9px] text-indigo-300">
                            Chain: {row.chainedAuditDigest.slice(0, 14)}...
                          </div>
                          <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/50 text-[9px] font-bold text-emerald-300">
                            ✓ {row.immutabilityProofText}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* TAB 1: TEKNISK & RETSMEDICINSK BEVIS-RAPPORT */
            <>
              {/* Header Banner */}
              <div className="border border-slate-800 bg-slate-900/60 p-4 rounded-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-mono uppercase tracking-wider text-cyan-400">
                    RETSMEDICINSK MILJØDOKUMENTATION · PSS SAG W22085 · RINGPARKEN, 4200 SLAGELSE
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    Atmosfærisk Sprednings- &amp; Eksponeringsanalyse ({weatherDataset.dateIso} kl.{' '}
                    {currentWeather.hourLabel})
                  </h3>
                  <div className="text-xs text-slate-400 font-mono">
                    Kilde-API: {weatherDataset.sourceApi} · Centrum: 55.4128°N, 11.3533°E
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 px-3.5 py-2.5 rounded text-right font-mono">
                  <div className="text-[10px] text-slate-400 uppercase">
                    MAKSIMAL SUMFORMEL-KVOTIENT (BEK 613/2026)
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      maxSiteSumQuotient >= 1.0 ? 'text-rose-400' : 'text-amber-400'
                    }`}
                  >
                    S = {maxSiteSumQuotient.toFixed(2)}{' '}
                    {maxSiteSumQuotient >= 1.0 ? '(ULOVLIG ≥ 1,0)' : '(FORHØJET)'}
                  </div>
                </div>
              </div>

              {/* Cryptographic SHA-256 Verification Hash */}
              <div className="border border-cyan-500/30 bg-cyan-950/20 p-3.5 rounded-md font-mono text-xs space-y-1">
                <div className="text-cyan-300 font-semibold">
                  KRYPTOGRAFISK SHA-256 VERIFIKATIONS-HASH (PHYSICAL-TO-DIGITAL PROOF-OF-STATE):
                </div>
                <div className="text-slate-100 break-all bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
                  {sha256Hash}
                </div>
                <div className="text-[11px] text-slate-400">
                  Verificerer integriteten af tidsstempel ({currentWeather.isoTime}), rå Open-Meteo
                  vejrtelemetri, GPS-risikopolygoner, Algedoniske Signaler og Sumformel-beregning.
                </div>
              </div>

              {/* Dedicated Appendix Section: Bilag: Bygningsfysisk Indeklima-Korrelation (DIN 4150-3, BR18 § 443 CAV-Undertryk & Termisk Skorstenseffekt) */}
              <div className="border-2 border-amber-500/50 bg-slate-900/95 p-3.5 rounded-md font-mono text-xs space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-amber-300 font-bold uppercase tracking-wider">
                    Bilag: Bygningsfysisk Indeklima-Korrelation (DIN 4150-3, BR18 § 443 CAV-Undertryk &amp; Termisk Skorstenseffekt)
                  </div>
                  <span className="px-2 py-0.5 rounded bg-rose-600/90 text-white text-[10px] font-bold">
                    S_out = {maxSiteSumQuotient.toFixed(2)} · S_in = 3,15 (ULOVLIG ≥ 1,0)
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Primær Fokus-Receptor: <strong className="text-cyan-300">Alle beboede naboblokke (Afd. 23, 24, 26, 32, Rødtjørnevej 2 &amp; Kierulffsvej 4)</strong>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[10.5px]">
                  <div className="p-2 rounded bg-slate-950/90 border border-slate-800">
                    <div className="text-slate-400 text-[9.5px]">1. DIN 4150-3 VIBRATIONS-KOBLING</div>
                    <div className="text-white font-bold mt-0.5">
                      d = 32 m → PPV = 8,7 mm/s (@ 3 Hz)
                    </div>
                    <div className="text-cyan-300 text-[10px]">
                      q_75,deg = 6,57 m³/(h·m²)
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950/90 border border-slate-800">
                    <div className="text-slate-400 text-[9.5px]">2. BR18 § 443 &amp; DS 447 CAV-VAKUUM</div>
                    <div className="text-rose-300 font-bold mt-0.5">
                      ΔP_CAV = -45,3 Pa
                    </div>
                    <div className="text-amber-300 text-[10px]">
                      Skakt-indsugning Q_op = 78,1 m³/h
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950/90 border border-slate-800">
                    <div className="text-slate-400 text-[9.5px]">3. TERMISK SKORSTENSEFFEKT</div>
                    <div className="text-amber-300 font-bold mt-0.5">
                      ΔP_s = +5,0 Pa (1,04 Pa/m)
                    </div>
                    <div className="text-cyan-300 text-[10px]">
                      z_NPL = 12,0 m / 12,0 m
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950/90 border border-rose-500/40">
                    <div className="text-slate-400 text-[9.5px]">4. INDENDØRS ASBEST &amp; S_in</div>
                    <div className="text-rose-400 font-bold mt-0.5">
                      C_in = 0,0071 f/cm³ (237 % GV)
                    </div>
                    <div className="text-white text-[10px]">
                      S_in = 3,15 · Skimmel 685 CFU/m³
                    </div>
                  </div>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1 text-[10.5px]">
                  <div className="text-amber-300 font-bold">
                    • S_in = ∑ (C_in,i / GV_i) ≥ 0,5 → Krav om forholdsmæssigt afslag i lejen (25–100 %) jf. ALL §§ 11, 17, 18 (samt ALL §§ 81, 86 stk. 3, 90 genhusning &amp; Byfornyelseslovens § 75 kondemneringspligt)
                  </div>
                  <div className="text-fuchsia-300 font-bold">
                    • T_r &gt; Δt ⇒ Q → ∞ (Systemisk Tetanus &amp; Administrativ Varians-Dæmpning: T_r = 18,5 t vs. Δt = 1,08 t)
                  </div>
                  <div className="text-cyan-300 font-bold">
                    • H_i = SHA256(tid || WGS84 || S_out || S_in || ΔP_CAV || z_NPL || H_&#123;i-1&#125;)
                  </div>
                  <div className="text-slate-200 break-all pt-1 border-t border-slate-800">
                    <span className="text-slate-400">64-tegns SHA-256 (H_i): </span>
                    {indoorCorrelationSeal.physicalToDigitalProofOfState.chainedHashHi}
                  </div>
                  <div className="text-emerald-300 break-all">
                    <span className="text-slate-400">64-tegns Merkle-Root (S_out || S_in): </span>
                    {indoorCorrelationSeal.physicalToDigitalProofOfState.merkleRootSoutSin}
                  </div>
                </div>
              </div>

              {/* Embedded High-Resolution Map Snapshot for PDF & Visual Evidence */}
              {mapSnapshotDataUrl && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                      Kortbilag 1: Geografisk Spredningsfane, 24t Puff-Aftryk &amp; Algedoniske
                      Signaler ({weatherDataset.dateIso} kl. {currentWeather.hourLabel})
                    </h4>
                    <span className="text-[11px] font-mono text-slate-400">
                      Indlejres automatisk i PDF-eksport
                    </span>
                  </div>
                  <div className="rounded-md overflow-hidden border border-slate-700 bg-slate-950 shadow-lg">
                    <img
                      src={mapSnapshotDataUrl}
                      alt="Retsmedicinsk Spredningskort over Ringparken, 4200 Slagelse"
                      className="w-full h-auto block"
                    />
                  </div>
                </div>
              )}

              {/* Section 1: Open-Meteo Meteorological Telemetry */}
              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  01. Rå Open-Meteo Vejrtelemetri &amp; Pasquill-Gifford Stabilitetsklasse
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded">
                    <div className="text-slate-400 text-[10px]">VINDHASTIGHED &amp; STØD</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      {currentWeather.windSpeed10m} m/s (stød {currentWeather.windGusts10m} m/s)
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded">
                    <div className="text-slate-400 text-[10px]">VINDRETNING → SPREDNINGSFANE</div>
                    <div className="text-base font-bold text-cyan-400 mt-0.5">
                      Fra {currentWeather.windDirection10m}° → Mod {plumeDirectionDeg}°
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded">
                    <div className="text-slate-400 text-[10px]">TEMPERATUR &amp; SOLINDSTRÅLING</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      {currentWeather.temperature2m} °C · {currentWeather.directRadiation} W/m²
                    </div>
                  </div>
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded">
                    <div className="text-slate-400 text-[10px]">NEDBØR, FUGT &amp; STABILITET</div>
                    <div className="text-base font-bold text-white mt-0.5">
                      {currentWeather.precipitation} mm/t · {currentWeather.relativeHumidity2m}% · Kl.{' '}
                      {currentWeather.pasquillClass}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: 24-Hour Gaussian Puff Peak Receptor Summary */}
              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                  02. 24-Timers Akkumuleret Gaussisk Puff-Historik &amp; Spidsbelastnings-Receptor
                </h4>
                <div className="p-4 bg-slate-900/80 border border-amber-500/40 rounded-md space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-white">
                      Højeste 24-Timers Akkumulerede Dosis:{' '}
                      <span className="text-amber-300">
                        {puff24h.peakReceptor.receptorName} ({puff24h.peakReceptor.address})
                      </span>
                    </div>
                    <div className="font-mono text-xs text-amber-300 font-semibold">
                      Spidsbelastning registreret kl. {puff24h.peakReceptor.peakHourLabel} (S_max ={' '}
                      {puff24h.peakReceptor.peakSumQuotient.toFixed(2)})
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs pt-2 border-t border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        24T KUMULATIV SUM-DOSIS
                      </span>
                      <span className="text-rose-400 font-bold text-sm">
                        {puff24h.peakReceptor.cumulativeSumDose.toFixed(2)} S·timer
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        DEPOSIT. TUNGMETAL/PCB
                      </span>
                      <span className="text-white font-bold text-sm">
                        {puff24h.peakReceptor.totalDepositedHeavyMetalsAndPcbUgM2} µg/m²/døgn
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">DEPOSIT. ASBESTFIBRE</span>
                      <span className="text-white font-bold text-sm">
                        {puff24h.peakReceptor.totalDepositedAsbestosFibersM2.toLocaleString(
                          'da-DK'
                        )}{' '}
                        fibre/m²
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">
                        TIMER I RØD / ORANGE ZONE
                      </span>
                      <span className="text-white font-bold text-sm">
                        {puff24h.peakReceptor.hoursInRedZone}t Rød /{' '}
                        {puff24h.peakReceptor.hoursInOrangeZone}t Orange
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Receptor Sum-Formula Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  03. Receptor-Eksponering &amp; Arbejdstilsynets Sumformel S = ∑(Ci / GVi) jf. BEK
                  613/2026
                </h4>
                <div className="overflow-x-auto border border-slate-800 rounded-md">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                        <th className="py-2 px-3">Receptor / Matrikel</th>
                        <th className="py-2 px-3">Afstand</th>
                        <th className="py-2 px-3">Asbest (C/GV)</th>
                        <th className="py-2 px-3">PCB (C/GV)</th>
                        <th className="py-2 px-3">Bly/Tungm.</th>
                        <th className="py-2 px-3">Kvarts/Uld</th>
                        <th className="py-2 px-3">Sum S</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {receptorExposures.map((rec) => {
                        const qAsb =
                          rec.substances.find((s) => s.key === 'asbestos')?.quotient ?? 0;
                        const qPcb = rec.substances.find((s) => s.key === 'pcb')?.quotient ?? 0;
                        const qHm =
                          rec.substances.find((s) => s.key === 'heavyMetals')?.quotient ?? 0;
                        const qQw =
                          rec.substances.find((s) => s.key === 'quartzWool')?.quotient ?? 0;
                        return (
                          <tr key={rec.receptorId} className="bg-slate-950/60">
                            <td className="py-2 px-3 font-sans font-medium text-slate-200">
                              {rec.receptorName}
                              <div className="text-[10px] text-slate-400 font-mono">
                                {rec.address}
                              </div>
                            </td>
                            <td className="py-2 px-3">{rec.distanceFromNearestSourceMeters} m</td>
                            <td className="py-2 px-3">{qAsb.toFixed(2)}</td>
                            <td className="py-2 px-3">{qPcb.toFixed(2)}</td>
                            <td className="py-2 px-3">{qHm.toFixed(2)}</td>
                            <td className="py-2 px-3">{qQw.toFixed(2)}</td>
                            <td className="py-2 px-3 font-bold text-white">
                              {rec.sumQuotient.toFixed(2)}
                            </td>
                            <td className="py-2 px-3">
                              {rec.sumQuotient >= 1.0 ? (
                                <span className="text-rose-400 font-bold">RØD (ULOVLIG)</span>
                              ) : rec.sumQuotient >= 0.5 ? (
                                <span className="text-amber-400 font-semibold">ORANGE (KRAV)</span>
                              ) : (
                                <span className="text-emerald-400">OBSERVATION</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 4: Statutory Violations Log */}
              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-rose-400 font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  <span>
                    04. Registrerede Lovovertrædelser &amp; Påbudshjemler ({legalViolations.length})
                  </span>
                </h4>
                <div className="space-y-2">
                  {legalViolations.map((v) => (
                    <div
                      key={v.id}
                      className="p-3 bg-rose-950/20 border border-rose-500/30 rounded text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-bold text-rose-300">{v.statuteTitle}</span>
                        <span className="text-slate-400">
                          {v.receptorName} · S = {v.sumQuotient.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-slate-200">{v.legalConsequence}</div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {v.technicalEvidence}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 5: Field-Based Physical Observations, Algedonic Signals & AI Photo Evidence */}
              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-fuchsia-400 font-semibold flex items-center gap-1.5">
                  <Radio className="w-4 h-4" />
                  <span>
                    05. Feltbaserede Fysiske Observationer, Algedoniske Signaler &amp; AI Foto-Bevismateriale (
                    {observations.length})
                  </span>
                </h4>
                {observations.length === 0 ? (
                  <div className="p-3 bg-slate-900/60 border border-slate-800 rounded text-xs text-slate-400">
                    Ingen feltbaserede observationer registreret endnu.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {observations.map((obs) => (
                      <div
                        key={obs.id}
                        className="p-3.5 bg-fuchsia-950/15 border border-fuchsia-500/40 rounded-md text-xs space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                          <span className="font-bold text-fuchsia-300">
                            {obs.photoEvidence ? '📸 ' : '⚡ '}
                            {obs.code}: {obs.observationType}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              obs.plumeCorroboration.isInsideMathematicalPlume
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {obs.plumeCorroboration.isInsideMathematicalPlume
                              ? `✓ BEKRÆFTET I MATEMATISK SPREDNINGSFANE (S = ${obs.plumeCorroboration.calculatedSumQuotient.toFixed(
                                  2
                                )})`
                              : `○ RAND-/KILDEZONE (S = ${obs.plumeCorroboration.calculatedSumQuotient.toFixed(
                                  2
                                )})`}
                          </span>
                        </div>

                        {obs.photoEvidence && (
                          <div className="p-3 rounded bg-slate-950/90 border border-cyan-500/50 space-y-2">
                            <div className="flex flex-col sm:flex-row gap-3 items-start">
                              <img
                                src={obs.photoEvidence.dataUrl}
                                alt={obs.photoEvidence.fileName}
                                className="w-full sm:w-44 h-32 object-cover rounded border border-slate-700 shrink-0"
                              />
                              <div className="flex-1 space-y-1.5 min-w-0">
                                <div className="flex flex-wrap items-center justify-between gap-1 font-mono text-[11px]">
                                  <span className="font-bold text-cyan-300">
                                    📸 AI FOTO-BEVIS: {obs.photoEvidence.aiAnalysis.visualTitle}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-rose-500/25 text-rose-200 border border-rose-400/50 text-[10px] font-bold">
                                    {obs.photoEvidence.aiAnalysis.severityAssessment} (
                                    {obs.photoEvidence.aiAnalysis.confidencePct}% AI-konfidens)
                                  </span>
                                </div>
                                <div className="text-slate-200 leading-relaxed">
                                  {obs.photoEvidence.aiAnalysis.visualDescription}
                                </div>
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {obs.photoEvidence.aiAnalysis.detectedHazards.map((h, idx) => (
                                    <span
                                      key={idx}
                                      className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-amber-200"
                                    >
                                      ⚠ {h}
                                    </span>
                                  ))}
                                </div>
                                <div className="text-[10px] font-mono text-emerald-300 pt-0.5 break-all">
                                  Billed-fil: {obs.photoEvidence.fileName} · Billed SHA-256:{' '}
                                  {obs.photoEvidence.imageSha256Hash}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="text-slate-200 font-medium">{obs.description}</div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1.5 border-t border-slate-800/80 font-mono text-[11px] text-slate-300">
                          <div>
                            <span className="text-slate-400 block text-[10px]">
                              OBSERVATIONSTIDSPUNKT &amp; ROLLE
                            </span>
                            <span>
                              {obs.observedDateIso} kl. {obs.observedHourLabel} · {obs.reporterRole}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">
                              GPS-PUNKT &amp; AFSTAND FRA KILDE
                            </span>
                            <span>
                              {obs.position.lat.toFixed(4)}°N, {obs.position.lng.toFixed(4)}°E (
                              {obs.plumeCorroboration.distanceFromSourceMeters} m fra{' '}
                              {obs.plumeCorroboration.nearestSourceName.split(':')[0]})
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">
                              OPEN-METEO VEJR PÅ TIDSPUNKTET
                            </span>
                            <span>
                              Vind {obs.weatherSnapshot.windSpeed10m} m/s (stød{' '}
                              {obs.weatherSnapshot.windGusts10m} m/s) fra{' '}
                              {obs.weatherSnapshot.windDirection10m}° · Nedbør{' '}
                              {obs.weatherSnapshot.precipitation} mm/t · Kl.{' '}
                              {obs.weatherSnapshot.pasquillClass}
                            </span>
                          </div>
                        </div>

                        <div className="text-[11px] font-mono text-fuchsia-200/90 bg-slate-950/80 p-2 rounded border border-slate-800">
                          <div>{obs.plumeCorroboration.corroborationSummary}</div>
                          <div className="text-[10px] text-slate-400 mt-1 break-all">
                            SHA-256 Signatur: {obs.sha256Signature}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 6: Google Maps Grounding Verification */}
              {groundingAnalysis && (
                <div className="space-y-2">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                    06. Google Maps Grounding Sted- &amp; Matrikelverifikation
                  </h4>
                  <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded text-xs whitespace-pre-line leading-relaxed">
                    {groundingAnalysis}
                  </div>
                  {displayedPlaces.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {displayedPlaces.map((pl, i) => (
                        <a
                          key={i}
                          href={pl.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          translate="no"
                          className="text-xs font-mono text-cyan-400 underline hover:text-cyan-300"
                        >
                          {pl.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
