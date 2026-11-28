/**
 * @file src/utils/highWindContingencyPlan.ts
 * @description Deterministisk motor der genererer en struktureret 'Høj-Vind Beredskabsplan'
 * når vindhastigheden overstiger 10 m/s, inkl. tjekliste for nedstøvning, maskinstop
 * og naboorientering baseret på de mest udsatte receptorer.
 */

import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  PuffAccumulationResult,
  ReceptorExposureResult,
  ReceptorZone,
} from '../types/dispersion';
import {
  angularDiffDeg,
  bearingBetweenPointsDeg,
  distanceBetweenPointsMeters,
} from '../services/dispersionEngine';
import { degreesToCompass } from '../services/weatherService';

export type ContingencyChecklistCategory =
  | 'nedstoevning'
  | 'maskinstop'
  | 'naboorientering';

export interface ContingencyChecklistItem {
  id: string;
  category: ContingencyChecklistCategory;
  categoryLabelDa: string;
  priority: 'AKUT' | 'HØJ' | 'OBLIGATORISK';
  titleDa: string;
  actionDetailsDa: string;
  targetRefDa: string;
}

export interface ExposedReceptorContingencyRow {
  receptorId: string;
  receptorCode: string;
  receptorName: string;
  address: string;
  distanceMeters: number;
  bearingDeg: number;
  downwindAlignmentDeg: number;
  isDirectlyDownwind: boolean;
  sumQuotientS: number;
  dustUgM3: number;
  estimatedLafmaxDb: number;
  priorityTier: 'KRITISK' | 'HØJ' | 'OBSERVATION';
  notificationActionDa: string;
}

export interface HighWindContingencyPlan {
  planId: string;
  dateIso: string;
  hourIndex: number;
  hourLabel: string;
  generatedAtIso: string;
  isHighWindTriggered: boolean; // windSpeed10m > 10.0 m/s
  windThresholdMs: number;
  windSpeedMs: number;
  windGustsMs: number;
  windFromDeg: number;
  windFromCompass: string;
  plumeDownwindDeg: number;
  plumeDownwindCompass: string;
  pasquillClass: string;
  highWindHoursIn24hCount: number;
  highWindHoursLabels: string[];
  activeSourcesCount: number;
  activeSourcesSummaryDa: string;
  effectiveSiteLwaDb: number;
  exposedReceptorsRanked: ExposedReceptorContingencyRow[];
  topExposedReceptors: ExposedReceptorContingencyRow[];
  dustSuppressionChecklist: ContingencyChecklistItem[];
  machineryStopChecklist: ContingencyChecklistItem[];
  neighborNotificationChecklist: ContingencyChecklistItem[];
  allChecklistItems: ContingencyChecklistItem[];
  sha256Hash?: string;
}

export interface BuildHighWindContingencyPlanParams {
  dateIso: string;
  currentWeather: HourlyWeatherPoint;
  weatherHours: HourlyWeatherPoint[];
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  receptorExposures: ReceptorExposureResult[];
  puff24h?: PuffAccumulationResult;
  manualMachineNoiseOutputDb?: number;
  isManualMachineNoiseOverrideActive?: boolean;
  plumeDirectionDeg?: number;
  sha256Hash?: string;
}

