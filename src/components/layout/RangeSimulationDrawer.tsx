import React from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  Droplets,
  FileSpreadsheet,
  FileText,
  Play,
  RefreshCw,
  X,
} from 'lucide-react';
import { RangeSimulationSummary } from '../../services/rangeSimulationService';

export interface RangeSimulationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rangeFromDateIso: string;
  onChangeRangeFromDateIso: (val: string) => void;
  rangeFromHourIndex: number;
  onChangeRangeFromHourIndex: (val: number) => void;
  rangeToDateIso: string;
  onChangeRangeToDateIso: (val: string) => void;
  rangeToHourIndex: number;
  onChangeRangeToHourIndex: (val: number) => void;
  nextWeekEndIso: string;
  simulationSpeedMultiplier: 1 | 2 | 3 | 5 | 10;
  onChangeSimulationSpeedMultiplier: (spd: 1 | 2 | 3 | 5 | 10) => void;
  isRunningRangeSimulation: boolean;
  rangeSimulationProgress: {
    completed: number;
    total: number;
    currentLabel: string;
  } | null;
  onRunRangeSimulation: () => Promise<void>;
  onFocusBlok12Percolation3D: () => void;
  completedRangeSimulation: RangeSimulationSummary | null;
  isBulkDownloading: boolean;
  onBulkDownloadCompletedSimulation: (summary: RangeSimulationSummary) => void;
  onDownloadSupervisionPdf: (summary: RangeSimulationSummary) => void;
  onDownloadPercolationPdf: (summary: RangeSimulationSummary) => void;
  onDownloadRangeCsv: (summary: RangeSimulationSummary) => void;
  onDownloadRangeJson: (summary: RangeSimulationSummary) => void;
}

