/**
 * @file src/services/weeklyExternalAuditPdfService.ts
 * @description Automatisk og omfattende 7-døgns (168 timers) PDF-rapport til ekstern miljørevision
 * der samler den seneste uges målinger og simuleringer for Støj, Støv og Vejr i Ringparken, Slagelse.
 */

import { jsPDF } from 'jspdf';
import {
  AlgedonicObservation,
  DemolitionSourceNode,
  HourlyWeatherPoint,
  ReceptorZone,
} from '../types/dispersion';
import {
  deterministicHexHash256,
} from './autonomousReceptorMeshService';
import {
  angularDiffDeg,
  bearingBetweenPointsDeg,
  distanceBetweenPointsMeters,
  runDispersionSimulation,
} from './dispersionEngine';
import {
  buildLastWeekPredictedVsActualWeatherPairs,
  degreesToCompass,
} from './weatherService';

export type WeeklyDayAuditStatus =
  | 'GODKENDT'
  | 'ANMÆRKNING'
  | 'KRITISK AFVIGELSE';

export interface WeeklyDayMeasurementRow {
  dayIndex: number;
  dateIso: string;
  weekdayDa: string;
  dayShortDa: string;
  weatherHeadline: string;
  meanWindMs: number;
  maxWindMs: number;
  maxGustMs: number;
  dominantWindFromDeg: number;
  dominantWindCompass: string;
  totalPrecipMm: number;
  highWindHoursCount: number;
  minTempC: number;
  maxTempC: number;
  dominantPasquill: string;
  peakSumQuotientS: number;
  meanSumQuotientS: number;
  dustExceedanceHoursS1: number;
  dustWarningHoursS08: number;
  cumulativeRespirableDustUgM2: number;
  worstDustReceptorCode: string;
  worstDustReceptorName: string;
  peakLaeqDb: number;
  peakLafmaxDb: number;
  noiseExceedanceHours: number;
  impulseOver85Hours: number;
  corroboratedComplaintsCount: number;
  dayAuditStatus: WeeklyDayAuditStatus;
}

export interface WeeklyTopReceptorAuditSummary {
  receptorId: string;
  receptorCode: string;
  receptorName: string;
  address: string;
  weeklyPeakS: number;
  weeklyPeakLafmaxDb: number;
  totalExceedanceHours: number;
}

export interface WeeklyExternalAuditSummary {
  reportId: string;
  periodStartIso: string;
  periodEndIso: string;
  periodLabel: string;
  totalHoursAnalyzed: number;
  activeSourcesCount: number;
  activeSourcesSummaryDa: string;
  effectiveSiteLwaDb: number;
  dailyRows: WeeklyDayMeasurementRow[];
  topExposedReceptors: WeeklyTopReceptorAuditSummary[];
  // Dust KPIs
  weeklyPeakSumQuotientS: number;
  totalDustExceedanceHours: number;
  totalDustWarningHours: number;
  weeklyTotalDustUgM2: number;
  // Noise KPIs
  weeklyPeakLaeqDb: number;
  weeklyPeakLafmaxDb: number;
  totalNoiseExceedanceHours: number;
  totalImpulseOver85Hours: number;
  // Weather KPIs
  weeklyMeanWindMs: number;
  weeklyMaxWindMs: number;
  weeklyMaxGustMs: number;
  totalPrecipMm: number;
  totalHighWindHours: number;
  // Audit Verdict & Integrity
  totalCorroboratedComplaints: number;
  overallAuditVerdict:
    | 'GODKENDT UDEN ANMÆRKNINGER'
    | 'BETINGET — KRÆVER AFHJÆLPNING'
    | 'IKKE GODKENDT — KRITISK OVERSKRIDELSE';
  auditFindingsSummaryDa: string[];
  auditSha256: string;
  merkleRootSignature?: string;
}

export interface BuildWeeklyExternalAuditParams {
  dateIso: string;
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  observations?: AlgedonicObservation[];
  manualMachineNoiseOutputDb?: number;
  isManualMachineNoiseOverrideActive?: boolean;
  merkleRootSignature?: string;
}

function sanitizePdfText(text: string): string {
  return text
    .replace(/∑/g, 'Sum')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/↔/g, '<->')
    .replace(/Δ/g, 'Delta ')
    .replace(/·/g, ' - ')
    .replace(/µ/g, 'u')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/–/g, '-')
    .replace(/—/g, '-');
}

const SAMPLE_HOURS = [7, 9, 11, 13, 15, 17, 19, 22];
const HOURS_WEIGHT = 24 / SAMPLE_HOURS.length; // 3 timer pr. repræsentativt tidsskridt = 24t dækning

