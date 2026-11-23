import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Crosshair,
  Download,
  FolderArchive,
  Maximize2,
  Minimize2,
  PlusCircle,
  Radio,
  RefreshCw,
  RotateCcw,
  Rows3,
  Scale,
  Search,
  ShieldAlert,
  Wind,
  Zap,
} from 'lucide-react';
import {
  AlgedonicObservation,
  AlgedonicTestScenarioId,
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LegalViolationEntry,
  PuffAccumulationResult,
  ReceptorExposureResult,
  SimultaneousAlgedonicDispatch,
} from '../../types/dispersion';
import { ALGEDONIC_SCENARIO_SPECS } from '../../services/myceliumSimulationEngine';
import {
  DashboardWindowId,
  MinimizedWindowsDropdownMenu,
  WindowInstanceState,
} from '../DraggableDashboardWindow';
import { HeaderWeatherCorrelationD3Popup } from '../HeaderWeatherCorrelationD3Popup';
import { SKvotientTendensSparkline, SparklineHourPoint } from '../SKvotientTendensSparkline';
import { SourceQuickSwitchDropdown } from '../SourceQuickSwitchDropdown';
import { RightPanelTab, UiDensityMode } from './layoutTypes';

export interface TopCommandHeaderProps {
  onSelectTab: (tab: RightPanelTab) => void;
  last6HoursSparklinePoints: SparklineHourPoint[];
  onSelectHour: (hourIdx: number) => void;
  currentWeather: HourlyWeatherPoint;
  maxSiteSumQuotient: number;
  observations: AlgedonicObservation[];
  puff24h: PuffAccumulationResult;
  relaxationTimeTrHours: number;
  manualMachineNoiseOutputDb: number;
  isManualMachineNoiseOverrideActive: boolean;
  legalViolations: LegalViolationEntry[];
  batchAddFindingsSuccess: boolean;
  batchAddedFindingsCount: number;
  totalCurrentFindingsCount: number;
  onAddAllFindingsToEvidence: () => void;
  isBulkDownloading: boolean;
  bulkDownloadSuccess: boolean;
  onAddAllAndBulkDownload: () => void;
  windowStates: Record<DashboardWindowId, WindowInstanceState>;
  onRestoreWindow: (id: DashboardWindowId) => void;
  onPopOutFloatingWindow: (id: DashboardWindowId) => void;
  onMinimizeAllFloating: () => void;
  onRestoreAllMinimized: () => void;
  isMinimizeAllFocusActive: boolean;
  onToggleMinimizeAllExceptMapAndSidebar: () => void;
  onOpenSourceReceptorModal: () => void;
  myceliumUnacknowledgedCount: number;
  onToggleMyceliumDrawer: () => void;
  isSlagelseLegalDashboardActive: boolean;
  onOpenSlagelseLegalDashboard: () => void;
  isRangeSimPanelOpen: boolean;
  onToggleRangeSimPanel: () => void;
  showHeaderWeatherCorrelationPopup: boolean;
  onToggleHeaderWeatherCorrelationPopup: () => void;
  onCloseHeaderWeatherCorrelationPopup: () => void;
  isExportHubOpen: boolean;
  onToggleExportHub: () => void;
  onOpenCommandPalette: () => void;
  dateIso: string;
  weatherHours: HourlyWeatherPoint[];
  selectedReceptorExposure: ReceptorExposureResult;
  receptorExposures: ReceptorExposureResult[];
  indoorSumQuotientSin: number;
  selectedHourIndex: number;
  densityMode: UiDensityMode;
  onToggleDensityMode: () => void;
  sources: DemolitionSourceNode[];
  selectedSourceId: string | null;
  onSelectSource: (sourceId: string) => void;
  onToggleSourceActive: (sourceId: string) => void;
  simultaneousDispatch?: SimultaneousAlgedonicDispatch | null;
  manualSimultaneousScenario?: AlgedonicTestScenarioId | null;
  onTriggerSimultaneousScenario?: (
    scenarioId: AlgedonicTestScenarioId,
    openSplitModal?: boolean
  ) => void;
  onOpenSimultaneousModal?: () => void;
  onAcknowledgeSimultaneousP1?: () => void;
  onClearSimultaneousSimulation?: () => void;
  onExportWeatherCorrelationPdf?: () => void;
}

