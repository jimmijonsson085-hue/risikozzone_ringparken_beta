import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileCheck2,
  FileText,
  Gavel,
  Landmark,
  Scale,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  AlgedonicObservation,
  DispersionSimulationState,
  WeatherDataset,
} from '../types/dispersion';
import {
  buildAutomatedLegalObjectionDocument,
  generateLegalObjectionPdfReport,
  LegalObjectionDocumentType,
} from '../services/pdfExportService';

export interface LegalObjectionGeneratorModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  embeddedMode?: boolean;
  weatherDataset: WeatherDataset;
  simulation: DispersionSimulationState;
  observations: AlgedonicObservation[];
  sha256Hash: string;
  relaxationTimeTrHours?: number;
  crisisIntervalDtHours?: number;
}

const OBJECTION_TAB_OPTIONS: Array<{
  id: LegalObjectionDocumentType;
  shortTitleDa: string;
  subtitleDa: string;
  accentColor: string;
}> = [
  {
    id: 'vvm_salami_waddenzee',
    shortTitleDa: '1. VVM-"Salami-Metode" & Waddenzee (C-127/02)',
    subtitleDa:
      'Aarhuskonventionen & EU-Domstolen C-127/02 · Krav om standsningspåbud ved S ≥ 1,0',
    accentColor: 'border-cyan-400 text-cyan-200 bg-cyan-950/50',
  },
  {
    id: 'l69_criminal_filing',
    shortTitleDa: '2. Strafferetslig Anmeldelse (Lovforslag L 69)',
    subtitleDa:
      'JFL §§ 8, 12, 50, 70 stk. 4, 72 & 88 · 15.000–100.000 kr. + 2–3x ΔE_besparelse',
    accentColor: 'border-rose-400 text-rose-200 bg-rose-950/50',
  },
  {
    id: 'eu_c417_23_prejudicial',
    shortTitleDa: '3. Præjudiciel EU-Notifikation (Sag C-417/23)',
    subtitleDa:
      'Ligebehandlingsdirektivet 2000/43/EF · Blok 1, 9 & 10 · EU-retlig forrang & erstatningsansvar',
    accentColor: 'border-amber-400 text-amber-200 bg-amber-950/50',
  },
];

export const LegalObjectionGeneratorModal: React.FC<
  LegalObjectionGeneratorModalProps
