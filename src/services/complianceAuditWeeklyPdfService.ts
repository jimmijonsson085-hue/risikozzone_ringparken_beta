/**
 * @file src/services/complianceAuditWeeklyPdfService.ts
 * @description Dedikeret PDF-rapportskabelon til ComplianceAuditPanel, der opsummerer
 * alle uge-overskridelser pr. bygningskategori samt tegner visuelle vektorgrafer over
 * S-kvotient tendenser for de mest belastede receptorer.
 */

import { jsPDF } from 'jspdf';
import {
  BUILDING_CATEGORY_METADATA,
  deriveReceptorsFromBuildings,
  deriveSourcesFromBuildings,
} from '../data/ringparkenData';
import {
  AlgedonicObservation,
  BuildingOperationalCategory,
  DemolitionSourceNode,
  PuffAccumulationResult,
  ReceptorZone,
  RingparkenBuildingUnit,
} from '../types/dispersion';
import {
  deterministicHexHash256,
  haversineMetersBetween,
} from './autonomousReceptorMeshService';
import { runDispersionSimulation } from './dispersionEngine';
import { buildLastWeekPredictedVsActualWeatherPairs } from './weatherService';

export interface BuildingCategoryWeeklyExceedanceSummary {
  category: BuildingOperationalCategory;
  labelDa: string;
  colorHex: string;
  buildingCount: number;
  dwellingsCount: number;
  daysWithSOver1: number;
  daysWithSOver08: number;
  weeklyExceedanceHoursS1: number;
  weeklyWarningHoursS08: number;
  weeklyNoiseExceedanceHours: number;
  peakSumQuotientS: number;
  peakWindSpeedMs: number;
  worstBuildingLabel: string;
}

export interface ReceptorWeeklyTrendSeries {
  receptorId: string;
  receptorCode: string;
  receptorName: string;
  address: string;
  buildingCategoryLabelDa: string;
  peakSumQuotientS: number;
  cumulative24hDoseSt: number;
  weeklyDaysOver1: number;
  daily7DayPeakS: Array<{ dayLabel: string; dateIso: string; maxS: number }>;
  hourly24hS: Array<{ hourIndex: number; hourLabel: string; sVal: number }>;
}

export interface WeeklyAuditReportDataset {
  baseDateIso: string;
  periodLabel: string;
  categorySummaries: BuildingCategoryWeeklyExceedanceSummary[];
  topReceptorTrends: ReceptorWeeklyTrendSeries[];
  totalWeeklyExceedanceHours: number;
  totalCategoryDaysOver1: number;
  reportSha256: string;
}

export interface AuditCaseSummaryForPdf {
  caseNumber: string;
  addressLabel: string;
  titleDa: string;
  areaM2: number;
  bek496StatusDa: string;
}

export interface AuditDiscrepancyForPdf {
  category: string;
  severity: string;
  titleDa: string;
  statutoryImpactDa: string;
}

export interface GenerateComplianceAuditWeeklyPdfParams {
  dateIso: string;
  buildings: RingparkenBuildingUnit[];
  sources?: DemolitionSourceNode[];
  receptors?: ReceptorZone[];
  puff24h?: PuffAccumulationResult | null;
  observations?: AlgedonicObservation[];
  permitCases: AuditCaseSummaryForPdf[];
  discrepancies: AuditDiscrepancyForPdf[];
  workHoursStatusDa: string;
}

const ORDERED_CATEGORIES: BuildingOperationalCategory[] = [
  'd_under_demolition',
  'e_demolished_unsecured',
  'c_under_renovation',
  'a_inhabited',
  'b_vacant',
];

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean.length === 6 ? clean : '38bdf8', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Aggregerer deterministisk alle uge-overskridelser (7 dage) for hver af de 5 bygningskategorier
 * samt S-kvotient tendenskurver for de mest belastede receptorer i Ringparken.
 */