export const TopCommandHeader: React.FC<TopCommandHeaderProps> = ({
  onSelectTab,
  last6HoursSparklinePoints,
  onSelectHour,
  maxSiteSumQuotient,
  observations,
  puff24h,
  relaxationTimeTrHours,
  manualMachineNoiseOutputDb,
  isManualMachineNoiseOverrideActive,
  legalViolations,
  batchAddFindingsSuccess,
  batchAddedFindingsCount,
  totalCurrentFindingsCount,
  onAddAllFindingsToEvidence,
  isBulkDownloading,
  bulkDownloadSuccess,
  onAddAllAndBulkDownload,
  windowStates,
  onRestoreWindow,
  onPopOutFloatingWindow,
  onMinimizeAllFloating,
  onRestoreAllMinimized,
  isMinimizeAllFocusActive,
  onToggleMinimizeAllExceptMapAndSidebar,
  onOpenSourceReceptorModal,
  myceliumUnacknowledgedCount,
  onToggleMyceliumDrawer,
  isSlagelseLegalDashboardActive,
  onOpenSlagelseLegalDashboard,
  isRangeSimPanelOpen,
  onToggleRangeSimPanel,
  showHeaderWeatherCorrelationPopup,
  onToggleHeaderWeatherCorrelationPopup,
  onCloseHeaderWeatherCorrelationPopup,
  isExportHubOpen,
  onToggleExportHub,
  onOpenCommandPalette,
  dateIso,
  weatherHours,
  currentWeather,
  selectedReceptorExposure,
  receptorExposures,
  indoorSumQuotientSin,
  selectedHourIndex,
  densityMode,
  onToggleDensityMode,
  sources,
  selectedSourceId,
  onSelectSource,
  onToggleSourceActive,
  simultaneousDispatch,
  manualSimultaneousScenario,
  onTriggerSimultaneousScenario,
  onOpenSimultaneousModal,
  onAcknowledgeSimultaneousP1,
  onClearSimultaneousSimulation,
  onExportWeatherCorrelationPdf,
}) => {
  const [showRiskSummaryPopover, setShowRiskSummaryPopover] = useState(false);
  const [showSimultaneousMenu, setShowSimultaneousMenu] = useState(false);

  const breachHours24 = Math.max(
    1,
    puff24h.peakReceptor.hourlyProfile.filter((h) => h.sumQuotient >= 0.45).length +
      observations.length
  );
  const crisisIntervalDt = Number((24 / breachHours24).toFixed(1));
  const isSystemicTetanus = relaxationTimeTrHours > crisisIntervalDt;
  const isP1Critical = maxSiteSumQuotient >= 1.0;

  const isHighWindAlert =
    currentWeather.windSpeed10m > 10 || currentWeather.windGusts10m > 10;
  const criticalReceptorZones = receptorExposures.filter((r) => r.sumQuotient >= 1.0);
  const elevatedReceptorZones = receptorExposures.filter(
    (r) => r.sumQuotient >= 0.5 && r.sumQuotient < 1.0
  );
  const isIndoorSinBreached = indoorSumQuotientSin >= 1.0;
  const totalThresholdViolations =
    criticalReceptorZones.length + (isIndoorSinBreached ? 1 : 0);
  const immediateActionRequired =
    isHighWindAlert ||
    criticalReceptorZones.length > 0 ||
    legalViolations.length > 0 ||
    isIndoorSinBreached;

  // Days Without Authority Intervention Counter (Dag 0 = 19. marts 2026)
  // Automatically ticks over at midnight and triggers a subtle glimmer sweep on increment.
  const [nowTimestampMs, setNowTimestampMs] = useState<number>(() => Date.now());
  const [isCounterGlimmering, setIsCounterGlimmering] = useState<boolean>(false);

  useEffect(() => {
    let midnightTimeoutId: number | undefined;
    const scheduleNextMidnightTick = () => {
      const now = new Date();
      const nextUtcMidnightMs = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        1
      );
      const nextLocalMidnightMs = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        1
      ).getTime();
      const msUntilNextBoundary = Math.max(
        1_000,
        Math.min(nextUtcMidnightMs, nextLocalMidnightMs) - now.getTime()
      );
      midnightTimeoutId = window.setTimeout(() => {
        setNowTimestampMs(Date.now());
        scheduleNextMidnightTick();
      }, msUntilNextBoundary);
    };

    scheduleNextMidnightTick();
    // Lightweight 30s reconciliation in case the browser tab slept across midnight
    const fallbackIntervalId = window.setInterval(() => {
      setNowTimestampMs(Date.now());
    }, 30_000);

    return () => {
      if (midnightTimeoutId !== undefined) window.clearTimeout(midnightTimeoutId);
      window.clearInterval(fallbackIntervalId);
    };
  }, []);

  const dayZeroUtcMs = Date.UTC(2026, 2, 19);
  const nowDate = new Date(nowTimestampMs);
  const todayUtcMs = Date.UTC(
    nowDate.getUTCFullYear(),
    nowDate.getUTCMonth(),
    nowDate.getUTCDate()
  );
  const daysWithoutInterventionToday = Math.max(
    0,
    Math.floor((todayUtcMs - dayZeroUtcMs) / 86_400_000)
  );
  const prevDaysWithoutInterventionRef = useRef<number>(daysWithoutInterventionToday);

  useEffect(() => {
    if (daysWithoutInterventionToday > prevDaysWithoutInterventionRef.current) {
      prevDaysWithoutInterventionRef.current = daysWithoutInterventionToday;
      setIsCounterGlimmering(true);
      const clearTimer = window.setTimeout(() => {
        setIsCounterGlimmering(false);
      }, 2_200);
      return () => window.clearTimeout(clearTimer);
    }
    prevDaysWithoutInterventionRef.current = daysWithoutInterventionToday;
  }, [daysWithoutInterventionToday]);

  const parsedDateParts = dateIso.split('-').map((n) => Number(n));
  const simUtcMs =
    parsedDateParts.length === 3 && parsedDateParts.every((n) => Number.isFinite(n))
      ? Date.UTC(parsedDateParts[0], parsedDateParts[1] - 1, parsedDateParts[2])
      : todayUtcMs;
  const daysWithoutInterventionSimDate = Math.max(
    0,
    Math.floor((simUtcMs - dayZeroUtcMs) / 86_400_000)
  );

  // Radial gauge arc geometry (270deg sweep calibrated against 365-day statutory escalation cycle)
  const gaugeRadius = 10;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeArcLength = gaugeCircumference * 0.75;
  const cycleRatio = Math.min(1, Math.max(0.06, daysWithoutInterventionToday / 365));
  const gaugeFilledLength = gaugeArcLength * cycleRatio;
  const gaugeStrokeColor =
    daysWithoutInterventionToday >= 180
      ? '#FB7185'
      : daysWithoutInterventionToday >= 60
      ? '#F59E0B'
      : '#38BDF8';

  return (
    <header
      id="page-top-anchor"
      className="relative z-40 min-h-12 h-auto w-full max-w-full px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-[var(--border-subtle)] bg-[var(--surface-panel)] shrink-0 font-sans tabular-nums"
    >
      {/* ZONE 1 (VENSTRE): App-titel, Myndigheds-fri periode Gauge, S-kvotient Sparkline & Status */}
      <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
        <a
          href="#top"
          onClick={(e) => e.preventDefault()}
          className="text-sm font-bold tracking-tight text-[var(--text-primary)] truncate max-w-full sm:whitespace-nowrap shrink-0"
        >
          Ringparken Miljø- &amp; Spredningstelemetri
        </a>

        {/* Gauge-komponent: Myndigheds-fri periode & Dage uden indgriben siden 19. marts 2026 */}
        <button
          type="button"
          data-testid="authority-nonintervention-counter"
          data-days-count={daysWithoutInterventionToday}
          data-glimmer-active={isCounterGlimmering ? 'true' : 'false'}
          onClick={onOpenSlagelseLegalDashboard}
          aria-label={`Myndigheds-fri periode: Dag ${daysWithoutInterventionToday} — Dage uden indgriben siden 19. marts 2026`}
          title={`Myndigheds-fri periode (Dag 0: 19. marts 2026): Dag ${daysWithoutInterventionToday} (${daysWithoutInterventionToday} dage uden indgriben pr. i dag)${
            daysWithoutInterventionSimDate !== daysWithoutInterventionToday
              ? ` · Simuleret dato (${dateIso}): Dag ${daysWithoutInterventionSimDate}`
              : ''
          }. Opdaterer automatisk ved midnat. Klik for at åbne Slagelse Tilsyns-Dashboard.`}
          className="relative overflow-hidden inline-flex items-center gap-2 h-9 px-2.5 rounded border border-amber-500/55 bg-rose-950/60 hover:bg-rose-950/85 text-amber-100 cursor-pointer transition-colors whitespace-nowrap shrink-0"
        >
          {isCounterGlimmering && (
            <span aria-hidden="true" className="authority-glimmer-sheen" />
          )}
          <svg
            viewBox="0 0 26 26"
            className="w-6 h-6 shrink-0"
            aria-hidden="true"
          >
            <circle
              cx="13"
              cy="13"
              r={gaugeRadius}
              fill="none"
              stroke="rgba(148, 163, 184, 0.25)"
              strokeWidth="2.6"
              strokeDasharray={`${gaugeArcLength} ${gaugeCircumference}`}
              strokeLinecap="round"
              transform="rotate(135 13 13)"
            />
            <circle
              cx="13"
              cy="13"
              r={gaugeRadius}
              fill="none"
              stroke={gaugeStrokeColor}
              strokeWidth="2.6"
              strokeDasharray={`${gaugeFilledLength} ${gaugeCircumference}`}
              strokeLinecap="round"
              transform="rotate(135 13 13)"
            />
            <text
              x="13"
              y="14.5"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#F8FAFC"
              fontSize="7.5"
              fontWeight="700"
              fontFamily="JetBrains Mono, ui-monospace, monospace"
            >
              {daysWithoutInterventionToday}
            </text>
          </svg>
          <span className="flex flex-col items-start justify-center leading-none gap-0.5 text-left">
            <span className="text-[11px] font-semibold text-amber-200/95 tracking-tight">
              Myndigheds-fri periode
            </span>
            <span
              className={`text-[11px] font-mono tabular-nums font-extrabold text-rose-300 ${
                isCounterGlimmering ? 'authority-day-tick-settle' : ''
              }`}
            >
              Dag {daysWithoutInterventionToday}
              <span className="hidden sm:inline font-semibold text-slate-300">
                {' '}· Dage uden indgriben
              </span>
              <span className="hidden 2xl:inline font-normal text-slate-400">
                {' '}(19. mar 2026)
              </span>
            </span>
          </span>
        </button>

        <div className="inline-flex items-center shrink-0">
          <SKvotientTendensSparkline
            points={last6HoursSparklinePoints}
            onSelectHour={onSelectHour}
            label="S-tendens"
            svgWidth={56}
            svgHeight={16}
            exceedanceColorHex="#f43f5e"
          />
        </div>

        <button
          type="button"
          onClick={() => onSelectTab('algedonic')}
          title={`Kybernetisk Afslapningstid Tr = ${relaxationTimeTrHours.toFixed(
            1
          )}t vs. Kriseinterval Δt = ${crisisIntervalDt.toFixed(1)}t`}
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border font-mono text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
            isSystemicTetanus
              ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] border-l-4 border-l-rose-500 text-[#F87171] hover:bg-[var(--surface-overlay)]'
              : 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Activity
            className={`w-3.5 h-3.5 shrink-0 ${
              isSystemicTetanus
                ? `text-[#F87171] ${isP1Critical ? 'animate-pulse' : ''}`
                : 'text-[var(--status-normal-text)]'
            }`}
          />
          <span>
            {isSystemicTetanus
              ? `Tr ${relaxationTimeTrHours.toFixed(1)}t > Δt ${crisisIntervalDt.toFixed(1)}t`
              : `Tr ${relaxationTimeTrHours.toFixed(1)}t ≤ Δt ${crisisIntervalDt.toFixed(1)}t`}
          </span>
        </button>

        {/* Aggregated High-Wind & Receptor Threshold Violations Summary Card */}
        <div className="relative shrink-0 max-w-full">
          <button
            type="button"
            data-testid="header-risk-summary-card"
            data-immediate-action-required={immediateActionRequired ? 'true' : 'false'}
            aria-expanded={showRiskSummaryPopover}
            onClick={() => setShowRiskSummaryPopover((v) => !v)}
            title="Samlet risikostatus på tværs af høj vind (>10 m/s), receptorzoner (S ≥ 1,0), indeklima (S_in) og aktive lovbrud"
            className={`px-2 py-1 rounded border font-mono text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap max-w-full ${
              immediateActionRequired
                ? 'bg-rose-950/75 hover:bg-rose-950 border-rose-500/75 border-l-4 border-l-rose-400 text-rose-100 font-bold'
                : elevatedReceptorZones.length > 0
                ? 'bg-amber-950/60 hover:bg-amber-950/80 border-amber-500/60 text-amber-200 font-semibold'
                : 'bg-[var(--surface-card)] hover:bg-[var(--surface-overlay)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium'
            }`}
          >
            {immediateActionRequired ? (
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            ) : elevatedReceptorZones.length > 0 ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            <span
              className={
                immediateActionRequired
                  ? 'text-rose-200 font-extrabold uppercase tracking-tight'
                  : 'text-slate-200 font-semibold'
              }
            >
              {immediateActionRequired
                ? 'Immediate Action Required'
                : elevatedReceptorZones.length > 0
                ? 'Forhøjet Risiko'
                : 'Normal Drift'}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-slate-950/70 border border-slate-700/80 text-[11px] text-slate-200 tabular-nums">
              <span className={isHighWindAlert ? 'text-rose-300 font-bold' : 'text-cyan-300'}>
                {currentWeather.windSpeed10m.toFixed(1)} m/s
              </span>
              <span className="text-slate-500">·</span>
              <span
                className={
                  totalThresholdViolations > 0 ? 'text-rose-300 font-bold' : 'text-emerald-300'
                }
              >
                {criticalReceptorZones.length}/{receptorExposures.length} S≥1
              </span>
            </span>
            <ChevronDown
              className={`w-3 h-3 shrink-0 transition-transform ${
                showRiskSummaryPopover ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showRiskSummaryPopover && (
            <div
              role="region"
              aria-label="Samlet risikoresumé for vind og receptorzoner"
              data-testid="header-risk-summary-popover"
              className="absolute left-0 top-full mt-1.5 w-[340px] max-w-[calc(100vw-1.5rem)] rounded-md bg-[var(--surface-overlay)] border border-[var(--border-subtle)] shadow-2xl p-3 z-50 font-sans text-xs space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-1.5 font-mono font-bold">
                  {immediateActionRequired ? (
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                  <span className={immediateActionRequired ? 'text-rose-300' : 'text-emerald-300'}>
                    {immediateActionRequired
                      ? 'Immediate Action Required (P1)'
                      : 'Ingen P1 Grænseoverskridelser'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRiskSummaryPopover(false)}
                  className="text-[11px] font-mono text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 cursor-pointer"
                >
                  Luk
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-[11px] tabular-nums">
                <div
                  className={`p-2 rounded border ${
                    isHighWindAlert
                      ? 'bg-rose-950/50 border-rose-500/60 text-rose-100'
                      : 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-slate-200'
                  }`}
                >
                  <div className="text-[11px] text-slate-400">Høj Vind (&gt;10 m/s)</div>
                  <div className="font-bold mt-0.5">
                    {isHighWindAlert ? 'ALARM AKTIV' : 'Under 10 m/s'}
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Middel {currentWeather.windSpeed10m.toFixed(1)} · Stød{' '}
                    {currentWeather.windGusts10m.toFixed(1)} m/s
                  </div>
                </div>

                <div
                  className={`p-2 rounded border ${
                    criticalReceptorZones.length > 0
                      ? 'bg-rose-950/50 border-rose-500/60 text-rose-100'
                      : elevatedReceptorZones.length > 0
                      ? 'bg-amber-950/40 border-amber-500/60 text-amber-100'
                      : 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-slate-200'
                  }`}
                >
                  <div className="text-[11px] text-slate-400">Receptorzoner (S ≥ 1,0)</div>
                  <div className="font-bold mt-0.5">
                    {criticalReceptorZones.length} kritiske · {elevatedReceptorZones.length} obs
                  </div>
                  <div className="text-[11px] text-slate-300">
                    S_max = {maxSiteSumQuotient.toFixed(2)} · S_in ={' '}
                    {indoorSumQuotientSin.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 text-[11px] font-mono">
                <span className="text-slate-300">
                  Aktive lovovertrædelser:{' '}
                  <strong className={legalViolations.length > 0 ? 'text-rose-300' : 'text-emerald-300'}>
                    {legalViolations.length}
                  </strong>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTab('substances');
                      setShowRiskSummaryPopover(false);
                    }}
                    className="px-2 py-1 rounded bg-[var(--surface-card)] hover:bg-[var(--surface-panel)] border border-[var(--border-subtle)] text-cyan-300 cursor-pointer"
                  >
                    Receptorer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectTab('compliance');
                      setShowRiskSummaryPopover(false);
                    }}
                    className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold cursor-pointer"
                  >
                    Lovlog ({legalViolations.length})
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ZONE 2 (MIDTE): Kommandopalet Søgeknap (⌘K) + Simuler Fra–Til + Føj alle fund + Kompakt Bulk-ikon */}
      <div className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-full">
        <button
          type="button"
          data-testid="open-command-palette-btn"
          onClick={onOpenCommandPalette}
          title="Åbn global kommandopalet (⌘K / Ctrl+K) — søg i 29 bygninger, receptorer, arbejdsrum, vejrscenarier og rapporter"
          className="px-2.5 py-1.5 rounded bg-[#0F141D] hover:bg-[#1B2433] border border-[#2D3B50] hover:border-cyan-500/50 text-slate-300 hover:text-white text-[11px] flex items-center gap-2 transition-colors cursor-pointer min-w-0 max-w-full sm:max-w-[250px]"
        >
          <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="truncate">
            Søg bygning, modul eller rapport…
          </span>
          <kbd className="px-1.5 py-0.5 rounded bg-[#1B2433] border border-[#2D3B50] font-mono text-[11px] text-slate-300 shrink-0">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          onClick={onToggleRangeSimPanel}
          className={`px-2.5 py-1.5 rounded text-[11px] font-mono font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            isRangeSimPanelOpen
              ? 'bg-emerald-400 text-slate-950 border-emerald-200 font-bold'
              : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
          }`}
          title="Åbn/skjul Simuler Fra dato_klokkeslæt – Til dato_klokkeslæt"
        >
          <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Simuler Fra – Til</span>
        </button>

        <button
          type="button"
          onClick={onAddAllFindingsToEvidence}
          className={`px-2.5 py-1.5 rounded font-mono text-[11px] font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            batchAddFindingsSuccess
              ? 'bg-emerald-500 text-slate-950 border-emerald-300 font-bold'
              : 'bg-[#1B2433] hover:bg-[#212C3E] text-emerald-200 border-emerald-500/45'
          }`}
          title="Føj samtlige aktuelle fund direkte til Beviser med kryptografisk SHA-256 signatur"
        >
          {batchAddFindingsSuccess ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <span>
            {batchAddFindingsSuccess
              ? `${batchAddedFindingsCount} føjet (${observations.length})`
              : `Føj alle fund (${totalCurrentFindingsCount})`}
          </span>
        </button>

        <button
          type="button"
          disabled={isBulkDownloading}
          onClick={onAddAllAndBulkDownload}
          data-testid="add-all-and-bulk-download-header-btn"
          aria-label="Tilføj alle fund og Bulk Download samlet bevispakke"
          className={`px-2 py-1.5 rounded font-mono text-[11px] font-bold flex items-center justify-center gap-1 border transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-60 ${
            bulkDownloadSuccess
              ? 'bg-emerald-400 text-slate-950 border-emerald-200'
              : 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300'
          }`}
          title="Tilføj samtlige aktuelle fund til Beviser med SHA-256 signatur OG download samlet bevispakke (PDF + Perkolation PDF + CSV + JSON)"
        >
          {isBulkDownloading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950 shrink-0" />
          ) : bulkDownloadSuccess ? (
            <Check className="w-3.5 h-3.5 text-slate-950 shrink-0" />
          ) : (
            <Download className="w-3.5 h-3.5 text-slate-950 shrink-0" />
          )}
          <span className="hidden sm:inline">Bulk</span>
        </button>
      </div>

      {/* ZONE 3 (HØJRE): Kilder & Receptorer, Mycelium ISA-18.2, Slagelse SHA-256, Minimerede Vinduer, Fokus-visning, Vejr-Korrelation & Rapport-Hub */}
      <div className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-full">
        <SourceQuickSwitchDropdown
          sources={sources}
          selectedSourceId={selectedSourceId}
          onSelectSource={onSelectSource}
          onToggleSourceActive={onToggleSourceActive}
          onOpenFullModal={onOpenSourceReceptorModal}
          searchable
          defaultFilter="active"
          align="right"
          buttonTestId="header-searchable-source-dropdown-btn"
          menuTestId="header-searchable-source-dropdown-menu"
          searchInputTestId="header-searchable-source-input"
          labelPrefix="Kilde:"
          hideLabelOnSmall={false}
          title="Søg og skift hurtigt mellem aktive kildenoder i simuleringen og på kortet"
        />

        <button
          type="button"
          data-testid="open-source-receptor-selector-btn"
          onClick={onOpenSourceReceptorModal}
          className="px-2 py-1.5 rounded text-[11px] font-mono font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]"
          title="Åbn samlet oversigt for Valg af kilder & Receptorer"
        >
          <Crosshair className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>Kilder &amp; Receptorer</span>
        </button>

        {onTriggerSimultaneousScenario && (
          <div className="relative shrink-0">
            <button
              type="button"
              data-testid="header-simultaneous-algedonic-btn"
              onClick={() => setShowSimultaneousMenu((v) => !v)}
              aria-expanded={showSimultaneousMenu}
              className={`px-2 py-1.5 rounded text-[11px] font-mono tabular-nums font-bold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                simultaneousDispatch?.isBlinkingP1
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border-amber-300 animate-pulse shadow-lg'
                  : simultaneousDispatch?.active
                  ? 'bg-rose-900 hover:bg-rose-800 text-rose-100 border-rose-400'
                  : 'bg-[#1B2433] hover:bg-[#212C3E] text-cyan-200 border-cyan-500/45'
              }`}
              title="Algedonisk Simultan-Simulering (S1 + S3): Udløs direkte atomar smertesignal-nødbremse (T0 → T1, Δt = 0 ms) på System 1 og System 3"
            >
              <AlertOctagon
                className={`w-3.5 h-3.5 shrink-0 ${
                  simultaneousDispatch?.active ? 'text-amber-200' : 'text-cyan-400'
                }`}
              />
              <span>
                {simultaneousDispatch?.isBlinkingP1
                  ? 'P1 S1+S3 (T1)'
                  : simultaneousDispatch?.active
                  ? 'S1+S3 LÅST'
                  : 'Algedonisk S1+S3'}
              </span>
              <ChevronDown className="w-3 h-3 shrink-0" />
            </button>

            {showSimultaneousMenu && (
              <div
                data-testid="header-simultaneous-algedonic-menu"
                className="absolute right-0 top-full mt-1.5 w-[370px] max-w-[calc(100vw-1.5rem)] rounded-lg bg-[#0F1623] border border-rose-500/70 shadow-2xl p-3 z-50 font-mono text-[11px] space-y-2"
              >
                <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
                  <span className="font-bold text-rose-200 uppercase flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span>Algedonisk Simultan-Simulering (S1 + S3)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSimultaneousMenu(false)}
                    className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                  >
                    Luk
                  </button>
                </div>

                <div className="space-y-1">
                  {(
                    [
                      'kierulffsvej_eternit_rupture',
                      'asbestos_plume_cav_vacuum',
                      'combined_vibration_rupture_plume',
                    ] as AlgedonicTestScenarioId[]
                  ).map((scenId) => {
                    const spec = ALGEDONIC_SCENARIO_SPECS[scenId];
                    const isSelected = manualSimultaneousScenario === scenId;
                    return (
                      <button
                        key={scenId}
                        type="button"
                        data-testid={`header-sim-scenario-${scenId}`}
                        onClick={() => {
                          onTriggerSimultaneousScenario(scenId, true);
                          setShowSimultaneousMenu(false);
                        }}
                        className={`w-full p-2 rounded border text-left transition-colors cursor-pointer space-y-0.5 ${
                          isSelected
                            ? 'bg-rose-600/25 border-rose-400 text-white font-bold'
                            : 'bg-[#151C28] hover:bg-[#1B2433] border-[#2D3B50] text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-amber-200 font-bold">{spec.shortTitleDa}</span>
                          {isSelected && (
                            <span className="px-1 rounded bg-rose-600 text-white text-[11px]">
                              AKTIV
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 leading-snug">
                          {spec.subtitleDa}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-1.5">
                  {onOpenSimultaneousModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenSimultaneousModal();
                        setShowSimultaneousMenu(false);
                      }}
                      className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-200 font-bold cursor-pointer"
                    >
                      Åbn Split-Screen Modal
                    </button>
                  )}
                  <div className="flex items-center gap-1.5">
                    {simultaneousDispatch?.isBlinkingP1 && onAcknowledgeSimultaneousP1 && (
                      <button
                        type="button"
                        onClick={() => {
                          onAcknowledgeSimultaneousP1();
                          setShowSimultaneousMenu(false);
                        }}
                        className="px-2 py-1 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer"
                      >
                        Kvittér P1
                      </button>
                    )}
                    {simultaneousDispatch?.active && onClearSimultaneousSimulation && (
                      <button
                        type="button"
                        onClick={() => {
                          onClearSimultaneousSimulation();
                          setShowSimultaneousMenu(false);
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Nulstil</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          data-testid="open-mycelium-isa182-drawer-btn"
          onClick={onToggleMyceliumDrawer}
          className={`px-2 py-1.5 rounded text-[11px] font-mono tabular-nums font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            myceliumUnacknowledgedCount > 0
              ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 font-bold'
              : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
          }`}
          title="Åbn System B Mycelium ISA-18.2 Algedonisk Alarm-Log & Kanal-Status"
        >
          <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>Mycelium ISA-18.2</span>
          <span>({myceliumUnacknowledgedCount})</span>
        </button>

        <button
          type="button"
          data-testid="open-slagelse-legal-dashboard-btn"
          onClick={onOpenSlagelseLegalDashboard}
          className={`px-2 py-1.5 rounded text-[11px] font-mono font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            isSlagelseLegalDashboardActive
              ? 'bg-rose-600 text-white border-rose-400 font-bold'
              : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
          }`}
          title="Åbn dedikeret dashboard til håndtering af juridiske overtrædelser, SHA-256 signerede beviser og dokumentation til Slagelse Kommune"
        >
          <Scale className="w-3.5 h-3.5 shrink-0 text-rose-400" />
          <span>Slagelse SHA-256</span>
          <span>({legalViolations.length})</span>
        </button>

        <MinimizedWindowsDropdownMenu
          windowStates={windowStates}
          onRestoreWindow={onRestoreWindow}
          onPopOutFloating={onPopOutFloatingWindow}
          onMinimizeAllFloating={onMinimizeAllFloating}
          onRestoreAllMinimized={onRestoreAllMinimized}
        />

        <button
          type="button"
          data-testid="toggle-density-mode-btn"
          data-density-mode={densityMode}
          onClick={onToggleDensityMode}
          className={`px-2 py-1.5 rounded text-[11px] font-mono font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            densityMode === 'compact'
              ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/60 font-bold'
              : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
          }`}
          title={
            densityMode === 'compact'
              ? 'Analyst Density Mode: Kompakt Tilsyn (0.80×) aktiv — klik for Standard visning'
              : 'Analyst Density Mode: Standard (1.00×) — klik for Kompakt Tilsyn (~20 % tættere til 13" feltvisning)'
          }
          aria-label="Skift mellem Standard og Kompakt Tilsyn visningstæthed"
        >
          <Rows3 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>
            {densityMode === 'compact' ? 'Kompakt' : 'Standard'}
          </span>
        </button>

        <button
          type="button"
          data-testid="minimize-all-preserve-map-sidebar-btn"
          onClick={onToggleMinimizeAllExceptMapAndSidebar}
          className={`px-2 py-1.5 rounded text-[11px] font-mono font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            isMinimizeAllFocusActive
              ? 'bg-emerald-400 text-slate-950 border-emerald-200 font-bold'
              : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
          }`}
          title="Fokus-visning: Minimer alle sekundære paneler med undtagelse af kort & aktivt højre sidepanel"
        >
          {isMinimizeAllFocusActive ? (
            <>
              <Maximize2 className="w-3.5 h-3.5 shrink-0" />
              <span>Gendan</span>
            </>
          ) : (
            <>
              <Minimize2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Fokus</span>
            </>
          )}
        </button>

        <button
          type="button"
          data-weather-corr-toggle="true"
          onClick={onToggleHeaderWeatherCorrelationPopup}
          aria-label="Vis 24-timers D3 Vejr-Korrelationsgraf"
          className={`px-2 py-1.5 rounded text-[11px] font-mono font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            showHeaderWeatherCorrelationPopup
              ? 'bg-cyan-400 text-slate-950 border-cyan-200 font-bold'
              : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
          }`}
          title="Vis 24-timers D3.js Vejr-Korrelationsgraf mellem vindhastighed (m/s) og registrerede støj- og støvhændelser"
        >
          <Wind className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>Vejr-Korrelation</span>
        </button>

        <button
          type="button"
          data-testid="open-export-hub-btn"
          aria-expanded={isExportHubOpen}
          aria-haspopup="menu"
          onClick={onToggleExportHub}
          className={`px-2.5 py-1.5 rounded text-[11px] font-mono font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            isExportHubOpen
              ? 'bg-cyan-400 text-slate-950 border-cyan-200 font-bold'
              : 'bg-[#212C3E] hover:bg-[#2A384E] text-cyan-100 border-cyan-500/45'
          }`}
          title="Åbn samlet Rapport & Eksport Hub dropdown opdelt i PDF, CSV og JSON (23 flows)"
        >
          <FolderArchive
            className={`w-3.5 h-3.5 shrink-0 ${
              isExportHubOpen ? 'text-slate-950' : 'text-amber-300'
            }`}
          />
          <span>Rapport &amp; Eksport Hub</span>
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 transition-transform ${
              isExportHubOpen ? 'rotate-180 text-slate-950' : 'text-cyan-300'
            }`}
          />
        </button>
      </div>

      {/* D3.js 24-Hour Wind vs. Noise/Dust Correlation Popup inside #page-top-anchor */}
      <HeaderWeatherCorrelationD3Popup
        isOpen={showHeaderWeatherCorrelationPopup}
        onClose={onCloseHeaderWeatherCorrelationPopup}
        dateIso={dateIso}
        weatherHours={weatherHours}
        observations={observations}
        hourlyReceptorProfile={
          (
            puff24h.receptorSummaries.find(
              (r) => r.receptorId === selectedReceptorExposure.receptorId
            ) || puff24h.peakReceptor
          ).hourlyProfile
        }
        selectedHourIndex={selectedHourIndex}
        machineNoiseOutputDb={
          isManualMachineNoiseOverrideActive ? manualMachineNoiseOutputDb : 114
        }
        onSelectHour={onSelectHour}
        onExportForensicPdf={onExportWeatherCorrelationPdf}
      />
    </header>
  );
};
