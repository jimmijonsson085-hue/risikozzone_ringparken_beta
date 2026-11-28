/**
 * @file src/components/WeeklyExternalAuditWidget.tsx
 * @description Automatisk Uge-Revisionsmodul der genererer en omfattende PDF-rapport
 * for den seneste uges miljømålinger (støj, støv og vejr) til ekstern revision.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  CloudRain,
  Download,
  FileCheck2,
  ShieldAlert,
  Volume2,
  Wind,
} from 'lucide-react';
import {
  AlgedonicObservation,
  DemolitionSourceNode,
  ReceptorZone,
} from '../types/dispersion';
import {
  WeeklyExternalAuditSummary,
  buildWeeklyExternalAuditSummary,
  generateWeeklyExternalAuditPdf,
} from '../services/weeklyExternalAuditPdfService';

export interface WeeklyExternalAuditWidgetProps {
  dateIso: string;
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  observations?: AlgedonicObservation[];
  manualMachineNoiseOutputDb?: number;
  isManualMachineNoiseOverrideActive?: boolean;
  merkleRootSignature?: string;
}

interface GeneratedRevisionRecord {
  id: string;
  fileName: string;
  periodLabel: string;
  generatedAtIso: string;
  mode: 'Automatisk' | 'Manuel';
  sha256: string;
}

const AUTO_WEEKLY_ENABLED_KEY = 'ringparken_auto_weekly_audit_enabled_v1';
const LAST_WEEK_KEY = 'ringparken_last_auto_weekly_audit_period_v1';

export const WeeklyExternalAuditWidget: React.FC<
  WeeklyExternalAuditWidgetProps
> = ({
  dateIso,
  sources,
  receptors,
  observations = [],
  manualMachineNoiseOutputDb = 114,
  isManualMachineNoiseOverrideActive = false,
  merkleRootSignature,
}) => {
  const [autoDownloadOnWeekRollover, setAutoDownloadOnWeekRollover] =
    useState<boolean>(() => {
      try {
        const saved = localStorage.getItem(AUTO_WEEKLY_ENABLED_KEY);
        return saved === null ? true : saved === 'true';
      } catch {
        return true;
      }
    });

  const [lastExport, setLastExport] = useState<GeneratedRevisionRecord | null>(
    null
  );
  const [revisionHistory, setRevisionHistory] = useState<
    GeneratedRevisionRecord[]
  >([]);
  const initialMountPeriodRef = useRef<string | null>(null);

  const summary: WeeklyExternalAuditSummary = useMemo(
    () =>
      buildWeeklyExternalAuditSummary({
        dateIso,
        sources,
        receptors,
        observations,
        manualMachineNoiseOutputDb,
        isManualMachineNoiseOverrideActive,
        merkleRootSignature,
      }),
    [
      dateIso,
      sources,
      receptors,
      observations,
      manualMachineNoiseOutputDb,
      isManualMachineNoiseOverrideActive,
      merkleRootSignature,
    ]
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        AUTO_WEEKLY_ENABLED_KEY,
        String(autoDownloadOnWeekRollover)
      );
    } catch {
      // Ignore storage errors
    }
  }, [autoDownloadOnWeekRollover]);

  // Automatisk generering & arkivering af ugerapport ved skift til en ny 7-døgns periode
  useEffect(() => {
    if (initialMountPeriodRef.current === null) {
      initialMountPeriodRef.current = summary.periodEndIso;
      // Klargør automatisk første uge-revisionspost i historikken uden at åbne download-dialog på opstart
      setRevisionHistory((prev) =>
        prev.length > 0
          ? prev
          : [
              {
                id: summary.reportId,
                fileName: `Ringparken_Ekstern_Revision_Ugerapport_${summary.periodEndIso}.pdf`,
                periodLabel: summary.periodLabel,
                generatedAtIso: new Date().toISOString(),
                mode: 'Automatisk',
                sha256: summary.auditSha256,
              },
            ]
      );
      return;
    }

    if (
      autoDownloadOnWeekRollover &&
      initialMountPeriodRef.current !== summary.periodEndIso
    ) {
      initialMountPeriodRef.current = summary.periodEndIso;
      try {
        const lastSaved = localStorage.getItem(LAST_WEEK_KEY);
        if (lastSaved === summary.periodEndIso) return;
        localStorage.setItem(LAST_WEEK_KEY, summary.periodEndIso);
      } catch {
        // Ignore storage errors
      }

      const res = generateWeeklyExternalAuditPdf({
        dateIso,
        sources,
        receptors,
        observations,
        manualMachineNoiseOutputDb,
        isManualMachineNoiseOverrideActive,
        merkleRootSignature,
      });
      const rec: GeneratedRevisionRecord = {
        id: `${res.summary.reportId}-${Date.now()}`,
        fileName: res.fileName,
        periodLabel: res.summary.periodLabel,
        generatedAtIso: res.exportedAtIso,
        mode: 'Automatisk',
        sha256: res.summary.auditSha256,
      };
      setLastExport(rec);
      setRevisionHistory((prev) => [rec, ...prev].slice(0, 5));
    }
  }, [
    autoDownloadOnWeekRollover,
    summary.periodEndIso,
    summary.periodLabel,
    summary.reportId,
    summary.auditSha256,
    dateIso,
    sources,
    receptors,
    observations,
    manualMachineNoiseOutputDb,
    isManualMachineNoiseOverrideActive,
    merkleRootSignature,
  ]);

  const handleManualExport = () => {
    const res = generateWeeklyExternalAuditPdf({
      dateIso,
      sources,
      receptors,
      observations,
      manualMachineNoiseOutputDb,
      isManualMachineNoiseOverrideActive,
      merkleRootSignature,
    });
    const rec: GeneratedRevisionRecord = {
      id: `${res.summary.reportId}-${Date.now()}`,
      fileName: res.fileName,
      periodLabel: res.summary.periodLabel,
      generatedAtIso: res.exportedAtIso,
      mode: 'Manuel',
      sha256: res.summary.auditSha256,
    };
    setLastExport(rec);
    setRevisionHistory((prev) => [rec, ...prev].slice(0, 5));
  };

  const isCritical = summary.overallAuditVerdict.startsWith('IKKE GODKENDT');
  const isWarning = summary.overallAuditVerdict.startsWith('BETINGET');

  return (
    <section
      data-testid="weekly-external-audit-widget"
      className="bg-[#111827] border border-[#334155] rounded-lg p-3.5 space-y-3 font-mono tabular-nums"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-[#1E293B]">
        <div className="space-y-0.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <h3 className="text-xs font-bold text-slate-100">
              Automatisk Ugerapport til Ekstern Revision (Støj, Støv &amp; Vejr)
            </h3>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                isCritical
                  ? 'bg-rose-950/60 border-rose-500/60 text-rose-200'
                  : isWarning
                  ? 'bg-amber-950/60 border-amber-500/60 text-amber-200'
                  : 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
              }`}
            >
              {summary.overallAuditVerdict}
            </span>
          </div>
          <p className="text-[11px] font-sans text-slate-400">
            Samler automatisk seneste 7 døgns ({summary.totalHoursAnalyzed} timer) målinger for periode{' '}
            <strong className="text-slate-200">{summary.periodLabel}</strong> i revisionsklar A4-PDF med ISO 19011 / SHA-256 kontrolsum.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <label className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#0B0F19] border border-[#334155] text-[10.5px] text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              data-testid="toggle-auto-weekly-audit-pdf"
              checked={autoDownloadOnWeekRollover}
              onChange={(e) => setAutoDownloadOnWeekRollover(e.target.checked)}
              className="accent-cyan-400 cursor-pointer"
            />
            <span>Auto-PDF ved ugeskifte</span>
          </label>

          <button
            type="button"
            data-testid="export-weekly-external-audit-pdf-btn"
            onClick={handleManualExport}
            className="px-2.5 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Download Ekstern Revisions-PDF</span>
          </button>
        </div>
      </div>

      {/* 3-Domain KPI Strip: Støv, Støj, Vejr */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B] space-y-1">
          <div className="flex items-center justify-between text-[10.5px] text-slate-400">
            <span className="flex items-center gap-1 text-rose-300 font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>Støv &amp; Asbest (7d)</span>
            </span>
            <span>BEK 613/2026</span>
          </div>
          <div className="text-sm font-bold text-slate-100">
            Maks S={summary.weeklyPeakSumQuotientS.toFixed(2)}
          </div>
          <div className="text-[10.5px] text-slate-400">
            {summary.totalDustExceedanceHours} t med S&ge;1,0 · {summary.weeklyTotalDustUgM2.toFixed(0)} µg/m²
          </div>
        </div>

        <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B] space-y-1">
          <div className="flex items-center justify-between text-[10.5px] text-slate-400">
            <span className="flex items-center gap-1 text-amber-300 font-semibold">
              <Volume2 className="w-3.5 h-3.5 shrink-0" />
              <span>Støj &amp; Impulser (7d)</span>
            </span>
            <span>MST 5/1984</span>
          </div>
          <div className="text-sm font-bold text-slate-100">
            Maks {summary.weeklyPeakLafmaxDb.toFixed(1)} dB(A)
          </div>
          <div className="text-[10.5px] text-slate-400">
            {summary.totalImpulseOver85Hours} t &gt;85 dB · L_Aeq {summary.weeklyPeakLaeqDb.toFixed(1)} dB
          </div>
        </div>

        <div className="p-2.5 rounded bg-[#0B0F19] border border-[#1E293B] space-y-1">
          <div className="flex items-center justify-between text-[10.5px] text-slate-400">
            <span className="flex items-center gap-1 text-sky-300 font-semibold">
              <Wind className="w-3.5 h-3.5 shrink-0" />
              <span>Vejr &amp; Vindstød (7d)</span>
            </span>
            <span className="flex items-center gap-1">
              <CloudRain className="w-3 h-3 shrink-0" />
              {summary.totalPrecipMm.toFixed(1)} mm
            </span>
          </div>
          <div className="text-sm font-bold text-slate-100">
            Stød {summary.weeklyMaxGustMs.toFixed(1)} m/s
          </div>
          <div className="text-[10.5px] text-slate-400">
            Middel {summary.weeklyMeanWindMs.toFixed(1)} m/s · {summary.totalHighWindHours} t &gt;10 m/s
          </div>
        </div>
      </div>

      {/* 7-Day Daily Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
        {summary.dailyRows.map((d) => {
          const dayCrit = d.dayAuditStatus === 'KRITISK AFVIGELSE';
          const dayWarn = d.dayAuditStatus === 'ANMÆRKNING';
          return (
            <div
              key={d.dateIso}
              title={d.weatherHeadline}
              className={`p-2 rounded border text-[10px] space-y-0.5 ${
                dayCrit
                  ? 'bg-rose-950/30 border-rose-500/45'
                  : dayWarn
                  ? 'bg-amber-950/25 border-amber-500/45'
                  : 'bg-[#0B0F19] border-[#1E293B]'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-slate-200">
                <span>{d.dayShortDa}</span>
                <span className="text-slate-400">{d.dateIso.slice(5)}</span>
              </div>
              <div className="text-slate-300">S={d.peakSumQuotientS.toFixed(2)}</div>
              <div className="text-amber-300">{d.peakLafmaxDb.toFixed(0)} dB</div>
              <div className="text-sky-300">{d.maxGustMs.toFixed(1)} m/s</div>
            </div>
          );
        })}
      </div>

      {/* Status Toast & Revisionsspor */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10.5px] text-slate-400">
        <span>
          SHA-256 kontrolsum:{' '}
          <strong className="text-emerald-300">{summary.auditSha256.slice(0, 20)}…</strong>
        </span>
        {lastExport ? (
          <span
            data-testid="weekly-external-audit-toast"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-500/50 text-emerald-200"
          >
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span>
              {lastExport.mode} PDF genereret: {lastExport.fileName}
            </span>
          </span>
        ) : (
          revisionHistory[0] && (
            <span className="text-slate-400">
              Automatisk klargjort til revision: {revisionHistory[0].periodLabel}
            </span>
          )
        )}
      </div>
    </section>
  );
};