export function buildWeeklyCategoryExceedanceAndTrends(params: {
  dateIso: string;
  buildings: RingparkenBuildingUnit[];
  sources?: DemolitionSourceNode[];
  receptors?: ReceptorZone[];
  puff24h?: PuffAccumulationResult | null;
}): WeeklyAuditReportDataset {
  const { dateIso, buildings, puff24h } = params;
  const effectiveSources =
    params.sources && params.sources.length > 0
      ? params.sources
      : deriveSourcesFromBuildings(buildings);
  const effectiveReceptors =
    params.receptors && params.receptors.length > 0
      ? params.receptors
      : deriveReceptorsFromBuildings(buildings);

  const weekPairs = buildLastWeekPredictedVsActualWeatherPairs(dateIso);
  const periodLabel =
    weekPairs.length > 0
      ? `${weekPairs[0].dateIso} til ${weekPairs[weekPairs.length - 1].dateIso} (7 døgn)`
      : `${dateIso} (7 døgn)`;

  // Map hvert bygningsid til nærmeste receptor eller egen receptor
  const nearestReceptorIdForBuilding = (b: RingparkenBuildingUnit): string => {
    const direct = effectiveReceptors.find((r) => r.buildingUnitId === b.id);
    if (direct) return direct.id;
    let bestId = effectiveReceptors[0]?.id ?? '';
    let bestDist = Infinity;
    effectiveReceptors.forEach((r) => {
      const d = haversineMetersBetween(b.center, r.center);
      if (d < bestDist) {
        bestDist = d;
        bestId = r.id;
      }
    });
    return bestId;
  };

  // Beregn daglig S-kvotient eksponering for alle receptorer på de mest kritiske dagstimer (kl. 08, 12, 16)
  // samt uge-overskridelsesmetrics pr. dag (skaleret deterministisk til 24t arbejds-/døgnprofil)
  const receptorDailyMaxS: Record<
    string,
    Array<{ dayLabel: string; dateIso: string; maxS: number; exceedHoursS1: number; warnHoursS08: number; peakWindMs: number; noiseExceedHours: number }>
  > = {};
  effectiveReceptors.forEach((r) => {
    receptorDailyMaxS[r.id] = [];
  });

  weekPairs.forEach((pair) => {
    const hours = pair.actualDataset.hours;
    const sampleHours = [8, 11, 13, 15].map((h) => hours[h] ?? hours[12] ?? hours[0]);
    const dayStatsByRec: Record<
      string,
      { maxS: number; exceedHoursS1: number; warnHoursS08: number; peakWindMs: number; noiseExceedHours: number }
    > = {};
    effectiveReceptors.forEach((r) => {
      dayStatsByRec[r.id] = {
        maxS: 0,
        exceedHoursS1: 0,
        warnHoursS08: 0,
        peakWindMs: 0,
        noiseExceedHours: 0,
      };
    });

    sampleHours.forEach((hr) => {
      const sim = runDispersionSimulation(
        pair.dateIso,
        hr.hourIndex,
        hours,
        effectiveSources,
        effectiveReceptors
      );
      sim.receptorExposures.forEach((exp) => {
        const st = dayStatsByRec[exp.receptorId];
        if (!st) return;
        st.maxS = Math.max(st.maxS, exp.sumQuotient);
        st.peakWindMs = Math.max(st.peakWindMs, hr.windSpeed10m);
        if (exp.sumQuotient >= 1.0) st.exceedHoursS1 += 2;
        if (exp.sumQuotient >= 0.8) st.warnHoursS08 += 2;
        if (hr.windSpeed10m > 9.0 || exp.sumQuotient >= 0.65) st.noiseExceedHours += 2;
      });
    });

    effectiveReceptors.forEach((r) => {
      receptorDailyMaxS[r.id].push({
        dayLabel: pair.weekdayNameDa.slice(0, 3),
        dateIso: pair.dateIso,
        ...dayStatsByRec[r.id],
      });
    });
  });

  // Opsummer pr. bygningskategori
  const categorySummaries: BuildingCategoryWeeklyExceedanceSummary[] =
    ORDERED_CATEGORIES.map((cat) => {
      const meta = BUILDING_CATEGORY_METADATA[cat];
      const catBuildings = buildings.filter((b) => b.category === cat);
      const dwellingsCount = catBuildings.reduce((s, b) => s + (b.dwellingsCount ?? 0), 0);

      let daysWithSOver1 = 0;
      let daysWithSOver08 = 0;
      let weeklyExceedanceHoursS1 = 0;
      let weeklyWarningHoursS08 = 0;
      let weeklyNoiseExceedanceHours = 0;
      let peakSumQuotientS = 0;
      let peakWindSpeedMs = 0;
      let worstBuildingLabel = catBuildings[0]?.name ?? 'Ingen bygninger';
      let worstBuildingPeakS = -1;

      const dayHitOver1 = new Array(weekPairs.length).fill(false);
      const dayHitOver08 = new Array(weekPairs.length).fill(false);

      catBuildings.forEach((b) => {
        const recId = nearestReceptorIdForBuilding(b);
        const daily = receptorDailyMaxS[recId] ?? [];
        // Kilde-bygninger under nedrivning/usikret har højere nærzone-S ved aktivt arbejde
        const categorySourceMultiplier =
          cat === 'd_under_demolition'
            ? 1.45
            : cat === 'e_demolished_unsecured'
            ? 1.25
            : cat === 'c_under_renovation'
            ? 1.12
            : cat === 'b_vacant'
            ? 0.85
            : 1.0;

        let bPeak = 0;
        daily.forEach((d, dayIdx) => {
          const adjS = Number((d.maxS * categorySourceMultiplier).toFixed(2));
          bPeak = Math.max(bPeak, adjS);
          peakSumQuotientS = Math.max(peakSumQuotientS, adjS);
          peakWindSpeedMs = Math.max(peakWindSpeedMs, d.peakWindMs);
          if (adjS >= 1.0) {
            dayHitOver1[dayIdx] = true;
            weeklyExceedanceHoursS1 += Math.max(1, d.exceedHoursS1);
          }
          if (adjS >= 0.8) {
            dayHitOver08[dayIdx] = true;
            weeklyWarningHoursS08 += Math.max(1, d.warnHoursS08);
          }
          if (cat !== 'b_vacant' && d.noiseExceedHours > 0) {
            weeklyNoiseExceedanceHours += d.noiseExceedHours;
          }
        });

        if (bPeak > worstBuildingPeakS) {
          worstBuildingPeakS = bPeak;
          worstBuildingLabel = b.name;
        }
      });

      daysWithSOver1 = dayHitOver1.filter(Boolean).length;
      daysWithSOver08 = dayHitOver08.filter(Boolean).length;

      return {
        category: cat,
        labelDa: meta.labelDa,
        colorHex: meta.colorHex,
        buildingCount: catBuildings.length,
        dwellingsCount,
        daysWithSOver1,
        daysWithSOver08,
        weeklyExceedanceHoursS1,
        weeklyWarningHoursS08,
        weeklyNoiseExceedanceHours,
        peakSumQuotientS: Number(peakSumQuotientS.toFixed(2)),
        peakWindSpeedMs: Number(peakWindSpeedMs.toFixed(1)),
        worstBuildingLabel,
      };
    });

  // Top 4 mest belastede receptorer med S-kvotient tendenser (7-døgns + 24-timers profil)
  const topReceptorTrends: ReceptorWeeklyTrendSeries[] = effectiveReceptors
    .map((rec) => {
      const daily = receptorDailyMaxS[rec.id] ?? [];
      const peakFromWeek = daily.reduce((m, d) => Math.max(m, d.maxS), 0);
      const puffSummary = puff24h?.receptorSummaries.find((p) => p.receptorId === rec.id);
      const peakFromPuff = puffSummary?.peakSumQuotient ?? 0;
      const peakSumQuotientS = Number(Math.max(peakFromWeek, peakFromPuff).toFixed(2));
      const matchedBuilding = buildings.find((b) => b.id === rec.buildingUnitId);
      const buildingCategoryLabelDa = matchedBuilding
        ? BUILDING_CATEGORY_METADATA[matchedBuilding.category].labelDa
        : 'Receptorzone';

      const hourly24hS = puffSummary
        ? puffSummary.hourlyProfile.slice(0, 24).map((h) => ({
            hourIndex: h.hourIndex,
            hourLabel: h.hourLabel,
            sVal: Number(h.sumQuotient.toFixed(2)),
          }))
        : Array.from({ length: 24 }, (_, hrIdx) => {
            const factor =
              hrIdx >= 7 && hrIdx <= 17
                ? 0.65 + 0.35 * Math.sin(((hrIdx - 7) / 10) * Math.PI)
                : 0.18;
            return {
              hourIndex: hrIdx,
              hourLabel: `${String(hrIdx).padStart(2, '0')}:00`,
              sVal: Number((peakSumQuotientS * factor).toFixed(2)),
            };
          });

      return {
        receptorId: rec.id,
        receptorCode: rec.code,
        receptorName: rec.name,
        address: rec.address,
        buildingCategoryLabelDa,
        peakSumQuotientS,
        cumulative24hDoseSt: Number(
          (
            puffSummary?.cumulativeSumDose ??
            hourly24hS.reduce((s, p) => s + p.sVal, 0)
          ).toFixed(1)
        ),
        weeklyDaysOver1: daily.filter((d) => d.maxS >= 1.0).length,
        daily7DayPeakS: daily.map((d) => ({
          dayLabel: d.dayLabel,
          dateIso: d.dateIso,
          maxS: Number(d.maxS.toFixed(2)),
        })),
        hourly24hS,
      };
    })
    .sort((a, b) => b.peakSumQuotientS - a.peakSumQuotientS || b.cumulative24hDoseSt - a.cumulative24hDoseSt)
    .slice(0, 4);

  const totalWeeklyExceedanceHours = categorySummaries.reduce(
    (s, c) => s + c.weeklyExceedanceHoursS1,
    0
  );
  const totalCategoryDaysOver1 = categorySummaries.reduce(
    (s, c) => s + c.daysWithSOver1,
    0
  );

  const reportSha256 = deterministicHexHash256(
    `AUDIT_WEEKLY_PDF|${dateIso}|${categorySummaries
      .map((c) => `${c.category}:${c.weeklyExceedanceHoursS1}:${c.peakSumQuotientS}`)
      .join('|')}|${topReceptorTrends.map((t) => `${t.receptorCode}:${t.peakSumQuotientS}`).join('|')}`
  );

  return {
    baseDateIso: dateIso,
    periodLabel,
    categorySummaries,
    topReceptorTrends,
    totalWeeklyExceedanceHours,
    totalCategoryDaysOver1,
    reportSha256,
  };
}

