import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Calendar,
  Camera,
  ChevronDown,
  Clock,
  FileText,
  Layers,
  MapPin,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Radio,
  Square,
  Star,
  Zap,
} from 'lucide-react';
import { CRITICAL_WEATHER_SCENARIOS } from '../../data/ringparkenData';
import { degreesToCompass } from '../../services/weatherService';
import {
  AlgedonicObservation,
  HeatmapComparisonViewMode,
  HourlyWeatherPoint,
  PuffAccumulationResult,
  WeatherDataset,
} from '../../types/dispersion';
import { DispersionForecastOptionMode } from '../DispersionForecastBulletinWidget';
import {
  ForensicEvidenceTimelineWidget,
  classifyObservationKind,
} from '../ForensicEvidenceTimelineWidget';

export interface BottomTimelineFooterProps {
  isBottomCompactMode: boolean;
  onToggleBottomCompactMode: () => void;
  isBottomCompactDropdownOpen: boolean;
  onSetBottomCompactDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isPuffMode: boolean;
  onToggle24hPuffMode: () => void;
  showHeatmapComparison: boolean;
  onToggleHeatmapComparison: () => void;
  heatmapComparisonViewMode: HeatmapComparisonViewMode;
  onSelectHeatmapComparisonMode: (mode: HeatmapComparisonViewMode) => void;
  comparisonHourAIndex: number;
  onSelectComparisonHourAIndex: (hr: number) => void;
  weatherDataset: WeatherDataset;
  currentWeather: HourlyWeatherPoint;
  puff24h: PuffAccumulationResult;
  selectedDateIso: string;
  todayIso: string;
  nextWeekEndIso: string;
  selectedHourIndex: number;
  plumeRouteProgress: number;
  onSelectHourIndex: (hr: number) => void;
  onSelectDateFromPicker: (dateIso: string) => void;
  dispersionForecastMode: DispersionForecastOptionMode;
  onSelectDispersionForecastOption: (mode: DispersionForecastOptionMode) => void;
  onStepBackwardOneHour: () => void;
  onStepForwardOneHour: () => void;
  isPlaying: boolean;
  onTogglePlayPause: () => void;
  simulationSpeedMultiplier: 1 | 2 | 3 | 5 | 10;
  onSelectSimulationSpeedMultiplier: (spd: 1 | 2 | 3 | 5 | 10) => void;
  autoSaveEvidenceOnTimeTravel: boolean;
  autoSavedEvidenceCount: number;
  lastAutoSavedFindingLabel: string | null;
  onToggleAutoSaveEvidenceOnTimeTravel: () => void;
  playbackTargetEndDateIso: string;
  lastMidnightRolloverNotice: { fromDateIso: string; toDateIso: string } | null;
  midnightRolloverCount: number;
  onStartLastWeekTimeTravel: () => void;
  onSimulateNextWeekForecast: () => void;
  onStopTimeTravelRecording: () => void;
  onNotifyTimelineScrub: () => void;
  onScrubTimelineProgress: (progress: number) => void;
  observations: AlgedonicObservation[];
  maxSiteSumQuotient: number;
  selectedObservationId: string | null;
  onSelectObservationFromTimeline: (obs: AlgedonicObservation) => void;
  onMoveObservationHour: (obsId: string, newHourIdx: number) => void;
  activeScenarioId: string | null;
  onApplyScenario: (scenarioId: string) => void;
  isLoadingWeather: boolean;
  onLoadLiveOpenMeteo: () => void;
  sha256Hash: string;
}

