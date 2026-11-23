/**
 * @file src/components/SelectedNoiseEventsPdfBuilderCard.tsx
 * @description Panel i 'Støj & Støv' til udvælgelse af specifikke støjhændelser og
 * generering af retsmedicinsk PDF-rapport med vindkorrelation og beregnet sumkvotient (S).
 */

import React, { useMemo, useState } from 'react';
import { Check, CheckSquare, FileDown, FileText, Square, Volume2, Wind } from 'lucide-react';
import { INITIAL_RECEPTOR_ZONES } from '../data/ringparkenData';
import { deterministicHexHash256 } from '../services/autonomousReceptorMeshService';
import {
  ForensicSelectableNoiseEvent,
  downloadNeighborGustNoiseTechnicalAppendixPdf,
  downloadSelectedNoiseEventsForensicPdf,
} from '../services/selectedNoiseEventsPdfService';
import {
  AlgedonicObservation,
  DemolitionSourceNode,
  HourlyWeatherPoint,
  PuffAccumulationResult,
  ReceptorZone,
} from '../types/dispersion';

export interface SelectedNoiseEventsPdfBuilderCardProps {
  dateIso: string;
  receptorFocusName: string;
  weatherHours: HourlyWeatherPoint[];
  currentWeather?: HourlyWeatherPoint;
  observations: AlgedonicObservation[];
  sources: DemolitionSourceNode[];
  receptors?: ReceptorZone[];
  puff24h: PuffAccumulationResult;
  manualMachineNoiseOutputDb: number;
  isManualMachineNoiseOverrideActive: boolean;
  onSelectHour?: (hourIndex: number) => void;
}

export const SelectedNoiseEventsPdfBuilderCard: React.FC<
  SelectedNoiseEventsPdfBuilderCardProps
