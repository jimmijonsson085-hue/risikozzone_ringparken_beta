import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Calendar,
  Check,
  ChevronDown,
  CloudRain,
  Compass,
  Download,
  FileDown,
  Flame,
  Gauge,
  Layers,
  Loader2,
  Navigation,
  Radio,
  Scale,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Sun,
  Thermometer,
  Volume2,
  Wind,
  X,
} from 'lucide-react';
import { degreesToCompass } from '../../services/weatherService';
import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  IndoorClimateTelemetryResult,
  Receptor24hCumulativeSummary,
  ReceptorExposureResult,
  ReceptorZone,
  RingparkenBuildingUnit,
  WeatherDataset,
} from '../../types/dispersion';
import { Animated24hWindWidget } from '../Animated24hWindWidget';
import { DispersionForecastOptionMode } from '../DispersionForecastBulletinWidget';
import { TemperatureAerosolChart } from '../TemperatureAerosolChart';
import { VerticalPlume3DBoxWidget } from '../VerticalPlume3DBoxWidget';

export interface WeatherTelemetryStripProps {
  weatherDataset: WeatherDataset;
  currentWeather: HourlyWeatherPoint;
  plumeDirectionDeg: number;
  isHighRiskWind: boolean;
  maxSiteSumQuotient: number;
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  receptorExposures: ReceptorExposureResult[];
  selectedReceptorExposure: ReceptorExposureResult;
  worstExposedReceptor: ReceptorExposureResult | undefined;
  top3MostAffectedReceptors: ReceptorExposureResult[];
  buildings: RingparkenBuildingUnit[];
  indoorClimateTelemetry: IndoorClimateTelemetryResult;
  isNoiseAmplificationRisk: boolean;
  isModerateDownwardBending: boolean;
  downwindWindRefractionDb: number;
  windGradientDuDz: number;
  thermalSpec: { dTdz: number; thermalRefractionDb: number; regimeLabel: string };
  maxDownwindRefractionDb: number;
  showRibbonWindRose: boolean;
  onToggleRibbonWindRose: () => void;
  showRibbon7DayWindRose: boolean;
  onToggleRibbon7DayWindRose: () => void;
  showRibbonProactiveAgent: boolean;
  onToggleRibbonProactiveAgent: () => void;
  showRibbonStochasticBias: boolean;
  onToggleRibbonStochasticBias: () => void;
  showRibbonPredVsActual: boolean;
  onToggleRibbonPredVsActual: () => void;
  showRibbonDispersionForecast: boolean;
  dispersionForecastMode: DispersionForecastOptionMode;
  onSelectDispersionForecastOption: (mode: DispersionForecastOptionMode) => void;
  showRibbon30DayHeatmap: boolean;
  onToggleRibbon30DayHeatmap: () => void;
  showRibbonDepositionProfile: boolean;
  onToggleRibbonDepositionProfile: () => void;
  showRibbonMedicalExpert: boolean;
  onToggleRibbonMedicalExpert: () => void;
  showRibbonExpertChat: boolean;
  onToggleRibbonExpertChat: () => void;
  showRibbonTempChart: boolean;
  onToggleRibbonTempChart: () => void;
  showRibbonAcousticRefraction: boolean;
  onToggleRibbonAcousticRefraction: () => void;
  showRibbonStackEffect: boolean;
  onToggleRibbonStackEffect: () => void;
  weatherJsonExportedJustNow: boolean;
  onExportSelectedDayWeatherJson: () => void;
  onJumpToHighWindHour: () => void;
  onSelectHour: (hrIdx: number) => void;
  onSelectReceptorAndFocusSubstances: (receptorId: string) => void;
  onSelectReceptorAndHour: (receptorId: string, hourIdx: number) => void;
  onLogVerticalPlumeEvidence: (payload: {
    hourIndex: number;
    hourLabel: string;
    windSpeedMs: number;
    pasquillClass: string;
    plumeDirectionDeg: number;
    sliceDistanceMeters: number;
    sigmaZAtSliceMeters: number;
    plumeTopHeightMeters: number;
    floorQuots: Array<{ label: string; zMeters: number; sQuotient: number }>;
  }) => void;
  receptorsExceeding24hDustDanger: Receptor24hCumulativeSummary[];
  allReceptors24hDustSorted: Receptor24hCumulativeSummary[];
  dustDepositionDangerThresholdUgM2: number;
  onChangeDustDepositionDangerThresholdUgM2: (val: number) => void;
  autoLogDustDangerToAlgedonic: boolean;
  onChangeAutoLogDustDangerToAlgedonic: (val: boolean) => void;
  lastAutoLoggedDustAlertCode: string | null;
  onOpenAlgedonicTab: () => void;
  onLog24hDustDepositionDangerManual: (rec: Receptor24hCumulativeSummary) => void;
  onCloseAllExternalDrawers?: () => void;
  externalDrawersActiveCount?: number;
  onExport7DayWindRoseBiasPdf?: () => Promise<void>;
}