export const BottomTimelineFooter: React.FC<BottomTimelineFooterProps> = ({
  isBottomCompactMode,
  onToggleBottomCompactMode,
  isBottomCompactDropdownOpen,
  onSetBottomCompactDropdownOpen,
  isPuffMode,
  onToggle24hPuffMode,
  showHeatmapComparison,
  onToggleHeatmapComparison,
  heatmapComparisonViewMode,
  onSelectHeatmapComparisonMode,
  comparisonHourAIndex,
  onSelectComparisonHourAIndex,
  weatherDataset,
  currentWeather,
  puff24h,
  selectedDateIso,
  todayIso,
  nextWeekEndIso,
  selectedHourIndex,
  plumeRouteProgress,
  onSelectHourIndex,
  onSelectDateFromPicker,
  dispersionForecastMode,
  onSelectDispersionForecastOption,
  onStepBackwardOneHour,
  onStepForwardOneHour,
  isPlaying,
  onTogglePlayPause,
  simulationSpeedMultiplier,
  onSelectSimulationSpeedMultiplier,
  autoSaveEvidenceOnTimeTravel,
  autoSavedEvidenceCount,
  lastAutoSavedFindingLabel,
  onToggleAutoSaveEvidenceOnTimeTravel,
  playbackTargetEndDateIso,
  lastMidnightRolloverNotice,
  midnightRolloverCount,
  onStartLastWeekTimeTravel,
  onSimulateNextWeekForecast,
  onStopTimeTravelRecording,
  onNotifyTimelineScrub,
  onScrubTimelineProgress,
  observations,
  maxSiteSumQuotient,
  selectedObservationId,
  onSelectObservationFromTimeline,
  onMoveObservationHour,
  activeScenarioId,
  onApplyScenario,
  isLoadingWeather,
  onLoadLiveOpenMeteo,
  sha256Hash,
}) => {
  const [isExtendedDeckOpen, setIsExtendedDeckOpen] = useState(true);

  return (
    <>
      <footer className="relative z-40 bg-[var(--surface-panel)] border-t border-[var(--border-subtle)] px-4 py-1.5 shrink-0 space-y-2 font-mono text-[11px] tabular-nums">
        {/* Midnight Rollover & Active Time-Travel Banner */}
        {!isBottomCompactMode &&
          (selectedDateIso !== todayIso || lastMidnightRolloverNotice || isPlaying) && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[11px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#212C3E] text-cyan-200 border border-[#36465E] font-semibold">
                  {selectedDateIso < todayIso
                    ? `TIDSREJSE TILBAGE (${selectedDateIso} → ${playbackTargetEndDateIso})`
                    : selectedDateIso > todayIso
                    ? `NÆSTE UGES VEJRUDSIGT (${selectedDateIso})`
                    : `DAGS DATO (${todayIso})`}
                </span>
                <span className="text-slate-300">
                  Ved kl. <strong className="text-white">00:00</strong> skifter dato automatisk på
                  afspilning &amp; registrering ({weatherDataset.dateIso} kl.{' '}
                  {currentWeather.hourLabel}) frem til{' '}
                  <strong className="text-cyan-300">{playbackTargetEndDateIso}</strong>
                </span>
                {lastMidnightRolloverNotice && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/50 text-amber-200 font-semibold">
                    Seneste 00:00-skift: {lastMidnightRolloverNotice.fromDateIso} →{' '}
                    {lastMidnightRolloverNotice.toDateIso} (#{midnightRolloverCount})
                  </span>
                )}
                {autoSaveEvidenceOnTimeTravel && lastAutoSavedFindingLabel && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/50 text-emerald-200 font-semibold">
                    Auto-gemt: {lastAutoSavedFindingLabel} (I alt: {autoSavedEvidenceCount})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={onStartLastWeekTimeTravel}
                  className="px-2 py-0.5 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-amber-200 font-semibold cursor-pointer"
                >
                  Sidste Uge (-7d) → Dags Dato
                </button>
                <button
                  type="button"
                  onClick={onSimulateNextWeekForecast}
                  className="px-2 py-0.5 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-cyan-200 font-semibold cursor-pointer"
                >
                  Simulér Næste Uge (+7d Udsigt)
                </button>
                {isPlaying && (
                  <button
                    type="button"
                    onClick={onStopTimeTravelRecording}
                    className="px-2.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Square className="w-3 h-3 fill-current shrink-0" />
                    <span>Afbryd Registrering</span>
                  </button>
                )}
              </div>
            </div>
          )}

        {/* Primary Time-Machine & Slider Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Selector */}
          <div className="flex items-center gap-1.5 bg-[#1B2433] border border-[#2D3B50] rounded px-2.5 py-1">
            <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <input
              type="date"
              value={selectedDateIso}
              min="2023-01-01"
              max={nextWeekEndIso}
              onChange={(e) => {
                if (e.target.value) onSelectDateFromPicker(e.target.value);
              }}
              className="bg-transparent text-[11px] font-mono text-slate-100 focus:outline-none [color-scheme:dark]"
            />
          </div>

          {/* Spredningsprognose Select */}
          <div className="hidden 2xl:flex items-center gap-1.5 bg-[#1B2433] border border-[#2D3B50] rounded px-2 py-1">
            <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <label
              htmlFor="spredningsprognose-select"
              className="text-[11px] text-slate-300 font-semibold whitespace-nowrap"
            >
              Spredningsprognose:
            </label>
            <select
              id="spredningsprognose-select"
              value={dispersionForecastMode}
              onChange={(e) =>
                onSelectDispersionForecastOption(e.target.value as DispersionForecastOptionMode)
              }
              className="bg-[#151C28] text-slate-100 text-[11px] rounded px-1.5 py-0.5 border border-[#2D3B50] focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="next_day_00_00_59">
                Døgnet efter fra klokken 00.00.00 - 00.59.59
              </option>
              <option value="five_day_forecast">Fem døgns prognose.</option>
              <option value="weather_broadcast_segment">Som indlæg i en Vejrudsigt.</option>
            </select>
          </div>

          {/* Playback Controls + Speed */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onStepBackwardOneHour}
              className="px-2 py-1 rounded bg-[#1B2433] border border-[#2D3B50] text-[11px] text-slate-200 hover:bg-[#212C3E] transition-colors whitespace-nowrap cursor-pointer"
              title="1 time tilbage (-1t)"
            >
              -1t
            </button>
            <button
              type="button"
              onClick={onTogglePlayPause}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                isPlaying
                  ? 'bg-rose-600 text-white hover:bg-rose-500'
                  : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-bold'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>
                {isPlaying
                  ? 'Pause'
                  : isBottomCompactMode
                  ? 'Afspil'
                  : selectedDateIso < todayIso
                  ? `Afspil til ${todayIso}`
                  : 'Afspil Hændelsesforløb'}
              </span>
            </button>
            <button
              type="button"
              onClick={onStepForwardOneHour}
              className="px-2 py-1 rounded bg-[#1B2433] border border-[#2D3B50] text-[11px] text-slate-200 hover:bg-[#212C3E] transition-colors whitespace-nowrap cursor-pointer"
              title="1 time frem (+1t)"
            >
              +1t
            </button>

            {/* Mandatory Simulation Speed Control Contract */}
            <div
              data-simulation-speed-control="true"
              className="flex items-center gap-0.5 bg-[#1B2433] border border-[#2D3B50] rounded px-1.5 py-0.5 text-[11px] tabular-nums"
              role="group"
              aria-label="Simulerings-hastighed: 1x (Nuværende standard), 2x, 3x, 5x og 10x"
            >
              <span className="text-slate-400 text-[11px] px-1 hidden sm:inline">Hastighed:</span>
              {([1, 2, 3, 5, 10] as const).map((spd) => {
                const isSelectedSpd = simulationSpeedMultiplier === spd;
                const btnLabel =
                  spd === 1
                    ? isBottomCompactMode
                      ? '1x'
                      : '1x (Nuværende standard)'
                    : `${spd}x`;
                return (
                  <button
                    key={`bottom-sim-spd-${spd}`}
                    type="button"
                    onClick={() => onSelectSimulationSpeedMultiplier(spd)}
                    className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                      isSelectedSpd
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:bg-[#212C3E]'
                    }`}
                  >
                    {btnLabel}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onToggleAutoSaveEvidenceOnTimeTravel}
              className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap border cursor-pointer ${
                autoSaveEvidenceOnTimeTravel
                  ? 'bg-[#1B2433] text-emerald-200 border-emerald-500/50'
                  : 'bg-[#1B2433] text-slate-400 border-[#2D3B50]'
              }`}
              title="Auto gem beviser med SHA-256 signatur ved tidsrejser"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                {autoSaveEvidenceOnTimeTravel
                  ? `Auto gem (${autoSavedEvidenceCount})`
                  : 'Auto gem: FRA'}
              </span>
            </button>
          </div>

          {/* Interactive 24-Hour Time-Slider with Lucide Icon Ticks */}
          <div className="flex-1 min-w-[200px] flex flex-col gap-1 bg-[#1B2433] border border-[#2D3B50] rounded px-3 py-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[11px] shrink-0">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold text-white">
                  {showHeatmapComparison
                    ? `T_B: kl. ${currentWeather.hourLabel}`
                    : `kl. ${currentWeather.hourLabel}`}
                </span>
              </div>

              <div className="relative flex-1 flex items-center">
                <input
                  type="range"
                  min={0}
                  max={23}
                  step={0.25}
                  value={
                    Math.abs(plumeRouteProgress - selectedHourIndex) <= 1.05
                      ? plumeRouteProgress
                      : selectedHourIndex
                  }
                  onChange={(e) => {
                    onNotifyTimelineScrub();
                    onScrubTimelineProgress(Number(e.target.value));
                  }}
                  aria-label="24-timers tids-slider med bevis-markører"
                  className="w-full accent-cyan-400 cursor-pointer relative z-10"
                />

                <div className="pointer-events-none absolute inset-x-1 -top-2.5 flex items-center justify-between">
                  {weatherDataset.hours.map((hr) => {
                    const hrObs = observations.filter((o) => o.observedHourIndex === hr.hourIndex);
                    const isPeak = hr.hourIndex === puff24h.peakReceptor.peakHourIndex;
                    const hasPhoto = hrObs.some((o) => classifyObservationKind(o) === 'PHOTO');
                    const hasPdf = hrObs.some((o) => classifyObservationKind(o) === 'PDF');
                    const hasPhys = hrObs.some((o) => classifyObservationKind(o) === 'PHYSICAL');
                    return (
                      <div
                        key={`slider-tick-${hr.hourIndex}`}
                        className="w-3 flex items-center justify-center leading-none"
                      >
                        {hasPhoto ? (
                          <Camera className="w-2.5 h-2.5 text-cyan-400" />
                        ) : hasPdf ? (
                          <FileText className="w-2.5 h-2.5 text-indigo-400" />
                        ) : hasPhys ? (
                          <Zap className="w-2.5 h-2.5 text-amber-400" />
                        ) : isPeak ? (
                          <Star className="w-2.5 h-2.5 text-amber-300 fill-amber-300" />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <span className="text-[11px] text-slate-400 hidden sm:inline whitespace-nowrap">
                00:00–23:00
              </span>
            </div>
          </div>

          {!isBottomCompactMode ? (
            <>
              {/* Dual-Hour Heatmap Comparison Controls */}
              <div className="flex items-center gap-1.5 bg-[#1B2433] border border-[#2D3B50] rounded px-2 py-1 shrink-0">
                <button
                  type="button"
                  onClick={onToggleHeatmapComparison}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                    showHeatmapComparison
                      ? 'bg-[#212C3E] text-amber-200 border border-amber-400/60'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Heatmap-Sammenligning</span>
                </button>

                {showHeatmapComparison && (
                  <>
                    <div className="flex items-center gap-0.5 bg-[#151C28] border border-[#2D3B50] rounded p-0.5">
                      <button
                        type="button"
                        onClick={() => onSelectHeatmapComparisonMode('difference')}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                          heatmapComparisonViewMode === 'difference'
                            ? 'bg-rose-600 text-white font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Δ Differens
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectHeatmapComparisonMode('dual_overlay')}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                          heatmapComparisonViewMode === 'dual_overlay'
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Begge
                      </button>
                    </div>

                    <select
                      value={comparisonHourAIndex}
                      onChange={(e) => onSelectComparisonHourAIndex(Number(e.target.value))}
                      aria-label="Vælg Reference-time T_A"
                      className="bg-[#151C28] border border-[#2D3B50] rounded px-2 py-0.5 text-[11px] font-semibold text-cyan-200 focus:outline-none"
                    >
                      {weatherDataset.hours.map((hr) => (
                        <option key={`footer-ta-${hr.hourIndex}`} value={hr.hourIndex}>
                          T_A: kl. {hr.hourLabel}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => onSelectComparisonHourAIndex(selectedHourIndex)}
                      className="px-2 py-0.5 rounded bg-[#151C28] border border-[#2D3B50] hover:border-cyan-400 text-[11px] text-cyan-300 whitespace-nowrap cursor-pointer"
                    >
                      T_A = Nu
                    </button>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={onToggle24hPuffMode}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 border cursor-pointer ${
                  isPuffMode
                    ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                    : 'bg-[#1B2433] text-amber-200 border-[#2D3B50] hover:bg-[#212C3E]'
                }`}
              >
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>{isPuffMode ? '24t Puff-Aftryk' : 'Vis 24t Puff-Aftryk'}</span>
              </button>

              {/* Calm Collapsible Toggle for 24h Evidence Timeline & Weather Scenarios */}
              <button
                type="button"
                onClick={() => setIsExtendedDeckOpen((v) => !v)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-colors whitespace-nowrap cursor-pointer ${
                  isExtendedDeckOpen
                    ? 'bg-[#212C3E] text-cyan-200 border-cyan-400/60'
                    : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
                }`}
              >
                <span>Tidslinje &amp; Vejr-Scenarier</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                    isExtendedDeckOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => onSetBottomCompactDropdownOpen((v) => !v)}
                className="px-3 py-1 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-[#2D3B50] text-cyan-200 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Kompakt Bund-Menu (Tidslinje, Scenarier &amp; Heatmap)</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isBottomCompactDropdownOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-[360px] sm:w-[580px] max-h-[75vh] overflow-y-auto rounded-lg bg-[#212C3E] border border-[#36465E] shadow-2xl p-3 space-y-3 z-50 text-xs">
                  <ForensicEvidenceTimelineWidget
                    observations={observations}
                    weatherHours={weatherDataset.hours}
                    currentWeather={currentWeather}
                    puff24h={puff24h}
                    selectedDateIso={weatherDataset.dateIso}
                    selectedHourIndex={selectedHourIndex}
                    plumeRouteProgress={plumeRouteProgress}
                    maxSiteSumQuotient={maxSiteSumQuotient}
                    selectedObservationId={selectedObservationId}
                    onSelectHour={onSelectHourIndex}
                    onScrubProgress={onScrubTimelineProgress}
                    onSelectObservation={onSelectObservationFromTimeline}
                    onMoveObservationHour={onMoveObservationHour}
                    comparisonHourAIndex={comparisonHourAIndex}
                    showHeatmapComparison={showHeatmapComparison}
                    onChangeComparisonHourA={onSelectComparisonHourAIndex}
                    onToggleHeatmapComparison={onToggleHeatmapComparison}
                    variant="slider_bar"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#36465E]">
                    {CRITICAL_WEATHER_SCENARIOS.map((sc) => (
                      <button
                        key={`compact-sc-${sc.id}`}
                        type="button"
                        onClick={() => {
                          onApplyScenario(sc.id);
                          onSetBottomCompactDropdownOpen(false);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                          activeScenarioId === sc.id
                            ? 'bg-rose-600 text-white font-semibold'
                            : 'bg-[#151C28] text-slate-300 border border-[#2D3B50]'
                        }`}
                      >
                        {sc.title}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        onLoadLiveOpenMeteo();
                        onSetBottomCompactDropdownOpen(false);
                      }}
                      className="px-2.5 py-1 rounded text-[11px] bg-cyan-500 text-slate-950 font-semibold cursor-pointer"
                    >
                      Live / Arkiv Open-Meteo (24t)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            data-testid="toggle-bottom-timeline-expand-btn"
            onClick={() => {
              if (isBottomCompactMode) {
                setIsExtendedDeckOpen(true);
              }
              onToggleBottomCompactMode();
            }}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isBottomCompactMode
                ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 border-cyan-200 font-bold'
                : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
            }`}
            title={
              isBottomCompactMode
                ? 'Udvid den fulde 24-timers bevis-tidslinje og kritiske vejr-scenarier'
                : 'Skift til slank afspiller-bjælke i bunden'
            }
          >
            {isBottomCompactMode ? (
              <>
                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                <span>Udvid Tidslinje</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                <span>Kompakt Tidslinje</span>
              </>
            )}
          </button>
        </div>

        {/* Collapsible Extended Timeline, 24h Hour Grid & Critical Weather Scenarios */}
        {!isBottomCompactMode && isExtendedDeckOpen && (
          <div className="space-y-2 pt-2 border-t border-[#253042] lg:max-h-[34dvh] lg:overflow-y-auto">
            {(isPuffMode || showHeatmapComparison) && (
              <div className="hidden md:flex items-center gap-1 bg-[#1B2433] border border-[#2D3B50] rounded px-2 py-1">
                <span className="text-[11px] text-amber-300 font-semibold mr-2 whitespace-nowrap">
                  {showHeatmapComparison
                    ? '24t Time-Sammenligning (T_A ↔ T_B):'
                    : '24t Puff-Profil:'}
                </span>
                <div className="flex-1 grid grid-cols-24 gap-0.5">
                  {weatherDataset.hours.map((hr) => {
                    const isPeak = hr.hourIndex === puff24h.peakReceptor.peakHourIndex;
                    const isCurrB = hr.hourIndex === selectedHourIndex;
                    const isCompA = showHeatmapComparison && hr.hourIndex === comparisonHourAIndex;
                    const advDeg = (hr.windDirection10m + 180) % 360;
                    return (
                      <button
                        key={hr.hourIndex}
                        type="button"
                        onClick={(e) => {
                          if (e.shiftKey && showHeatmapComparison) {
                            onSelectComparisonHourAIndex(hr.hourIndex);
                          } else {
                            onSelectHourIndex(hr.hourIndex);
                          }
                        }}
                        title={`Kl. ${hr.hourLabel}: Vind ${hr.windSpeed10m} m/s fra ${hr.windDirection10m}° (${degreesToCompass(
                          hr.windDirection10m
                        )})`}
                        className={`flex flex-col items-center py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                          isCompA && isCurrB
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : isCompA
                            ? 'bg-cyan-500/30 text-cyan-100 border border-cyan-400 font-bold'
                            : isCurrB
                            ? 'bg-rose-500/30 text-rose-100 border border-rose-400 font-bold'
                            : isPeak
                            ? 'bg-amber-400 text-slate-950 font-bold'
                            : 'text-slate-400 hover:bg-[#212C3E] hover:text-slate-200'
                        }`}
                      >
                        <span>{String(hr.hourIndex).padStart(2, '0')}</span>
                        <span
                          className="inline-block leading-none"
                          style={{ transform: `rotate(${advDeg}deg)` }}
                        >
                          ↑
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <ForensicEvidenceTimelineWidget
              observations={observations}
              weatherHours={weatherDataset.hours}
              currentWeather={currentWeather}
              puff24h={puff24h}
              selectedDateIso={weatherDataset.dateIso}
              selectedHourIndex={selectedHourIndex}
              plumeRouteProgress={plumeRouteProgress}
              maxSiteSumQuotient={maxSiteSumQuotient}
              selectedObservationId={selectedObservationId}
              onSelectHour={onSelectHourIndex}
              onScrubProgress={onScrubTimelineProgress}
              onSelectObservation={onSelectObservationFromTimeline}
              onMoveObservationHour={onMoveObservationHour}
              comparisonHourAIndex={comparisonHourAIndex}
              showHeatmapComparison={showHeatmapComparison}
              onChangeComparisonHourA={onSelectComparisonHourAIndex}
              onToggleHeatmapComparison={onToggleHeatmapComparison}
              variant="slider_bar"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#253042]">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 mr-1">Kritiske Vejr-Scenarier:</span>
                {CRITICAL_WEATHER_SCENARIOS.map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => onApplyScenario(sc.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      activeScenarioId === sc.id
                        ? 'bg-rose-600 text-white font-semibold'
                        : 'bg-[#1B2433] text-slate-300 border border-[#2D3B50] hover:bg-[#212C3E] hover:text-white'
                    }`}
                  >
                    {sc.title}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={onLoadLiveOpenMeteo}
                  disabled={isLoadingWeather}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeScenarioId === null
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'bg-[#1B2433] text-cyan-300 border border-[#2D3B50] hover:bg-[#212C3E]'
                  }`}
                >
                  {isLoadingWeather ? 'Henter 24t Open-Meteo...' : 'Live / Arkiv Open-Meteo API (24t)'}
                </button>
              </div>

              <div className="text-[11px] text-slate-400 hidden xl:flex items-center gap-2">
                <span>
                  24t Spids-Receptor:{' '}
                  <strong className="text-amber-300">
                    {puff24h.peakReceptor.address.split(',')[0]}
                  </strong>{' '}
                  kl. <strong className="text-white">{puff24h.peakReceptor.peakHourLabel}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>SHA-256: {sha256Hash.slice(0, 14)}…</span>
              </div>
            </div>
          </div>
        )}
      </footer>

      {/* Subtle ISA-101 Page Scroll Helper Bar (Fallback on < lg; Hidden on Desktop 100dvh Shell) */}
      <div className="fixed right-3 bottom-3 z-50 flex lg:hidden items-center gap-1 rounded-md bg-[#212C3E]/95 border border-[#36465E] px-2 py-1 shadow-xl font-mono text-[11px] text-slate-200 tabular-nums">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="px-2 py-0.5 rounded bg-[#151C28] hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
          title="Rul til toppen"
        >
          <ArrowUp className="w-3 h-3 shrink-0" />
          <span>Top</span>
        </button>
        <button
          type="button"
          onClick={() =>
            document
              .getElementById('main-workspace-anchor')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          className="px-2 py-0.5 rounded bg-[#151C28] hover:bg-[#1B2433] text-amber-300 border border-[#2D3B50] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
          title="Rul til Kort & Analysepanel"
        >
          <MapPin className="w-3 h-3 shrink-0" />
          <span>Kort &amp; Analyse</span>
        </button>
        <button
          type="button"
          onClick={() =>
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
          }
          className="px-2 py-0.5 rounded bg-[#151C28] hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
          title="Rul til bunden"
        >
          <ArrowDown className="w-3 h-3 shrink-0" />
          <span>Bund</span>
        </button>
      </div>
    </>
  );
};