/**
 * Genererer og downloader den dedikerede ComplianceAuditPanel PDF-rapport med
 * uge-overskridelser pr. bygningskategori og visuelle S-kvotient tendensgrafer.
 */
export function downloadComplianceAuditWeeklyPdfReport(
  params: GenerateComplianceAuditWeeklyPdfParams
): { fileName: string; dataset: WeeklyAuditReportDataset } {
  const dataset = buildWeeklyCategoryExceedanceAndTrends({
    dateIso: params.dateIso,
    buildings: params.buildings,
    sources: params.sources,
    receptors: params.receptors,
    puff24h: params.puff24h,
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const exportedAtIso = new Date().toISOString();

  // Top Header Banner
  doc.setFillColor(11, 15, 25);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setTextColor(34, 211, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('COMPLIANCE-AUDIT: UGE-OVERSKRIDELSER & S-KVOTIENT TENDENSER', 14, 12.5);

  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.text(
    `Ringparken, 4200 Slagelse · Periode: ${dataset.periodLabel} · Arbejdstid: ${params.workHoursStatusDa}`,
    14,
    19.5
  );
  doc.text(
    `Sager: 25-019352, 25-019350, 25-019157, 25-019354 · Hjemmel: BEK 496/2024, BEK 1328/2025, BEK 613/2026`,
    14,
    25
  );
  doc.setTextColor(52, 211, 153);
  doc.text(`SHA-256 Dokument-Segl: ${dataset.reportSha256}`, 14, 30.8);

  // KPI Stribe
  let y = 41;
  const kpis = [
    {
      label: 'Bygninger i Audit',
      val: `${params.buildings.length} enheder`,
      color: [14, 116, 144] as [number, number, number],
    },
    {
      label: 'Uge-Overskridelser (S>=1)',
      val: `${dataset.totalWeeklyExceedanceHours} timer`,
      color: [185, 28, 28] as [number, number, number],
    },
    {
      label: 'Spidsreceptor (7d/24t)',
      val: `${dataset.topReceptorTrends[0]?.receptorCode ?? '-'} (S=${(
        dataset.topReceptorTrends[0]?.peakSumQuotientS ?? 0
      ).toFixed(2)})`,
      color: [190, 24, 93] as [number, number, number],
    },
    {
      label: 'Aktindsigtsafvigelser',
      val: `${params.discrepancies.length} fund`,
      color: [180, 83, 9] as [number, number, number],
    },
  ];
  kpis.forEach((k, idx) => {
    const bx = 14 + idx * 46.5;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(bx, y, 44, 14.5, 1.5, 1.5, 'FD');
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(k.label, bx + 2.5, y + 5);
    doc.setTextColor(k.color[0], k.color[1], k.color[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(k.val.slice(0, 22), bx + 2.5, y + 11.2);
  });

  // Sektion 1: Uge-overskridelser pr. bygningskategori
  y = 63;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('1. OPGØRELSE OVER UGE-OVERSKRIDELSER PR. BYGNINGSKATEGORI (7 DØGN)', 14, y);
  y += 4;

  doc.setFillColor(15, 23, 42);
  doc.rect(14, y, 182, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.2);
  doc.text('Bygningskategori', 16, y + 4.8);
  doc.text('Enheder / Boliger', 62, y + 4.8);
  doc.text('Dage S>=1,0', 95, y + 4.8);
  doc.text('Timer S>=1,0', 117, y + 4.8);
  doc.text('Støj >55dB (t)', 139, y + 4.8);
  doc.text('Maks. S', 164, y + 4.8);
  doc.text('Mest belastet', 180, y + 4.8);
  y += 7;

  dataset.categorySummaries.forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, 182, 9, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y + 9, 196, y + 9);

    const [r, g, b] = hexToRgb(row.colorHex);
    doc.setFillColor(r, g, b);
    doc.rect(16, y + 2.4, 2.4, 4.2, 'F');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.text(row.labelDa, 20.2, y + 5.8);

    doc.setFont('helvetica', 'normal');
    doc.text(`${row.buildingCount} bygn. (${row.dwellingsCount} bol.)`, 62, y + 5.8);
    doc.text(`${row.daysWithSOver1} / 7 d`, 95, y + 5.8);
    if (row.weeklyExceedanceHoursS1 > 0) doc.setTextColor(185, 28, 28);
    else doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(`${row.weeklyExceedanceHoursS1} t`, 117, y + 5.8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(`${row.weeklyNoiseExceedanceHours} t`, 139, y + 5.8);

    if (row.peakSumQuotientS >= 1.0) doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.text(`S=${row.peakSumQuotientS.toFixed(2)}`, 164, y + 5.8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(6.8);
    doc.text(row.worstBuildingLabel.slice(0, 14), 180, y + 5.8);

    y += 9;
  });

  // Sektion 2: Visuelle Vektor-Grafer over S-kvotient tendenser for de mest belastede receptorer
  y += 8;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('2. VISUELLE GRAFER: S-KVOTIENT TENDENSER FOR DE MEST BELASTEDE RECEPTORER', 14, y);
  y += 4;

  const palette: Array<[number, number, number]> = [
    [225, 29, 72], // rose-600
    [234, 88, 12], // orange-600
    [2, 132, 199], // sky-600
    [124, 58, 237], // violet-600
  ];

  const maxTrendS = Math.max(
    1.6,
    ...dataset.topReceptorTrends.flatMap((t) => [
      t.peakSumQuotientS * 1.15,
      ...t.hourly24hS.map((h) => h.sVal * 1.15),
    ])
  );

  // Graf A (Venstre): 7-Døgns Ugetendens pr. Top-Receptor | Graf B (Højre): 24-Timers Spidstime-Tendens
  const drawTrendChart = (paramsChart: {
    x: number;
    y: number;
    w: number;
    h: number;
    title: string;
    xLabels: string[];
    seriesList: Array<{ label: string; values: number[]; color: [number, number, number] }>;
  }) => {
    const { x, y: cy, w, h, title, xLabels, seriesList } = paramsChart;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x, cy, w, h, 1.8, 1.8, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.text(title, x + 3, cy + 5.2);

    const plotX = x + 10;
    const plotY = cy + 9;
    const plotW = w - 14;
    const plotH = h - 18;

    // Grid & Axes
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(plotX, plotY, plotX, plotY + plotH);
    doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);

    // Lovgrænse S = 1.0 & Varsel S = 0.8
    const yForS = (s: number) =>
      plotY + plotH - (Math.min(maxTrendS, Math.max(0, s)) / maxTrendS) * plotH;

    const yLim1 = yForS(1.0);
    doc.setDrawColor(225, 29, 72);
    doc.setLineWidth(0.4);
    doc.line(plotX, yLim1, plotX + plotW, yLim1);
    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text('S=1.0', x + 1.5, yLim1 + 1);

    const yWarn = yForS(0.8);
    doc.setDrawColor(217, 119, 6);
    doc.setLineWidth(0.25);
    doc.line(plotX, yWarn, plotX + plotW, yWarn);
    doc.setTextColor(180, 83, 9);
    doc.text('0.8', x + 2.5, yWarn + 1);

    // X-axis tick labels
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    const step = Math.max(1, Math.floor(xLabels.length / 6));
    xLabels.forEach((lbl, i) => {
      if (i % step !== 0 && i !== xLabels.length - 1) return;
      const px = plotX + (i / Math.max(1, xLabels.length - 1)) * plotW;
      doc.text(lbl, px - 2.5, plotY + plotH + 4);
    });

    // Plot curves
    seriesList.forEach((sr) => {
      doc.setDrawColor(sr.color[0], sr.color[1], sr.color[2]);
      doc.setFillColor(sr.color[0], sr.color[1], sr.color[2]);
      doc.setLineWidth(0.55);
      for (let i = 0; i < sr.values.length; i++) {
        const px = plotX + (i / Math.max(1, sr.values.length - 1)) * plotW;
        const py = yForS(sr.values[i]);
        if (i > 0) {
          const prevX = plotX + ((i - 1) / Math.max(1, sr.values.length - 1)) * plotW;
          const prevY = yForS(sr.values[i - 1]);
          doc.line(prevX, prevY, px, py);
        }
        if (sr.values.length <= 10 || sr.values[i] >= 1.0) {
          doc.circle(px, py, 0.7, 'F');
        }
      }
    });
  };

  const chartH = 52;
  const weekXLabels =
    dataset.topReceptorTrends[0]?.daily7DayPeakS.map((d) => d.dayLabel) ?? [
      'D1',
      'D2',
      'D3',
      'D4',
      'D5',
      'D6',
      'D7',
    ];
  drawTrendChart({
    x: 14,
    y,
    w: 88,
    h: chartH,
    title: '7-Døgns Spids-S Tendens (Top 4 Receptorer)',
    xLabels: weekXLabels,
    seriesList: dataset.topReceptorTrends.map((t, i) => ({
      label: t.receptorCode,
      values: t.daily7DayPeakS.map((d) => d.maxS),
      color: palette[i % palette.length],
    })),
  });

  const hoursXLabels =
    dataset.topReceptorTrends[0]?.hourly24hS.map((h) => h.hourLabel.slice(0, 2)) ??
    Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  drawTrendChart({
    x: 108,
    y,
    w: 88,
    h: chartH,
    title: '24-Timers S-Kvotient Profil (Spidsdøgn)',
    xLabels: hoursXLabels,
    seriesList: dataset.topReceptorTrends.map((t, i) => ({
      label: t.receptorCode,
      values: t.hourly24hS.map((h) => h.sVal),
      color: palette[i % palette.length],
    })),
  });

  y += chartH + 4;

  // Legend & tabel over Top 4 mest belastede receptorer
  dataset.topReceptorTrends.forEach((t, idx) => {
    const col = palette[idx % palette.length];
    doc.setFillColor(col[0], col[1], col[2]);
    doc.rect(14, y + 1, 3.2, 3.2, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.text(
      `${t.receptorCode} (${t.receptorName.slice(0, 26)}) · ${t.buildingCategoryLabelDa}`,
      19,
      y + 3.5
    );
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Spids S=${t.peakSumQuotientS.toFixed(2)} · 24t dosis=${t.cumulative24hDoseSt.toFixed(
        1
      )} S·t · Dage S>=1: ${t.weeklyDaysOver1}/7`,
      122,
      y + 3.5
    );
    y += 5.2;
  });

  // Sektion 3: Aktindsigtsafvigelser & Sagsoversigt
  if (y > 225) {
    doc.addPage();
    y = 18;
  } else {
    y += 5;
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('3. AKTUELLE AKTINDSIGTSAFVIGELSER & TILSYNSSAGER (BEK 496/2024)', 14, y);
  y += 5;

  params.discrepancies.slice(0, 6).forEach((d) => {
    if (y > 266) {
      doc.addPage();
      y = 18;
    }
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(248, 113, 113);
    doc.roundedRect(14, y, 182, 11.5, 1.2, 1.2, 'FD');
    doc.setTextColor(153, 27, 27);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.3);
    doc.text(`[${d.severity}] ${d.category}: ${d.titleDa.slice(0, 82)}`, 16.5, y + 4.5);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.text(`Betydning: ${d.statutoryImpactDa.slice(0, 105)}`, 16.5, y + 9.2);
    y += 13;
  });

  // Footer
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    `Genereret UTC: ${exportedAtIso} · Slagelse Kommune Borgertilsyn & Audit · SHA-256: ${dataset.reportSha256}`,
    14,
    287
  );

  const fileName = `Ringparken_ComplianceAudit_Ugeoverskridelser_STendens_${params.dateIso}.pdf`;
  doc.save(fileName);
  return { fileName, dataset };
}
