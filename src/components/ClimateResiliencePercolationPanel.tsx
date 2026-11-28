import React, { useMemo } from 'react';
import {
  AlertTriangle,
  Box,
  CloudRain,
  Droplets,
  Layers,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Waves,
} from 'lucide-react';
import { HourlyWeatherPoint } from '../types/dispersion';
import {
  CLIMATE_HORIZON_PRESETS,
  ClimateResilienceConfig,
  computeClimateResiliencePercolation,
  DEFAULT_CLIMATE_RESILIENCE_CONFIG,
} from '../utils/climateResiliencePercolation';

export interface ClimateResiliencePercolationPanelProps {
  config: ClimateResilienceConfig;
  onChangeConfig: (next: ClimateResilienceConfig) => void;
  currentWeather: HourlyWeatherPoint;
  precipitationOverrideMm: number | null;
  activeSourceCount: number;
  unsecuredDemolishedCount: number;
  isUnderground3DActive: boolean;
  onVisualizeIn3DUnderground: () => void;
  onFocusBlok12In3D: () => void;
  onSwitchTo2DPercolation?: () => void;
}

export const ClimateResiliencePercolationPanel: React.FC<ClimateResiliencePercolationPanelProps> = ({
  config,
  onChangeConfig,
  currentWeather,
  precipitationOverrideMm,
  activeSourceCount,
  unsecuredDemolishedCount,
  isUnderground3DActive,
  onVisualizeIn3DUnderground,
  onFocusBlok12In3D,
  onSwitchTo2DPercolation,
}) => {
  const basePrecipMm =
    precipitationOverrideMm !== null ? precipitationOverrideMm : currentWeather.precipitation;

  const result = useMemo(
    () =>
      computeClimateResiliencePercolation(
        basePrecipMm,
        currentWeather.soilMoisture0To7cm,
        currentWeather.hadRecentFreezeThaw,
        activeSourceCount,
        unsecuredDemolishedCount,
        config
      ),
    [
      basePrecipMm,
      currentWeather.soilMoisture0To7cm,
      currentWeather.hadRecentFreezeThaw,
      activeSourceCount,
      unsecuredDemolishedCount,
      config,
    ]
  );

  const handleSelectHorizon = (presetId: (typeof CLIMATE_HORIZON_PRESETS)[number]['id']) => {
    const preset = CLIMATE_HORIZON_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    onChangeConfig({
      ...config,
      enabled: presetId !== 'baseline_2026',
      horizonId: preset.id,
      horizonLabel: preset.fullLabel,
      precipitationIncreasePct: preset.precipitationIncreasePct,
      cloudburstSurgeMmH: preset.cloudburstSurgeMmH,
      groundwaterTableRiseM: preset.groundwaterTableRiseM,
      soilSaturationBoost: preset.soilSaturationBoost,
      freezeThawMacroporeAmplificationPct: preset.freezeThawMacroporeAmplificationPct,
    });
  };

  const updateField = <K extends keyof ClimateResilienceConfig>(
    key: K,
    val: ClimateResilienceConfig[K]
  ) => {
    onChangeConfig({
      ...config,
      enabled: true,
      horizonId: 'custom',
      horizonLabel: 'Brugerdefineret Klimascenarie',
      [key]: val,
    });
  };

  const statusTone =
    result.resilienceStatus === 'GRÆNSEBRUD'
      ? 'text-rose-300 border-rose-500/60 bg-rose-950/50'
      : result.resilienceStatus === 'KRITISK'
      ? 'text-amber-300 border-amber-500/60 bg-amber-950/40'
      : result.resilienceStatus === 'PRESSET'
      ? 'text-cyan-200 border-cyan-500/50 bg-cyan-950/40'
      : 'text-emerald-300 border-emerald-500/50 bg-emerald-950/40';

  const maxDepthScaleM = 25;
  const baselineGwTopPct = Math.min(96, (result.baseline.secondaryWaterTableDepthM / maxDepthScaleM) * 100);
  const projectedGwTopPct = Math.min(96, (result.projected.secondaryWaterTableDepthM / maxDepthScaleM) * 100);
  const baselinePlumeBottomPct = Math.min(98, (result.baseline.plumeMaxDepthMeters / maxDepthScaleM) * 100);
  const projectedPlumeBottomPct = Math.min(98, (result.projected.plumeMaxDepthMeters / maxDepthScaleM) * 100);

  return (
    <div
      data-testid="climate-resilience-panel"
      className="space-y-3 text-xs font-sans tabular-nums text-slate-100"
    >
      {/* Header & Activation Controls */}
      <div className="p-3 rounded-md bg-[#1B2433] border border-[#2D3B50] space-y-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Waves className="w-4 h-4 text-cyan-400 shrink-0" />
              <h3 className="text-sm font-bold text-white">
                Klimaresiliens &amp; Underjordisk Perkolation (3D)
              </h3>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
              Simulér fremtidige klimaforandringer (øget nedbør, skybrud og højere grundvandsspejl) og visualisér effekten direkte på perkolation og udvaskning under Blok 1–2 i 3D-scenen.
            </p>
          </div>

          <div className={`px-2 py-1 rounded border text-[11px] font-mono font-bold whitespace-nowrap shrink-0 ${statusTone}`}>
            {result.resilienceStatus} · {result.resilienceScore0To100}/100
          </div>
        </div>

        {/* Toggle 3D Projection Active + Primary CTA to open 3D Underground Percolation */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#2D3B50]">
          <label className="flex items-center gap-2 text-xs text-slate-100 cursor-pointer font-medium">
            <input
              type="checkbox"
              data-testid="climate-resilience-enable-checkbox"
              checked={config.enabled}
              onChange={(e) => onChangeConfig({ ...config, enabled: e.target.checked })}
              className="accent-cyan-400 w-3.5 h-3.5"
            />
            <span>Aktivér klimafremskrivning i 3D-scenen</span>
          </label>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              data-testid="climate-visualize-3d-btn"
              onClick={() => {
                if (!config.enabled) {
                  onChangeConfig({ ...config, enabled: true });
                }
                onVisualizeIn3DUnderground();
              }}
              className={`px-3 py-1.5 rounded text-xs font-bold inline-flex items-center gap-1.5 border cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                isUnderground3DActive
                  ? 'bg-cyan-400 text-slate-950 border-cyan-200'
                  : 'bg-[#0284C7] hover:bg-[#0369A1] text-white border-cyan-400/60'
              }`}
            >
              <Box className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isUnderground3DActive
                  ? '3D Underjordisk Perkolation Aktiv'
                  : 'Visualisér i 3D Underjordisk Scene'}
              </span>
            </button>

            <button
              type="button"
              onClick={onFocusBlok12In3D}
              className="px-2.5 py-1.5 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#36465E] text-cyan-200 text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
              title="Fokusér 3D-kamera direkte på Blok 1 & 2 perkolationsveje"
            >
              Fokus Blok 1–2
            </button>

            {onSwitchTo2DPercolation && (
              <button
                type="button"
                onClick={onSwitchTo2DPercolation}
                className="px-2 py-1.5 rounded bg-[#151C28] hover:bg-[#212C3E] border border-[#36465E] text-slate-300 text-[11px] font-medium cursor-pointer whitespace-nowrap shrink-0"
              >
                2D Snit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Climate Horizon Presets */}
      <div className="p-3 rounded-md bg-[#1B2433] border border-[#2D3B50] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
            1. Klimascenarie (DMI Klimaatlas · Slagelse)
          </span>
          <button
            type="button"
            onClick={() => onChangeConfig(DEFAULT_CLIMATE_RESILIENCE_CONFIG)}
            className="text-[11px] font-mono text-slate-400 hover:text-white inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Nulstil</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {CLIMATE_HORIZON_PRESETS.map((preset) => {
            const active =
              config.horizonId === preset.id &&
              (preset.id === 'baseline_2026' ? !config.enabled : config.enabled);
            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`climate-horizon-${preset.id}`}
                onClick={() => handleSelectHorizon(preset.id)}
                className={`p-2 rounded border text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-cyan-500/20 border-cyan-400 text-white'
                    : 'bg-[#151C28] border-[#2D3B50] text-slate-300 hover:bg-[#212C3E]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-xs">{preset.shortLabel}</span>
                  <span className="text-[10px] font-mono text-cyan-300">{preset.sspTag}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  +{preset.cloudburstSurgeMmH} mm/t skybrud · +{preset.groundwaterTableRiseM.toFixed(2)} m GV
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Climate Parameter Sliders */}
      <div className="p-3 rounded-md bg-[#1B2433] border border-[#2D3B50] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span>2. Justér Klimaparametre (Live 3D-Effekt)</span>
          </span>
          <span className="text-[11px] font-mono text-cyan-300">
            Effektiv regn: {result.effectiveClimatePrecipMmH.toFixed(1)} mm/t
          </span>
        </div>

        {/* Slider 1: Precipitation Intensity Increase (%) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-200 flex items-center gap-1.5">
              <CloudRain className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Øget Nedbørsmængde (Intensitet)</span>
            </span>
            <span className="font-bold text-cyan-300">+{config.precipitationIncreasePct}%</span>
          </div>
          <input
            type="range"
            data-testid="climate-precip-pct-slider"
            min={0}
            max={100}
            step={2}
            value={config.precipitationIncreasePct}
            onChange={(e) => updateField('precipitationIncreasePct', Number(e.target.value))}
            aria-label="Øget nedbørsmængde i procent"
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded"
          />
        </div>

        {/* Slider 2: Cloudburst Surge Intensity (mm/h) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-200 flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>Ekstrem Skybrudsspids (Klimatillæg)</span>
            </span>
            <span className="font-bold text-sky-300">+{config.cloudburstSurgeMmH.toFixed(1)} mm/t</span>
          </div>
          <input
            type="range"
            data-testid="climate-cloudburst-slider"
            min={0}
            max={35}
            step={0.5}
            value={config.cloudburstSurgeMmH}
            onChange={(e) => updateField('cloudburstSurgeMmH', Number(e.target.value))}
            aria-label="Ekstrem skybrudsspids i mm pr time"
            className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded"
          />
        </div>

        {/* Slider 3: Groundwater Table Rise (m) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-200 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Grundvandsspejl-Stigning (Vinter/Havspejl)</span>
            </span>
            <span className="font-bold text-amber-300">+{config.groundwaterTableRiseM.toFixed(2)} m</span>
          </div>
          <input
            type="range"
            data-testid="climate-gw-rise-slider"
            min={0}
            max={1.2}
            step={0.05}
            value={config.groundwaterTableRiseM}
            onChange={(e) => updateField('groundwaterTableRiseM', Number(e.target.value))}
            aria-label="Grundvandsspejl stigning i meter"
            className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded"
          />
        </div>

        {/* Slider 4: Freeze-Thaw Macropore Fracturing (%) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-200 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Moræneler Makropore-Opsprækning</span>
            </span>
            <span className="font-bold text-rose-300">+{config.freezeThawMacroporeAmplificationPct}%</span>
          </div>
          <input
            type="range"
            data-testid="climate-macropore-slider"
            min={0}
            max={50}
            step={2}
            value={config.freezeThawMacroporeAmplificationPct}
            onChange={(e) =>
              updateField('freezeThawMacroporeAmplificationPct', Number(e.target.value))
            }
            aria-label="Moræneler makropore opsprækning i procent"
            className="w-full accent-rose-400 cursor-pointer h-1.5 bg-slate-800 rounded"
          />
        </div>

        {/* Adaptation Measure Toggle */}
        <label className="flex items-start gap-2 pt-2 border-t border-[#2D3B50] cursor-pointer">
          <input
            type="checkbox"
            data-testid="climate-lar-adaptation-checkbox"
            checked={config.larRetentionActive}
            onChange={(e) =>
              onChangeConfig({
                ...config,
                enabled: true,
                larRetentionActive: e.target.checked,
              })
            }
            className="accent-emerald-400 mt-0.5 w-3.5 h-3.5 shrink-0"
          />
          <div className="space-y-0.5">
            <div className="font-semibold text-emerald-300 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Klimatilpasning: LAR-Faskiner &amp; Krybekælder-Membran (Blok 1–2)</span>
            </div>
            <div className="text-[11px] text-slate-400 leading-snug">
              Reducerer effektiv nedbørsinfiltration med 45% og sænker bly/PAH-udvaskningen i 3D-modellen.
            </div>
          </div>
        </label>
      </div>

      {/* Comparative Baseline vs Future Hydrogeological Impact Grid */}
      <div className="p-3 rounded-md bg-[#1B2433] border border-[#2D3B50] space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            3. Hydrologisk Effekt: Baseline vs. Klimaprojektion
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            DN200 Stress: {result.dn200SubsurfaceStressFactor.toFixed(2)}x
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
          <div className="p-2 rounded bg-[#151C28] border border-[#2D3B50]">
            <div className="text-[10px] text-slate-400 uppercase">Perkolationshastighed</div>
            <div className="text-sm font-bold text-cyan-300 mt-0.5">
              {result.projected.macroporeVelocityMetersPerDay.toFixed(1)} m/døgn
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Baseline: {result.baseline.macroporeVelocityMetersPerDay.toFixed(1)} m/døgn (
              {result.percolationVelocityDeltaPct >= 0 ? '+' : ''}
              {result.percolationVelocityDeltaPct}%)
            </div>
          </div>

          <div className="p-2 rounded bg-[#151C28] border border-[#2D3B50]">
            <div className="text-[10px] text-slate-400 uppercase">Sekundært Grundvand</div>
            <div className="text-sm font-bold text-amber-300 mt-0.5">
              -{result.projected.secondaryWaterTableDepthM.toFixed(1)} m
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Baseline: -{result.baseline.secondaryWaterTableDepthM.toFixed(1)} m (↑{' '}
              {result.waterTableRiseTotalM.toFixed(2)} m)
            </div>
          </div>

          <div className="p-2 rounded bg-[#151C28] border border-[#2D3B50]">
            <div className="text-[10px] text-slate-400 uppercase">Umættet Jordbuffer</div>
            <div
              className={`text-sm font-bold mt-0.5 ${
                result.unsaturatedBufferProjectedM < 3.5 ? 'text-rose-300' : 'text-emerald-300'
              }`}
            >
              {result.unsaturatedBufferProjectedM.toFixed(2)} m
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Under Blok 1–2 (-1,8 m) · Var {result.unsaturatedBufferBaselineM.toFixed(2)} m
            </div>
          </div>

          <div className="p-2 rounded bg-[#151C28] border border-[#2D3B50]">
            <div className="text-[10px] text-slate-400 uppercase">Bly (Pb) i Grundvand</div>
            <div
              className={`text-sm font-bold mt-0.5 ${
                result.projected.leadConcentrationSecondaryUgL >= 1.0
                  ? 'text-rose-300'
                  : 'text-emerald-300'
              }`}
            >
              {result.projected.leadConcentrationSecondaryUgL.toFixed(2)} µg/L
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              GV 1,0 µg/L · Gennembrud {result.projected.breakthroughHoursSecondary.toFixed(1)}t
            </div>
          </div>
        </div>

        {/* Depth Profile Comparison Visual (0m to -25m) */}
        <div className="p-2 rounded bg-[#111722] border border-[#253245] space-y-1.5 font-mono text-[10px]">
          <div className="flex items-center justify-between text-slate-300">
            <span>Dybdeprofil (0 m → -25 m OSD): Fane &amp; Grundvandsspejl</span>
            <span className="text-cyan-300">
              Max fane: -{result.projected.plumeMaxDepthMeters.toFixed(1)} m
            </span>
          </div>
          <div className="relative h-20 rounded bg-[#0B1019] border border-[#243043] overflow-hidden">
            {/* Baseline Plume Penetration */}
            <div
              className="absolute left-3 w-1/3 top-0 bg-slate-500/25 border-b border-slate-400 transition-all"
              style={{ height: `${baselinePlumeBottomPct}%` }}
            >
              <span className="px-1 text-[9px] text-slate-300">
                2026: -{result.baseline.plumeMaxDepthMeters.toFixed(1)}m
              </span>
            </div>

            {/* Projected Climate Plume Penetration */}
            <div
              className="absolute right-3 w-1/3 top-0 bg-amber-500/30 border-b-2 border-amber-400 transition-all"
              style={{ height: `${projectedPlumeBottomPct}%` }}
            >
              <span className="px-1 text-[9px] text-amber-200 font-bold">
                Klima: -{result.projected.plumeMaxDepthMeters.toFixed(1)}m
              </span>
            </div>

            {/* Baseline Water Table Line */}
            <div
              className="absolute left-0 right-0 border-t border-dashed border-slate-400/70"
              style={{ top: `${baselineGwTopPct}%` }}
            />

            {/* Projected Raised Water Table Line */}
            <div
              className="absolute left-0 right-0 border-t-2 border-cyan-400 transition-all"
              style={{ top: `${projectedGwTopPct}%` }}
            >
              <span className="px-1.5 bg-[#0B1019]/90 text-cyan-300 font-semibold">
                ▼ Nyt Grundvandsspejl (-{result.projected.secondaryWaterTableDepthM.toFixed(1)}m)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
