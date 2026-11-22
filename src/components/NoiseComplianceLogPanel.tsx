/**
 * @file src/components/NoiseComplianceLogPanel.tsx
 * @description Realtids støj-overholdelseslog (L_Aeq & L_AFmax > 55 dB(A)) for valgt receptor
 * med direkte CSV-eksport i Slagelse Kommune ESDH-format.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  Volume2,
} from 'lucide-react';
import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LegalViolationEntry,
  ReceptorExposureResult,
  ReceptorZone,
} from '../types/dispersion';
import {
  angularDiffDeg,
  bearingBetweenPointsDeg,
  distanceBetweenPointsMeters,
} from '../services/dispersionEngine';
import { exportSlagelseViolationsEsdhCsv } from '../services/exportHubHelpers';

export interface NoiseComplianceLogEntry {
  id: string;
  loggedAtIso: string;
  dateIso: string;
  hourIndex: number;
  hourLabel: string;
  receptorId: string;
  receptorCode: string;
  receptorName: string;
  receptorAddress: string;
  laeqDb: number;
  impulseAdjustedLaeqDb: number;
  lafmaxDb: number;
  exceedanceDb: number;
  windSpeedMs: number;
  windGustsMs: number;
  windDirectionDeg: number;
  windRefractionDb: number;
  dominantSourceName: string;
  distanceMeters: number;
  sumQuotient: number;
}

export interface NoiseComplianceLogPanelProps {
  dateIso: string;
  currentWeather: HourlyWeatherPoint;
  weatherHours: HourlyWeatherPoint[];
  selectedHourIndex: number;
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  selectedReceptorExposure: ReceptorExposureResult;
  manualMachineNoiseOutputDb: number;
  isManualMachineNoiseOverrideActive: boolean;
  plumeDirectionDeg: number;
  sha256Hash: string;
  onSelectHour?: (hourIndex: number) => void;
}

const NOISE_COMPLIANCE_THRESHOLD_DB = 55.0;

function computeReceptorNoiseSnapshot(params: {
  weather: HourlyWeatherPoint;
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  receptorExposure: ReceptorExposureResult;
  manualMachineNoiseOutputDb: number;
  isManualMachineNoiseOverrideActive: boolean;
}): {
  laeqDb: number;
  impulseAdjustedLaeqDb: number;
  lafmaxDb: number;
  windRefractionDb: number;
  dominantSourceName: string;
  distanceMeters: number;
} {
  const {
    weather,
    sources,
    receptors,
    receptorExposure,
    manualMachineNoiseOutputDb,
    isManualMachineNoiseOverrideActive,
  } = params;

  const activeSources = sources.filter((s) => s.active);
  const recDef = receptors.find((r) => r.id === receptorExposure.receptorId);
  const targetPt = recDef?.center || receptorExposure.position;

  const isDaytimeWorkHours = weather.hourIndex >= 7 && weather.hourIndex < 18;
  const isEveningHours = weather.hourIndex >= 18 && weather.hourIndex < 22;
  const ambientDb = isDaytimeWorkHours ? 47.0 : isEveningHours ? 42.0 : 38.0;
  const effectiveWindSpeed = Math.max(weather.windSpeed10m, weather.windGusts10m * 0.72);
  const windPropagationDeg = (weather.windDirection10m + 180) % 360;
  const inversionBonusDb =
    weather.pasquillClass === 'E' || weather.pasquillClass === 'F'
      ? 2.2
      : weather.pasquillClass === 'A' || weather.pasquillClass === 'B'
      ? -0.8
      : 0.0;

  const demolishedUnsecuredCount = activeSources.filter(
    (s) => s.buildingCategory === 'e_demolished_unsecured' || s.buildingHeight3DMeters === 0
  ).length;
  const lostBarrierShieldingDb = Math.min(7.0, demolishedUnsecuredCount * 3.5);

  const getSourceLwaAndImpulse = (src: DemolitionSourceNode) => {
    if (isManualMachineNoiseOverrideActive) {
      const scaledImpulse = Math.max(
        6.0,
        Math.min(18.0, (manualMachineNoiseOutputDb - 88) * 0.45 + 6.0)
      );
      return {
        lwaDb: manualMachineNoiseOutputDb,
        impulseDb: isDaytimeWorkHours ? scaledImpulse : scaledImpulse * 0.75,
      };
    }
    const defaultDayLwa =
      src.buildingCategory === 'b_vacant'
        ? 68.0
        : src.buildingCategory === 'e_demolished_unsecured'
        ? 98.5
        : src.buildingCategory === 'c_under_renovation'
        ? 108.5
        : src.id === 'src-blok-1'
        ? 118.5
        : src.id === 'src-bygning-2'
        ? 115.0
        : src.id === 'src-bygning-3'
        ? 112.0
        : 114.0;
    const lwaOverrideDelta =
      typeof src.baseSoundPowerLwaDb === 'number'
        ? Number((src.baseSoundPowerLwaDb - defaultDayLwa).toFixed(1))
        : 0;
    const impulseAdj = Math.max(-4, Math.min(4, lwaOverrideDelta * 0.25));
    const applyOverride = (baseLwa: number, baseImp: number) => ({
      lwaDb: Number(Math.max(52, Math.min(138, baseLwa + lwaOverrideDelta)).toFixed(1)),
      impulseDb: Number(Math.max(3, Math.min(20, baseImp + impulseAdj)).toFixed(1)),
    });

    if (src.buildingCategory === 'b_vacant') return applyOverride(68.0, 4.0);
    if (src.buildingCategory === 'e_demolished_unsecured') {
      return applyOverride(isDaytimeWorkHours ? 98.5 : 88.0, 8.5);
    }
    if (src.buildingCategory === 'c_under_renovation') {
      return applyOverride(isDaytimeWorkHours ? 108.5 : 86.0, 12.0);
    }
    if (!isDaytimeWorkHours) {
      const windRattleBoost = Math.min(7.5, Math.max(0, weather.windGusts10m - 6) * 0.65);
      return applyOverride(
        (src.id === 'src-blok-1' ? 96.5 : 93.0) + windRattleBoost,
        src.id === 'src-blok-1' ? 12.5 : 10.5
      );
    }
    if (src.id === 'src-blok-1') return applyOverride(118.5, 15.0);
    if (src.id === 'src-bygning-2') return applyOverride(115.0, 16.0);
    if (src.id === 'src-bygning-3') return applyOverride(112.0, 12.5);
    return applyOverride(114.0, 14.0);
  };

  let sumLinearAcoustic = Math.pow(10, ambientDb / 10);
  let maxLafmaxDb = ambientDb + 5;
  let dominantSourceName = receptorExposure.dominantSourceName;
  let maxSingleSrcLaeq = -Infinity;
  let dominantDistM = receptorExposure.distanceFromNearestSourceMeters;
  let dominantWindRefractionDb = 0;

  for (const src of activeSources) {
    const { lwaDb, impulseDb } = getSourceLwaAndImpulse(src);
    const horizDist = Math.max(8, distanceBetweenPointsMeters(src.position, targetPt));
    const heightDiff = Math.max(1.0, src.releaseHeightMeters) - 1.5;
    const slantDist = Math.sqrt(horizDist * horizDist + heightDiff * heightDiff);

    const bearingDeg = bearingBetweenPointsDeg(src.position, targetPt);
    const angleDiff = angularDiffDeg(bearingDeg, windPropagationDeg);
    const windCos = Math.cos((angleDiff * Math.PI) / 180);

    const aDiv = 20 * Math.log10(slantDist) + 11.0;
    const alphaAtm = weather.relativeHumidity2m < 45 ? 5.2 : 3.8;
    const aAtmGround = Math.max(
      0,
      alphaAtm * (slantDist / 1000) +
        Math.max(
          0,
          1.8 * Math.log10(Math.max(1, slantDist / 16)) -
            (src.releaseHeightMeters >= 10 ? 1.5 : 0.4)
        ) -
        lostBarrierShieldingDb
    );

    const windRefraction =
      windCos >= 0
        ? windCos * Math.min(6.4, 0.55 * effectiveWindSpeed)
        : windCos * Math.min(4.5, 0.35 * effectiveWindSpeed);
    const metCorrectionDb =
      windRefraction + inversionBonusDb + (weather.precipitation > 2.0 ? 0.6 : 0);

    const recLaeq = Math.max(30, lwaDb - aDiv - aAtmGround + metCorrectionDb);
    const gustImpulseBonus =
      windCos > 0.15
        ? Math.min(3.8, 0.28 * Math.max(0, weather.windGusts10m - weather.windSpeed10m))
        : 0;
    const recLafmax = recLaeq + impulseDb + gustImpulseBonus;

    sumLinearAcoustic += Math.pow(10, recLaeq / 10);
    if (recLafmax > maxLafmaxDb) {
      maxLafmaxDb = recLafmax;
    }
    if (recLaeq > maxSingleSrcLaeq) {
      maxSingleSrcLaeq = recLaeq;
      dominantSourceName = src.name;
      dominantDistM = Math.round(horizDist);
      dominantWindRefractionDb = Number(metCorrectionDb.toFixed(1));
    }
  }

  const laeqDb = Number((10 * Math.log10(sumLinearAcoustic)).toFixed(1));
  const impulseAdjustedLaeqDb = Number((laeqDb + 5.0).toFixed(1));
  const lafmaxDb = Number(maxLafmaxDb.toFixed(1));

  return {
    laeqDb,
    impulseAdjustedLaeqDb,
    lafmaxDb,
    windRefractionDb: dominantWindRefractionDb,
    dominantSourceName,
    distanceMeters: dominantDistM,
  };
}

export const NoiseComplianceLogPanel: React.FC<NoiseComplianceLogPanelProps> = ({
  dateIso,
  currentWeather,
  weatherHours,
  selectedHourIndex,
  sources,
  receptors,
  selectedReceptorExposure,
  manualMachineNoiseOutputDb,
  isManualMachineNoiseOverrideActive,
  plumeDirectionDeg,
  sha256Hash,
  onSelectHour,
}) => {
  const [logEntries, setLogEntries] = useState<NoiseComplianceLogEntry[]>([]);
  const [esdhExportedJustNow, setEsdhExportedJustNow] = useState(false);

  const liveReading = useMemo(
    () =>
      computeReceptorNoiseSnapshot({
        weather: currentWeather,
        sources,
        receptors,
        receptorExposure: selectedReceptorExposure,
        manualMachineNoiseOutputDb,
        isManualMachineNoiseOverrideActive,
      }),
    [
      currentWeather,
      sources,
      receptors,
      selectedReceptorExposure,
      manualMachineNoiseOutputDb,
      isManualMachineNoiseOverrideActive,
    ]
  );

  const isCurrentExceeding55 =
    liveReading.laeqDb > NOISE_COMPLIANCE_THRESHOLD_DB ||
    liveReading.lafmaxDb > NOISE_COMPLIANCE_THRESHOLD_DB;

  // Automatically log every real-time L_Aeq or L_AFmax reading above 55 dB(A) for the selected receptor
  useEffect(() => {
    if (!isCurrentExceeding55) return;

    const maxReading = Math.max(liveReading.laeqDb, liveReading.lafmaxDb);
    const exceedanceDb = Number((maxReading - NOISE_COMPLIANCE_THRESHOLD_DB).toFixed(1));
    const entryId = `ncl-${dateIso}-${selectedHourIndex}-${selectedReceptorExposure.receptorId}-${liveReading.laeqDb.toFixed(
      1
    )}-${liveReading.lafmaxDb.toFixed(1)}`;

    setLogEntries((prev) => {
      if (prev.some((item) => item.id === entryId)) {
        return prev;
      }
      const nextItem: NoiseComplianceLogEntry = {
        id: entryId,
        loggedAtIso: new Date().toISOString(),
        dateIso,
        hourIndex: selectedHourIndex,
        hourLabel: currentWeather.hourLabel,
        receptorId: selectedReceptorExposure.receptorId,
        receptorCode: selectedReceptorExposure.receptorCode,
        receptorName: selectedReceptorExposure.receptorName,
        receptorAddress: selectedReceptorExposure.address,
        laeqDb: liveReading.laeqDb,
        impulseAdjustedLaeqDb: liveReading.impulseAdjustedLaeqDb,
        lafmaxDb: liveReading.lafmaxDb,
        exceedanceDb,
        windSpeedMs: currentWeather.windSpeed10m,
        windGustsMs: currentWeather.windGusts10m,
        windDirectionDeg: currentWeather.windDirection10m,
        windRefractionDb: liveReading.windRefractionDb,
        dominantSourceName: liveReading.dominantSourceName,
        distanceMeters: liveReading.distanceMeters,
        sumQuotient: selectedReceptorExposure.sumQuotient,
      };
      return [nextItem, ...prev].slice(0, 72);
    });
  }, [
    isCurrentExceeding55,
    dateIso,
    selectedHourIndex,
    currentWeather.hourLabel,
    currentWeather.windSpeed10m,
    currentWeather.windGusts10m,
    currentWeather.windDirection10m,
    selectedReceptorExposure,
    liveReading,
  ]);

  const handleScan24HoursForReceptor = () => {
    const scanned: NoiseComplianceLogEntry[] = [];
    weatherHours.slice(0, 24).forEach((hr) => {
      const snap = computeReceptorNoiseSnapshot({
        weather: hr,
        sources,
        receptors,
        receptorExposure: selectedReceptorExposure,
        manualMachineNoiseOutputDb,
        isManualMachineNoiseOverrideActive,
      });
      if (
        snap.laeqDb > NOISE_COMPLIANCE_THRESHOLD_DB ||
        snap.lafmaxDb > NOISE_COMPLIANCE_THRESHOLD_DB
      ) {
        const maxVal = Math.max(snap.laeqDb, snap.lafmaxDb);
        scanned.push({
          id: `ncl-${dateIso}-${hr.hourIndex}-${selectedReceptorExposure.receptorId}-${snap.laeqDb.toFixed(
            1
          )}-${snap.lafmaxDb.toFixed(1)}`,
          loggedAtIso: new Date().toISOString(),
          dateIso,
          hourIndex: hr.hourIndex,
          hourLabel: hr.hourLabel,
          receptorId: selectedReceptorExposure.receptorId,
          receptorCode: selectedReceptorExposure.receptorCode,
          receptorName: selectedReceptorExposure.receptorName,
          receptorAddress: selectedReceptorExposure.address,
          laeqDb: snap.laeqDb,
          impulseAdjustedLaeqDb: snap.impulseAdjustedLaeqDb,
          lafmaxDb: snap.lafmaxDb,
          exceedanceDb: Number((maxVal - NOISE_COMPLIANCE_THRESHOLD_DB).toFixed(1)),
          windSpeedMs: hr.windSpeed10m,
          windGustsMs: hr.windGusts10m,
          windDirectionDeg: hr.windDirection10m,
          windRefractionDb: snap.windRefractionDb,
          dominantSourceName: snap.dominantSourceName,
          distanceMeters: snap.distanceMeters,
          sumQuotient: selectedReceptorExposure.sumQuotient,
        });
      }
    });

    if (scanned.length === 0) return;
    setLogEntries((prev) => {
      const map = new Map<string, NoiseComplianceLogEntry>();
      prev.forEach((p) => map.set(p.id, p));
      scanned.forEach((s) => map.set(s.id, s));
      return Array.from(map.values())
        .sort((a, b) => b.hourIndex - a.hourIndex)
        .slice(0, 72);
    });
  };

  const handleExportToSlagelseEsdh = () => {
    const entriesToExport: NoiseComplianceLogEntry[] =
      logEntries.length > 0
        ? logEntries
        : [
            {
              id: `ncl-snapshot-${dateIso}-${selectedHourIndex}`,
              loggedAtIso: new Date().toISOString(),
              dateIso,
              hourIndex: selectedHourIndex,
              hourLabel: currentWeather.hourLabel,
              receptorId: selectedReceptorExposure.receptorId,
              receptorCode: selectedReceptorExposure.receptorCode,
              receptorName: selectedReceptorExposure.receptorName,
              receptorAddress: selectedReceptorExposure.address,
              laeqDb: liveReading.laeqDb,
              impulseAdjustedLaeqDb: liveReading.impulseAdjustedLaeqDb,
              lafmaxDb: liveReading.lafmaxDb,
              exceedanceDb: Number(
                Math.max(
                  0,
                  Math.max(liveReading.laeqDb, liveReading.lafmaxDb) -
                    NOISE_COMPLIANCE_THRESHOLD_DB
                ).toFixed(1)
              ),
              windSpeedMs: currentWeather.windSpeed10m,
              windGustsMs: currentWeather.windGusts10m,
              windDirectionDeg: currentWeather.windDirection10m,
              windRefractionDb: liveReading.windRefractionDb,
              dominantSourceName: liveReading.dominantSourceName,
              distanceMeters: liveReading.distanceMeters,
              sumQuotient: selectedReceptorExposure.sumQuotient,
            },
          ];

    const violations: LegalViolationEntry[] = entriesToExport.map((entry) => {
      const isCrit = entry.laeqDb >= 70 || entry.lafmaxDb >= 70;
      return {
        id: entry.id,
        severity: isCrit ? 'CRITICAL_RED' : 'ELEVATED_ORANGE',
        legalBasisCategory: 'MST_NOISE_LIMITS',
        legalBasisLabel: 'Miljøstyrelsens vejledende støjgrænser',
        timestampIso: `${entry.dateIso}T${entry.hourLabel}:00`,
        receptorName: entry.receptorName,
        receptorAddress: entry.receptorAddress,
        sumQuotient: entry.sumQuotient,
        statuteTitle:
          'Miljøstyrelsens vejledning nr. 5/1984 & Bygge-/Anlægsstøj (55 dB(A) overvågningstærskel)',
        statuteReference: 'Miljøbeskyttelsesloven § 42 · MST Vejl. 5/1984 (55 dB(A) L_Aeq / L_AFmax)',
        legalConsequence: `Realtids støjlog overskrider 55,0 dB(A) med +${entry.exceedanceDb.toFixed(
          1
        )} dB ved ${entry.receptorName} (kl. ${entry.hourLabel}). Påbud om støjdæmpning eller driftstidsbegrænsning.`,
        technicalEvidence: `L_Aeq=${entry.laeqDb.toFixed(
          1
        )} dB(A) (L_Aeq,korr=${entry.impulseAdjustedLaeqDb.toFixed(
          1
        )} dB(A)) · L_AFmax=${entry.lafmaxDb.toFixed(1)} dB(A) · Kilde: ${
          entry.dominantSourceName
        } (${entry.distanceMeters} m) · Vind: ${entry.windSpeedMs.toFixed(
          1
        )} m/s (${entry.windDirectionDeg}°) · Refraktionsbidrag ΔL=${
          entry.windRefractionDb >= 0 ? '+' : ''
        }${entry.windRefractionDb.toFixed(1)} dB`,
        noiseMetrics: {
          laeqDb: entry.laeqDb,
          lafmaxDb: entry.lafmaxDb,
          impulseAdjustedLaeqDb: entry.impulseAdjustedLaeqDb,
          limitLaeqDb: NOISE_COMPLIANCE_THRESHOLD_DB,
          limitLafmaxDb: NOISE_COMPLIANCE_THRESHOLD_DB,
          windRefractionDb: entry.windRefractionDb,
          dominantSourceName: entry.dominantSourceName,
          distanceMeters: entry.distanceMeters,
        },
      };
    });

    exportSlagelseViolationsEsdhCsv({
      violations,
      dateIso,
      currentWeather,
      plumeDirectionDeg,
      sha256Hash,
      delimiter: ';',
    });

    setEsdhExportedJustNow(true);
    window.setTimeout(() => setEsdhExportedJustNow(false), 3000);
  };

  const selectedReceptorLogCount = logEntries.filter(
    (e) => e.receptorId === selectedReceptorExposure.receptorId
  ).length;

  return (
    <div
      data-testid="noise-compliance-log-panel"
      className="p-3 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-3 font-mono text-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)] uppercase tracking-wide">
            <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Realtids Støj-Overholdelseslog (&gt; 55 dB(A))</span>
          </div>
          <p className="text-[11px] font-sans text-[var(--text-secondary)]">
            Automatisk logning af L_Aeq og L_AFmax over 55,0 dB(A) for valgt receptor:{' '}
            <strong className="text-[var(--text-primary)]">
              {selectedReceptorExposure.receptorCode} ({selectedReceptorExposure.receptorName})
            </strong>
          </p>
        </div>

        <button
          type="button"
          data-testid="export-noise-compliance-esdh-csv-btn"
          onClick={handleExportToSlagelseEsdh}
          className={`px-2.5 py-1.5 rounded text-[11px] font-bold border transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 ${
            esdhExportedJustNow
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60'
              : 'bg-[var(--surface-overlay)] hover:bg-slate-700 text-sky-300 border-sky-500/50'
          }`}
          title="Eksportér loggede støjoverskridelser (>55 dB(A)) i Slagelse Kommune ESDH CSV-format (semikolonsepareret UTF-8)"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
          <span>
            {esdhExportedJustNow
              ? '✓ ESDH CSV Eksporteret!'
              : 'Export to Slagelse-Kommune-ESDH'}
          </span>
        </button>
      </div>

      {/* Live Receptor Reading Strip */}
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div className="p-2 rounded bg-[var(--surface-panel)] border border-[var(--border-subtle)]">
          <div className="text-[var(--text-secondary)]">L_Aeq (Valgt)</div>
          <div
            className={`text-sm font-bold tabular-nums mt-0.5 ${
              liveReading.laeqDb > NOISE_COMPLIANCE_THRESHOLD_DB
                ? 'text-[var(--status-critical-text)]'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {liveReading.laeqDb.toFixed(1)} dB(A)
          </div>
        </div>
        <div className="p-2 rounded bg-[var(--surface-panel)] border border-[var(--border-subtle)]">
          <div className="text-[var(--text-secondary)]">L_AFmax (Spids)</div>
          <div
            className={`text-sm font-bold tabular-nums mt-0.5 ${
              liveReading.lafmaxDb > NOISE_COMPLIANCE_THRESHOLD_DB
                ? 'text-[var(--status-critical-text)]'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {liveReading.lafmaxDb.toFixed(1)} dB(A)
          </div>
        </div>
        <div className="p-2 rounded bg-[var(--surface-panel)] border border-[var(--border-subtle)]">
          <div className="text-[var(--text-secondary)]">Logget (&gt;55 dB)</div>
          <div className="text-sm font-bold tabular-nums text-[var(--status-warning-text)] mt-0.5">
            {logEntries.length} stk. ({selectedReceptorLogCount} her)
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          {isCurrentExceeding55 ? (
            <span className="inline-flex items-center gap-1 text-[var(--status-critical-text)] font-bold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                Overskridelse aktiv kl. {currentWeather.hourLabel} (+
                {Math.max(
                  liveReading.laeqDb - NOISE_COMPLIANCE_THRESHOLD_DB,
                  liveReading.lafmaxDb - NOISE_COMPLIANCE_THRESHOLD_DB
                ).toFixed(1)}{' '}
                dB)
              </span>
            </span>
          ) : (
            <span>Under 55,0 dB(A) tærskel kl. {currentWeather.hourLabel}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleScan24HoursForReceptor}
            className="px-2 py-1 rounded bg-[var(--surface-panel)] hover:bg-[var(--surface-overlay)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold flex items-center gap-1 cursor-pointer"
            title="Scan alle 24 timer på den valgte dato for overskridelser > 55 dB(A) ved denne receptor"
          >
            <RefreshCw className="w-3 h-3 text-sky-400" />
            <span>Scan 24t</span>
          </button>
          {logEntries.length > 0 && (
            <button
              type="button"
              onClick={() => setLogEntries([])}
              className="px-2 py-1 rounded bg-[var(--surface-panel)] hover:bg-[var(--surface-overlay)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              title="Ryd støjloggen"
            >
              <Trash2 className="w-3 h-3" />
              <span>Ryd</span>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Compliance Log Table */}
      {logEntries.length === 0 ? (
        <div className="p-2.5 rounded bg-[var(--surface-panel)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)]">
          Ingen støjhændelser over 55,0 dB(A) logget endnu. Flyt tidsslideren eller klik &quot;Scan 24t&quot;.
        </div>
      ) : (
        <div className="max-h-56 overflow-y-auto rounded border border-[var(--border-subtle)] bg-[var(--surface-panel)]">
          <table className="w-full text-left border-collapse text-[11px] tabular-nums">
            <thead className="sticky top-0 bg-[var(--surface-overlay)] text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">
              <tr>
                <th className="py-1.5 px-2 font-semibold">Tid</th>
                <th className="py-1.5 px-2 font-semibold">Receptor</th>
                <th className="py-1.5 px-2 font-semibold text-right">L_Aeq</th>
                <th className="py-1.5 px-2 font-semibold text-right">L_AFmax</th>
                <th className="py-1.5 px-2 font-semibold text-right">&gt;55 dB</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {logEntries.map((entry) => (
                <tr
                  key={entry.id}
                  onClick={() => onSelectHour?.(entry.hourIndex)}
                  className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                  title={`${entry.dominantSourceName} (${entry.distanceMeters} m) · Vind ${entry.windSpeedMs.toFixed(1)} m/s (${entry.windDirectionDeg}°)`}
                >
                  <td className="py-1.5 px-2 text-sky-300 font-semibold whitespace-nowrap">
                    {entry.hourLabel}
                  </td>
                  <td className="py-1.5 px-2 text-[var(--text-primary)] truncate max-w-[115px]">
                    {entry.receptorCode}
                  </td>
                  <td
                    className={`py-1.5 px-2 text-right font-bold ${
                      entry.laeqDb > NOISE_COMPLIANCE_THRESHOLD_DB
                        ? 'text-[var(--status-warning-text)]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {entry.laeqDb.toFixed(1)}
                  </td>
                  <td
                    className={`py-1.5 px-2 text-right font-bold ${
                      entry.lafmaxDb > NOISE_COMPLIANCE_THRESHOLD_DB
                        ? 'text-[var(--status-critical-text)]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {entry.lafmaxDb.toFixed(1)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-bold text-[var(--status-critical-text)]">
                    +{entry.exceedanceDb.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
