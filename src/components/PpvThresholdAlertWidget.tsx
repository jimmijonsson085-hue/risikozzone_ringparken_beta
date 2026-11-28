/**
 * @file src/components/PpvThresholdAlertWidget.tsx
 * @description Real-time 'PPV Threshold Alert' widget der beregner strukturel
 * skadesrisiko ud fra afstand til aktive nedrivningskilder og jordvibrationsdæmpning
 * (Bornitz) samt udløser en tydelig visuel advarsel når 25 mm/s (DIN 4150-3) nærmer sig.
 */

import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Crosshair,
  Gauge,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  ReceptorZone,
} from '../types/dispersion';
import {
  DIN_4150_3_PPV_LIMIT_MM_S,
  PPV_APPROACHING_THRESHOLD_MM_S,
  PpvAlertLevel,
  SOIL_VIBRATION_PROFILES,
  SoilVibrationProfileKey,
  evaluatePpvThresholdAlert,
} from '../utils/ppvThresholdAlertEngine';

export interface PpvThresholdAlertWidgetProps {
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  currentWeather: HourlyWeatherPoint;
  precipitationOverrideMm?: number | null;
  manualMachineNoiseOutputDb?: number;
  isManualMachineNoiseOverrideActive?: boolean;
  hasSteelRoadPlates?: boolean;
  waterMainPipePpvMmPerSec?: number;
  onSelectReceptor?: (receptorId: string) => void;
  onSelectSource?: (sourceId: string) => void;
}

function alertColorClasses(level: PpvAlertLevel): {
  text: string;
  border: string;
  surface: string;
  labelDa: string;
} {
  switch (level) {
    case 'EXCEEDED':
      return {
        text: 'text-rose-300',
        border: 'border-rose-500/70',
        surface: 'bg-rose-950/50',
        labelDa: 'OVERSKREDET (>= 25 mm/s)',
      };
    case 'APPROACHING':
      return {
        text: 'text-amber-300',
        border: 'border-amber-500/70',
        surface: 'bg-amber-950/45',
        labelDa: 'NÆRMER SIG 25 mm/s',
      };
    case 'ELEVATED':
      return {
        text: 'text-sky-300',
        border: 'border-sky-500/50',
        surface: 'bg-sky-950/35',
        labelDa: 'FORHØJET',
      };
    default:
      return {
        text: 'text-emerald-300',
        border: 'border-emerald-500/40',
        surface: 'bg-emerald-950/25',
        labelDa: 'NOMINEL',
      };
  }
}

