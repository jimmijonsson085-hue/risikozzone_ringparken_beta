import React, { useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Calendar,
  Check,
  ChevronDown,
  CloudRain,
  Compass,
  Download,
  Flame,
  Gauge,
  Layers,
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

export interface WeatherTelemetryRibbonBarProps {
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
  onToggleDispersionForecast?: () => void;
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
}

export const WeatherTelemetryRibbonBar: React.FC<WeatherTelemetryRibbonBarProps> = ({
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
  onToggleDispersionForecast,
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
}) => {
  const [isModulesPopoverOpen, setIsModulesPopoverOpen] = useState(false);
  const [showVerticalPlume3DProfile, setShowVerticalPlume3DProfile] = useState(false);
  const [is24hWindDrawerOpen, setIs24hWindDrawerOpen] = useState(false);
  const [is24hDustDangerDrawerOpen, setIs24hDustDangerDrawerOpen] = useState(false);

  const activeRibbonModuleCount = [
    showRibbonWindRose,
    showRibbon7DayWindRose,
    showRibbonProactiveAgent,
    showRibbonStochasticBias,
    showRibbonPredVsActual,
    showRibbonDispersionForecast,
    showRibbon30DayHeatmap,
    showRibbonDepositionProfile,
    showRibbonMedicalExpert,
    showRibbonExpertChat,
  ].filter(Boolean).length;

  return (
    <div
      role={isHighRiskWind ? 'alert' : undefined}
      aria-live={isHighRiskWind ? 'polite' : undefined}
      className={`border-b px-4 py-1.5 flex flex-col gap-2 text-[11px] font-mono tabular-nums shrink-0 transition-colors ${
        isHighRiskWind
          ? 'bg-[var(--surface-panel)] border-[var(--border-subtle)] border-l-4 border-l-rose-500'
          : 'bg-[var(--surface-panel)] border-[var(--border-subtle)]'
      }`}
    >
      {/* CALM SINGLE-ROW TELEMETRY STRIP */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-3">
          {/* Wind Speed Telemetry (P1 animate-pulse strictly when > 10 m/s) */}
          <div
            className={`flex items-center gap-1.5 rounded px-2 py-0.5 border ${
              isHighRiskWind
                ? 'bg-rose-600 text-white border-rose-300 animate-pulse'
                : 'bg-[#1B2433] border-[#2D3B50] text-slate-200'
            }`}
            title={
              isHighRiskWind
                ? `KRITISK VINDHASTIGHED (${currentWeather.windSpeed10m} m/s > 10 m/s): Højrisiko-spredningsforhold`
                : `Vindhastighed ${currentWeather.windSpeed10m} m/s (højrisiko-grænse: > 10 m/s)`
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
            <span className="font-bold text-white">{currentWeather.windSpeed10m} m/s</span>
            <span className={isHighRiskWind ? 'text-amber-100' : 'text-slate-400'}>
              (Stød: {currentWeather.windGusts10m} m/s)
            </span>
            {isHighRiskWind && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-[#0F141D] text-rose-200 border border-rose-400/70 text-[11px] font-bold uppercase whitespace-nowrap">
                HØJRISIKO (&gt; 10 m/s)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-slate-300">
            <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-slate-400">Retning:</span>
            <span className="font-semibold text-slate-100">
              {currentWeather.windDirection10m}° ({degreesToCompass(currentWeather.windDirection10m)})
            </span>
            <span className="text-cyan-300">
              → Fane {plumeDirectionDeg}° ({degreesToCompass(plumeDirectionDeg)})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-slate-300">
              <Thermometer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-slate-400">Temp:</span>
              <span className="font-semibold text-slate-100">{currentWeather.temperature2m} °C</span>
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

          <div className="hidden 2xl:flex items-center gap-1 text-slate-300">
            <Sun className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="text-slate-400">Sol:</span>
            <span className="font-semibold text-slate-100">{currentWeather.directRadiation} W/m²</span>
          </div>

          <div className="hidden xl:flex items-center gap-1 text-slate-300">
            <CloudRain className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-slate-400">Fugt/Nedbør:</span>
            <span className="font-semibold text-slate-100">
              {currentWeather.relativeHumidity2m}% · {currentWeather.precipitation} mm/t
            </span>
          </div>

          <div className="hidden xl:flex items-center gap-1 text-slate-300">
            <Gauge className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-slate-400">PG:</span>
            <span className="font-semibold text-emerald-300">Klasse {currentWeather.pasquillClass}</span>
          </div>

          {/* Acoustic Refraction Toggle */}
          <button
            type="button"
            onClick={onToggleRibbonAcousticRefraction}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors flex items-center gap-1.5 border cursor-pointer ${
              showRibbonAcousticRefraction
                ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                : isNoiseAmplificationRisk
                ? 'bg-rose-950/60 text-amber-200 border-rose-500/60 hover:bg-rose-950/80'
                : isModerateDownwardBending
                ? 'bg-[#1B2433] text-cyan-200 border-[#2D3B50] hover:bg-[#212C3E]'
                : 'bg-[#1B2433] text-slate-300 border-[#2D3B50] hover:bg-[#212C3E]'
            }`}
            title={`ISO 9613-2 / Nord2000 lydbølgebøjning: Medvind +${downwindWindRefractionDb.toFixed(1)} dB (∂u/∂z = +${windGradientDuDz} s⁻¹), termisk ${thermalSpec.thermalRefractionDb >= 0 ? '+' : ''}${thermalSpec.thermalRefractionDb.toFixed(1)} dB (${thermalSpec.regimeLabel}). Netto: ${maxDownwindRefractionDb >= 0 ? '+' : ''}${maxDownwindRefractionDb.toFixed(1)} dB.`}
          >
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
            <span>Lydbølge-Refraktion:</span>
            <span className="font-bold">
              {maxDownwindRefractionDb >= 0 ? '+' : ''}
              {maxDownwindRefractionDb.toFixed(1)} dB
            </span>
          </button>

          {/* Thermal Stack Buoyancy Toggle */}
          <button
            type="button"
            onClick={onToggleRibbonStackEffect}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors flex items-center gap-1.5 border cursor-pointer ${
              showRibbonStackEffect
                ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                : 'bg-[#1B2433] text-slate-300 border-[#2D3B50] hover:bg-[#212C3E]'
            }`}
            title={`Skorstenseffekt (ΔP_s = +${indoorClimateTelemetry.deltaPsSpanPa.toFixed(1)} Pa · z_NPL = ${indoorClimateTelemetry.zNplEffectiveMeters.toFixed(1)} m · Q_op = ${indoorClimateTelemetry.shaftAndCrackInflowQopM3PerH.toFixed(1)} m³/h)`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Skorstenseffekt: +{indoorClimateTelemetry.deltaPsSpanPa.toFixed(1)} Pa</span>
          </button>
        </div>

        {/* RIGHT CLUSTER: Vejrmoduler Popover, 24t Vind & 3D Fane Toggle, JSON Export & S_max */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Vejrmoduler & Prognoser Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsModulesPopoverOpen((v) => !v)}
              className={`px-2.5 py-1 rounded border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                isModulesPopoverOpen || activeRibbonModuleCount > 1
                  ? 'bg-[#212C3E] border-cyan-400/60 text-cyan-200'
                  : 'bg-[#1B2433] hover:bg-[#212C3E] border-[#2D3B50] text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Vejrmoduler &amp; Prognoser ({activeRibbonModuleCount})</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {isModulesPopoverOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-[420px] max-w-[92vw] rounded-lg bg-[#212C3E] border border-[#36465E] shadow-2xl p-3 space-y-2.5 z-50 text-[11px]">
                <div className="font-bold uppercase text-slate-300 border-b border-[#36465E] pb-1.5">
                  Spredningsprognose (3 visninger)
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {(
                    [
                      { id: 'next_day_00_00_59', label: 'Døgnet efter fra klokken 00.00.00 - 00.59.59' },
                      { id: 'five_day_forecast', label: 'Fem døgns prognose' },
                      { id: 'weather_broadcast_segment', label: 'Som indlæg i en Vejrudsigt' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        onSelectDispersionForecastOption(opt.id);
                        setIsModulesPopoverOpen(false);
                      }}
                      className={`px-2.5 py-1.5 rounded text-left border flex items-center gap-2 cursor-pointer ${
                        showRibbonDispersionForecast && dispersionForecastMode === opt.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                          : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#1B2433]'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>

                <div className="font-bold uppercase text-slate-300 border-b border-[#36465E] pb-1.5 pt-1">
                  Meteorologiske &amp; Kliniske Analyse-Vinduer
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { active: showRibbonWindRose, toggle: onToggleRibbonWindRose, label: '24t Vind-Rose', icon: Navigation },
                    { active: showRibbon7DayWindRose, toggle: onToggleRibbon7DayWindRose, label: '7-Dages Vind-Rose', icon: Compass },
                    { active: showRibbonProactiveAgent, toggle: onToggleRibbonProactiveAgent, label: 'Proaktiv AI-Agent', icon: Sparkles },
                    { active: showRibbonStochasticBias, toggle: onToggleRibbonStochasticBias, label: 'Stokastisk Vind-Bias', icon: Scale },
                    { active: showRibbonPredVsActual, toggle: onToggleRibbonPredVsActual, label: 'Prædiktion vs. +7d', icon: Calendar },
                    { active: showRibbon30DayHeatmap, toggle: onToggleRibbon30DayHeatmap, label: '30-Dages Heatmap', icon: Flame },
                    { active: showRibbonDepositionProfile, toggle: onToggleRibbonDepositionProfile, label: 'Støv-Deponering (µg/m²)', icon: Layers },
                    { active: showRibbonMedicalExpert, toggle: onToggleRibbonMedicalExpert, label: 'Lægefaglig AI Ekspert', icon: Stethoscope },
                    { active: showRibbonExpertChat, toggle: onToggleRibbonExpertChat, label: '5 AI Eksperter (Chat)', icon: Bot },
                  ].map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.label}
                        type="button"
                        onClick={m.toggle}
                        className={`px-2 py-1.5 rounded text-left border flex items-center gap-1.5 cursor-pointer ${
                          m.active
                            ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                            : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#1B2433]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (onToggleDispersionForecast) {
                onToggleDispersionForecast();
              } else {
                onSelectDispersionForecastOption(dispersionForecastMode);
              }
            }}
            className={`px-2.5 py-1 rounded border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              showRibbonDispersionForecast
                ? 'bg-cyan-400 text-slate-950 border-cyan-200 font-bold'
                : 'bg-[#1B2433] hover:bg-[#212C3E] border-[#2D3B50] text-slate-200'
            }`}
            title="Åbn/skjul Spredningsprognose (Fem døgns prognose · Døgnet efter 00:00–00:59 · Vejrudsigt)"
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Spredningsprognose</span>
          </button>

          <button
            type="button"
            data-testid="toggle-3d-vertical-plume-profile-btn"
            onClick={() => setShowVerticalPlume3DProfile((v) => !v)}
            className={`px-2.5 py-1 rounded border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              showVerticalPlume3DProfile
                ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                : 'bg-[#1B2433] hover:bg-[#212C3E] border-[#2D3B50] text-slate-200'
            }`}
            title="Åbn/skjul 3D Vertikal Fane-Profil (Pasquill σ_z & Etage-eksponering)"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>3D Vertikal Fane-Profil</span>
          </button>

          <button
            type="button"
            onClick={() => setIs24hWindDrawerOpen((v) => !v)}
            className={`px-2 py-1 rounded border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
              is24hWindDrawerOpen
                ? 'bg-cyan-400 text-slate-950 border-cyan-200 font-bold'
                : 'bg-[#1B2433] hover:bg-[#212C3E] border-[#2D3B50] text-slate-200'
            }`}
            title="Vis/skjul 24t Vind-Animation"
          >
            <Wind className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>24t Vind</span>
          </button>

          <button
            type="button"
            onClick={() => setIs24hDustDangerDrawerOpen((v) => !v)}
            className={`px-2 py-1 rounded border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
              is24hDustDangerDrawerOpen
                ? 'bg-amber-400 text-slate-950 border-amber-200 font-bold'
                : receptorsExceeding24hDustDanger.length > 0
                ? 'bg-rose-950/60 border-amber-400/70 text-amber-200 hover:bg-rose-950/80'
                : 'bg-[#1B2433] hover:bg-[#212C3E] border-[#2D3B50] text-slate-300'
            }`}
            title="Vis/skjul 24-timers kumulativ støv-deponerings fare-alarm (µg/m²)"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              24t Støv-Deponering
              {receptorsExceeding24hDustDanger.length > 0
                ? ` (${receptorsExceeding24hDustDanger.length})`
                : ''}
            </span>
          </button>

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
              Proaktivt tiltag: Aktivér vandkanoner ved {top3MostAffectedReceptors[0]?.dominantSourceName.split(':')[0]} · Indstil uafskærmet nedbrydning
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
                        Kritisk stof: {topSub.name.split(' ')[0]} ({topSub.concentration} {topSub.unit})
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={recExp.sumQuotient >= 1.0 ? 'text-sm font-bold text-rose-300' : 'text-sm font-bold text-amber-300'}>
                      S = {recExp.sumQuotient.toFixed(2)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* COLLAPSIBLE ON-DEMAND 24H WIND, 3D VERTICAL PLUME & 24H CUMULATIVE DUST DEPOSITION DRAWER */}
      {(showVerticalPlume3DProfile || is24hWindDrawerOpen || is24hDustDangerDrawerOpen) && (
        <div className="space-y-2 pt-1.5 border-t border-[#253042] lg:max-h-[38dvh] lg:overflow-y-auto">
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

          {/* 24-HOUR CUMULATIVE DUST-DEPOSITION DANGER THRESHOLD (ON-DEMAND) */}
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
                    receptorsExceeding24hDustDanger.length > 0 ? 'text-amber-400' : 'text-emerald-400'
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
                  onChange={(e) => onChangeDustDepositionDangerThresholdUgM2(Number(e.target.value))}
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
                    (rec.totalDepositedHeavyMetalsAndPcbUgM2 - dustDepositionDangerThresholdUgM2).toFixed(1)
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
                          {rec.address} · Spids kl. {rec.peakHourLabel} (S={rec.peakSumQuotient.toFixed(2)})
                        </div>
                        <div className="text-[11px] text-amber-300 font-semibold">
                          24t Deponering: {rec.totalDepositedHeavyMetalsAndPcbUgM2.toFixed(1)} µg/m² (+{excessUg} µg/m²)
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSelectReceptorAndHour(rec.receptorId, rec.peakHourIndex)}
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
                    {allReceptors24hDustSorted[0]?.totalDepositedHeavyMetalsAndPcbUgM2.toFixed(1) ?? 0} µg/m²
                  </strong>{' '}
                  ved {allReceptors24hDustSorted[0]?.receptorCode} ({allReceptors24hDustSorted[0]?.receptorName}).
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChangeDustDepositionDangerThresholdUgM2(
                      Math.max(
                        20,
                        Math.floor(
                          (allReceptors24hDustSorted[0]?.totalDepositedHeavyMetalsAndPcbUgM2 ?? 100) * 0.85
                        )
                      )
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
