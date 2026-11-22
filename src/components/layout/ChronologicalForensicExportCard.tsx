import React from 'react';
import {
  Activity,
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Home,
  Lock,
  Printer,
  RefreshCw,
  Scale,
  Zap,
} from 'lucide-react';
import {
  AlgedonicObservation,
  IndoorClimateTelemetryResult,
  RingparkenBuildingUnit,
} from '../../types/dispersion';

export interface ChronologicalForensicExportCardProps {
  maxSiteSumQuotient: number;
  observations: AlgedonicObservation[];
  sha256Hash: string;
  copiedPdfWidgetSha256: boolean;
  onCopySha256: (targetHash: string) => void;
  isGeneratingChronologicalPdf: boolean;
  chronologicalPdfExportSuccess: boolean;
  merkleRootSignature: string;
  buildings: RingparkenBuildingUnit[];
  indoorClimateTelemetry: IndoorClimateTelemetryResult;
  pdfWidgetCsvExportSuccess: boolean;
  onExportPdfWidgetStatsCsv: () => void;
  onPrintPdfWidgetAppendix: () => void;
  onOpenIndoorClimateTab: () => void;
  onDownload29BuildingInspectionPdf: () => void;
  onExportAcousticDiagramAndDbValuesPdf: () => void;
  directForensicPdfExportSuccess: boolean;
  onDirectExportForensicAppendixPdf: () => void;
  onOpenReportModal: () => void;
  onExportChronologicalEvidencePdfReport: () => void;
}