export function buildHighWindContingencyPlan(
  params: BuildHighWindContingencyPlanParams
): HighWindContingencyPlan {
  const {
    dateIso,
    currentWeather,
    weatherHours,
    sources,
    receptors,
    receptorExposures,
    puff24h,
    manualMachineNoiseOutputDb = 114,
    isManualMachineNoiseOverrideActive = false,
    plumeDirectionDeg,
    sha256Hash,
  } = params;

  const windSpeedMs = Number((currentWeather.windSpeed10m ?? 0).toFixed(1));
  const windGustsMs = Number(
    Math.max(windSpeedMs, currentWeather.windGusts10m ?? windSpeedMs * 1.32).toFixed(1)
  );
  const windFromDeg = Math.round(currentWeather.windDirection10m ?? 240);
  const downwindDeg =
    typeof plumeDirectionDeg === 'number'
      ? Math.round(plumeDirectionDeg)
      : (windFromDeg + 180) % 360;

  const isHighWindTriggered = windSpeedMs > 10.0;
  const activeSources = sources.filter((s) => s.active);
  const refSource = activeSources[0] ?? sources[0];

  const effectiveSiteLwaDb =
    activeSources.length === 0
      ? 0
      : isManualMachineNoiseOverrideActive
      ? Number(manualMachineNoiseOutputDb.toFixed(1))
      : Number(
          Math.max(
            ...activeSources.map((s) => s.baseSoundPowerLwaDb ?? 114.0)
          ).toFixed(1)
        );

  const highWindHours = weatherHours.filter((h) => (h.windSpeed10m ?? 0) > 10.0);

  // Rank all receptors by combined dust exposure, downwind alignment & acoustic impulse load
  const exposedReceptorsRanked: ExposedReceptorContingencyRow[] = receptors
    .map((rec) => {
      const exp = receptorExposures.find((e) => e.receptorId === rec.id);
      const puffRec = puff24h?.receptorSummaries.find((r) => r.receptorId === rec.id);

      const distM = refSource
        ? Math.round(distanceBetweenPointsMeters(refSource.position, rec.center))
        : Math.round(exp?.distanceFromNearestSourceMeters ?? 60);
      const bearingDeg = refSource
        ? Math.round(bearingBetweenPointsDeg(refSource.position, rec.center))
        : downwindDeg;
      const alignDiff = Math.round(angularDiffDeg(bearingDeg, downwindDeg));
      const isDirectlyDownwind = alignDiff <= 40;

      const sumQuotientS = Number(
        Math.max(
          exp?.sumQuotient ?? 0,
          puffRec?.peakSumQuotient ?? 0
        ).toFixed(2)
      );
      const dustUgM3 = Number(
        (puffRec?.totalDepositedHeavyMetalsAndPcbUgM2 ?? sumQuotientS * 24).toFixed(1)
      );

      // Directional acoustic L_AFmax estimate including high-wind refraction
      const cosAlign = Math.cos((alignDiff * Math.PI) / 180);
      const windRefrDb =
        cosAlign >= 0
          ? cosAlign * Math.min(5.2, Math.max(0, (windSpeedMs - 4) * 0.48))
          : cosAlign * 2.5;
      const aDiv = 20 * Math.log10(Math.max(12, distM)) + 11.0;
      const estimatedLafmaxDb =
        activeSources.length > 0
          ? Number(
              Math.max(
                45,
                effectiveSiteLwaDb + 9.5 - aDiv - Math.min(5, distM * 0.015) + windRefrDb
              ).toFixed(1)
            )
          : 45.0;

      const priorityScore =
        sumQuotientS * 45 +
        (isDirectlyDownwind ? 30 : 0) +
        Math.max(0, estimatedLafmaxDb - 65) * 1.4;

      const priorityTier: ExposedReceptorContingencyRow['priorityTier'] =
        (isDirectlyDownwind && (sumQuotientS >= 0.8 || estimatedLafmaxDb >= 85)) ||
        priorityScore >= 75
          ? 'KRITISK'
          : isDirectlyDownwind || sumQuotientS >= 0.45 || estimatedLafmaxDb >= 75
          ? 'HØJ'
          : 'OBSERVATION';

      const notificationActionDa =
        priorityTier === 'KRITISK'
          ? `Akut SMS/varsel + anmodning om lukkede vinduer/ventilation (${degreesToCompass(
              downwindDeg
            )} nedvind)`
          : priorityTier === 'HØJ'
          ? `Forebyggende naboorientering om støj-/støvdæmpende tiltag`
          : `Løbende overvågning via miljøstation`;

      return {
        receptorId: rec.id,
        receptorCode: rec.code,
        receptorName: rec.name,
        address: rec.address,
        distanceMeters: distM,
        bearingDeg,
        downwindAlignmentDeg: alignDiff,
        isDirectlyDownwind,
        sumQuotientS,
        dustUgM3,
        estimatedLafmaxDb,
        priorityTier,
        notificationActionDa,
        _score: priorityScore,
      };
    })
    .sort((a, b) => b._score - a._score)
    .map(({ _score: _ignore, ...rest }) => rest);

  const topExposedReceptors = exposedReceptorsRanked.slice(0, 3);
  const topRec = topExposedReceptors[0];
  const activeNames =
    activeSources.length > 0
      ? activeSources.map((s) => `${s.code} (${s.name})`).join(', ')
      : 'Ingen aktive kilder';

  const dustSuppressionChecklist: ContingencyChecklistItem[] = [
    {
      id: 'chk-dust-1',
      category: 'nedstoevning',
      categoryLabelDa: 'Nedstøvning',
      priority: isHighWindTriggered ? 'AKUT' : 'HØJ',
      titleDa: 'Aktivér vandtågekanoner og forstøvningsdyser ved aktive nedrivningszoner',
      actionDetailsDa: `Ret vandtågedyser mod ${degreesToCompass(
        downwindDeg
      )}-sektoren (${downwindDeg}°) for at binde respirabelt støv før det når ${
        topRec?.receptorName ?? 'nærmeste naboer'
      }.`,
      targetRefDa: activeNames,
    },
    {
      id: 'chk-dust-2',
      category: 'nedstoevning',
      categoryLabelDa: 'Nedstøvning',
      priority: 'OBLIGATORISK',
      titleDa: 'Forvand og tildæk åbne brokkebunker, nedstyrtningsrør og støvende flader',
      actionDetailsDa: `Ved vindstød på ${windGustsMs.toFixed(
        1
      )} m/s skal alle ubefæstede bunker fugtes eller overdækkes med presenning; sluk tør materialehåndtering.`,
      targetRefDa: `Vindstød ${windGustsMs.toFixed(1)} m/s`,
    },
    {
      id: 'chk-dust-3',
      category: 'nedstoevning',
      categoryLabelDa: 'Nedstøvning',
      priority: 'HØJ',
      titleDa: 'Kontrollér asbest/PCB-sluser, undertryksanlæg og containerafdækning',
      actionDetailsDa: `Verificér tæt lukning af BigBags og HEPA-undertryk i saneringszoner så vindtryk ikke bryder indeslutningen.`,
      targetRefDa: 'Miljøsanering & affald',
    },
  ];

  const machineryStopChecklist: ContingencyChecklistItem[] = [
    {
      id: 'chk-stop-1',
      category: 'maskinstop',
      categoryLabelDa: 'Maskinstop',
      priority: isHighWindTriggered && effectiveSiteLwaDb >= 108 ? 'AKUT' : 'HØJ',
      titleDa: 'Iværksæt straks-stop for høj-impuls nedrivningsmaskiner (>108 dB L_WA)',
      actionDetailsDa: `Stands hydraulisk betonknusning, mejselhammer og nedstyrtning ved v > 10,0 m/s (aktuel vind ${windSpeedMs.toFixed(
        1
      )} m/s · aktiv L_WA ${effectiveSiteLwaDb.toFixed(1)} dB).`,
      targetRefDa: activeNames,
    },
    {
      id: 'chk-stop-2',
      category: 'maskinstop',
      categoryLabelDa: 'Maskinstop',
      priority: 'OBLIGATORISK',
      titleDa: 'Omlæg mandskab til indvendig lavstøjs-sanering (≤96 dB L_WA)',
      actionDetailsDa: `Flyt drift til støjsvag indvendig demontering/sortering indtil vindhastigheden falder stabilt under 10,0 m/s i min. 15 min.`,
      targetRefDa: 'Driftsomlægning',
    },
    {
      id: 'chk-stop-3',
      category: 'maskinstop',
      categoryLabelDa: 'Maskinstop',
      priority: 'OBLIGATORISK',
      titleDa: 'Registrér maskinstop-tidspunkt og anemometerdata i ESDH/bevis-log',
      actionDetailsDa: `Dokumentér nedlukning for Slagelse Kommune miljøtilsyn med SHA-256 hash og aktuel vindretning (${windFromDeg}°).`,
      targetRefDa: `Kl. ${currentWeather.hourLabel}`,
    },
  ];

  const neighborNotificationChecklist: ContingencyChecklistItem[] = [
    {
      id: 'chk-nabo-1',
      category: 'naboorientering',
      categoryLabelDa: 'Naboorientering',
      priority: topRec?.priorityTier === 'KRITISK' ? 'AKUT' : 'HØJ',
      titleDa: `Udsend direkte SMS/varsel til de ${topExposedReceptors.length} mest udsatte receptorer`,
      actionDetailsDa:
        topExposedReceptors.length > 0
          ? `Prioriteret modtagerliste: ${topExposedReceptors
              .map(
                (r) =>
                  `${r.receptorCode} ${r.receptorName} (S=${r.sumQuotientS.toFixed(
                    2
                  )}, ${r.estimatedLafmaxDb.toFixed(0)} dB)`
              )
              .join(' | ')}.`
          : 'Ingen udsatte receptorer fundet.',
      targetRefDa: topRec ? `${topRec.receptorCode} · ${topRec.address}` : 'Ringparken',
    },
    {
      id: 'chk-nabo-2',
      category: 'naboorientering',
      categoryLabelDa: 'Naboorientering',
      priority: 'HØJ',
      titleDa: 'Informér om vindperiode, forventet varighed og lukning af vinduer',
      actionDetailsDa:
        highWindHours.length > 0
          ? `Høj vind (>10 m/s) registreret/varslet i ${highWindHours.length} timer (${highWindHours
              .slice(0, 5)
              .map((h) => h.hourLabel)
              .join(', ')}). Anbefal midlertidig lukning af vinduer mod byggepladsen.`
          : 'Informér beboere om skærpet beredskab ved kraftige vindstød.',
      targetRefDa: `${highWindHours.length} høj-vindstimer`,
    },
    {
      id: 'chk-nabo-3',
      category: 'naboorientering',
      categoryLabelDa: 'Naboorientering',
      priority: 'OBLIGATORISK',
      titleDa: 'Opgiv direkte hotline til pladsleder og henvis til naboklage-log',
      actionDetailsDa: `Sørg for at eventuelle støj- eller støvhenvendelser fra beboere logges straks med adresse og målt dB-niveau.`,
      targetRefDa: 'Pladsledelse & Tilsyn',
    },
  ];

  const allChecklistItems = [
    ...dustSuppressionChecklist,
    ...machineryStopChecklist,
    ...neighborNotificationChecklist,
  ];

  return {
    planId: `HVB-${dateIso.replace(/-/g, '')}-${String(currentWeather.hourIndex).padStart(
      2,
      '0'
    )}`,
    dateIso,
    hourIndex: currentWeather.hourIndex,
    hourLabel: currentWeather.hourLabel,
    generatedAtIso: new Date().toISOString(),
    isHighWindTriggered,
    windThresholdMs: 10.0,
    windSpeedMs,
    windGustsMs,
    windFromDeg,
    windFromCompass: degreesToCompass(windFromDeg),
    plumeDownwindDeg: downwindDeg,
    plumeDownwindCompass: degreesToCompass(downwindDeg),
    pasquillClass: currentWeather.pasquillClass || 'D',
    highWindHoursIn24hCount: highWindHours.length,
    highWindHoursLabels: highWindHours.map((h) => h.hourLabel),
    activeSourcesCount: activeSources.length,
    activeSourcesSummaryDa: activeNames,
    effectiveSiteLwaDb,
    exposedReceptorsRanked,
    topExposedReceptors,
    dustSuppressionChecklist,
    machineryStopChecklist,
    neighborNotificationChecklist,
    allChecklistItems,
    sha256Hash,
  };
}