export const PpvThresholdAlertWidget: React.FC<PpvThresholdAlertWidgetProps> = ({
  sources,
  receptors,
  currentWeather,
  precipitationOverrideMm = null,
  manualMachineNoiseOutputDb = 114,
  isManualMachineNoiseOverrideActive = false,
  hasSteelRoadPlates = false,
  waterMainPipePpvMmPerSec,
  onSelectReceptor,
  onSelectSource,
}) => {
  const [soilProfileKey, setSoilProfileKey] =
    useState<SoilVibrationProfileKey>('moraine_clay');
  const [simulatedProximityOverrideM, setSimulatedProximityOverrideM] =
    useState<number | null>(null);

  const evaluation = useMemo(
    () =>
      evaluatePpvThresholdAlert({
        sources,
        receptors,
        currentWeather,
        precipitationOverrideMm,
        manualMachineNoiseOutputDb,
        isManualMachineNoiseOverrideActive,
        soilProfileKey,
        hasSteelRoadPlates,
        simulatedProximityOverrideM,
        waterMainPipePpvMmPerSec,
      }),
    [
      sources,
      receptors,
      currentWeather,
      precipitationOverrideMm,
      manualMachineNoiseOutputDb,
      isManualMachineNoiseOverrideActive,
      soilProfileKey,
      hasSteelRoadPlates,
      simulatedProximityOverrideM,
      waterMainPipePpvMmPerSec,
    ]
  );

  const statusStyle = alertColorClasses(evaluation.alertLevel);

  // SVG Bornitz Attenuation Curve Geometry (2m..65m vs mm/s)
  const svgW = 460;
  const svgH = 148;
  const padL = 36;
  const padR = 14;
  const padT = 14;
  const padB = 24;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;
  const maxDistX = 65;
  const maxPpvY = Math.max(
    32,
    Math.ceil(
      Math.max(
        evaluation.peakPpvMmPerSec,
        ...evaluation.attenuationCurve.map((p) => p.ppvMmPerSec)
      ) / 5
    ) * 5
  );

  const mapX = (d: number) =>
    padL + (Math.min(maxDistX, Math.max(0, d)) / maxDistX) * plotW;
  const mapY = (ppv: number) =>
    padT + plotH - (Math.min(maxPpvY, Math.max(0, ppv)) / maxPpvY) * plotH;

  const curvePath = evaluation.attenuationCurve
    .map(
      (pt, i) =>
        `${i === 0 ? 'M' : 'L'} ${mapX(pt.distanceMeters).toFixed(1)} ${mapY(
          pt.ppvMmPerSec
        ).toFixed(1)}`
    )
    .join(' ');

  const limit25Y = mapY(DIN_4150_3_PPV_LIMIT_MM_S);
  const approaching18Y = mapY(PPV_APPROACHING_THRESHOLD_MM_S);

  return (
    <section
      data-testid="ppv-threshold-alert-widget"
      className={`p-3 rounded-lg bg-[#0F172A] border ${
        evaluation.isLimitExceeded
          ? 'border-rose-500/75'
          : evaluation.isApproachingLimit
          ? 'border-amber-500/70'
          : 'border-slate-700/70'
      } space-y-3 text-slate-100 text-xs tabular-nums`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="space-y-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-white uppercase tracking-wide">
            <Activity
              className={`w-4 h-4 shrink-0 ${
                evaluation.isLimitExceeded
                  ? 'text-rose-400'
                  : evaluation.isApproachingLimit
                  ? 'text-amber-400'
                  : 'text-cyan-400'
              }`}
            />
            <span>PPV Threshold Alert · DIN 4150-3 (25 mm/s Strukturgrænse)</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Realtids Bornitz jordvibrationsdæmpning fra {evaluation.activeSourcesCount} aktive nedrivningskilder (L_WA {evaluation.effectiveMachineLwaDb.toFixed(0)} dB{evaluation.hasSteelRoadPlates ? ' · Stålplader -14%' : ''}).
          </p>
        </div>

        <span
          className={`font-mono text-[11px] font-bold uppercase tracking-wider shrink-0 ${statusStyle.text}`}
        >
          {statusStyle.labelDa}
        </span>
      </div>

      {/* Visuel Advarsel når 25 mm/s nærmer sig (>= 18 mm/s) eller overskrides */}
      {evaluation.isVisualWarningTriggered ? (
        <div
          role="alert"
          data-testid="ppv-threshold-visual-warning"
          className={`p-2.5 rounded border ${statusStyle.border} ${statusStyle.surface} space-y-1.5`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono font-bold text-xs">
              {evaluation.isLimitExceeded ? (
                <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span className={statusStyle.text}>
                {evaluation.isLimitExceeded
                  ? `DIN 4150-3 OVERSKREDET: ${evaluation.peakPpvMmPerSec.toFixed(1)} mm/s (>= 25,0 mm/s)`
                  : `VISUEL ADVARSEL: PPV ${evaluation.peakPpvMmPerSec.toFixed(1)} mm/s (${evaluation.pctOfDin4150Limit}%) nærmer sig 25,0 mm/s`}
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-200">
              {evaluation.worstTargetCode} · {evaluation.nearestDistanceMeters.toFixed(1)} m fra {evaluation.nearestSourceCode}
            </span>
          </div>
          <p className="text-[11px] text-slate-200 leading-relaxed">
            {evaluation.guidanceDa}
          </p>
        </div>
      ) : (
        <div
          data-testid="ppv-threshold-nominal-status"
          className="px-2.5 py-2 rounded border border-emerald-500/35 bg-emerald-950/20 flex flex-wrap items-center justify-between gap-2 text-[11px]"
        >
          <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>
              Ingen akut strukturel skadesrisiko ({evaluation.peakPpvMmPerSec.toFixed(1)} / 25,0 mm/s ved {evaluation.worstTargetCode}).
            </span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">
            Advarsel udløses ved ≥ {PPV_APPROACHING_THRESHOLD_MM_S.toFixed(0)} mm/s (72%)
          </span>
        </div>
      )}

      {/* 4-KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
        <div className="p-2 rounded bg-[#1E293B] border border-slate-700/60">
          <div className="text-[10px] text-slate-400 uppercase">Peak PPV</div>
          <div className={`text-sm font-bold mt-0.5 ${statusStyle.text}`}>
            {evaluation.peakPpvMmPerSec.toFixed(1)} mm/s
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            {evaluation.worstTargetCode} @ {evaluation.nearestDistanceMeters.toFixed(1)} m
          </div>
        </div>

        <div className="p-2 rounded bg-[#1E293B] border border-slate-700/60">
          <div className="text-[10px] text-slate-400 uppercase">DIN 4150-3 (25 mm/s)</div>
          <div className={`text-sm font-bold mt-0.5 ${statusStyle.text}`}>
            {evaluation.pctOfDin4150Limit}%
          </div>
          <div className="text-[10px] text-slate-400">
            Margin: {evaluation.marginTo25MmPerSec >= 0 ? '+' : ''}
            {evaluation.marginTo25MmPerSec.toFixed(1)} mm/s
          </div>
        </div>

        <div className="p-2 rounded bg-[#1E293B] border border-slate-700/60">
          <div className="text-[10px] text-slate-400 uppercase">Jorddæmpning</div>
          <div className="text-sm font-bold text-cyan-300 mt-0.5">
            {evaluation.soilAttenuationPct.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-400">
            α = {evaluation.effectiveAlphaPerM.toFixed(3)} m⁻¹
          </div>
        </div>

        <div className="p-2 rounded bg-[#1E293B] border border-slate-700/60">
          <div className="text-[10px] text-slate-400 uppercase">Min. Sikker Afstand</div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">
            {evaluation.safeSetback25Meters.toFixed(1)} m
          </div>
          <div className="text-[10px] text-slate-400">
            Før &lt; 25,0 mm/s
          </div>
        </div>
      </div>

      {/* Interaktive Kontroller: Jordbundsprofil & Nærhedstest */}
      <div className="p-2.5 rounded bg-[#1E293B]/70 border border-slate-700/60 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <span className="font-mono font-semibold text-slate-400">Jordtype:</span>
            <select
              data-testid="ppv-soil-profile-select"
              value={soilProfileKey}
              onChange={(e) =>
                setSoilProfileKey(e.target.value as SoilVibrationProfileKey)
              }
              className="px-2 py-1 rounded bg-[#0F172A] border border-slate-700 text-slate-100 text-[11px] font-mono focus:outline-none focus:border-cyan-400"
            >
              {Object.values(SOIL_VIBRATION_PROFILES).map((spec) => (
                <option key={spec.key} value={spec.key}>
                  {spec.labelDa}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="ppv-simulate-approach-btn"
              onClick={() => setSimulatedProximityOverrideM(5.5)}
              className="px-2 py-1 rounded bg-amber-600/80 hover:bg-amber-500 border border-amber-400/70 text-white text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="Simulér maskine tæt på nærmeste bygningsfundament (5,5 m) for at teste DIN 4150-3 advarsel"
            >
              <Crosshair className="w-3 h-3 shrink-0" />
              <span>Simulér Nærhed (5,5 m)</span>
            </button>
            {simulatedProximityOverrideM !== null && (
              <button
                type="button"
                data-testid="ppv-reset-proximity-btn"
                onClick={() => setSimulatedProximityOverrideM(null)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-[10px] font-mono flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3 shrink-0" />
                <span>Live GPS Afstand</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
          <div className="flex items-center gap-1.5 text-slate-300 shrink-0">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              Kildeafstand:{' '}
              <strong className="text-white">
                {(simulatedProximityOverrideM ?? evaluation.nearestDistanceMeters).toFixed(1)} m
              </strong>
              {evaluation.isSimulatedProximityActive ? ' (Simuleret)' : ' (Live GPS)'}
            </span>
          </div>
          <input
            type="range"
            min={2}
            max={60}
            step={0.5}
            aria-label="Simuleret kildeafstand i meter"
            data-testid="ppv-proximity-slider"
            value={
              simulatedProximityOverrideM ??
              Math.min(60, Math.max(2, evaluation.nearestDistanceMeters || 18))
            }
            onChange={(e) => setSimulatedProximityOverrideM(Number(e.target.value))}
            className="flex-1 min-w-[140px] accent-amber-400 cursor-pointer"
          />
        </div>
        <p className="text-[10px] text-slate-400">
          {evaluation.soilProfile.descriptionDa}
        </p>
      </div>

      {/* Bornitz Attenuation Curve SVG */}
      <div className="p-2 rounded bg-[#090D16] border border-slate-800 space-y-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-1">
          <span>Bornitz Vibrationsdæmpning v(r) vs. Afstand (2–65 m)</span>
          <span className="text-rose-300">--- DIN 4150-3 (25 mm/s)</span>
        </div>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-36 block"
          role="img"
          aria-label="Bornitz jordvibrationsdæmpningskurve mod DIN 4150-3 25 mm/s grænse"
        >
          {/* Grid lines */}
          {[0, 10, 20, 30].map((val) => {
            if (val > maxPpvY) return null;
            const gy = mapY(val);
            return (
              <g key={`grid-${val}`}>
                <line
                  x1={padL}
                  y1={gy}
                  x2={svgW - padR}
                  y2={gy}
                  stroke="#1E293B"
                  strokeWidth={1}
                />
                <text
                  x={padL - 5}
                  y={gy + 3}
                  textAnchor="end"
                  fill="#64748B"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* 18 mm/s Approaching Warning Line */}
          <line
            x1={padL}
            y1={approaching18Y}
            x2={svgW - padR}
            y2={approaching18Y}
            stroke="#F59E0B"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text
            x={svgW - padR - 2}
            y={approaching18Y - 3}
            textAnchor="end"
            fill="#FBBF24"
            fontSize="8.5"
            fontFamily="monospace"
          >
            18 mm/s Advarsel
          </text>

          {/* 25 mm/s DIN 4150-3 Limit Line */}
          <line
            x1={padL}
            y1={limit25Y}
            x2={svgW - padR}
            y2={limit25Y}
            stroke="#F43F5E"
            strokeWidth={1.3}
            strokeDasharray="5 3"
          />
          <text
            x={svgW - padR - 2}
            y={limit25Y - 3}
            textAnchor="end"
            fill="#FB7185"
            fontSize="8.5"
            fontFamily="monospace"
            fontWeight="bold"
          >
            25 mm/s DIN 4150-3
          </text>

          {/* Attenuation Curve */}
          <path
            d={curvePath}
            fill="none"
            stroke="#38BDF8"
            strokeWidth={2}
          />

          {/* Plotted Receptor / Target Positions */}
          {evaluation.receptorRisks.slice(0, 8).map((r) => {
            const cx = mapX(r.distanceMeters);
            const cy = mapY(r.ppvMmPerSec);
            const dotFill =
              r.alertLevel === 'EXCEEDED'
                ? '#F43F5E'
                : r.alertLevel === 'APPROACHING'
                ? '#F59E0B'
                : r.alertLevel === 'ELEVATED'
                ? '#38BDF8'
                : '#10B981';
            return (
              <g key={`pt-${r.targetId}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={3.5}
                  fill={dotFill}
                  stroke="#0F172A"
                  strokeWidth={1.2}
                />
                {r.targetId === evaluation.worstTargetId && (
                  <text
                    x={Math.min(svgW - padR - 24, cx + 5)}
                    y={Math.max(padT + 9, cy - 4)}
                    fill="#F8FAFC"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {r.targetCode} ({r.ppvMmPerSec.toFixed(1)})
                  </text>
                )}
              </g>
            );
          })}

          {/* X Axis Ticks */}
          {[5, 15, 25, 35, 50, 65].map((d) => (
            <text
              key={`xt-${d}`}
              x={mapX(d)}
              y={svgH - 6}
              textAnchor="middle"
              fill="#64748B"
              fontSize="8.5"
              fontFamily="monospace"
            >
              {d}m
            </text>
          ))}
        </svg>
      </div>

      {/* Receptor & Struktur Risk Table */}
      {evaluation.receptorRisks.length > 0 && (
        <div className="rounded border border-slate-800 overflow-hidden bg-[#090D16]">
          <div className="px-2.5 py-1.5 bg-[#1E293B] border-b border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-300 uppercase">
            <span>Mål / Bygning</span>
            <span>Afstand &amp; Beregnet PPV</span>
          </div>
          <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/80">
            {evaluation.receptorRisks.slice(0, 7).map((item) => {
              const rowCls = alertColorClasses(item.alertLevel);
              return (
                <div
                  key={item.targetId}
                  onClick={() => {
                    if (item.targetKind === 'receptor') {
                      onSelectReceptor?.(item.targetId);
                    }
                    onSelectSource?.(item.nearestSourceId);
                  }}
                  className="px-2.5 py-1.5 flex items-center justify-between gap-2 hover:bg-slate-900/80 cursor-pointer text-[11px] font-mono"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-100 truncate">
                      {item.targetCode} · {item.targetName}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Nærmeste kilde: {item.nearestSourceCode} ({item.distanceMeters.toFixed(1)} m) · Dæmpning {item.soilAttenuationPct.toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-bold ${rowCls.text}`}>
                      {item.ppvMmPerSec.toFixed(1)} mm/s
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {item.pctOf25Limit}% af 25 mm/s
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