> = ({
  dateIso,
  receptorFocusName,
  weatherHours,
  currentWeather,
  observations,
  sources,
  receptors = INITIAL_RECEPTOR_ZONES,
  puff24h,
  manualMachineNoiseOutputDb,
  isManualMachineNoiseOverrideActive,
  onSelectHour,
}) => {
  const [deselectedIds, setDeselectedIds] = useState<Record<string, boolean>>({});
  const [selectedNeighborIds, setSelectedNeighborIds] = useState<string[]>(() => {
    const residential = receptors
      .filter((r) => r.category === 'residential_block' || r.category === 'custom_receptor')
      .map((r) => r.id);
    return residential.length > 0 ? residential : receptors.map((r) => r.id);
  });
  const [lastExportedInfo, setLastExportedInfo] = useState<{
    fileName: string;
    hash: string;
    label: string;
  } | null>(null);

  const neighborBlockChoices = useMemo(() => {
    const filtered = receptors.filter(
      (r) => r.category === 'residential_block' || r.category === 'custom_receptor'
    );
    return filtered.length > 0 ? filtered : receptors;
  }, [receptors]);

  const effectiveSelectedNeighborReceptors = useMemo(() => {
    const idSet = new Set(selectedNeighborIds);
    const chosen = neighborBlockChoices.filter((r) => idSet.has(r.id));
    return chosen.length > 0 ? chosen : neighborBlockChoices;
  }, [neighborBlockChoices, selectedNeighborIds]);

  const toggleNeighborBlock = (recId: string) => {
    setSelectedNeighborIds((prev) => {
      if (prev.includes(recId)) {
        return prev.length > 1 ? prev.filter((id) => id !== recId) : prev;
      }
      return [...prev, recId];
    });
  };

  const activeSources = sources.filter((s) => s.active);
  const dominantSourceLabel = activeSources[0]
    ? `${activeSources[0].code} (${activeSources[0].name})`
    : 'Ringparken Nedrivningsfelt';
  const baseLwaDb = isManualMachineNoiseOverrideActive
    ? manualMachineNoiseOutputDb
    : 106 + Math.min(6, Math.max(0, activeSources.length - 1) * 1.8);

  const candidateEvents: ForensicSelectableNoiseEvent[] = useMemo(() => {
    const profile = puff24h.peakReceptor.hourlyProfile;
    const list: ForensicSelectableNoiseEvent[] = [];

    // 1. Registrerede støj- og akustiske naboklage-observationer
    observations.forEach((obs) => {
      const isNoiseRelated =
        Boolean(obs.audioEvidence) ||
        /støj|db|impuls|mejsel|hammer|klage|vibrat|larm/i.test(
          `${obs.observationType} ${obs.description}`
        );
      if (!isNoiseRelated && observations.length > 4) return;
      const w = obs.weatherSnapshot;
      const gust = Math.max(w.windSpeed10m, w.windGusts10m || w.windSpeed10m * 1.32);
      const refBoost = Number(
        Math.min(7.5, Math.max(0, (w.windSpeed10m - 4.5) * 0.42 + (gust - 8.0) * 0.24)).toFixed(1)
      );
      const lafmax = obs.audioEvidence
        ? Number((obs.audioEvidence.analysis.estimatedSourceLwaDb - 28 + refBoost).toFixed(1))
        : Number((baseLwaDb - 31.5 + refBoost).toFixed(1));
      const sAtTime = Number(
        (
          obs.plumeCorroboration?.calculatedSumQuotient ??
          profile[obs.observedHourIndex]?.sumQuotient ??
          0
        ).toFixed(2)
      );

      list.push({
        id: `obs-${obs.id}`,
        code: obs.code,
        timestampLabel: `${obs.observedDateIso} kl. ${obs.observedHourLabel}`,
        hourIndex: obs.observedHourIndex,
        locationLabel: obs.locationLabel,
        sourceLabel: obs.plumeCorroboration?.nearestSourceName || dominantSourceLabel,
        windSpeedMs: w.windSpeed10m,
        windGustMs: gust,
        windDirectionDeg: w.windDirection10m,
        windRefractionBoostDb: refBoost,
        estimatedLafmaxDb: lafmax,
        sumQuotientS: sAtTime,
        isNoiseLimitExceeded: lafmax >= 80,
        isSumQuotientExceeded: sAtTime >= 1.0,
        sha256Signature:
          obs.sha256Signature || deterministicHexHash256(`${obs.code}|${lafmax}|${sAtTime}`),
      });
    });

    // 2. Suppler med de mest kritiske vind-støj timer fra 24t-telemetrien
    const teleHours = weatherHours
      .slice(0, 24)
      .filter((hr) => hr.hourIndex >= 6 && hr.hourIndex <= 18)
      .map((hr) => {
        const gust = Math.max(hr.windSpeed10m, hr.windGusts10m || hr.windSpeed10m * 1.32);
        const refBoost = Number(
          Math.min(7.5, Math.max(0, (hr.windSpeed10m - 4.5) * 0.42 + (gust - 8.0) * 0.24)).toFixed(1)
        );
        const lafmax = Number((baseLwaDb - 32.5 + refBoost).toFixed(1));
        const sVal = Number((profile[hr.hourIndex]?.sumQuotient ?? 0).toFixed(2));
        return { hr, gust, refBoost, lafmax, sVal };
      })
      .sort((a, b) => b.lafmax + b.refBoost * 2 - (a.lafmax + a.refBoost * 2))
      .slice(0, 5);

    teleHours.forEach(({ hr, gust, refBoost, lafmax, sVal }) => {
      const id = `tele-${dateIso}-${hr.hourIndex}`;
      if (list.some((x) => x.hourIndex === hr.hourIndex)) return;
      list.push({
        id,
        code: `STØJ-T${String(hr.hourIndex).padStart(2, '0')}`,
        timestampLabel: `${dateIso} kl. ${hr.hourLabel}`,
        hourIndex: hr.hourIndex,
        locationLabel: puff24h.peakReceptor.receptorName,
        sourceLabel: dominantSourceLabel,
        windSpeedMs: hr.windSpeed10m,
        windGustMs: gust,
        windDirectionDeg: hr.windDirection10m,
        windRefractionBoostDb: refBoost,
        estimatedLafmaxDb: lafmax,
        sumQuotientS: sVal,
        isNoiseLimitExceeded: lafmax >= 80,
        isSumQuotientExceeded: sVal >= 1.0,
        sha256Signature: deterministicHexHash256(`${id}|${lafmax}|${sVal}|${hr.windDirection10m}`),
      });
    });

    return list.sort((a, b) => a.hourIndex - b.hourIndex);
  }, [observations, weatherHours, puff24h, baseLwaDb, dominantSourceLabel, dateIso]);

  const selectedEvents = useMemo(
    () => candidateEvents.filter((ev) => !deselectedIds[ev.id]),
    [candidateEvents, deselectedIds]
  );

  const toggleEvent = (id: string) => {
    setDeselectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectExceedancesOnly = () => {
    const next: Record<string, boolean> = {};
    const anyCritical = candidateEvents.some(
      (e) => e.isNoiseLimitExceeded || e.isSumQuotientExceeded || e.windRefractionBoostDb >= 3.0
    );
    candidateEvents.forEach((e) => {
      if (anyCritical && !e.isNoiseLimitExceeded && !e.isSumQuotientExceeded && e.windRefractionBoostDb < 3.0) {
        next[e.id] = true;
      }
    });
    setDeselectedIds(next);
  };

  const handleExportPdf = () => {
    if (selectedEvents.length === 0) return;
    const res = downloadSelectedNoiseEventsForensicPdf({
      dateIso,
      receptorFocusName,
      selectedEvents,
    });
    setLastExportedInfo({
      fileName: res.fileName,
      hash: res.reportSha256,
      label: 'Retsmedicinsk Støj- & Vind-PDF',
    });
  };

  const handleExportTechnicalAppendixPdf = () => {
    const activeWeather =
      currentWeather ??
      weatherHours[12] ??
      weatherHours[0] ?? {
        hourIndex: 12,
        hourLabel: '12:00',
        windSpeed10m: 8.5,
        windGusts10m: 12.8,
        windDirection10m: 245,
      };
    const res = downloadNeighborGustNoiseTechnicalAppendixPdf({
      dateIso,
      hourLabel: activeWeather.hourLabel,
      weatherHours,
      currentWeather: activeWeather,
      sources,
      selectedReceptors: effectiveSelectedNeighborReceptors,
      effectiveLwaDb: baseLwaDb,
      machineProfileLabel: isManualMachineNoiseOverrideActive
        ? `Manuelt Maskin-Output (${baseLwaDb.toFixed(1)} dB)`
        : `Aktiv Nedrivningsdrift (${dominantSourceLabel.split(' ')[0]})`,
      selectedEventsCount: selectedEvents.length,
    });
    setLastExportedInfo({
      fileName: res.fileName,
      hash: res.reportSha256,
      label: `Teknisk Bilag (${effectiveSelectedNeighborReceptors.length} naboblokke)`,
    });
  };

  return (
    <section
      data-testid="selected-noise-events-pdf-card"
      className="p-3 rounded-lg bg-[#090D16] border border-rose-500/55 space-y-2.5 font-mono text-slate-100 text-xs tabular-nums"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="space-y-0.5 min-w-0 flex-1">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Retsmedicinsk PDF-Rapport: Valgte Støj-Hændelser × Vind &amp; Sumkvotient (S)</span>
          </h3>
          <p className="text-[11px] text-slate-400">
            Vælg støj-hændelser eller naboblokke nedenfor for at eksportere retsmedicinsk støj-PDF eller teknisk bilag over vindstød × maskinstøj til miljøtilsyn.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            data-testid="export-gust-noise-technical-appendix-pdf-btn"
            onClick={handleExportTechnicalAppendixPdf}
            className="px-2.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 border border-sky-300 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
            title="Download teknisk bilag til miljøtilsyn med korrelation mellem vindstød og maskinstøj for de valgte naboblokke"
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>
              Teknisk Bilag: Vindstød × Maskinstøj ({effectiveSelectedNeighborReceptors.length})
            </span>
          </button>

          <button
            type="button"
            data-testid="export-selected-noise-events-pdf-btn"
            disabled={selectedEvents.length === 0}
            onClick={handleExportPdf}
            className="px-2.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-50 border border-rose-300 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileDown className="w-3.5 h-3.5 shrink-0" />
            <span>Støj- &amp; Vind-PDF ({selectedEvents.length})</span>
          </button>
        </div>
      </div>

      {/* Valgte naboblokke til teknisk bilag */}
      <div className="p-2 rounded bg-[#0D1320] border border-sky-500/35 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="font-semibold text-sky-300">
            Valgte naboblokke til teknisk miljøtilsyns-bilag ({effectiveSelectedNeighborReceptors.length}/{neighborBlockChoices.length}):
          </span>
          <button
            type="button"
            onClick={() => setSelectedNeighborIds(neighborBlockChoices.map((r) => r.id))}
            className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] cursor-pointer whitespace-nowrap"
          >
            Vælg alle blokke
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {neighborBlockChoices.map((rec) => {
            const isPicked = effectiveSelectedNeighborReceptors.some((r) => r.id === rec.id);
            return (
              <button
                key={`appendix-block-${rec.id}`}
                type="button"
                onClick={() => toggleNeighborBlock(rec.id)}
                className={`px-2 py-0.5 rounded border text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors ${
                  isPicked
                    ? 'bg-sky-950/80 border-sky-400/70 text-sky-100 font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                {isPicked ? (
                  <CheckSquare className="w-3 h-3 text-sky-400 shrink-0" />
                ) : (
                  <Square className="w-3 h-3 text-slate-600 shrink-0" />
                )}
                <span>{rec.code}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hurtigvalg-knapper */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDeselectedIds({})}
            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold cursor-pointer"
          >
            Vælg alle ({candidateEvents.length})
          </button>
          <button
            type="button"
            onClick={handleSelectExceedancesOnly}
            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-amber-500/50 text-amber-200 font-semibold cursor-pointer"
          >
            Kun kritiske (≥80 dB / Vind ≥+3 dB / S≥1,0)
          </button>
        </div>
        {lastExportedInfo && (
          <span className="text-emerald-300 inline-flex items-center gap-1 truncate">
            <Check className="w-3 h-3 shrink-0" />
            <span>
              {lastExportedInfo.label} gemt · SHA-256: {lastExportedInfo.hash.slice(0, 12)}…
            </span>
          </span>
        )}
      </div>

      {/* Vælgbare støjhændelser med vinddata & S-kvotient */}
      <div className="max-h-44 overflow-y-auto rounded border border-slate-800 divide-y divide-slate-800/80 bg-[#07090E]">
        {candidateEvents.map((ev) => {
          const checked = !deselectedIds[ev.id];
          return (
            <div
              key={ev.id}
              className={`px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px] ${
                checked ? 'bg-slate-900/65 text-slate-100' : 'text-slate-500'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleEvent(ev.id)}
                className="flex items-center gap-2 min-w-0 text-left flex-1 cursor-pointer"
              >
                {checked ? (
                  <CheckSquare className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                )}
                <span className="font-bold w-20 shrink-0 truncate">{ev.code}</span>
                <span className="truncate text-slate-300">{ev.timestampLabel.slice(-8)} · {ev.locationLabel}</span>
              </button>

              <div
                onClick={() => onSelectHour?.(ev.hourIndex)}
                className="flex items-center gap-2.5 shrink-0 cursor-pointer"
                title="Klik for at hoppe til hændelsens tidspunkt"
              >
                <span className="text-cyan-300 inline-flex items-center gap-1">
                  <Wind className="w-3 h-3" />
                  {ev.windGustMs.toFixed(1)}m/s @{Math.round(ev.windDirectionDeg)}° (+{ev.windRefractionBoostDb.toFixed(1)}dB)
                </span>
                <span className={ev.isNoiseLimitExceeded ? 'text-rose-300 font-bold' : 'text-amber-200'}>
                  {ev.estimatedLafmaxDb.toFixed(1)} dB
                </span>
                <span className={ev.isSumQuotientExceeded ? 'text-fuchsia-300 font-bold' : 'text-emerald-300'}>
                  S={ev.sumQuotientS.toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
