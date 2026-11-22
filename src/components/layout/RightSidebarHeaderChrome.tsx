import React from 'react';
import {
  Activity,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  FolderArchive,
  Maximize2,
  Minimize2,
  PlusCircle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AlgedonicObservation,
  LegalViolationEntry,
  ReceptorExposureResult,
} from '../../types/dispersion';
import {
  DASHBOARD_WINDOW_REGISTRY,
  DashboardWindowId,
} from '../DraggableDashboardWindow';
import { EksponeringsBadge } from '../EksponeringsBadge';
import { SKvotientTendensSparkline, SparklineHourPoint } from '../SKvotientTendensSparkline';
import { SidebarWorkspaceNav } from './SidebarWorkspaceNav';
import { RightPanelTab } from './layoutTypes';

export interface RightSidebarHeaderChromeProps {
  selectedReceptorExposure: ReceptorExposureResult;
  receptorExposures: ReceptorExposureResult[];
  onSelectReceptor: (recId: string) => void;
  activeTab: RightPanelTab;
  onSelectTab: (tab: RightPanelTab) => void;
  observations: AlgedonicObservation[];
  legalViolations: LegalViolationEntry[];
  isSidebarMinimizeOthersActive: boolean;
  onToggleSidebarMinimizeAllExceptActive: () => void;
  effectiveActiveSidebarWindowId: DashboardWindowId;
  onSelectActiveAnalysisWindow: (id: DashboardWindowId) => void;
  currentTabWindowIds: DashboardWindowId[];
  allSidebarWindowEntries: Array<{ id: DashboardWindowId; tab: RightPanelTab }>;
  onOpenWindNoiseCorrelationDocked: () => void;
  onFloatWindNoiseCorrelationWindow: () => void;
  acousticDustWarningEnabled: boolean;
  onToggleAcousticDustWarning: () => void;
  onTestAcousticDustWarningTone: () => void;
  maxSiteSumQuotient: number;
  indoorSumQuotientSin: number;
  last6HoursSparklinePoints: SparklineHourPoint[];
  onSelectHour: (hr: number) => void;
  batchAddFindingsSuccess: boolean;
  batchAddedFindingsCount: number;
  totalCurrentFindingsCount: number;
  onAddAllFindingsToEvidence: () => void;
  isBulkDownloading: boolean;
  bulkDownloadSuccess: boolean;
  onAddAllAndBulkDownload: () => void;
  onOpenExportHub: () => void;
}

