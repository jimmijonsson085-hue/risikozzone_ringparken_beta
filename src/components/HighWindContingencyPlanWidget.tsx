/**
 * @file src/components/HighWindContingencyPlanWidget.tsx
 * @description Automatisk 'Høj-Vind Beredskabsplan' (PDF-eksport) i 'Noise Dust'-panelet,
 * som aktiveres ved vindhastighed > 10 m/s med tjeklister for nedstøvning, maskinstop
 * og naboorientering baseret på de mest udsatte receptorer.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  Download,
  FileText,
  ShieldAlert,
  Square,
  Users,
  Wind,
} from 'lucide-react';
import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  PuffAccumulationResult,
  ReceptorExposureResult,
  ReceptorZone,
} from '../types/dispersion';
import {
  ContingencyChecklistCategory,
  buildHighWindContingencyPlan,
} from '../utils/highWindContingencyPlan';
import { generateHighWindContingencyPlanPdf } from '../services/highWindContingencyPdfService';

export interface HighWindContingencyPlanWidgetProps {
  dateIso: string;
  currentWeather: HourlyWeatherPoint;
  weatherHours: HourlyWeatherPoint[];
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  receptorExposures: ReceptorExposureResult[];
  puff24h?: PuffAccumulationResult;
  manualMachineNoiseOutputDb?: number;
  isManualMachineNoiseOverrideActive?: boolean;
  plumeDirectionDeg?: number;
  sha256Hash?: string;
  onSelectHour: (hourIndex: number) => void;
  onSelectReceptor?: (receptorId: string) => void;
}

export const HighWindContingencyPlanWidget: React.FC<
  HighWindContingencyPlanWidgetProps
> = ({
  dateIso,
  currentWeather,
  weatherHours,
  sources,
  receptors,
  receptorExposures,
  puff24h,
  manualMachineNoiseOutputDb = 114,
  isManualMachineNoiseOverrideActive = false,
  plumeDirectionDeg,
  sha256Hash,
  onSelectHour,
  onSelectReceptor,
}) => {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [activeCategoryTab, setActiveCategoryTab] = useState<
    'all' | ContingencyChecklistCategory
  >('all');
  const [autoExportPdfOnCross, setAutoExportPdfOnCross] = useState<boolean>(false);
  const [lastExportedInfo, setLastExportedInfo] = useState<{
    fileName: string;
    timeStr: string;
    isAuto: boolean;
  } | null>(null);

  const plan = useMemo(
    () =>
      buildHighWindContingencyPlan({
        dateIso,
        currentWeather,
        weatherHours,
        sources,
        receptors,
        receptorExposures,
        puff24h,
        manualMachineNoiseOutputDb,
        isManualMachineNoiseOverrideActive,
        plumeDirectionDeg,
        sha256Hash,
      }),
    [
      dateIso,
      currentWeather,
      weatherHours,
      sources,
      receptors,
      receptorExposures,
      puff24h,
      manualMachineNoiseOutputDb,
      isManualMachineNoiseOverrideActive,
      plumeDirectionDeg,
      sha256Hash,
    ]
  );

  const lastAutoExportKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!autoExportPdfOnCross || !plan.isHighWindTriggered) return;
    const key = `${plan.dateIso}-${plan.hourIndex}`;
    if (lastAutoExportKeyRef.current === key) return;
    lastAutoExportKeyRef.current = key;
    const res = generateHighWindContingencyPlanPdf(plan, checkedIds);
    setLastExportedInfo({
      fileName: res.fileName,
      timeStr: new Date().toLocaleTimeString('da-DK', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      isAuto: true,
    });
  }, [autoExportPdfOnCross, plan, checkedIds]);

  const handleManualExportPdf = () => {
    const res = generateHighWindContingencyPlanPdf(plan, checkedIds);
    setLastExportedInfo({
      fileName: res.fileName,
      timeStr: new Date().toLocaleTimeString('da-DK', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      isAuto: false,
    });
  };

  const toggleChecklistItem = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const firstHighWindHour = useMemo(
    () => weatherHours.find((h) => (h.windSpeed10m ?? 0) > 10.0) ?? null,
    [weatherHours]
  );

  const visibleChecklist = useMemo(() => {
    if (activeCategoryTab === 'all') return plan.allChecklistItems;
    return plan.allChecklistItems.filter((i) => i.category === activeCategoryTab);
  }, [activeCategoryTab, plan.allChecklistItems]);

  return (
    <section
      data-testid="high-wind-contingency-plan-widget"
      className={`rounded-lg border p-4 space-y-3.5 text-slate-100 transition-colors ${
        plan.isHighWindTriggered
          ? 'bg-[#17121A] border-amber-500/70'
          : 'bg-[#0F172A] border-[#2D3B50]'
      }`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2.5 pb-3 border-b border-slate-800">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            {plan.isHighWindTriggered ? (
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Wind className="w-4 h-4 text-cyan-400 shrink-0" />
            )}
            <span className={plan.isHighWindTriggered ? 'text-amber-300' : 'text-cyan-200'}>
              Høj-Vind Beredskabsplan (&gt;10 m/s) · PDF-Eksport
            </span>
            <span
              className={`font-mono text-[10.5px] tabular-nums ${
                plan.isHighWindTriggered ? 'text-rose-300 font-bold' : 'text-slate-400'
              }`}
            >
              {plan.isHighWindTriggered
                ? `AUTO-GENERERET (${plan.windSpeedMs.toFixed(1)} m/s)`
                : `Beredskab klar (${plan.windSpeedMs.toFixed(1)} / 10,0 m/s)`}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Plan-ID <span className="font-mono text-slate-300">{plan.planId}</span>
            <span aria-hidden="true"> · </span>
            <span>
              Vind {plan.windFromCompass} ({plan.windFromDeg}°) → Fane {plan.plumeDownwindCompass} (
              {plan.plumeDownwindDeg}°)
            </span>
            <span aria-hidden="true"> · </span>
            <span>{checkedIds.size}/{plan.allChecklistItems.length} afkrydset</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0 font-mono text-[11px]">
          {!plan.isHighWindTriggered && firstHighWindHour && (
            <button
              type="button"
              onClick={() => onSelectHour(firstHighWindHour.hourIndex)}
              className="px-2.5 py-1.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/50 text-amber-200 font-semibold cursor-pointer whitespace-nowrap shrink-0"
              title="Hop til time med vindhastighed over 10 m/s"
            >
              Hop til &gt;10 m/s (kl. {firstHighWindHour.hourLabel})
            </button>
          )}

          <button
            type="button"
            onClick={() => setAutoExportPdfOnCross((v) => !v)}
            className={`px-2.5 py-1.5 rounded border text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
              autoExportPdfOnCross
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                : 'bg-[#0B0E17] border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Automatisk PDF-download når vindhastigheden overstiger 10 m/s"
          >
            {autoExportPdfOnCross ? '✓ Auto-PDF ved >10 m/s' : 'Auto-PDF: Fra'}
          </button>

          <button
            type="button"
            data-testid="export-high-wind-contingency-pdf-btn"
            onClick={handleManualExportPdf}
            className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Eksporter Beredskabsplan (PDF)</span>
          </button>
        </div>
      </div>

      {lastExportedInfo && (
        <div
          data-testid="high-wind-contingency-pdf-feedback"
          className="px-2.5 py-1.5 rounded bg-emerald-950/60 border border-emerald-500/60 text-[11px] font-mono text-emerald-200 flex items-center justify-between gap-2"
        >
          <span className="truncate">
            <FileText className="w-3.5 h-3.5 inline mr-1.5 text-emerald-400" />
            {lastExportedInfo.isAuto ? 'Auto-genereret' : 'Eksporteret'}:{' '}
            <strong>{lastExportedInfo.fileName}</strong>
          </span>
          <span className="text-slate-300 shrink-0 tabular-nums">{lastExportedInfo.timeStr}</span>
        </div>
      )}

      {/* Top Exposed Receptors Strip */}
      <div className="rounded bg-[#0B0E17] border border-slate-800 p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-200">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Mest Udsatte Receptorer til Naboorientering</span>
          </div>
          <span className="font-mono text-[11px] tabular-nums text-slate-400">
            {plan.highWindHoursIn24hCount} timer &gt;10 m/s i 24t prognose
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 font-mono text-[11px] tabular-nums">
          {plan.topExposedReceptors.map((rec, idx) => (
            <button
              key={rec.receptorId}
              type="button"
              onClick={() => onSelectReceptor?.(rec.receptorId)}
              className="p-2 rounded bg-[#151C28] hover:bg-[#1E293B] border border-slate-800 text-left space-y-1 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-white truncate">
                  #{idx + 1} {rec.receptorCode} · {rec.receptorName}
                </span>
                <span
                  className={`font-bold shrink-0 ${
                    rec.priorityTier === 'KRITISK'
                      ? 'text-rose-400'
                      : rec.priorityTier === 'HØJ'
                      ? 'text-amber-300'
                      : 'text-cyan-300'
                  }`}
                >
                  {rec.priorityTier}
                </span>
              </div>
              <div className="text-[10.5px] text-slate-400 truncate">{rec.address}</div>
              <div className="flex items-center justify-between gap-2 text-[10.5px] pt-0.5 border-t border-slate-800/80">
                <span className="text-cyan-300">S = {rec.sumQuotientS.toFixed(2)}</span>
                <span className="text-rose-300">{rec.estimatedLafmaxDb.toFixed(1)} dB</span>
                <span className="text-slate-300">{rec.distanceMeters} m</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive 3-Part Contingency Checklist */}
      <div className="rounded bg-[#0B0E17] border border-slate-800 p-2.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Struktureret Beredskabs-Tjekliste</span>
          </div>

          <div
            role="group"
            aria-label="Filtrér tjekliste-kategori"
            className="flex flex-wrap items-center gap-1 p-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px]"
          >
            {(
              [
                { id: 'all', label: 'Alle (9)' },
                { id: 'nedstoevning', label: 'Nedstøvning' },
                { id: 'maskinstop', label: 'Maskinstop' },
                { id: 'naboorientering', label: 'Naboorientering' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategoryTab(tab.id)}
                className={`px-2 py-0.5 rounded cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                  activeCategoryTab === tab.id
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-800/80 max-h-[240px] overflow-y-auto">
          {visibleChecklist.map((item) => {
            const isChecked = checkedIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleChecklistItem(item.id)}
                className="w-full py-2 px-1.5 flex items-start gap-2.5 text-left hover:bg-slate-900/60 cursor-pointer transition-colors"
              >
                {isChecked ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={`font-mono font-bold ${
                        item.priority === 'AKUT'
                          ? 'text-rose-400'
                          : item.priority === 'HØJ'
                          ? 'text-amber-300'
                          : 'text-cyan-300'
                      }`}
                    >
                      {item.categoryLabelDa} · {item.priority}
                    </span>
                    <span
                      className={`font-semibold ${
                        isChecked ? 'line-through text-slate-400' : 'text-slate-100'
                      }`}
                    >
                      {item.titleDa}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {item.actionDetailsDa}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