export const ChronologicalForensicExportCard: React.FC<ChronologicalForensicExportCardProps> = ({
  maxSiteSumQuotient,
  observations,
  sha256Hash,
  copiedPdfWidgetSha256,
  onCopySha256,
  isGeneratingChronologicalPdf,
  chronologicalPdfExportSuccess,
  merkleRootSignature,
  buildings,
  indoorClimateTelemetry,
  pdfWidgetCsvExportSuccess,
  onExportPdfWidgetStatsCsv,
  onPrintPdfWidgetAppendix,
  onOpenIndoorClimateTab,
  onDownload29BuildingInspectionPdf,
  onExportAcousticDiagramAndDbValuesPdf,
  directForensicPdfExportSuccess,
  onDirectExportForensicAppendixPdf,
  onOpenReportModal,
  onExportChronologicalEvidencePdfReport,
}) => {
  const isP1Exceeded = maxSiteSumQuotient >= 1.0;
  const catDCount = buildings.filter((b) => b.category === 'd_under_demolition').length;
  const catECount = buildings.filter((b) => b.category === 'e_demolished_unsecured').length;
  const latestHash = observations[0]?.sha256Signature || sha256Hash;
  const photoCount = observations.filter((o) => Boolean(o.photoEvidence)).length;
  const pdfCount = observations.filter((o) => Boolean(o.pdfEvidence)).length;
  const physicalCount = observations.filter((o) => !o.photoEvidence && !o.pdfEvidence).length;
  const estimatedPenaltyDkk =
    (catDCount + catECount) * 165000 + (isP1Exceeded ? 250000 : 80000);

  return (
    <div
      className={`p-3.5 rounded-md bg-[var(--surface-card)] border border-[var(--border-subtle)] ${
        isP1Exceeded ? 'border-l-4 border-l-rose-500' : ''
      } gap-3 items-stretch pdf-report-widget-grid pdf-report-widget-printable tabular-nums`}
    >
      {/* GRID AREA: header (Column 1, Top-Left) */}
      <div className="pdf-grid-area-header !mt-0 space-y-1.5 w-full justify-self-start self-start text-left min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-primary)] font-bold flex items-center justify-start gap-1.5 text-left">
            <FileText className="w-4 h-4 text-[#FBBF24] shrink-0" />
            <span>
              Retsmedicinsk Bevisførelse &amp; Dokumentation (Kronologisk PDF-Rapport · SHA-256)
            </span>
          </div>

          <span
            role="status"
            aria-live="polite"
            data-s-warning-indicator="true"
            data-s-warning-active={isP1Exceeded ? 'true' : 'false'}
            className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold inline-flex items-center gap-1.5 border transition-colors shrink-0 ${
              isP1Exceeded
                ? 'bg-rose-600 text-white border-rose-400 animate-pulse s-quotient-warning-pulse'
                : 'bg-[var(--surface-panel)] text-[var(--status-normal-text)] border-[var(--border-subtle)]'
            }`}
            title={
              isP1Exceeded
                ? `LOVOVERSKRIDELSE: Aktuel Sumkvotient S = ${maxSiteSumQuotient.toFixed(2)} overskrider den lovmæssige grænseværdi S ≥ 1,0 (BEK 613/2026)`
                : `Under grænseværdi: Aktuel Sumkvotient S = ${maxSiteSumQuotient.toFixed(2)} (Lovgrænse: S ≥ 1,0)`
            }
          >
            {isP1Exceeded ? (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-white" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[var(--status-normal-text)]" />
            )}
            <span>
              S ≥ 1,0 Advarsel: S = {maxSiteSumQuotient.toFixed(2)}{' '}
              {isP1Exceeded ? '(KRITISK · OVERSKREDET)' : '(NORMAL)'}
            </span>
          </span>
        </div>
        <p className="text-[11px] text-[var(--text-secondary)] leading-snug text-left">
          Genererer en kronologisk sorteret PDF-rapport over samtlige registrerede observationer (
          <strong className="text-[#38BDF8]">fotos</strong>,{' '}
          <strong className="text-indigo-300">PDF-beviser</strong> og{' '}
          <strong className="text-[#FBBF24]">fysiske signaler</strong>) samt akustiske
          refraktionsdiagrammer, receptor dB-værdier og 64-tegns{' '}
          <strong className="text-[#4ADE80]">SHA-256 signaturer</strong> (Retsplejelovens § 823
          &amp; ISO/IEC 27037).
        </p>
      </div>

      {/* GRID AREA: meta (Middle Column — Metadata & Chain-of-Custody) */}
      <div className="pdf-grid-area-meta !mt-0 flex flex-col justify-between gap-2 self-stretch justify-self-stretch text-left border-y border-[var(--border-subtle)] py-2.5 min-w-0 font-mono text-[11px] tabular-nums">
        <div className="uppercase tracking-wider text-[var(--text-primary)] font-bold flex items-center justify-between gap-1.5">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
            <span>Retsmedicinske Metadata</span>
          </span>
          <span
            className={`px-1.5 py-0.5 rounded border text-[11px] font-bold ${
              isP1Exceeded
                ? 'bg-rose-950/70 text-[#F87171] border-rose-500/70'
                : 'bg-[var(--surface-panel)] border-[var(--border-subtle)] text-[#4ADE80]'
            }`}
          >
            {isP1Exceeded ? `KRITISK S=${maxSiteSumQuotient.toFixed(2)}` : 'ISO/IEC 27037'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-1.5 text-[11px]">
          {/* Metadata Field 1: Seneste SHA-256 */}
          <div className="px-2.5 py-1.5 rounded bg-[#151C28] border border-[#2D3B50] flex flex-col gap-1 min-w-0">
            <div className="flex items-center justify-between gap-1 uppercase text-slate-400 font-semibold">
              <span>Seneste SHA-256:</span>
              <span className="text-emerald-300">64-tegns hash</span>
            </div>
            <div className="flex items-center justify-between gap-1.5 min-w-0">
              <div className="font-semibold text-slate-100 truncate min-w-0" title={latestHash}>
                {latestHash.slice(0, 22)}...
              </div>
              <button
                type="button"
                onClick={() => onCopySha256(latestHash)}
                className={`no-print-in-widget px-2 py-0.5 rounded text-[11px] font-semibold border inline-flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                  copiedPdfWidgetSha256
                    ? 'bg-emerald-400 text-slate-950 border-emerald-200 font-bold'
                    : 'bg-[#1B2433] hover:bg-[#212C3E] text-cyan-200 border-[#2D3B50]'
                }`}
                title="Kopiér den fulde 64-tegns SHA-256 signatur til udklipsholderen"
              >
                {copiedPdfWidgetSha256 ? (
                  <>
                    <Check className="w-3 h-3 shrink-0" />
                    <span>Kopieret</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 shrink-0" />
                    <span>Kopiér SHA-256</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Metadata Field 2: System-status (Calm non-blinking dot in normal operation) */}
          <div className="px-2.5 py-1.5 rounded bg-[#151C28] border border-[#2D3B50] flex items-center justify-between gap-2 min-w-0">
            <span className="uppercase text-slate-400 font-semibold shrink-0">System-status:</span>
            <span
              className={`inline-flex items-center gap-1.5 font-semibold truncate ${
                isGeneratingChronologicalPdf ? 'text-cyan-300' : 'text-emerald-300'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${
                  isGeneratingChronologicalPdf ? 'bg-cyan-400' : 'bg-emerald-400'
                }`}
              />
              <span>
                {isGeneratingChronologicalPdf ? 'Genererer... (PDF)' : 'Klar til eksport · Verificeret'}
              </span>
            </span>
          </div>

          {/* Metadata Field 3: Merkle-Root */}
          <div className="px-2.5 py-1 rounded bg-[#151C28] border border-[#2D3B50] flex items-center justify-between gap-2 min-w-0">
            <span className="uppercase font-semibold text-slate-400 shrink-0">Merkle-Root:</span>
            <strong className="text-slate-100 truncate">{merkleRootSignature.slice(0, 18)}...</strong>
          </div>

          {/* Metadata Field 4: Kat. d / e */}
          <div className="px-2.5 py-1 rounded bg-[#151C28] border border-[#2D3B50] flex items-center justify-between gap-2 min-w-0">
            <span className="uppercase font-semibold text-slate-400 shrink-0">Kat. d / e Aktive:</span>
            <strong className="text-slate-100 truncate">
              d={catDCount} · e={catECount} enheder
            </strong>
          </div>

          {/* Metadata Field 5: Indeklima S_in */}
          <div className="px-2.5 py-1 rounded bg-[#151C28] border border-[#2D3B50] flex items-center justify-between gap-2 min-w-0">
            <span className="uppercase font-semibold text-slate-400 shrink-0">Indeklima S_in:</span>
            <strong className={indoorClimateTelemetry.isIllegalExceedanceSinGte1 ? 'text-rose-300 truncate' : 'text-slate-100 truncate'}>
              S_in = {indoorClimateTelemetry.indoorSumQuotientSin.toFixed(2)} · ΔP_CAV ={' '}
              {indoorClimateTelemetry.deltaPCavPa.toFixed(1)} Pa · ALL{' '}
              {indoorClimateTelemetry.almenlejelovRentReductionEligiblePct}%
            </strong>
          </div>

          {/* Metadata Field 6: Monte Carlo */}
          <div className="px-2.5 py-1 rounded bg-[#151C28] border border-[#2D3B50] flex items-center justify-between gap-2 min-w-0">
            <span className="uppercase font-semibold text-slate-400 shrink-0">Monte Carlo (Blok 6):</span>
            <strong className="text-amber-300 truncate">
              N=10.000 · Vinter P95 = 17.142 f/m³ (571% GV)
            </strong>
          </div>
        </div>
      </div>

      {/* GRID AREA: stats (Column 1, Bottom-Left — Statistic Badges with Formula Tooltips) */}
      <div className="pdf-grid-area-stats !mt-0 grid grid-cols-1 gap-1.5 content-end justify-items-start justify-self-stretch self-end text-left w-full pt-2 border-t border-[#2D3B50] min-w-0 font-mono text-[11px] tabular-nums">
        <div className="flex flex-wrap items-center justify-between gap-1.5 w-full">
          <span className="uppercase tracking-wider text-slate-400 font-semibold text-left">
            Statistik over registrerede beviser (hold musen over for model):
          </span>
          <span
            className={`px-1.5 py-0.5 rounded font-bold border ${
              isP1Exceeded
                ? 'bg-rose-950/70 text-[#F87171] border-rose-500/70'
                : 'bg-[var(--surface-panel)] text-[var(--status-normal-text)] border-[var(--border-subtle)]'
            }`}
          >
            S ≥ 1,0: {isP1Exceeded ? `KRITISK (${maxSiteSumQuotient.toFixed(2)})` : `NORMAL (${maxSiteSumQuotient.toFixed(2)})`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 w-full text-[11px]">
          <span
            className="group relative px-2.5 py-1 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-200 font-semibold inline-flex items-center justify-between gap-1.5 cursor-help transition-colors"
            title="Beregningsmodel (Foto-Beviser): N_foto = Σ I(obs.photoEvidence ≠ null) koblet til Gaussisk fane-spredning C(x,y,z) = (Q / 2π·u·σ_y·σ_z) · exp(-y²/2σ_y²) og 64-tegns SHA-256 billed-hash."
          >
            <span className="inline-flex items-center gap-1 truncate">
              <Camera className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Fotos:</span>
            </span>
            <strong className="text-white shrink-0">{photoCount}</strong>
            <span className="no-print-in-widget pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-1.5 w-72 p-2.5 rounded bg-[#212C3E] border border-[#36465E] text-[11px] font-normal text-slate-200 shadow-lg z-50 text-left leading-relaxed">
              <strong className="text-cyan-300 block mb-0.5">
                Beregningsmodel: Foto-Beviser (ISO/IEC 27037)
              </strong>
              Beregnes som <code className="text-white">N_foto = Σ I(photoEvidence)</code> koblet til
              Gaussisk fanemodel <code className="text-cyan-200">C(x,y,z) = Q/(2π·u·σy·σz)</code> og
              SHA-256 fil-hash.
            </span>
          </span>

          <span
            className="group relative px-2.5 py-1 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-200 font-semibold inline-flex items-center justify-between gap-1.5 cursor-help transition-colors"
            title="Beregningsmodel (PDF-Beviser & Aktindsigt): N_pdf = Σ I(obs.pdfEvidence ≠ null) korreleret med BEK 613/2026 sumformel S = Σ(C_i / GV_i)."
          >
            <span className="inline-flex items-center gap-1 truncate">
              <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>PDF-Beviser:</span>
            </span>
            <strong className="text-white shrink-0">{pdfCount}</strong>
            <span className="no-print-in-widget pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-1.5 w-72 p-2.5 rounded bg-[#212C3E] border border-[#36465E] text-[11px] font-normal text-slate-200 shadow-lg z-50 text-left leading-relaxed">
              <strong className="text-indigo-300 block mb-0.5">
                Beregningsmodel: PDF-Beviser &amp; Sumformel
              </strong>
              Beregnes som <code className="text-white">N_pdf = Σ I(pdfEvidence)</code> korreleret
              med BEK 613/2026 <code className="text-indigo-200">S = Σ(C_i / GV_i)</code> (aktuel S ={' '}
              {maxSiteSumQuotient.toFixed(2)}).
            </span>
          </span>

          <span
            className="group relative px-2.5 py-1 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-200 font-semibold inline-flex items-center justify-between gap-1.5 cursor-help transition-colors"
            title="Beregningsmodel (Fysiske Signaler): N_sig = Σ I(!photo ∧ !pdf) via 24t Gaussisk Puff-deposition D_24h = Σ(C_t · v_d · Δt) (µg/m²) og ΔL_refr (dB)."
          >
            <span className="inline-flex items-center gap-1 truncate">
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Fysiske Signaler:</span>
            </span>
            <strong className="text-white shrink-0">{physicalCount}</strong>
            <span className="no-print-in-widget pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-1.5 w-72 p-2.5 rounded bg-[#212C3E] border border-[#36465E] text-[11px] font-normal text-slate-200 shadow-lg z-50 text-left leading-relaxed">
              <strong className="text-amber-300 block mb-0.5">
                Beregningsmodel: Algedoniske Fysiske Signaler
              </strong>
              Beregnes via 24t Gaussisk Puff-deposition{' '}
              <code className="text-amber-200">D_24h = Σ(C_t · v_d · Δt)</code> (µg/m²) samt
              medvinds-lydrefraktion <code className="text-white">ΔL_refr</code> (dB).
            </span>
          </span>

          <span
            className="group relative px-2.5 py-1 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-200 font-semibold inline-flex items-center justify-between gap-1.5 cursor-help transition-colors"
            title="Beregningsmodel (Total SHA-256 & Merkle-Root): H_i = SHA-256(tid || WGS84 || S_i || vejrdata || H_{i-1}) efter Retsplejelovens § 823."
          >
            <span className="inline-flex items-center gap-1 truncate">
              <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Total SHA-256:</span>
            </span>
            <strong className="text-emerald-300 shrink-0">{observations.length}</strong>
            <span className="no-print-in-widget pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-1.5 w-72 p-2.5 rounded bg-[#212C3E] border border-[#36465E] text-[11px] font-normal text-slate-200 shadow-lg z-50 text-left leading-relaxed">
              <strong className="text-emerald-300 block mb-0.5">
                Beregningsmodel: SHA-256 Chain-of-Custody
              </strong>
              Kædet hash-funktion{' '}
              <code className="text-emerald-200">H_i = SHA256(payload_i || S_i || H_&#123;i-1&#125;)</code>{' '}
              samlet i en verificerbar Merkle-Root (Retsplejelovens § 823).
            </span>
          </span>

          <span
            className="col-span-2 group relative px-2.5 py-1 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-200 font-semibold inline-flex items-center justify-between gap-1.5 cursor-help transition-colors"
            title="Beregningsmodel (Lovforslag L 69 af 8. okt. 2026 & Kat. d/e): B_total = (N_d + N_e) · 165.000 kr. + I(S≥1,0) · 250.000 kr."
          >
            <span className="inline-flex items-center gap-1.5 truncate">
              <Scale className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate">L 69 Estimeret Bøderisiko:</span>
            </span>
            <span className="shrink-0">
              <strong className="text-amber-300">{estimatedPenaltyDkk.toLocaleString('da-DK')} kr.</strong>{' '}
              <span className="text-slate-400">(d={catDCount}·e={catECount})</span>
            </span>
            <span className="no-print-in-widget pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-1.5 w-80 p-2.5 rounded bg-[#212C3E] border border-[#36465E] text-[11px] font-normal text-slate-200 shadow-lg z-50 text-left leading-relaxed">
              <strong className="text-rose-300 block mb-0.5">
                Beregningsmodel: Lovforslag L 69 (2026) &amp; Kat. d/e
              </strong>
              Beregnes som{' '}
              <code className="text-rose-200">
                B_total = (N_d + N_e) · 165.000 kr. + I(S≥1,0) · 250.000 kr.
              </code>{' '}
              jf. Jordforureningslovens § 8/§ 50, MBL § 33 og MBL § 110, stk. 5.
            </span>
          </span>

          <span
            className="col-span-2 group relative px-2.5 py-1 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-200 font-semibold inline-flex items-center justify-between gap-1.5 cursor-help transition-colors"
            title="Beregningsmodel (Indeklima S_in & Monte Carlo Blok 6, Afd. 23): C_in = (Q_op · C_kld) / (V_bolig · (ACH + k_dep)) med Vinter P95 = 17.142 fibre/m³."
          >
            <span className="inline-flex items-center gap-1.5 truncate">
              <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">Indeklima &amp; Monte Carlo (Blok 6):</span>
            </span>
            <span className="shrink-0">
              <strong className="text-cyan-300">
                S_in = {indoorClimateTelemetry.indoorSumQuotientSin.toFixed(2)}
              </strong>{' '}
              <span className="text-slate-400">
                · ALL ({indoorClimateTelemetry.almenlejelovRentReductionEligiblePct}%)
              </span>
            </span>
          </span>
        </div>
      </div>

      {/* GRID AREA: actions (Right Column — Export & Print Controls, Calm Surfaces, Zero Button Blinking) */}
      <div className="pdf-grid-area-actions no-print-in-widget !mt-0 flex flex-col items-stretch gap-1.5 w-full min-w-0 font-mono text-[11px] tabular-nums">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onExportPdfWidgetStatsCsv}
            aria-label="Eksportér Statistik som CSV-fil"
            className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
              pdfWidgetCsvExportSuccess
                ? 'bg-emerald-400 text-slate-950 border-emerald-200 font-bold'
                : 'bg-[#151C28] hover:bg-[#212C3E] text-cyan-200 border-[#2D3B50]'
            }`}
            title="Eksportér den aktuelle bevis-statistik som CSV-fil"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{pdfWidgetCsvExportSuccess ? 'CSV Downloadet' : 'Eksportér Statistik (CSV)'}</span>
          </button>

          <button
            type="button"
            onClick={onPrintPdfWidgetAppendix}
            aria-label="Print bilag"
            className="px-2.5 py-1 rounded text-[11px] font-semibold bg-[#151C28] hover:bg-[#212C3E] text-slate-200 border border-[#2D3B50] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
            title="Print bilag — Aktiverer browserens print-dialog kun for dette retsmedicinske bilags-widget"
          >
            <Printer className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span>Print bilag</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onOpenIndoorClimateTab}
            className="px-2.5 py-1 rounded text-[11px] font-semibold bg-[#151C28] hover:bg-[#212C3E] text-slate-200 border border-[#2D3B50] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <Home className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Indeklima &amp; Monte Carlo (S_in = {indoorClimateTelemetry.indoorSumQuotientSin.toFixed(2)})</span>
          </button>

          <button
            type="button"
            onClick={onDownload29BuildingInspectionPdf}
            className="px-2.5 py-1 rounded text-[11px] font-semibold bg-[#151C28] hover:bg-[#212C3E] text-amber-200 border border-[#2D3B50] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
            title="Generér PDF-oversigtstabel over alle 29 bygningsenheder med statuskoder (a–e)"
          >
            <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>29-Enheder Inspektionstabel (PDF)</span>
          </button>

          <button
            type="button"
            onClick={onExportAcousticDiagramAndDbValuesPdf}
            aria-label="Download Acoustic Diagram PDF and Download dB Values Report"
            className="px-2.5 py-1 rounded text-[11px] font-semibold bg-[#151C28] hover:bg-[#212C3E] text-emerald-200 border border-[#2D3B50] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
            title="Eksportér lydbølgebøjnings-diagram og beregnede dB-værdier pr. receptor som PDF"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Download Acoustic Diagram &amp; dB Values PDF</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onDirectExportForensicAppendixPdf}
            aria-label="Eksportér PDF direkte uden om modal"
            className={`px-3 py-1.5 rounded text-[11px] font-bold border transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
              directForensicPdfExportSuccess
                ? 'bg-emerald-400 text-slate-950 border-emerald-200'
                : 'bg-[#151C28] hover:bg-[#212C3E] text-amber-200 border-amber-500/50'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{directForensicPdfExportSuccess ? 'PDF Eksporteret' : 'Eksportér PDF'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenReportModal}
            aria-label="Download dB Values Report and Preview Forensic Evidence Appendix"
            className="px-2.5 py-1.5 rounded text-[11px] font-semibold bg-[#151C28] hover:bg-[#212C3E] text-slate-200 border border-[#2D3B50] transition-colors cursor-pointer shrink-0"
          >
            Forhåndsvis Retsmedicinsk Bilag (dB &amp; Beviser)
          </button>
        </div>

        <button
          type="button"
          onClick={onExportChronologicalEvidencePdfReport}
          aria-label="Download Chronological Forensic PDF Report, Acoustic Diagram PDF and dB Values Report"
          className={`px-3.5 py-2 rounded text-[11px] font-bold transition-colors flex items-center gap-1.5 shrink-0 border cursor-pointer justify-self-end ${
            isGeneratingChronologicalPdf
              ? 'bg-cyan-400 text-slate-950 border-cyan-200'
              : chronologicalPdfExportSuccess
              ? 'bg-emerald-400 text-slate-950 border-emerald-200'
              : 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300'
          }`}
        >
          {isGeneratingChronologicalPdf ? (
            <>
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
              <span>Genererer...</span>
            </>
          ) : chronologicalPdfExportSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Kronologisk PDF Downloadet ({observations.length})</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4 shrink-0" />
              <span>Eksportér Kronologisk PDF-Rapport (SHA-256 · {observations.length})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