function computeHourlySiteNoiseForAudit(params: {
  hr: HourlyWeatherPoint;
  activeSources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  effectiveSiteLwaDb: number;
}): {
  laeqDb: number;
  lafmaxDb: number;
  isExceeded: boolean;
  isImpulseOver85: boolean;
} {
  const { hr, activeSources, receptors, effectiveSiteLwaDb } = params;
  if (activeSources.length === 0) {
    return {
      laeqDb: 42.0,
      lafmaxDb: 48.0,
      isExceeded: false,
      isImpulseOver85: false,
    };
  }

  const isWorkHour = hr.hourIndex >= 7 && hr.hourIndex < 18;
  const isEvening = hr.hourIndex >= 18 && hr.hourIndex < 22;
  const limitLaeq = isWorkHour ? 70.0 : isEvening ? 45.0 : 40.0;
  const limitLafmax = isWorkHour ? 85.0 : 55.0;

  // Outside demolition work hours (night), machinery idles at ambient background
  if (!isWorkHour && hr.hourIndex !== 18) {
    return {
      laeqDb: 38.5,
      lafmaxDb: 45.2,
      isExceeded: false,
      isImpulseOver85: false,
    };
  }

  const downwindDeg = (hr.windDirection10m + 180) % 360;
  const src = activeSources[0];
  let worstLaeq = 42.0;
  let worstLafmax = 48.0;

  for (const rec of receptors) {
    const distM = Math.max(
      14,
      distanceBetweenPointsMeters(src.position, rec.center)
    );
    const bearingDeg = bearingBetweenPointsDeg(src.position, rec.center);
    const alignDiff = angularDiffDeg(bearingDeg, downwindDeg);
    const cosAlign = Math.cos((alignDiff * Math.PI) / 180);
    const windRefractionDb =
      cosAlign >= 0
        ? cosAlign * Math.min(5.2, Math.max(0, (hr.windSpeed10m - 4) * 0.48))
        : cosAlign * 2.5;
    const aDiv = 20 * Math.log10(distM) + 11.0;
    const impulseSurchargeDb = effectiveSiteLwaDb >= 104 ? 5.0 : 0.0;
    const laeq =
      effectiveSiteLwaDb - aDiv - Math.min(5, distM * 0.015) + windRefractionDb + impulseSurchargeDb;
    const lafmax = laeq + 9.2;
    if (laeq > worstLaeq) worstLaeq = laeq;
    if (lafmax > worstLafmax) worstLafmax = lafmax;
  }

  const laeqRounded = Number(worstLaeq.toFixed(1));
  const lafmaxRounded = Number(worstLafmax.toFixed(1));

  return {
    laeqDb: laeqRounded,
    lafmaxDb: lafmaxRounded,
    isExceeded: laeqRounded > limitLaeq || lafmaxRounded > limitLafmax,
    isImpulseOver85: lafmaxRounded > 85.0,
  };
}

/**
 * Aggregerer deterministisk de seneste 7 døgns miljømålinger for Støj, Støv og Vejr
 * til brug for automatisk ekstern revisionsrapport.
 */