export const RightSidebarHeaderChrome: React.FC<RightSidebarHeaderChromeProps> = ({
  selectedReceptorExposure,
  receptorExposures,
  onSelectReceptor,
  activeTab,
  onSelectTab,
  observations,
  legalViolations,
  isSidebarMinimizeOthersActive,
  onToggleSidebarMinimizeAllExceptActive,
  effectiveActiveSidebarWindowId,
  onSelectActiveAnalysisWindow,
  currentTabWindowIds,
  allSidebarWindowEntries,
  onOpenWindNoiseCorrelationDocked,
  onFloatWindNoiseCorrelationWindow,
  acousticDustWarningEnabled,
  onToggleAcousticDustWarning,
  onTestAcousticDustWarningTone,
  maxSiteSumQuotient,
  indoorSumQuotientSin,
  last6HoursSparklinePoints,
  onSelectHour,
  batchAddFindingsSuccess,
  batchAddedFindingsCount,
  totalCurrentFindingsCount,
  onAddAllFindingsToEvidence,
  isBulkDownloading,
  bulkDownloadSuccess,
  onAddAllAndBulkDownload,
  onOpenExportHub,
}) => {
  return (
    <>
      {/* Eksponerings-Badge at top of .sidebar */}
      <EksponeringsBadge
        selectedReceptor={selectedReceptorExposure}
        allReceptors={receptorExposures}
        onSelectReceptor={onSelectReceptor}
      />

      {/* 2-Trins Domæne-Navigation (4 Primære Arbejdsrum + Sekundær Sub-Navigation) */}
      <SidebarWorkspaceNav
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        observationsCount={observations.length}
        legalViolationsCount={legalViolations.length}
        indoorSumQuotientSin={indoorSumQuotientSin}
      />

      {/* Right Sidebar Compact Operator Control Bar */}
      <div className="px-3 py-1.5 bg-[var(--surface-panel)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-1.5 shrink-0 font-mono text-[11px] tabular-nums">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            data-testid="right-sidebar-minimize-all-btn"
            onClick={onToggleSidebarMinimizeAllExceptActive}
            title="Global 'Minimer alle': Minimerer alle åbne dashboards i kontrolcentret med undtagelse af det aktive analysevindue"
            className={`px-2 py-1 rounded font-semibold flex items-center gap-1 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isSidebarMinimizeOthersActive
                ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                : 'bg-[var(--surface-card)] hover:bg-[var(--surface-overlay)] text-[var(--text-primary)] border-[var(--border-subtle)]'
            }`}
          >
            {isSidebarMinimizeOthersActive ? (
              <>
                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                <span>Gendan alle</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Minimer alle</span>
              </>
            )}
          </button>

          <select
            aria-label="Vælg aktivt analysevindue i højre sidepanel"
            value={effectiveActiveSidebarWindowId}
            onChange={(e) => onSelectActiveAnalysisWindow(e.target.value as DashboardWindowId)}
            className="max-w-[190px] px-2 py-1 rounded bg-[#1B2433] border border-[#2D3B50] text-slate-200 text-[11px] truncate cursor-pointer focus:outline-none focus:border-cyan-400"
          >
            <optgroup label="Aktuel fane">
              {currentTabWindowIds.map((id) => (
                <option key={`cur-${id}`} value={id}>
                  Aktiv: {DASHBOARD_WINDOW_REGISTRY[id].shortTitle}
                </option>
              ))}
            </optgroup>
            <optgroup label="Øvrige analysevinduer">
              {allSidebarWindowEntries
                .filter((e) => !currentTabWindowIds.includes(e.id))
                .map(({ id }) => (
                  <option key={`all-${id}`} value={id}>
                    Skift til: {DASHBOARD_WINDOW_REGISTRY[id].shortTitle}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            data-testid="open-wind-noise-correlation-btn"
            aria-label="Åbn Vind-Støj Korrelation i sidepanelet"
            onClick={onOpenWindNoiseCorrelationDocked}
            title="Åbn 'Vind-Støj Korrelation' i sidepanelet (24-timers tidslinje med vindstød, støv/støj-hændelser & vindstøj-sensitivitet)"
            className="px-2 py-1 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-[#2D3B50] text-cyan-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="hidden xl:inline">Vind-Støj</span>
          </button>

          <button
            type="button"
            data-testid="float-wind-noise-correlation-btn"
            aria-label="Frigiv Vind-Støj Korrelation som frit vindue"
            onClick={onFloatWindNoiseCorrelationWindow}
            title="Frigiv 'Vind-Støj Korrelation' som frit trækbart dashboard-vindue på skærmen"
            className="p-1.5 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-200 flex items-center justify-center cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
          </button>

          <button
            type="button"
            data-testid="toggle-high-wind-s08-tone-btn"
            aria-label="Slå akustisk advarselstone for S > 0,8 under højvind til eller fra"
            onClick={onToggleAcousticDustWarning}
            title="Diskret akustisk advarselstone (Web Audio API), når S > 0,8 under højvind (v > 10 m/s)"
            className={`p-1.5 rounded border flex items-center justify-center cursor-pointer ${
              acousticDustWarningEnabled
                ? 'bg-[#1B2433] border-emerald-500/50 text-emerald-200'
                : 'bg-[#1B2433] border-[#2D3B50] text-slate-400'
            }`}
          >
            {acousticDustWarningEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 shrink-0" />
            )}
          </button>

          <button
            type="button"
            data-testid="test-high-wind-s08-tone-btn"
            onClick={onTestAcousticDustWarningTone}
            title="Afspil diskret Web Audio advarselstone for S > 0,8 & v > 10 m/s"
            className="px-2 py-1 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-300 text-[11px] cursor-pointer whitespace-nowrap"
          >
            Tone
          </button>
        </div>
      </div>

      {/* Calm Evidence & Discreet Action Strip (Hidden when 'Minimer alle' is active) */}
      {!isSidebarMinimizeOthersActive && (
        <div className="px-3 py-1.5 bg-[var(--surface-card)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 shrink-0 font-mono text-[11px] tabular-nums">
          <div className="min-w-0 flex items-center gap-2 truncate">
            <span className="text-[var(--status-verified-text)] font-semibold">Beviser: {observations.length}</span>
            <span className="text-slate-500" aria-hidden="true">·</span>
            <span className="text-[var(--text-secondary)] truncate">
              <strong className={legalViolations.length > 0 ? 'text-[#F87171]' : 'text-[var(--text-primary)]'}>{legalViolations.length} lovbrud</strong> ·{' '}
              <strong className={maxSiteSumQuotient >= 1.0 ? 'text-[#F87171]' : 'text-[#FBBF24]'}>
                S_max = {maxSiteSumQuotient.toFixed(2)}
              </strong>
            </span>
            <span className="hidden sm:inline-flex items-center">
              <SKvotientTendensSparkline
                points={last6HoursSparklinePoints}
                onSelectHour={onSelectHour}
                label="6t:"
                svgWidth={50}
                svgHeight={14}
                exceedanceColorHex="#f43f5e"
              />
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onAddAllFindingsToEvidence}
              aria-label="Føj aktuelle fund til Beviser"
              className={`p-1.5 rounded border transition-colors cursor-pointer shrink-0 flex items-center justify-center ${
                batchAddFindingsSuccess
                  ? 'bg-emerald-400 text-slate-950 border-emerald-200 font-bold'
                  : 'bg-[#151C28] hover:bg-[#212C3E] text-emerald-200 border-[#2D3B50]'
              }`}
              title={
                batchAddFindingsSuccess
                  ? `${batchAddedFindingsCount} fund føjet til Beviser`
                  : `Føj alle aktuelle fund (${totalCurrentFindingsCount}) til Beviser med SHA-256 signatur`
              }
            >
              {batchAddFindingsSuccess ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <PlusCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
            </button>

            <button
              type="button"
              disabled={isBulkDownloading}
              onClick={onAddAllAndBulkDownload}
              data-testid="add-all-and-bulk-download-sidebar-btn"
              aria-label="Tilføj alle fund og Bulk Download pakke"
              className={`p-1.5 rounded border transition-colors cursor-pointer shrink-0 disabled:opacity-60 flex items-center justify-center ${
                bulkDownloadSuccess
                  ? 'bg-emerald-400 text-slate-950 border-emerald-200'
                  : 'bg-[#151C28] hover:bg-[#212C3E] text-amber-300 border-[#2D3B50]'
              }`}
              title="Tilføj alle aktuelle fund til Beviser OG download komplet pakke (PDF + Perkolation PDF + CSV + JSON)"
            >
              {bulkDownloadSuccess ? (
                <Check className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Download className="w-3.5 h-3.5 shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={onOpenExportHub}
              className="px-2 py-1 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-cyan-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="Åbn samlet Rapport- & Eksport-Hub (23 PDF-, CSV- og JSON-flows)"
            >
              <FolderArchive className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Eksport-Hub</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