> = ({
  isOpen = true,
  onClose,
  embeddedMode = false,
  weatherDataset,
  simulation,
  observations,
  sha256Hash,
  relaxationTimeTrHours = 18.5,
  crisisIntervalDtHours = 3.2,
}) => {
  const [selectedDocType, setSelectedDocType] =
    useState<LegalObjectionDocumentType>('vvm_salami_waddenzee');
  const [economicSavingDkk, setEconomicSavingDkk] = useState<number>(480000);
  const [copiedState, setCopiedState] = useState<boolean>(false);
  const [pdfDownloadedState, setPdfDownloadedState] = useState<boolean>(false);
  const [txtDownloadedState, setTxtDownloadedState] = useState<boolean>(false);

  const generatedDoc = useMemo(
    () =>
      buildAutomatedLegalObjectionDocument({
        docType: selectedDocType,
        dateIso: weatherDataset.dateIso,
        hourLabel: simulation.currentWeather.hourLabel,
        simulation,
        observations,
        sha256Hash,
        relaxationTimeTrHours,
        crisisIntervalDtHours,
        economicSavingDkk,
      }),
    [
      selectedDocType,
      weatherDataset.dateIso,
      simulation,
      observations,
      sha256Hash,
      relaxationTimeTrHours,
      crisisIntervalDtHours,
      economicSavingDkk,
    ]
  );

  if (!embeddedMode && !isOpen) return null;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generatedDoc.bodyText);
      setCopiedState(true);
      window.setTimeout(() => setCopiedState(false), 2500);
    } catch {
      // ignore clipboard error
    }
  };

  const handleDownloadPdf = () => {
    generateLegalObjectionPdfReport({
      docType: selectedDocType,
      dateIso: weatherDataset.dateIso,
      hourLabel: simulation.currentWeather.hourLabel,
      simulation,
      observations,
      sha256Hash,
      relaxationTimeTrHours,
      crisisIntervalDtHours,
      economicSavingDkk,
    });
    setPdfDownloadedState(true);
    window.setTimeout(() => setPdfDownloadedState(false), 3000);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([generatedDoc.bodyText], {
      type: 'text/plain;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ringparken_Juridisk_Indsigelse_${selectedDocType}_${weatherDataset.dateIso}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setTxtDownloadedState(true);
    window.setTimeout(() => setTxtDownloadedState(false), 2500);
  };

  const innerContent = (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="p-3.5 rounded-md bg-slate-900/95 border border-amber-500/50 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider font-extrabold text-amber-300">
            <Scale className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Automatisk EU- &amp; Miljøretlig Indsigelses-, Anmeldelses- og Påbudsgenerator (ZKP &amp; SHA-256)
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Genererer automatisk tre indsendelsesklare juridiske processkrifter baseret på de{' '}
            <strong className="text-white">{observations.length}</strong> registrerede SHA-256 /
            Zero-Knowledge Proof (ZKP) observationer, aktuel Sumkvotient{' '}
            <strong className="text-rose-300">
              S = {simulation.maxSiteSumQuotient.toFixed(2)}
            </strong>{' '}
            og kybernetisk afslapningstid{' '}
            <strong className="text-cyan-300">
              Tr = {relaxationTimeTrHours.toFixed(1)}t vs. Δt = {crisisIntervalDtHours.toFixed(1)}t
            </strong>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {pdfDownloadedState
                ? '✓ Officiel PDF Downloadet!'
                : 'Download Indsigelse som PDF'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleDownloadTxt}
            className="px-2.5 py-1.5 rounded bg-slate-950 hover:bg-slate-800 border border-cyan-500/50 text-cyan-200 font-mono text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{txtDownloadedState ? '✓ .TXT Downloadet' : 'Download .TXT'}</span>
          </button>
          <button
            type="button"
            onClick={handleCopyText}
            className="px-2.5 py-1.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 font-mono text-xs font-semibold flex items-center gap-1 cursor-pointer"
          >
            {copiedState ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Kopieret!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Kopiér Processkrift</span>
              </>
            )}
          </button>
          {!embeddedMode && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 3 Document Type Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {OBJECTION_TAB_OPTIONS.map((opt) => {
          const isSelected = selectedDocType === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelectedDocType(opt.id)}
              className={`p-3 rounded-md border text-left transition-all cursor-pointer space-y-1 ${
                isSelected
                  ? `${opt.accentColor} border border-l-4`
                  : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-mono font-extrabold text-white">
                {opt.shortTitleDa}
              </div>
              <div className="text-[11px] text-slate-300 leading-snug">{opt.subtitleDa}</div>
            </button>
          );
        })}
      </div>

      {/* Optional Economic Saving Adjuster when L 69 Criminal Filing is selected */}
      {selectedDocType === 'l69_criminal_filing' && (
        <div className="p-3 rounded bg-rose-950/35 border border-rose-500/50 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div>
            <span className="text-rose-200 font-bold">
              Lovforslag L 69 Sparet Saneringsudgift (ΔE_besparelse):
            </span>{' '}
            <strong className="text-amber-300">
              {economicSavingDkk.toLocaleString('da-DK')} kr.
            </strong>{' '}
            <span className="text-slate-300">
              (2,0x bødetillæg = {(economicSavingDkk * 2).toLocaleString('da-DK')} kr. · 3,0x uden
              konfiskation = {(economicSavingDkk * 3).toLocaleString('da-DK')} kr.)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {[250000, 480000, 850000].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setEconomicSavingDkk(val)}
                className={`px-2 py-0.5 rounded border text-[11px] cursor-pointer ${
                  economicSavingDkk === val
                    ? 'bg-rose-500 text-slate-950 border-rose-300 font-bold'
                    : 'bg-slate-950 text-slate-300 border-slate-800'
                }`}
              >
                {(val / 1000).toFixed(0)}k kr.
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recipients & Statutory Metadata Strip */}
      <div className="p-3 rounded bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-mono text-[11px] text-slate-300">
            <span className="text-slate-400 uppercase">Modtagende Myndigheder:</span>{' '}
            <strong className="text-white">
              {generatedDoc.recipientAuthoritiesDa.join(' · ')}
            </strong>
          </div>
          <div className="font-mono text-[11px] text-emerald-300">
            ZKP Right-to-Opacity: AKTIV · SHA-256: {sha256Hash.slice(0, 20)}...
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-amber-300">
          {generatedDoc.legalBasisBadges.map((b, i) => (
            <React.Fragment key={b}>
              {i > 0 && <span className="text-slate-600">·</span>}
              <span>{b}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Full Generated Legal Document Text */}
      <div className="p-4 rounded-md bg-slate-950 border border-slate-800 font-mono text-xs text-slate-100 whitespace-pre-wrap leading-relaxed max-h-[520px] overflow-y-auto select-all">
        {generatedDoc.bodyText}
      </div>
    </div>
  );

  if (embeddedMode) {
    return innerContent;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0B0E17] border border-amber-500/60 rounded-lg max-w-5xl w-full max-h-[92vh] overflow-y-auto p-5 shadow-2xl">
        {innerContent}
      </div>
    </div>
  );
};