export const RangeSimulationDrawer: React.FC<RangeSimulationDrawerProps> = ({
  isOpen,
  onClose,
  rangeFromDateIso,
  onChangeRangeFromDateIso,
  rangeFromHourIndex,
  onChangeRangeFromHourIndex,
  rangeToDateIso,
  onChangeRangeToDateIso,
  rangeToHourIndex,
  onChangeRangeToHourIndex,
  nextWeekEndIso,
  simulationSpeedMultiplier,
  onChangeSimulationSpeedMultiplier,
  isRunningRangeSimulation,
  rangeSimulationProgress,
  onRunRangeSimulation,
  onFocusBlok12Percolation3D,
  completedRangeSimulation,
  isBulkDownloading,
  onBulkDownloadCompletedSimulation,
  onDownloadSupervisionPdf,
  onDownloadPercolationPdf,
  onDownloadRangeCsv,
  onDownloadRangeJson,
}) => {
  if (!isOpen) return null;

  return (
    <section
      aria-label="Simuler Fra dato_klokkeslæt - Til dato_klokkeslæt kontrolpanel"
      className="bg-[#151C28] border-b border-[#253042] px-4 py-2.5 font-mono text-[11px] tabular-nums space-y-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-[#1B2433] border border-[#2D3B50] text-emerald-300 font-bold text-[11px] inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>INTERVAL-SIMULERING (FRA – TIL)</span>
          </span>

          {/* Fra dato_klokkeslæt */}
          <div className="flex items-center gap-1.5 bg-[#1B2433] border border-[#2D3B50] rounded px-2 py-1">
            <span className="text-slate-400 text-[11px] font-semibold">Fra:</span>
            <input
              type="date"
              value={rangeFromDateIso}
              min="2023-01-01"
              max={nextWeekEndIso}
              onChange={(e) => {
                if (e.target.value) onChangeRangeFromDateIso(e.target.value);
              }}
              aria-label="Fra dato"
              className="bg-transparent text-slate-100 text-[11px] focus:outline-none [color-scheme:dark]"
            />
            <select
              value={rangeFromHourIndex}
              onChange={(e) => onChangeRangeFromHourIndex(Number(e.target.value))}
              aria-label="Fra klokkeslæt"
              className="bg-[#151C28] border border-[#2D3B50] rounded px-1.5 py-0.5 text-cyan-200 text-[11px] focus:outline-none"
            >
              {Array.from({ length: 24 }, (_, hr) => (
                <option key={`from-hr-${hr}`} value={hr}>
                  {String(hr).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>

          <span className="text-slate-500 font-bold">→</span>

          {/* Til dato_klokkeslæt */}
          <div className="flex items-center gap-1.5 bg-[#1B2433] border border-[#2D3B50] rounded px-2 py-1">
            <span className="text-slate-400 text-[11px] font-semibold">Til:</span>
            <input
              type="date"
              value={rangeToDateIso}
              min="2023-01-01"
              max={nextWeekEndIso}
              onChange={(e) => {
                if (e.target.value) onChangeRangeToDateIso(e.target.value);
              }}
              aria-label="Til dato"
              className="bg-transparent text-slate-100 text-[11px] focus:outline-none [color-scheme:dark]"
            />
            <select
              value={rangeToHourIndex}
              onChange={(e) => onChangeRangeToHourIndex(Number(e.target.value))}
              aria-label="Til klokkeslæt"
              className="bg-[#151C28] border border-[#2D3B50] rounded px-1.5 py-0.5 text-amber-200 text-[11px] focus:outline-none"
            >
              {Array.from({ length: 24 }, (_, hr) => (
                <option key={`to-hr-${hr}`} value={hr}>
                  {String(hr).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>

          {/* Simulation Speed Multiplier Selector */}
          <div
            className="flex items-center gap-1 bg-[#1B2433] border border-[#2D3B50] rounded px-1.5 py-0.5 text-[11px] font-mono tabular-nums"
            role="group"
            aria-label="Vælg simulerings-hastighed"
          >
            <span className="text-slate-400 text-[11px] mr-0.5">Hastighed:</span>
            {([1, 2, 3, 5] as const).map((spd) => {
              const isActiveSpd = simulationSpeedMultiplier === spd;
              const labelText = spd === 1 ? '1x (Nuværende standard)' : `${spd}x`;
              return (
                <button
                  key={`range-spd-${spd}`}
                  type="button"
                  onClick={() => onChangeSimulationSpeedMultiplier(spd)}
                  className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                    isActiveSpd
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-[#151C28] text-slate-300 hover:bg-[#212C3E]'
                  }`}
                >
                  {labelText}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={isRunningRangeSimulation}
            onClick={() => void onRunRangeSimulation()}
            className="px-3 py-1.5 rounded bg-emerald-400 hover:bg-emerald-300 disabled:opacity-60 text-slate-950 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"
          >
            {isRunningRangeSimulation ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <Play className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>
              {isRunningRangeSimulation && rangeSimulationProgress
                ? `Simulerer ${simulationSpeedMultiplier}x (${rangeSimulationProgress.completed}/${rangeSimulationProgress.total}) · ${rangeSimulationProgress.currentLabel}...`
                : `Simuler Fra ${rangeFromDateIso}_${String(rangeFromHourIndex).padStart(2, '0')}:00 - Til ${rangeToDateIso}_${String(rangeToHourIndex).padStart(2, '0')}:00 (${simulationSpeedMultiplier}x)`}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onFocusBlok12Percolation3D}
            className="px-2.5 py-1 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-[#2D3B50] text-cyan-200 font-semibold text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
            title="Fokuser 3D-visningen specifikt på de underjordiske perkolations-veje ved Blok 1 og 2 (Bly & PAH vs. nedbør)"
          >
            <Droplets className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>3D Fokus: Blok 1 &amp; 2 Perkolation (Bly &amp; PAH)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-400 hover:text-white text-[11px] inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Skjul</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isRunningRangeSimulation && rangeSimulationProgress && (
        <div className="w-full bg-[#0F141D] rounded h-2 overflow-hidden border border-[#253042]">
          <div
            className="bg-emerald-400 h-full transition-all duration-100"
            style={{
              width: `${Math.round(
                (rangeSimulationProgress.completed /
                  Math.max(1, rangeSimulationProgress.total)) *
                  100
              )}%`,
            }}
          />
        </div>
      )}

      {completedRangeSimulation && !isRunningRangeSimulation && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#253042]">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-200">
            <span className="text-emerald-300 font-bold inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Simulering fuldført ({completedRangeSimulation.totalHoursSimulated} timer:{' '}
                {completedRangeSimulation.fromLabel} – {completedRangeSimulation.toLabel})
              </span>
            </span>
            <span className="text-rose-300">
              Peak S = <strong>{completedRangeSimulation.peakSumQuotient.toFixed(2)}</strong> (
              {completedRangeSimulation.hoursWithSAtLeast1}t S≥1,0)
            </span>
            <span className="text-cyan-300">
              Nedbør: <strong>{completedRangeSimulation.totalPrecipitationMm.toFixed(1)} mm</strong> · Bly:{' '}
              <strong>{completedRangeSimulation.cumulativeBlok12LeadLeachedMgM2.toFixed(2)} mg/m²</strong> · PAH:{' '}
              <strong>{completedRangeSimulation.cumulativeBlok12PahLeachedUgM2.toFixed(2)} µg/m²</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={isBulkDownloading}
              onClick={() => onBulkDownloadCompletedSimulation(completedRangeSimulation)}
              className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Tilføj alle &amp; Bulk Download</span>
            </button>

            <button
              type="button"
              onClick={() => onDownloadSupervisionPdf(completedRangeSimulation)}
              className="px-2.5 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Download samlet Tilsynsrapport (pdf)</span>
            </button>

            <button
              type="button"
              onClick={() => onDownloadPercolationPdf(completedRangeSimulation)}
              className="px-2.5 py-1 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Droplets className="w-3.5 h-3.5 shrink-0" />
              <span>Download samlet Perkulationsrapport (pdf)</span>
            </button>

            <button
              type="button"
              onClick={() => onDownloadRangeCsv(completedRangeSimulation)}
              className="px-2.5 py-1 rounded bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span>Download Data (csv)</span>
            </button>

            <button
              type="button"
              onClick={() => onDownloadRangeJson(completedRangeSimulation)}
              className="px-2.5 py-1 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-[#2D3B50] text-cyan-200 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>Download json</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