export const WeatherTelemetryStrip: React.FC<WeatherTelemetryStripProps> = ({
  weatherDataset,
  currentWeather,
  plumeDirectionDeg,
  isHighRiskWind,
  maxSiteSumQuotient,
  sources,
  receptors,
  receptorExposures,
  selectedReceptorExposure,
  top3MostAffectedReceptors,
  buildings,
  indoorClimateTelemetry,
  isNoiseAmplificationRisk,
  isModerateDownwardBending,
  downwindWindRefractionDb,
  windGradientDuDz,
  thermalSpec,
  maxDownwindRefractionDb,
  showRibbonWindRose,
  onToggleRibbonWindRose,
  showRibbon7DayWindRose,
  onToggleRibbon7DayWindRose,
  showRibbonProactiveAgent,
  onToggleRibbonProactiveAgent,
  showRibbonStochasticBias,
  onToggleRibbonStochasticBias,
  showRibbonPredVsActual,
  onToggleRibbonPredVsActual,
  showRibbonDispersionForecast,
  dispersionForecastMode,
  onSelectDispersionForecastOption,
  showRibbon30DayHeatmap,
  onToggleRibbon30DayHeatmap,
  showRibbonDepositionProfile,
  onToggleRibbonDepositionProfile,
  showRibbonMedicalExpert,
  onToggleRibbonMedicalExpert,
  showRibbonExpertChat,
  onToggleRibbonExpertChat,
  showRibbonTempChart,
  onToggleRibbonTempChart,
  showRibbonAcousticRefraction,
  onToggleRibbonAcousticRefraction,
  showRibbonStackEffect,
  onToggleRibbonStackEffect,
  weatherJsonExportedJustNow,
  onExportSelectedDayWeatherJson,
  onJumpToHighWindHour,
  onSelectHour,
  onSelectReceptorAndFocusSubstances,
  onSelectReceptorAndHour,
  onLogVerticalPlumeEvidence,
  receptorsExceeding24hDustDanger,
  allReceptors24hDustSorted,
  dustDepositionDangerThresholdUgM2,
  onChangeDustDepositionDangerThresholdUgM2,
  autoLogDustDangerToAlgedonic,
  onChangeAutoLogDustDangerToAlgedonic,
  lastAutoLoggedDustAlertCode,
  onOpenAlgedonicTab,
  onLog24hDustDepositionDangerManual,
  onCloseAllExternalDrawers,
  externalDrawersActiveCount = 0,
  onExport7DayWindRoseBiasPdf,
}) => {
  const [isDrawersMenuOpen, setIsDrawersMenuOpen] = useState(false);
  const [showVerticalPlume3DProfile, setShowVerticalPlume3DProfile] = useState(false);
  const [is24hWindDrawerOpen, setIs24hWindDrawerOpen] = useState(false);
  const [is24hDustDangerDrawerOpen, setIs24hDustDangerDrawerOpen] = useState(false);
  const [isExporting7DayWindRosePdf, setIsExporting7DayWindRosePdf] = useState(false);
  const [exported7DayWindRosePdfJustNow, setExported7DayWindRosePdfJustNow] = useState(false);

  const handleTrigger7DayWindRosePdf = async () => {
    if (!onExport7DayWindRoseBiasPdf || isExporting7DayWindRosePdf) return;
    setIsExporting7DayWindRosePdf(true);
    try {
      await onExport7DayWindRoseBiasPdf();
      setExported7DayWindRosePdfJustNow(true);
      window.setTimeout(() => setExported7DayWindRosePdfJustNow(false), 3500);
    } finally {
      setIsExporting7DayWindRosePdf(false);
    }
  };

  const localDrawerCount = [
    showVerticalPlume3DProfile,
    is24hWindDrawerOpen,
    is24hDustDangerDrawerOpen,
  ].filter(Boolean).length;

  const totalOpenDrawersCount = localDrawerCount + externalDrawersActiveCount;
  const hasAnyLocalDrawer = localDrawerCount > 0;

  const peak24hDustUgM2 =
    allReceptors24hDustSorted[0]?.totalDepositedHeavyMetalsAndPcbUgM2 ?? 0;
  const isDustDangerActive = receptorsExceeding24hDustDanger.length > 0;

  const closeAllLocalDrawers = () => {
    setShowVerticalPlume3DProfile(false);
    setIs24hWindDrawerOpen(false);
    setIs24hDustDangerDrawerOpen(false);
  };

  useEffect(() => {
    if (!isDrawersMenuOpen && !hasAnyLocalDrawer && externalDrawersActiveCount === 0) {
      return;
    }
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      if (isDrawersMenuOpen) {
        setIsDrawersMenuOpen(false);
        return;
      }
      if (hasAnyLocalDrawer) {
        closeAllLocalDrawers();
      }
      if (externalDrawersActiveCount > 0 && onCloseAllExternalDrawers) {
        onCloseAllExternalDrawers();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isDrawersMenuOpen,
    hasAnyLocalDrawer,
    externalDrawersActiveCount,
    onCloseAllExternalDrawers,
  ]);

  return (
    <div
      role={isHighRiskWind ? 'alert' : undefined}
      aria-live={isHighRiskWind ? 'polite' : undefined}
      data-testid="weather-telemetry-strip"
      className={`border-b px-4 py-1.5 flex flex-col gap-2 text-[11px] font-mono tabular-nums shrink-0 transition-colors ${
        isHighRiskWind
          ? 'bg-[var(--surface-panel)] border-[var(--border-subtle)] border-l-4 border-l-rose-500'
          : 'bg-[var(--surface-panel)] border-[var(--border-subtle)]'
      }`}
    >
      {/* LEVEL-1 SINGLE-ROW TELEMETRY STRIP (6 Core Tabular Indicators + Consolidated Drawer Selector) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* LEFT: 6 Core Physical & Compliance Telemetry Indicators */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Vind & Stød (m/s — P1 pulse strictly when v > 10 m/s) */}
          <div
            className={`flex items-center gap-1.5 rounded px-2 py-0.5 border ${
              isHighRiskWind
                ? 'bg-rose-600 text-white border-rose-300 animate-pulse'
                : 'bg-[#1B2433] border-[#2D3B50] text-slate-200'
            }`}
            title={
              isHighRiskWind
                ? `KRITISK VINDHASTIGHED (${currentWeather.windSpeed10m} m/s > 10 m/s): Højrisiko-spredningsforhold`
                : `Vindhastighed ${currentWeather.windSpeed10m} m/s (stød ${currentWeather.windGusts10m} m/s · højrisiko > 10 m/s)`
            }
          >
            {isHighRiskWind ? (
              <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0" />
            ) : (
              <Wind className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            )}
            <span className={isHighRiskWind ? 'text-rose-100 font-semibold' : 'text-slate-400'}>
              Vind:
            </span>
            <span className="font-bold text-white">{currentWeather.windSpeed10m.toFixed(1)} m/s</span>
            <span className={isHighRiskWind ? 'text-amber-100' : 'text-slate-400'}>
              (stød {currentWeather.windGusts10m.toFixed(1)})
            </span>
            {isHighRiskWind && (
              <span className="px-1.5 py-0.5 rounded bg-[var(--surface-canvas)] text-rose-200 border border-rose-400/70 text-[11px] font-bold uppercase whitespace-nowrap">
                &gt; 10 m/s
              </span>
            )}
          </div>

          {/* 2. Retning & Fanevektor (° + kompas) */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1B2433] border border-[#2D3B50] text-slate-200"
            title={`Vind fra ${currentWeather.windDirection10m}° (${degreesToCompass(
              currentWeather.windDirection10m
            )}) · Røg-/støvfane driver mod ${plumeDirectionDeg}° (${degreesToCompass(plumeDirectionDeg)})`}
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-semibold text-slate-100">
              {currentWeather.windDirection10m}° {degreesToCompass(currentWeather.windDirection10m)}
            </span>
            <span className="text-cyan-300 font-semibold">
              → Fane {plumeDirectionDeg}° ({degreesToCompass(plumeDirectionDeg)})
            </span>
          </div>

          {/* 3. Temperatur, Sol & Nedbør (°C · W/m² · mm/t inkl. TemperatureAerosolChart sparkline) */}
          <div
            className="flex items-center gap-2 px-2 py-0.5 rounded bg-[#1B2433] border border-[#2D3B50] text-slate-200"
            title={`Temperatur ${currentWeather.temperature2m} °C · Direkte solindstråling ${currentWeather.directRadiation} W/m² · Nedbør ${currentWeather.precipitation} mm/t (RF ${currentWeather.relativeHumidity2m}%)`}
          >
            <div className="flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-semibold text-white">
                {currentWeather.temperature2m.toFixed(1)} °C
              </span>
            </div>
            <span className="hidden xl:inline text-slate-400">·</span>
            <div className="hidden xl:flex items-center gap-1 text-slate-300">
              <Sun className="w-3 h-3 text-amber-300 shrink-0" />
              <span>{currentWeather.directRadiation} W/m²</span>
            </div>
            <span className="hidden lg:inline text-slate-400">·</span>
            <div className="hidden lg:flex items-center gap-1 text-slate-300">
              <CloudRain className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>{currentWeather.precipitation.toFixed(1)} mm/t</span>
            </div>
            <TemperatureAerosolChart
              hours={weatherDataset.hours}
              currentWeather={currentWeather}
              dateIso={weatherDataset.dateIso}
              onSelectHour={onSelectHour}
              variant="inline-sparkline"
              isInlineExpanded={showRibbonTempChart}
              onToggleExpandInline={onToggleRibbonTempChart}
            />
          </div>

          {/* 4. Pasquill-Gifford Stabilitetsklasse (A–F) & Skorstenseffekt (+Pa · z_NPL) */}
          <button
            type="button"
            onClick={onToggleRibbonStackEffect}
            className={`px-2 py-0.5 rounded border text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors ${
              showRibbonStackEffect
                ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                : 'bg-[#1B2433] hover:bg-[#212C3E] text-slate-200 border-[#2D3B50]'
            }`}
            title={`Pasquill-Gifford Stabilitetsklasse ${currentWeather.pasquillClass} · Termisk Skorstenseffekt ΔP_s = +${indoorClimateTelemetry.deltaPsSpanPa.toFixed(
              1
            )} Pa · Neutraltryksplan z_NPL = ${indoorClimateTelemetry.zNplEffectiveMeters.toFixed(
              1
            )} m · Klik for Skorstenseffekt-skuffe`}
          >
            <Gauge
              className={`w-3.5 h-3.5 shrink-0 ${
                showRibbonStackEffect ? 'text-slate-950' : 'text-emerald-400'
              }`}
            />
            <span className={showRibbonStackEffect ? 'text-slate-950' : 'text-emerald-300 font-semibold'}>
              PG {currentWeather.pasquillClass}
            </span>
            <span className={showRibbonStackEffect ? 'text-slate-800' : 'text-slate-500'}>·</span>
            <Flame
              className={`w-3 h-3 shrink-0 ${
                showRibbonStackEffect ? 'text-slate-950' : 'text-amber-400'
              }`}
            />
            <span className="font-semibold">
              +{indoorClimateTelemetry.deltaPsSpanPa.toFixed(1)} Pa · z
              <sub>NPL</sub> {indoorClimateTelemetry.zNplEffectiveMeters.toFixed(1)}m
            </span>
          </button>

          {/* 5. Lydbølge-Refraktion (+dB) */}
          <button
            type="button"
            onClick={onToggleRibbonAcousticRefraction}
            className={`px-2 py-0.5 rounded border text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors ${
              showRibbonAcousticRefraction
                ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                : isNoiseAmplificationRisk
                ? 'bg-rose-950/60 text-amber-200 border-rose-500/60 hover:bg-rose-950/80'
                : isModerateDownwardBending
                ? 'bg-[#1B2433] text-cyan-200 border-[#2D3B50] hover:bg-[#212C3E]'
                : 'bg-[#1B2433] text-slate-300 border-[#2D3B50] hover:bg-[#212C3E]'
            }`}
            title={`ISO 9613-2 / Nord2000 lydbølgebøjning: Medvind +${downwindWindRefractionDb.toFixed(
              1
            )} dB (∂u/∂z = +${windGradientDuDz} s⁻¹), termisk ${
              thermalSpec.thermalRefractionDb >= 0 ? '+' : ''
            }${thermalSpec.thermalRefractionDb.toFixed(1)} dB (${
              thermalSpec.regimeLabel
            }). Netto: ${maxDownwindRefractionDb >= 0 ? '+' : ''}${maxDownwindRefractionDb.toFixed(
              1
            )} dB. Klik for Akustisk Refraktions-skuffe`}
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span>Refraktion:</span>
            <span className="font-bold">
              {maxDownwindRefractionDb >= 0 ? '+' : ''}
              {maxDownwindRefractionDb.toFixed(1)} dB
            </span>
          </button>

          {/* 6. 24t Støv-Deponerings Status (µg/m² mod faregrænsen) */}
          <button
            type="button"
            onClick={() => setIs24hDustDangerDrawerOpen((v) => !v)}
            className={`px-2 py-0.5 rounded border text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors ${
              is24hDustDangerDrawerOpen
                ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                : isDustDangerActive
                ? 'bg-rose-950/60 border-amber-400/70 text-amber-200 hover:bg-rose-950/80'
                : 'bg-[#1B2433] hover:bg-[#212C3E] border-[#2D3B50] text-slate-200'
            }`}
            title={`24t kumulativ støv-deponering: spids ${peak24hDustUgM2.toFixed(
              1
            )} µg/m² mod faregrænse ${dustDepositionDangerThresholdUgM2} µg/m² (${
              receptorsExceeding24hDustDanger.length
            } receptorer over grænse)`}
          >
            <ShieldAlert
              className={`w-3.5 h-3.5 shrink-0 ${
                is24hDustDangerDrawerOpen
                  ? 'text-slate-950'
                  : isDustDangerActive
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            />
            <span>24t Støv:</span>
            <span className="font-bold">
              {peak24hDustUgM2.toFixed(0)}/{dustDepositionDangerThresholdUgM2} µg/m²
            </span>
            {isDustDangerActive && (
              <span
                className={`px-1 rounded text-[11px] font-bold ${
                  is24hDustDangerDrawerOpen
                    ? 'bg-slate-950 text-amber-300'
                    : 'bg-rose-600 text-white'
                }`}
              >
                {receptorsExceeding24hDustDanger.length}
              </span>
            )}
          </button>
        </div>

        {/* RIGHT: Consolidated 'Vejr- & Prognose-Skuffer' (4 Groups) + Weather JSON + >10m/s Sim + S_max */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Compact Popover Selector with 4 Groups */}
          <div className="relative">
            <button
              type="button"
              data-testid="weather-forecast-drawers-toggle-btn"
              onClick={() => setIsDrawersMenuOpen((v) => !v)}
              className={`px-2.5 py-1 rounded border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                isDrawersMenuOpen || totalOpenDrawersCount > 0
                  ? 'bg-[#212C3E] border-cyan-400/70 text-cyan-200'
                  : 'bg-[#1B2433] hover:bg-[#212C3E] border-[#2D3B50] text-slate-200'
              }`}
              title="Åbn Vejr- & Prognose-Skuffer (Prognose, Vind & Luft, Akustik & Skorsten, AI Rådgivere)"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>
                Vejr- &amp; Prognose-Skuffer
                {totalOpenDrawersCount > 0 ? ` (${totalOpenDrawersCount})` : ''}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {isDrawersMenuOpen && (
              <div
                role="dialog"
                aria-label="Vejr- og Prognose-Skuffer"
                className="absolute right-0 top-full mt-1.5 w-[490px] max-w-[94vw] max-h-[75vh] overflow-y-auto rounded-lg bg-[#1B2433] border border-[#36465E] shadow-2xl p-3 space-y-3 z-50 text-[11px]"
              >
                <div className="flex items-center justify-between border-b border-[#2D3B50] pb-1.5">
                  <span className="font-bold uppercase tracking-wider text-cyan-200">
                    Vejr- &amp; Prognose-Skuffer (4 Grupper)
                  </span>
                  <div className="flex items-center gap-1.5">
                    {totalOpenDrawersCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          closeAllLocalDrawers();
                          onCloseAllExternalDrawers?.();
                        }}
                        className="px-2 py-0.5 rounded bg-rose-950/70 hover:bg-rose-900 border border-rose-500/50 text-rose-200 text-[11px] font-semibold cursor-pointer"
                      >
                        Luk alle ({totalOpenDrawersCount})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsDrawersMenuOpen(false)}
                      className="p-1 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-slate-300 hover:text-white cursor-pointer"
                      title="Luk menu (Esc)"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Gruppe 1: Prognose (5-døgn / 00:00 / Udsigt + Prædiktion vs +7d) */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                    1. Prognose (5-døgn / 00:00 / Udsigt)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'five_day_forecast', label: '5-Døgns Prognose' },
                        { id: 'next_day_00_00_59', label: '00:00–00:59 Næste Døgn' },
                        { id: 'weather_broadcast_segment', label: 'Vejrudsigts-Indlæg' },
                      ] as const
                    ).map((opt) => {
                      const active =
                        showRibbonDispersionForecast && dispersionForecastMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onSelectDispersionForecastOption(opt.id)}
                          className={`px-2 py-1.5 rounded text-left border flex items-center gap-1.5 cursor-pointer transition-colors ${
                            active
                              ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                              : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                          }`}
                        >
                          <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="truncate">{opt.label}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={onToggleRibbonPredVsActual}
                      className={`px-2 py-1.5 rounded text-left border flex items-center gap-1.5 cursor-pointer transition-colors ${
                        showRibbonPredVsActual
                          ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">Prædiktion vs. +7d</span>
                    </button>
                  </div>
                </div>

                {/* Gruppe 2: Vind & Luft (24t/7d Vindrose, Bias, 3D Vertikal Fane, 24t Vind, Heatmap, Støv-Deponering) */}
                <div className="space-y-1.5 pt-1 border-t border-[#2D3B50]/70">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    2. Vind &amp; Luft (Vindrose, Bias, 3D Vertikal Fane)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={onToggleRibbonWindRose}
                      className={`px-2 py-1.5 rounded text-left border flex items-center gap-1.5 cursor-pointer ${
                        showRibbonWindRose
                          ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                      }`}
                    >
                      <Navigation className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">24t Vind-Rose</span>
                    </button>
                    <button
                      type="button"
                      onClick={onToggleRibbon7DayWindRose}
                      className={`px-2 py-1.5 rounded text-left border flex items-center gap-1.5 cursor-pointer ${
                        showRibbon7DayWindRose
                          ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                      }`}
                    >
                      <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">7-Dages Vind-Rose</span>
                    </button>
                    <button
                      type="button"
                      onClick={onToggleRibbonStochasticBias}
                      className={`px-2 py-1.5 rounded text-left border flex items-center gap-1.5 cursor-pointer ${
                        showRibbonStochasticBias
                          ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                      }`}
                    >
                      <Scale className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">Stokastisk Vind-Bias</span>
                    </button>
                    <button
                      type="button"
                      data-testid="toggle-3d-vertical-plume-profile-btn"
                      onClick={() => setShowVerticalPlume3DProfile((v) => !v)}
                      className={`px-2 py-1.5 rounded text-left border flex items-center gap-1.5 cursor-pointer ${
                        showVerticalPlume3DProfile
                          ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                      }`}
                    >
                      <Layers
                        className={`w-3.5 h-3.5 shrink-0 ${
                          showVerticalPlume3DProfile ? 'text-slate-950' : 'text-amber-400'
                        }`}
                      />
                      <span className="truncate">3D Vertikal Fane-Profil</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIs24hWindDrawerOpen((v) => !v)}
                      className={`px-2 py-1.5 rounded text-left border flex items-center gap-1.5 cursor-pointer ${
                        is24hWindDrawerOpen
                          ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                      }`}
                    >
                      <Wind className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">24t Vind-Animation</span>
                    </button>
                    <button
                      type="button"
                      onClick={onToggleRibbon30DayHeatmap}
                      className={`px-2 py-1.5 rounded text-left border flex items-center gap-1.5 cursor-pointer ${
                        showRibbon30DayHeatmap
                          ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">30-Dages Heatmap</span>
                    </button>
                    <button
                      type="button"
                      onClick={onToggleRibbonDepositionProfile}
                      className={`px-2 py-1.5 rounded text-left border flex items-center gap-1.5 cursor-pointer ${
                        showRibbonDepositionProfile
                          ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                      <span className="truncate">Støv-Deponering (µg/m²)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIs24hDustDangerDrawerOpen((v) => !v)}
                      className={`px-2 py-1.5 rounded text-left border flex items-center gap-1.5 cursor-pointer ${
                        is24hDustDangerDrawerOpen
                          ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                      }`}
                    >
                      <ShieldAlert
                        className={`w-3.5 h-3.5 shrink-0 ${
                          is24hDustDangerDrawerOpen ? 'text-slate-950' : 'text-amber-400'
                        }`}
                      />
                      <span className="truncate">24t Støv Fare-Alarm</span>
                    </button>
                    <button
                      type="button"
                      onClick={onToggleRibbonTempChart}
                      className={`px-2 py-1.5 rounded text-left border flex items-center gap-1.5 cursor-pointer col-span-2 ${
                        showRibbonTempChart
                          ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                      }`}
                    >
                      <Thermometer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">24t Temperatur &amp; Aerosol-Profil</span>
                    </button>
                    {onExport7DayWindRoseBiasPdf && (
                      <button
                        type="button"
                        data-testid="ribbon-7day-windrose-bias-pdf-btn"
                        disabled={isExporting7DayWindRosePdf}
                        onClick={() => void handleTrigger7DayWindRosePdf()}
                        className={`px-2 py-1.5 rounded text-left border flex items-center justify-between gap-1.5 cursor-pointer col-span-2 transition-colors disabled:opacity-60 ${
                          exported7DayWindRosePdfJustNow
                            ? 'bg-emerald-400 text-slate-950 border-emerald-200 font-bold'
                            : 'bg-cyan-950/60 hover:bg-cyan-900/70 border-cyan-500/60 text-cyan-100 font-semibold'
                        }`}
                        title="Generér og download højopløselig 2-siders PDF med 7-dages vind-rose, Slagelse normal-sammenligning og statistisk vind-bias"
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          {isExporting7DayWindRosePdf ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-cyan-300" />
                          ) : exported7DayWindRosePdfJustNow ? (
                            <Check className="w-3.5 h-3.5 shrink-0 text-slate-950" />
                          ) : (
                            <FileDown className="w-3.5 h-3.5 shrink-0 text-cyan-300" />
                          )}
                          <span className="truncate">
                            {isExporting7DayWindRosePdf
                              ? 'Genererer 7-Dages Vind-Rose & Bias PDF...'
                              : exported7DayWindRosePdfJustNow
                              ? '✓ 7-Dages Vind-Rose & Bias PDF downloadet'
                              : 'Download 7-Dages Vind-Rose & Statistisk Bias (PDF)'}
                          </span>
                        </span>
                        <span className="text-[10px] font-mono opacity-85 shrink-0">
                          2000px A4
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Gruppe 3: Akustik & Skorsten (Refraktion, Skorstenseffekt) */}
                <div className="space-y-1.5 pt-1 border-t border-[#2D3B50]/70">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-rose-300">
                    3. Akustik &amp; Skorsten
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={onToggleRibbonAcousticRefraction}
                      className={`px-2 py-1.5 rounded text-left border flex items-center gap-1.5 cursor-pointer ${
                        showRibbonAcousticRefraction
                          ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                      }`}
                    >
                      <Volume2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          showRibbonAcousticRefraction ? 'text-slate-950' : 'text-rose-400'
                        }`}
                      />
                      <span className="truncate">Akustisk Refraktion</span>
                    </button>
                    <button
                      type="button"
                      onClick={onToggleRibbonStackEffect}
                      className={`px-2 py-1.5 rounded text-left border flex items-center gap-1.5 cursor-pointer ${
                        showRibbonStackEffect
                          ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                      }`}
                    >
                      <Flame
                        className={`w-3.5 h-3.5 shrink-0 ${
                          showRibbonStackEffect ? 'text-slate-950' : 'text-amber-400'
                        }`}
                      />
                      <span className="truncate">Skorstenseffekt (ΔP_s)</span>
                    </button>
                  </div>
                </div>

                {/* Gruppe 4: AI Rådgivere (Proaktiv AI, Lægefaglig AI, 5 AI Eksperter) */}
                <div className="space-y-1.5 pt-1 border-t border-[#2D3B50]/70">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                    4. AI Rådgivere
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={onToggleRibbonProactiveAgent}
                      className={`px-2 py-1.5 rounded text-left border flex items-center gap-1.5 cursor-pointer ${
                        showRibbonProactiveAgent
                          ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">Proaktiv AI-Agent</span>
                    </button>
                    <button
                      type="button"
                      onClick={onToggleRibbonMedicalExpert}
                      className={`px-2 py-1.5 rounded text-left border flex items-center gap-1.5 cursor-pointer ${
                        showRibbonMedicalExpert
                          ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                      }`}
                    >
                      <Stethoscope className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">Lægefaglig AI Ekspert</span>
                    </button>
                    <button
                      type="button"
                      onClick={onToggleRibbonExpertChat}
                      className={`px-2 py-1.5 rounded text-left border flex items-center gap-1.5 cursor-pointer col-span-2 ${
                        showRibbonExpertChat
                          ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                      }`}
                    >
                      <Bot className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">5 AI Eksperter (Miljø · Akustik · Jura · Toksikologi)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {onExport7DayWindRoseBiasPdf && (
            <button
              type="button"
              data-testid="ribbon-bar-7day-windrose-pdf-btn"
              disabled={isExporting7DayWindRosePdf}
              onClick={() => void handleTrigger7DayWindRosePdf()}
              className={`px-2 py-1 rounded border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 ${
                exported7DayWindRosePdfJustNow
                  ? 'bg-emerald-400 text-slate-950 border-emerald-200 font-bold'
                  : 'bg-[#1B2433] hover:bg-[#212C3E] text-cyan-200 border-[#2D3B50]'
              }`}
              title="Download højopløselig PDF af 7-dages vind-rose & statistisk vind-bias sammenligning"
            >
              {isExporting7DayWindRosePdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-cyan-300" />
              ) : exported7DayWindRosePdfJustNow ? (
                <Check className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              )}
              <span>
                {isExporting7DayWindRosePdf
                  ? '7d PDF...'
                  : exported7DayWindRosePdfJustNow
                  ? '7d PDF ✓'
                  : '7d Vind-Rose & Bias (PDF)'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onExportSelectedDayWeatherJson}
            className={`px-2 py-1 rounded border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
              weatherJsonExportedJustNow
                ? 'bg-emerald-400 text-slate-950 border-emerald-200 font-bold'
                : 'bg-[#1B2433] hover:bg-[#212C3E] text-emerald-200 border-[#2D3B50]'
            }`}
            title={`Eksportér 24 timers vejrdata (${weatherDataset.dateIso}) som JSON`}
          >
            {weatherJsonExportedJustNow ? (
              <>
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>24t JSON</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>24t Vejr (JSON)</span>
              </>
            )}
          </button>

          {!isHighRiskWind && (
            <button
              type="button"
              onClick={onJumpToHighWindHour}
              className="px-2 py-1 rounded bg-[#1B2433] hover:bg-[#212C3E] text-slate-300 border border-[#2D3B50] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
              title="Skift til time/scenarie med vindhastighed > 10 m/s"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Simulér &gt; 10 m/s</span>
            </button>
          )}

          <span
            className={`px-2 py-1 rounded border font-bold whitespace-nowrap ${
              maxSiteSumQuotient >= 1.0
                ? 'bg-rose-950/60 border-rose-500/70 text-rose-300'
                : maxSiteSumQuotient >= 0.5
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                : 'bg-[#1B2433] border-[#2D3B50] text-emerald-300'
            }`}
          >
            {maxSiteSumQuotient >= 1.0
              ? `ULOVLIG S = ${maxSiteSumQuotient.toFixed(2)}`
              : `S = ${maxSiteSumQuotient.toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* PROACTIVE P1 HIGH-WIND (> 10 m/s) RECEPTOR ALERT BANNER */}
      {isHighRiskWind && top3MostAffectedReceptors.length > 0 && (
        <div className="p-2.5 rounded-md bg-[var(--surface-card)] border border-[var(--border-subtle)] border-l-4 border-l-rose-500 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F87171] shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-100">
                PROAKTIV STØVSPREDNINGS-NOTIFIKATION (VIND {currentWeather.windSpeed10m} m/s &gt; 10 m/s · FANE MOD{' '}
                {plumeDirectionDeg}° {degreesToCompass(plumeDirectionDeg)})
              </span>
            </div>
            <span className="text-[11px] text-amber-200 font-semibold">
              Proaktivt tiltag: Aktivér vandkanoner ved{' '}
              {top3MostAffectedReceptors[0]?.dominantSourceName.split(':')[0]} · Indstil uafskærmet nedbrydning
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {top3MostAffectedReceptors.map((recExp, idx) => {
              const rank = idx + 1;
              const isSel = selectedReceptorExposure.receptorId === recExp.receptorId;
              const topSub = [...recExp.substances].sort((a, b) => b.quotient - a.quotient)[0];
              return (
                <button
                  key={`ribbon-hw-rec-${recExp.receptorId}`}
                  type="button"
                  onClick={() => onSelectReceptorAndFocusSubstances(recExp.receptorId)}
                  className={`text-left p-2 rounded border transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                    isSel
                      ? 'bg-rose-950/60 border-amber-400 text-white'
                      : 'bg-[#151C28] border-[#2D3B50] hover:border-rose-400/70 text-slate-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold">
                        #{rank}
                      </span>
                      <span className="font-bold text-xs text-white truncate">
                        {recExp.receptorCode}: {recExp.receptorName}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 truncate mt-0.5">
                      {recExp.address} · {recExp.distanceFromNearestSourceMeters} m fra{' '}
                      {recExp.dominantSourceName.split(':')[0]}
                    </div>
                    {topSub && (
                      <div className="text-[11px] text-amber-200 truncate">
                        Kritisk stof: {topSub.name.split(' ')[0]} ({topSub.concentration}{' '}
                        {topSub.unit})
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={
                        recExp.sumQuotient >= 1.0
                          ? 'text-sm font-bold text-rose-300'
                          : 'text-sm font-bold text-amber-300'
                      }
                    >
                      S = {recExp.sumQuotient.toFixed(2)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* CONTROLLED, CLOSABLE LOCAL DRAWER (24h Wind / 3D Vertical Plume / 24h Cumulative Dust Deposition) */}
      {hasAnyLocalDrawer && (
        <div
          role="region"
          aria-label="Vejr- & Luftskuffe"
          className="space-y-2 pt-1.5 border-t border-[#253042] max-h-[55vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-[#1B2433] border border-[#2D3B50] sticky top-0 z-10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-200">
              Vind- &amp; Luftskuffe (Tryk Esc eller Luk for fuld kortvisning)
            </span>
            <button
              type="button"
              onClick={closeAllLocalDrawers}
              className="px-2 py-0.5 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#36465E] text-slate-200 hover:text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Luk</span>
            </button>
          </div>

          {(showVerticalPlume3DProfile || is24hWindDrawerOpen) && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5 items-start">
              {is24hWindDrawerOpen && (
                <div className={showVerticalPlume3DProfile ? 'xl:col-span-5' : 'xl:col-span-12'}>
                  <Animated24hWindWidget
                    hours={weatherDataset.hours}
                    currentWeather={currentWeather}
                    dateIso={weatherDataset.dateIso}
                    onSelectHour={onSelectHour}
                    onExportWeatherJson={onExportSelectedDayWeatherJson}
                    jsonExportedJustNow={weatherJsonExportedJustNow}
                    onOpenStackEffectVisualization={onToggleRibbonStackEffect}
                    variant="rubric-box"
                  />
                </div>
              )}
              {showVerticalPlume3DProfile && (
                <div className={is24hWindDrawerOpen ? 'xl:col-span-7' : 'xl:col-span-12'}>
                  <VerticalPlume3DBoxWidget
                    dateIso={weatherDataset.dateIso}
                    currentWeather={currentWeather}
                    hours={weatherDataset.hours}
                    sources={sources}
                    receptors={receptors}
                    receptorExposures={receptorExposures}
                    buildings={buildings}
                    maxSiteSumQuotient={maxSiteSumQuotient}
                    onSelectHour={onSelectHour}
                    onLogVerticalPlumeEvidence={onLogVerticalPlumeEvidence}
                  />
                </div>
              )}
            </div>
          )}

          {is24hDustDangerDrawerOpen && (
            <div
              role="region"
              aria-label="Automatisk 24-timers kumulativ støv-deponerings fare-alarm (µg/m²)"
              className={`p-2.5 rounded-md border space-y-2 text-[11px] ${
                receptorsExceeding24hDustDanger.length > 0
                  ? 'bg-[#1B2433] border-amber-500/70'
                  : 'bg-[#1B2433] border-[#2D3B50]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <ShieldAlert
                    className={`w-4 h-4 shrink-0 ${
                      receptorsExceeding24hDustDanger.length > 0
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  />
                  <span className="font-bold uppercase tracking-wider text-slate-100">
                    {receptorsExceeding24hDustDanger.length > 0
                      ? `FARE-ALARM: 24T KUMULATIV STØV-DEPONERING OVERSKREDET (${receptorsExceeding24hDustDanger.length} RECEPTORER ≥ ${dustDepositionDangerThresholdUgM2} µg/m²)`
                      : `24T KUMULATIV STØV-DEPONERING UNDER FARE-GRÆNSE (< ${dustDepositionDangerThresholdUgM2} µg/m²)`}
                  </span>
                  {lastAutoLoggedDustAlertCode && (
                    <button
                      type="button"
                      onClick={onOpenAlgedonicTab}
                      className="px-2 py-0.5 rounded bg-[#212C3E] hover:bg-[#151C28] text-cyan-200 border border-[#36465E] text-[11px] font-semibold cursor-pointer"
                    >
                      Logget i Algedonisk Log: {lastAutoLoggedDustAlertCode} →
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-slate-300 font-semibold">Fare-grænse (µg/m²):</span>
                  {[80, 150, 220, 300].map((presetVal) => (
                    <button
                      key={`dust-thr-${presetVal}`}
                      type="button"
                      onClick={() => onChangeDustDepositionDangerThresholdUgM2(presetVal)}
                      className={`px-1.5 py-0.5 rounded border font-semibold cursor-pointer transition-colors ${
                        dustDepositionDangerThresholdUgM2 === presetVal
                          ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                          : 'bg-[#151C28] text-slate-300 border-[#2D3B50] hover:border-amber-400/60'
                      }`}
                    >
                      {presetVal} µg/m²
                    </button>
                  ))}
                  <input
                    type="range"
                    min={40}
                    max={400}
                    step={10}
                    value={dustDepositionDangerThresholdUgM2}
                    onChange={(e) =>
                      onChangeDustDepositionDangerThresholdUgM2(Number(e.target.value))
                    }
                    aria-label="Fare-grænse for 24-timers kumulativ støv-deponering i µg/m²"
                    className="w-24 accent-amber-400 cursor-pointer"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoLogDustDangerToAlgedonic}
                      onChange={(e) => onChangeAutoLogDustDangerToAlgedonic(e.target.checked)}
                      className="accent-cyan-400"
                    />
                    <span>Auto-log til Algedonisk Log</span>
                  </label>
                </div>
              </div>

              {receptorsExceeding24hDustDanger.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {receptorsExceeding24hDustDanger.slice(0, 3).map((rec, idx) => {
                    const excessUg = Number(
                      (
                        rec.totalDepositedHeavyMetalsAndPcbUgM2 -
                        dustDepositionDangerThresholdUgM2
                      ).toFixed(1)
                    );
                    return (
                      <div
                        key={`dust-danger-rec-${rec.receptorId}`}
                        className="p-2 rounded bg-[#151C28] border border-amber-500/50 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold">
                              #{idx + 1}
                            </span>
                            <span className="font-bold text-white truncate">
                              {rec.receptorCode}: {rec.receptorName}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 truncate mt-0.5">
                            {rec.address} · Spids kl. {rec.peakHourLabel} (S=
                            {rec.peakSumQuotient.toFixed(2)})
                          </div>
                          <div className="text-[11px] text-amber-300 font-semibold">
                            24t Deponering: {rec.totalDepositedHeavyMetalsAndPcbUgM2.toFixed(1)}{' '}
                            µg/m² (+{excessUg} µg/m²)
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              onSelectReceptorAndHour(rec.receptorId, rec.peakHourIndex)
                            }
                            className="px-2 py-0.5 rounded bg-[#1B2433] hover:bg-[#212C3E] border border-[#2D3B50] text-cyan-200 text-[11px] font-semibold cursor-pointer"
                          >
                            Fokusér Kort
                          </button>
                          <button
                            type="button"
                            onClick={() => onLog24hDustDepositionDangerManual(rec)}
                            className="px-2 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-bold cursor-pointer"
                          >
                            + Algedonisk Log
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-slate-300 flex items-center justify-between">
                  <span>
                    Højeste 24t støv-deponering er aktuelt{' '}
                    <strong className="text-emerald-300">
                      {peak24hDustUgM2.toFixed(1)} µg/m²
                    </strong>{' '}
                    ved {allReceptors24hDustSorted[0]?.receptorCode} (
                    {allReceptors24hDustSorted[0]?.receptorName}).
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeDustDepositionDangerThresholdUgM2(
                        Math.max(20, Math.floor(peak24hDustUgM2 * 0.85))
                      )
                    }
                    className="px-2 py-0.5 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#2D3B50] text-amber-200 text-[11px] font-semibold cursor-pointer"
                  >
                    Simulér Fare-Grænse Overskridelse Nu
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