export function buildWeeklyExternalAuditSummary(
  params: BuildWeeklyExternalAuditParams
): WeeklyExternalAuditSummary {
  const {
    dateIso,
    sources,
    receptors,
    observations = [],
    manualMachineNoiseOutputDb = 114,
    isManualMachineNoiseOverrideActive = false,
    merkleRootSignature,
  } = params;

  const activeSources = sources.filter((s) => s.active);
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

  const weekPairs = buildLastWeekPredictedVsActualWeatherPairs(dateIso);
  const receptorAccum: Record<
    string,
    {
      receptorCode: string;
      receptorName: string;
      address: string;
      peakS: number;
      peakLafmaxDb: number;
      exceedHours: number;
    }
  > = {};
  receptors.forEach((r) => {
    receptorAccum[r.id] = {
      receptorCode: r.code,
      receptorName: r.name,
      address: r.address,
      peakS: 0,
      peakLafmaxDb: 45,
      exceedHours: 0,
    };
  });

  const dailyRows: WeeklyDayMeasurementRow[] = weekPairs.map((pair, idx) => {
    const hours = pair.actualDataset.hours;

    // Weather stats across all 24 hours
    const windSpeeds = hours.map((h) => h.windSpeed10m);
    const windGusts = hours.map((h) => h.windGusts10m);
    const temps = hours.map((h) => h.temperature2m);
    const meanWindMs = Number(
      (windSpeeds.reduce((s, v) => s + v, 0) / Math.max(1, windSpeeds.length)).toFixed(1)
    );
    const maxWindMs = Number(Math.max(...windSpeeds, 0).toFixed(1));
    const maxGustMs = Number(Math.max(...windGusts, 0).toFixed(1));
    const totalPrecipMm = Number(
      hours.reduce((s, h) => s + (h.precipitation ?? 0), 0).toFixed(1)
    );
    const highWindHoursCount = hours.filter(
      (h) => h.windSpeed10m > 10.0 || h.windGusts10m > 12.5
    ).length;
    const minTempC = Number(Math.min(...temps, 0).toFixed(1));
    const maxTempC = Number(Math.max(...temps, 0).toFixed(1));

    // Vector mean wind direction
    let sinSum = 0;
    let cosSum = 0;
    const pasquillFreq: Record<string, number> = {};
    hours.forEach((h) => {
      const rad = (h.windDirection10m * Math.PI) / 180;
      sinSum += Math.sin(rad) * Math.max(0.5, h.windSpeed10m);
      cosSum += Math.cos(rad) * Math.max(0.5, h.windSpeed10m);
      const pc = h.pasquillClass || 'D';
      pasquillFreq[pc] = (pasquillFreq[pc] ?? 0) + 1;
    });
    const dominantWindFromDeg = Math.round(
      ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360
    );
    const dominantPasquill =
      Object.entries(pasquillFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'D';

    // Dust & Noise simulation across representative hours
    let peakSumQuotientS = 0;
    let sumSAccum = 0;
    let dustExceedanceHoursS1 = 0;
    let dustWarningHoursS08 = 0;
    let cumulativeRespirableDustUgM2 = 0;
    let worstDustReceptorCode = receptors[0]?.code ?? 'R1';
    let worstDustReceptorName = receptors[0]?.name ?? 'Ringparken';

    let peakLaeqDb = 40.0;
    let peakLafmaxDb = 45.0;
    let noiseExceedanceHours = 0;
    let impulseOver85Hours = 0;

    SAMPLE_HOURS.forEach((hrIdx) => {
      const hr = hours[hrIdx] ?? hours[12] ?? hours[0];
      const sim = runDispersionSimulation(
        pair.dateIso,
        hr.hourIndex,
        hours,
        sources,
        receptors
      );

      const maxSiteS = sim.maxSiteSumQuotient ?? 0;
      sumSAccum += maxSiteS;
      if (maxSiteS > peakSumQuotientS) {
        peakSumQuotientS = maxSiteS;
        if (sim.worstExposedReceptor) {
          worstDustReceptorCode = sim.worstExposedReceptor.receptorCode;
          worstDustReceptorName = sim.worstExposedReceptor.receptorName;
        }
      }
      if (maxSiteS >= 1.0) dustExceedanceHoursS1 += HOURS_WEIGHT;
      else if (maxSiteS >= 0.8) dustWarningHoursS08 += HOURS_WEIGHT;

      const dryMultiplier = hr.precipitation < 0.2 ? 1.15 : 0.45;
      cumulativeRespirableDustUgM2 +=
        maxSiteS * (8.5 + hr.windSpeed10m * 1.1) * dryMultiplier * HOURS_WEIGHT;

      const noiseEval = computeHourlySiteNoiseForAudit({
        hr,
        activeSources,
        receptors,
        effectiveSiteLwaDb,
      });
      if (noiseEval.laeqDb > peakLaeqDb) peakLaeqDb = noiseEval.laeqDb;
      if (noiseEval.lafmaxDb > peakLafmaxDb) peakLafmaxDb = noiseEval.lafmaxDb;
      if (noiseEval.isExceeded) noiseExceedanceHours += HOURS_WEIGHT;
      if (noiseEval.isImpulseOver85) impulseOver85Hours += HOURS_WEIGHT;

      sim.receptorExposures.forEach((exp) => {
        const recAcc = receptorAccum[exp.receptorId];
        if (!recAcc) return;
        recAcc.peakS = Math.max(recAcc.peakS, exp.sumQuotient);
        recAcc.peakLafmaxDb = Math.max(recAcc.peakLafmaxDb, noiseEval.lafmaxDb);
        if (exp.sumQuotient >= 1.0) {
          recAcc.exceedHours += HOURS_WEIGHT;
        }
      });
    });

    const corroboratedComplaintsCount = observations.filter(
      (o) =>
        o.observedDateIso === pair.dateIso &&
        o.plumeCorroboration?.isInsideMathematicalPlume
    ).length;

    const meanSumQuotientS = Number(
      (sumSAccum / Math.max(1, SAMPLE_HOURS.length)).toFixed(2)
    );
    const peakSRounded = Number(peakSumQuotientS.toFixed(2));
    const dayAuditStatus: WeeklyDayAuditStatus =
      peakSRounded >= 1.0 || impulseOver85Hours > 0 || noiseExceedanceHours >= 6
        ? 'KRITISK AFVIGELSE'
        : peakSRounded >= 0.8 || highWindHoursCount >= 4 || noiseExceedanceHours > 0
        ? 'ANMÆRKNING'
        : 'GODKENDT';

    return {
      dayIndex: idx,
      dateIso: pair.dateIso,
      weekdayDa: pair.weekdayNameDa,
      dayShortDa: pair.dayLabelShort,
      weatherHeadline: pair.eventAnomalyHeadline,
      meanWindMs,
      maxWindMs,
      maxGustMs,
      dominantWindFromDeg,
      dominantWindCompass: degreesToCompass(dominantWindFromDeg),
      totalPrecipMm,
      highWindHoursCount,
      minTempC,
      maxTempC,
      dominantPasquill,
      peakSumQuotientS: peakSRounded,
      meanSumQuotientS,
      dustExceedanceHoursS1: Math.round(dustExceedanceHoursS1),
      dustWarningHoursS08: Math.round(dustWarningHoursS08),
      cumulativeRespirableDustUgM2: Number(cumulativeRespirableDustUgM2.toFixed(1)),
      worstDustReceptorCode,
      worstDustReceptorName,
      peakLaeqDb: Number(peakLaeqDb.toFixed(1)),
      peakLafmaxDb: Number(peakLafmaxDb.toFixed(1)),
      noiseExceedanceHours: Math.round(noiseExceedanceHours),
      impulseOver85Hours: Math.round(impulseOver85Hours),
      corroboratedComplaintsCount,
      dayAuditStatus,
    };
  });

  const periodStartIso = dailyRows[0]?.dateIso ?? dateIso;
  const periodEndIso = dailyRows[dailyRows.length - 1]?.dateIso ?? dateIso;
  const periodLabel = `${periodStartIso} til ${periodEndIso} (168 timer)`;

  const topExposedReceptors: WeeklyTopReceptorAuditSummary[] = Object.entries(
    receptorAccum
  )
    .map(([receptorId, v]) => ({
      receptorId,
      receptorCode: v.receptorCode,
      receptorName: v.receptorName,
      address: v.address,
      weeklyPeakS: Number(v.peakS.toFixed(2)),
      weeklyPeakLafmaxDb: Number(v.peakLafmaxDb.toFixed(1)),
      totalExceedanceHours: Math.round(v.exceedHours),
    }))
    .sort((a, b) => b.weeklyPeakS - a.weeklyPeakS || b.totalExceedanceHours - a.totalExceedanceHours)
    .slice(0, 4);

  const weeklyPeakSumQuotientS = Number(
    Math.max(...dailyRows.map((d) => d.peakSumQuotientS), 0).toFixed(2)
  );
  const totalDustExceedanceHours = dailyRows.reduce(
    (s, d) => s + d.dustExceedanceHoursS1,
    0
  );
  const totalDustWarningHours = dailyRows.reduce(
    (s, d) => s + d.dustWarningHoursS08,
    0
  );
  const weeklyTotalDustUgM2 = Number(
    dailyRows.reduce((s, d) => s + d.cumulativeRespirableDustUgM2, 0).toFixed(1)
  );

  const weeklyPeakLaeqDb = Number(
    Math.max(...dailyRows.map((d) => d.peakLaeqDb), 0).toFixed(1)
  );
  const weeklyPeakLafmaxDb = Number(
    Math.max(...dailyRows.map((d) => d.peakLafmaxDb), 0).toFixed(1)
  );
  const totalNoiseExceedanceHours = dailyRows.reduce(
    (s, d) => s + d.noiseExceedanceHours,
    0
  );
  const totalImpulseOver85Hours = dailyRows.reduce(
    (s, d) => s + d.impulseOver85Hours,
    0
  );

  const weeklyMeanWindMs = Number(
    (
      dailyRows.reduce((s, d) => s + d.meanWindMs, 0) /
      Math.max(1, dailyRows.length)
    ).toFixed(1)
  );
  const weeklyMaxWindMs = Number(
    Math.max(...dailyRows.map((d) => d.maxWindMs), 0).toFixed(1)
  );
  const weeklyMaxGustMs = Number(
    Math.max(...dailyRows.map((d) => d.maxGustMs), 0).toFixed(1)
  );
  const totalPrecipMm = Number(
    dailyRows.reduce((s, d) => s + d.totalPrecipMm, 0).toFixed(1)
  );
  const totalHighWindHours = dailyRows.reduce(
    (s, d) => s + d.highWindHoursCount,
    0
  );
  const totalCorroboratedComplaints = dailyRows.reduce(
    (s, d) => s + d.corroboratedComplaintsCount,
    0
  );

  const criticalDays = dailyRows.filter(
    (d) => d.dayAuditStatus === 'KRITISK AFVIGELSE'
  ).length;
  const warningDays = dailyRows.filter(
    (d) => d.dayAuditStatus === 'ANMÆRKNING'
  ).length;

  const overallAuditVerdict: WeeklyExternalAuditSummary['overallAuditVerdict'] =
    criticalDays > 0 || weeklyPeakSumQuotientS >= 1.0 || totalImpulseOver85Hours > 0
      ? 'IKKE GODKENDT — KRITISK OVERSKRIDELSE'
      : warningDays > 0 || totalHighWindHours > 0
      ? 'BETINGET — KRÆVER AFHJÆLPNING'
      : 'GODKENDT UDEN ANMÆRKNINGER';

  const auditFindingsSummaryDa: string[] = [
    `Støv & Asbest (BEK 613/2026): Maksimal sum-kvotient målt til S=${weeklyPeakSumQuotientS.toFixed(
      2
    )} (${totalDustExceedanceHours} kritiske timer S>=1,0 og ${weeklyTotalDustUgM2.toFixed(
      1
    )} µg/m² kumulativ respirabel støvdeposition).`,
    `Støj & Impulser (MST Vejl. 5/1984): Spidsbelastning nåede L_AFmax ${weeklyPeakLafmaxDb.toFixed(
      1
    )} dB(A) (L_Aeq ${weeklyPeakLaeqDb.toFixed(
      1
    )} dB(A)), heraf ${totalImpulseOver85Hours} timer >85 dB(A) impulsgrænse ved aktive kilder (${effectiveSiteLwaDb.toFixed(
      0
    )} dB L_WA).`,
    `Vejr & Spredningsklima (Open-Meteo 168t): Middelvind ${weeklyMeanWindMs.toFixed(
      1
    )} m/s, maks. vindstød ${weeklyMaxGustMs.toFixed(
      1
    )} m/s, ${totalHighWindHours} timer over 10 m/s høj-vindstærskel og samlet nedbør ${totalPrecipMm.toFixed(
      1
    )} mm.`,
    `Ekstern Revisionskonklusion: ${criticalDays} døgn med kritisk afvigelse og ${warningDays} døgn med anmærkning ud af 7 døgn (${totalCorroboratedComplaints} fane-bekræftede naboklager).`,
  ];

  const activeSourcesSummaryDa =
    activeSources.length > 0
      ? activeSources.map((s) => `${s.code} (${s.name})`).join(', ')
      : 'Ingen aktive nedrivningskilder';

  const auditSha256 = deterministicHexHash256(
    `WEEKLY_EXTERNAL_AUDIT|${periodStartIso}|${periodEndIso}|S:${weeklyPeakSumQuotientS}|DB:${weeklyPeakLafmaxDb}|WIND:${weeklyMaxGustMs}|DAYS:${dailyRows
      .map((d) => `${d.dateIso}:${d.peakSumQuotientS}:${d.peakLafmaxDb}`)
      .join(';')}`
  );

  return {
    reportId: `EXT-REV-${periodEndIso.replace(/-/g, '')}`,
    periodStartIso,
    periodEndIso,
    periodLabel,
    totalHoursAnalyzed: weekPairs.length * 24,
    activeSourcesCount: activeSources.length,
    activeSourcesSummaryDa,
    effectiveSiteLwaDb,
    dailyRows,
    topExposedReceptors,
    weeklyPeakSumQuotientS,
    totalDustExceedanceHours,
    totalDustWarningHours,
    weeklyTotalDustUgM2,
    weeklyPeakLaeqDb,
    weeklyPeakLafmaxDb,
    totalNoiseExceedanceHours,
    totalImpulseOver85Hours,
    weeklyMeanWindMs,
    weeklyMaxWindMs,
    weeklyMaxGustMs,
    totalPrecipMm,
    totalHighWindHours,
    totalCorroboratedComplaints,
    overallAuditVerdict,
    auditFindingsSummaryDa,
    auditSha256,
    merkleRootSignature,
  };
}

/**
 * Genererer og downloader en omfattende 2-siders A4 PDF-rapport for den seneste uges
 * miljømålinger (Støj, Støv og Vejr) formateret til ekstern revision.
 */
export function generateWeeklyExternalAuditPdf(
  params: BuildWeeklyExternalAuditParams & { dryRun?: boolean }
): {
  fileName: string;
  summary: WeeklyExternalAuditSummary;
  exportedAtIso: string;
} {
  const summary = buildWeeklyExternalAuditSummary(params);
  const exportedAtIso = new Date().toISOString();
  const fileName = `Ringparken_Ekstern_Revision_Ugerapport_${summary.periodEndIso}.pdf`;

  if (params.dryRun) {
    return { fileName, summary, exportedAtIso };
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // === SIDE 1: HOVEDOVERSIGT, KPI & 7-DØGNS REVISIONS-TABEL ===
  doc.setFillColor(11, 15, 25);
  doc.rect(0, 0, 210, 38, 'F');
  doc.setTextColor(34, 211, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(
    sanitizePdfText('EKSTERN MILJØREVISION: SENESTE UGES MÅLERAPPORT (STØJ, STØV & VEJR)'),
    14,
    12.5
  );

  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.text(
    sanitizePdfText(
      `Lokalitet: Ringparken, 4200 Slagelse · Revisionsperiode: ${summary.periodLabel}`
    ),
    14,
    19.5
  );
  doc.text(
    sanitizePdfText(
      `Rapport-ID: ${summary.reportId} · Aktive kilder: ${summary.activeSourcesCount} (${summary.effectiveSiteLwaDb.toFixed(
        0
      )} dB L_WA) · Norm: ISO 19011 / BEK 613/2026 / MST Vejl. 5/1984`
    ),
    14,
    25.2
  );
  doc.setTextColor(52, 211, 153);
  doc.text(
    sanitizePdfText(
      `SHA-256 Revisionssegl: ${summary.auditSha256}${
        summary.merkleRootSignature
          ? ` · Merkle: ${summary.merkleRootSignature.slice(0, 14)}...`
          : ''
      }`
    ),
    14,
    31.4
  );

  // Revisionskonklusion-banner
  let y = 43;
  const isCritical = summary.overallAuditVerdict.startsWith('IKKE GODKENDT');
  const isWarning = summary.overallAuditVerdict.startsWith('BETINGET');
  doc.setFillColor(
    isCritical ? 254 : isWarning ? 255 : 236,
    isCritical ? 242 : isWarning ? 251 : 253,
    isCritical ? 242 : isWarning ? 235 : 245
  );
  doc.setDrawColor(
    isCritical ? 225 : isWarning ? 217 : 16,
    isCritical ? 29 : isWarning ? 119 : 185,
    isCritical ? 72 : isWarning ? 6 : 129
  );
  doc.roundedRect(14, y, 182, 10, 1.5, 1.5, 'FD');
  doc.setTextColor(
    isCritical ? 153 : isWarning ? 146 : 6,
    isCritical ? 27 : isWarning ? 64 : 95,
    isCritical ? 27 : isWarning ? 14 : 70
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.text(
    sanitizePdfText(`SAMLET REVISIONSVURDERING: ${summary.overallAuditVerdict}`),
    17,
    y + 6.4
  );

  // 4 Domæne-KPI bokse
  y += 14;
  const kpis = [
    {
      label: 'STØV (MAKS S / TID)',
      val: `S=${summary.weeklyPeakSumQuotientS.toFixed(2)} (${summary.totalDustExceedanceHours}t)`,
      sub: `${summary.weeklyTotalDustUgM2.toFixed(0)} ug/m2 kum.`,
      rgb: [225, 29, 72] as [number, number, number],
    },
    {
      label: 'STØJ (L_AFmax / >85dB)',
      val: `${summary.weeklyPeakLafmaxDb.toFixed(1)} dB(A)`,
      sub: `${summary.totalImpulseOver85Hours}t >85dB · ${summary.totalNoiseExceedanceHours}t brud`,
      rgb: [217, 119, 6] as [number, number, number],
    },
    {
      label: 'VEJR (VIND / NEDBØR)',
      val: `Stød ${summary.weeklyMaxGustMs.toFixed(1)} m/s`,
      sub: `${summary.totalHighWindHours}t >10 m/s · ${summary.totalPrecipMm.toFixed(1)} mm`,
      rgb: [2, 132, 199] as [number, number, number],
    },
    {
      label: 'DATAGRUNDLAG',
      val: `${summary.totalHoursAnalyzed} timer`,
      sub: `${summary.totalCorroboratedComplaints} bekræft. klager`,
      rgb: [15, 118, 110] as [number, number, number],
    },
  ];
  kpis.forEach((k, idx) => {
    const bx = 14 + idx * 46.5;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(bx, y, 44, 17, 1.5, 1.5, 'FD');
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(sanitizePdfText(k.label), bx + 2.5, y + 4.8);
    doc.setTextColor(k.rgb[0], k.rgb[1], k.rgb[2]);
    doc.setFontSize(8.4);
    doc.text(sanitizePdfText(k.val), bx + 2.5, y + 10.2);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.text(sanitizePdfText(k.sub), bx + 2.5, y + 14.8);
  });

  // Sektion 1: Døgn-for-døgn revisionslog (Støj, Støv & Vejr)
  y += 23;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.text(
    sanitizePdfText('1. SENESTE 7 DØGNS MILJØMÅLINGER (STØJ, STØV & VEJR PR. DØGN)'),
    14,
    y
  );
  y += 4;

  doc.setFillColor(15, 23, 42);
  doc.rect(14, y, 182, 7.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.8);
  doc.text('Dato / Dag', 16, y + 5);
  doc.text('Vind (Middel/Stød)', 43, y + 5);
  doc.text('Nedbør', 75, y + 5);
  doc.text('Maks Støv S', 92, y + 5);
  doc.text('S>=1 (t)', 113, y + 5);
  doc.text('Maks Støj', 129, y + 5);
  doc.text('Støj >85dB', 150, y + 5);
  doc.text('Revisionsstatus', 171, y + 5);
  y += 7.5;

  summary.dailyRows.forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, 182, 10, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y + 10, 196, y + 10);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.1);
    doc.text(sanitizePdfText(`${row.dateIso}`), 16, y + 4.4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      sanitizePdfText(`${row.weekdayDa} · ${row.dominantWindCompass} ${row.dominantWindFromDeg}°`),
      16,
      y + 8.4
    );

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(7);
    doc.text(
      sanitizePdfText(`${row.meanWindMs.toFixed(1)} / ${row.maxGustMs.toFixed(1)} m/s`),
      43,
      y + 6.2
    );
    doc.text(sanitizePdfText(`${row.totalPrecipMm.toFixed(1)} mm`), 75, y + 6.2);

    if (row.peakSumQuotientS >= 1.0) doc.setTextColor(185, 28, 28);
    else if (row.peakSumQuotientS >= 0.8) doc.setTextColor(180, 83, 9);
    else doc.setTextColor(15, 118, 110);
    doc.setFont('helvetica', 'bold');
    doc.text(sanitizePdfText(`S=${row.peakSumQuotientS.toFixed(2)}`), 92, y + 6.2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(`${row.dustExceedanceHoursS1} t`), 113, y + 6.2);

    if (row.peakLafmaxDb > 85) doc.setTextColor(185, 28, 28);
    else doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(sanitizePdfText(`${row.peakLafmaxDb.toFixed(1)} dB`), 129, y + 6.2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(`${row.impulseOver85Hours} t`), 150, y + 6.2);

    if (row.dayAuditStatus === 'KRITISK AFVIGELSE') doc.setTextColor(185, 28, 28);
    else if (row.dayAuditStatus === 'ANMÆRKNING') doc.setTextColor(180, 83, 9);
    else doc.setTextColor(5, 150, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(sanitizePdfText(row.dayAuditStatus), 171, y + 6.2);

    y += 10;
  });

  // Sektion 2: Mest belastede receptorer i ugen
  y += 8;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.text(
    sanitizePdfText('2. MEST EKSPONEREDE NABORECEPTORER (7-DØGNS REVISIONSOVERSIGT)'),
    14,
    y
  );
  y += 4.5;

  summary.topExposedReceptors.forEach((rec, idx) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, y, 182, 10.5, 1.2, 1.2, 'FD');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.text(
      sanitizePdfText(`#${idx + 1} ${rec.receptorCode} - ${rec.receptorName} (${rec.address})`),
      17,
      y + 4.4
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.1);
    doc.setTextColor(71, 85, 105);
    doc.text(
      sanitizePdfText(
        `Maks støveksponering: S=${rec.weeklyPeakS.toFixed(2)} · Maks L_AFmax: ${rec.weeklyPeakLafmaxDb.toFixed(
          1
        )} dB(A) · Overskridelsestimer (S>=1): ${rec.totalExceedanceHours} timer`
      ),
      17,
      y + 8.8
    );
    y += 12;
  });

  // Sektion 3: Revisionsfund & lovgrundlag
  y += 4;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.text(sanitizePdfText('3. REVISIONSMÆSSIGE KONKLUSIONER'), 14, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(51, 65, 85);
  summary.auditFindingsSummaryDa.forEach((line) => {
    const wrapped = doc.splitTextToSize(sanitizePdfText(`- ${line}`), 180);
    doc.text(wrapped, 15, y);
    y += wrapped.length * 3.8 + 1.4;
  });

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(6.8);
  doc.text(
    sanitizePdfText(
      `Side 1/2 · Genereret UTC: ${exportedAtIso} · SHA-256: ${summary.auditSha256}`
    ),
    14,
    287
  );

  // === SIDE 2: VEKTORGRAFER (VEJR, STØJ, STØV) & EKSTERN REVISOR-PÅTEGNING ===
  doc.addPage();
  doc.setFillColor(11, 15, 25);
  doc.rect(0, 0, 210, 22, 'F');
  doc.setTextColor(34, 211, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(
    sanitizePdfText('BILAG: 7-DØGNS TIDSGRÆNSER & MÅLEKURVER FOR EKSTERN REVISION'),
    14,
    11
  );
  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.text(
    sanitizePdfText(`Rapport-ID: ${summary.reportId} · Periode: ${summary.periodLabel}`),
    14,
    17.5
  );

  const drawWeeklyBarLineChart = (cfg: {
    x: number;
    y: number;
    w: number;
    h: number;
    title: string;
    unit: string;
    maxVal: number;
    limitVal: number;
    limitLabel: string;
    bars: Array<{ label: string; primary: number; secondary?: number }>;
    primaryRgb: [number, number, number];
    secondaryRgb?: [number, number, number];
  }) => {
    const { x, y: cy, w, h, title, maxVal, limitVal, limitLabel, bars, primaryRgb, secondaryRgb } = cfg;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x, cy, w, h, 1.5, 1.5, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.text(sanitizePdfText(title), x + 4, cy + 6);

    const px = x + 14;
    const py = cy + 10;
    const pw = w - 20;
    const ph = h - 20;

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.line(px, py, px, py + ph);
    doc.line(px, py + ph, px + pw, py + ph);

    const yFor = (val: number) =>
      py + ph - (Math.min(maxVal, Math.max(0, val)) / Math.max(0.001, maxVal)) * ph;

    // Limit line
    const yLim = yFor(limitVal);
    doc.setDrawColor(225, 29, 72);
    doc.setLineWidth(0.45);
    doc.line(px, yLim, px + pw, yLim);
    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.text(sanitizePdfText(limitLabel), x + 2, yLim + 1);

    const slotW = pw / Math.max(1, bars.length);
    bars.forEach((b, i) => {
      const bx = px + i * slotW + slotW * 0.2;
      const bw = secondaryRgb ? slotW * 0.28 : slotW * 0.56;
      const top1 = yFor(b.primary);
      doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
      doc.rect(bx, top1, bw, Math.max(0.8, py + ph - top1), 'F');

      if (secondaryRgb && typeof b.secondary === 'number') {
        const top2 = yFor(b.secondary);
        doc.setFillColor(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]);
        doc.rect(bx + bw + 1, top2, bw, Math.max(0.8, py + ph - top2), 'F');
      }

      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.3);
      doc.text(sanitizePdfText(b.label), bx, py + ph + 4.2);

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.text(sanitizePdfText(b.primary.toFixed(1)), bx, Math.max(py + 3, top1 - 1.2));
    });
  };

  let y2 = 28;
  drawWeeklyBarLineChart({
    x: 14,
    y: y2,
    w: 182,
    h: 54,
    title: 'A. STØV-EKSPONERING: DAGLIG MAKS. SUM-KVOTIENT (S) VS. LOVGRÆNSE (S = 1,0)',
    unit: 'S',
    maxVal: Math.max(1.8, summary.weeklyPeakSumQuotientS * 1.15),
    limitVal: 1.0,
    limitLabel: 'S=1.0',
    bars: summary.dailyRows.map((d) => ({
      label: d.dateIso.slice(5),
      primary: d.peakSumQuotientS,
      secondary: d.meanSumQuotientS,
    })),
    primaryRgb: [225, 29, 72],
    secondaryRgb: [245, 158, 11],
  });

  y2 += 59;
  drawWeeklyBarLineChart({
    x: 14,
    y: y2,
    w: 182,
    h: 54,
    title: 'B. STØJ & IMPULSER: MAKS. L_AFmax & L_Aeq (dB(A)) VS. IMPULSGRÆNSE (85 dB)',
    unit: 'dB',
    maxVal: Math.max(100, summary.weeklyPeakLafmaxDb + 8),
    limitVal: 85,
    limitLabel: '85 dB',
    bars: summary.dailyRows.map((d) => ({
      label: d.dateIso.slice(5),
      primary: d.peakLafmaxDb,
      secondary: d.peakLaeqDb,
    })),
    primaryRgb: [217, 119, 6],
    secondaryRgb: [14, 116, 144],
  });

  y2 += 59;
  drawWeeklyBarLineChart({
    x: 14,
    y: y2,
    w: 182,
    h: 54,
    title: 'C. VEJR & VINDSTØD: MAKS. VINDSTØD & MIDDELVIND (m/s) VS. BEREDSKAB (10 m/s)',
    unit: 'm/s',
    maxVal: Math.max(18, summary.weeklyMaxGustMs + 3),
    limitVal: 10,
    limitLabel: '10 m/s',
    bars: summary.dailyRows.map((d) => ({
      label: d.dateIso.slice(5),
      primary: d.maxGustMs,
      secondary: d.meanWindMs,
    })),
    primaryRgb: [2, 132, 199],
    secondaryRgb: [56, 189, 248],
  });

  // Ekstern Revisor Påtegning & Verifikationsboks
  y2 += 60;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(148, 163, 184);
  doc.roundedRect(14, y2, 182, 34, 1.5, 1.5, 'FD');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(
    sanitizePdfText('EKSTERN REVISION & MYNDIGHEDSVERIFIKATION (ISO 19011 / ISO/IEC 27037)'),
    17,
    y2 + 6
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(51, 65, 85);
  doc.text(
    sanitizePdfText(
      `Dokumentet er automatisk sammenstillet over 168 timers måle- og simuleringsdata for Ringparken, Slagelse.`
    ),
    17,
    y2 + 11.5
  );
  doc.text(
    sanitizePdfText(`Kryptografisk SHA-256 kontrolsum: ${summary.auditSha256}`),
    17,
    y2 + 16.5
  );
  doc.text(
    sanitizePdfText(
      `Ekstern revisor / Tilsynsførende: ___________________________   Dato & Underskrift: ______________________`
    ),
    17,
    y2 + 27
  );

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(6.8);
  doc.text(
    sanitizePdfText(
      `Side 2/2 · Genereret UTC: ${exportedAtIso} · Slagelse Kommune Ekstern Miljørevision`
    ),
    14,
    287
  );

  doc.save(fileName);
  return { fileName, summary, exportedAtIso };
}
