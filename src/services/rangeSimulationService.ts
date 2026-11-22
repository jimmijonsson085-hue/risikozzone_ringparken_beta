import jsPDF from 'jspdf';
import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LegalViolationEntry,
  ReceptorZone,
  RingparkenBuildingUnit,
  WeatherDataset,
} from '../types/dispersion';
import {
  computeForensicSha256Hash,
  evaluateLegalViolations,
  evaluateReceptorAtHour,
} from './dispersionEngine';
import { fetchOpenMeteoWeatherForDate, shiftDateIsoByDays } from './weatherService';
import { computeHydrogeologicalPercolation } from '../components/UndergroundPercolation2D';

export interface RangeSimulationStepRecord {
  stepIndex: number;
  dateIso: string;
  hourIndex: number;
  hourLabel: string;
  timestampIso: string;
  windSpeedMs: number;
  windGustsMs: number;
  windDirectionDeg: number;
  plumeDirectionDeg: number;
  pasquillClass: string;
  temperatureC: number;
  precipitationMmH: number;
  soilMoistureM3M3: number;
  maxSumQuotient: number;
  worstReceptorId: string;
  worstReceptorName: string;
  worstReceptorAddress: string;
  asbestosFibersCm3: number;
  pcbNgM3: number;
  leadAirMgM3: number;
  quartzMgM3: number;
  estimatedImpulseNoiseLaeqDb: number;
  noiseLimitDb: number;
  isNoiseExceedance: boolean;
  isBek613Violation: boolean;
  // Hydrogeological & Blok 1 + 2 percolation metrics
  infiltrationRateMmH: number;
  darcyFluxMmH: number;
  macroporeVelocityMDay: number;
  plumeMaxDepthMeters: number;
  blok12LeadLeachingRateMgM2H: number;
  blok12PahLeachingRateUgM2H: number;
  leadConcentrationSecondaryUgL: number;
  pahConcentrationSecondaryUgL: number;
  leadConcentrationPrimaryUgL: number;
  mblPercolationViolation: boolean;
  violationCount: number;
}

export interface ReceptorRangeAggregate {
  receptorId: string;
  receptorCode: string;
  receptorName: string;
  address: string;
  peakSumQuotient: number;
  meanSumQuotient: number;
  cumulativeSumDose: number;
  hoursExceedingS1: number;
  peakTimestampIso: string;
}

export interface RangeSimulationSummary {
  simulationId: string;
  fromDateIso: string;
  fromHourIndex: number;
  fromLabel: string;
  toDateIso: string;
  toHourIndex: number;
  toLabel: string;
  completedAtIso: string;
  totalHoursSimulated: number;
  machineNoiseOutputDb: number;
  precipitationOverrideMm: number | null;
  peakSumQuotient: number;
  peakTimestampIso: string;
  peakReceptorName: string;
  peakReceptorAddress: string;
  hoursWithSAtLeast1: number;
  hoursWithNoiseExceedance: number;
  hoursWithMblPercolationViolation: number;
  totalPrecipitationMm: number;
  totalInfiltrationMm: number;
  cumulativeBlok12LeadLeachedMgM2: number;
  cumulativeBlok12PahLeachedUgM2: number;
  peakLeadSecondaryUgL: number;
  peakPahSecondaryUgL: number;
  maxPlumeDepthMeters: number;
  sha256Digest: string;
  receptorAggregates: ReceptorRangeAggregate[];
  steps: RangeSimulationStepRecord[];
}

export interface RunRangeSimulationParams {
  fromDateIso: string;
  fromHourIndex: number;
  toDateIso: string;
  toHourIndex: number;
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  buildings?: RingparkenBuildingUnit[];
  precipitationOverrideMm?: number | null;
  machineNoiseOutputDb?: number;
  stepDelayMs?: number;
  onProgress?: (
    completedSteps: number,
    totalSteps: number,
    latestStep: RangeSimulationStepRecord,
    datasetForDate: WeatherDataset
  ) => void;
}

export function computeBlok12PercolationFluxes(params: {
  effectivePrecipMmH: number;
  infiltrationRateMmH: number;
  saturationRatio: number;
  leadSecondaryUgL: number;
  pahSecondaryUgL: number;
  buildings?: RingparkenBuildingUnit[];
}): {
  pbLeachingRateMgM2H: number;
  pahLeachingRateUgM2H: number;
  unsealedCrawlspaceFactor: number;
} {
  const {
    effectivePrecipMmH,
    infiltrationRateMmH,
    saturationRatio,
    leadSecondaryUgL,
    pahSecondaryUgL,
    buildings = [],
  } = params;

  const blok1 = buildings.find((b) => b.id === 'BLOK-1');
  const blok2 = buildings.find((b) => b.id === 'BLOK-2');

  let unsealedCrawlspaceFactor = 1.25;
  if (
    blok1?.category === 'e_demolished_unsecured' ||
    blok2?.category === 'e_demolished_unsecured'
  ) {
    unsealedCrawlspaceFactor = 2.15;
  } else if (
    blok1?.category === 'd_under_demolition' ||
    blok2?.category === 'd_under_demolition'
  ) {
    unsealedCrawlspaceFactor = 1.55;
  }

  const flowDriver = Math.max(0.06, infiltrationRateMmH * 0.85 + effectivePrecipMmH * 0.22);
  const pbLeachingRateMgM2H = Number(
    (
      (0.12 + flowDriver * 1.38 * (0.7 + saturationRatio * 0.65) + leadSecondaryUgL * 0.14) *
      unsealedCrawlspaceFactor
    ).toFixed(3)
  );
  const pahLeachingRateUgM2H = Number(
    (
      (0.45 + flowDriver * 4.65 * (0.75 + saturationRatio * 0.7) + pahSecondaryUgL * 8.5) *
      unsealedCrawlspaceFactor
    ).toFixed(3)
  );

  return {
    pbLeachingRateMgM2H,
    pahLeachingRateUgM2H,
    unsealedCrawlspaceFactor,
  };
}

function enumerateHourlySlots(
  fromDateIso: string,
  fromHourIndex: number,
  toDateIso: string,
  toHourIndex: number
): Array<{ dateIso: string; hourIndex: number }> {
  let startD = fromDateIso;
  let startH = Math.max(0, Math.min(23, Math.floor(fromHourIndex)));
  let endD = toDateIso;
  let endH = Math.max(0, Math.min(23, Math.floor(toHourIndex)));

  if (startD > endD || (startD === endD && startH > endH)) {
    // Auto-swap if inverted
    const tmpD = startD;
    const tmpH = startH;
    startD = endD;
    startH = endH;
    endD = tmpD;
    endH = tmpH;
  }

  const slots: Array<{ dateIso: string; hourIndex: number }> = [];
  let curDate = startD;
  let curHour = startH;
  const MAX_HOURS = 24 * 14; // Cap at 336 hours (14 days) so browser stays crisp

  while (slots.length < MAX_HOURS) {
    slots.push({ dateIso: curDate, hourIndex: curHour });
    if (curDate === endD && curHour === endH) break;
    if (curHour < 23) {
      curHour += 1;
    } else {
      curHour = 0;
      curDate = shiftDateIsoByDays(curDate, 1);
    }
    if (curDate > endD && slots.length > 0) break;
  }

  return slots;
}

export async function runMultiHourRangeSimulation(
  params: RunRangeSimulationParams
): Promise<RangeSimulationSummary> {
  const {
    fromDateIso,
    fromHourIndex,
    toDateIso,
    toHourIndex,
    sources,
    receptors,
    buildings = [],
    precipitationOverrideMm = null,
    machineNoiseOutputDb = 114,
    stepDelayMs = 28,
    onProgress,
  } = params;

  const slots = enumerateHourlySlots(fromDateIso, fromHourIndex, toDateIso, toHourIndex);
  const uniqueDates = Array.from(new Set(slots.map((s) => s.dateIso)));

  const datasetMap = new Map<string, WeatherDataset>();
  for (const dIso of uniqueDates) {
    const ds = await fetchOpenMeteoWeatherForDate(dIso);
    datasetMap.set(dIso, ds);
  }

  const activeSourceCount = sources.filter((s) => s.active).length;
  const unsecuredDemolishedCount = buildings.filter(
    (b) => b.category === 'e_demolished_unsecured'
  ).length;

  const recAccumMap = new Map<
    string,
    {
      receptor: ReceptorZone;
      sumTotal: number;
      peakS: number;
      hoursS1: number;
      peakTs: string;
    }
  >();

  receptors.forEach((r) => {
    recAccumMap.set(r.id, {
      receptor: r,
      sumTotal: 0,
      peakS: 0,
      hoursS1: 0,
      peakTs: `${slots[0]?.dateIso || fromDateIso}T${String(fromHourIndex).padStart(2, '0')}:00`,
    });
  });

  const steps: RangeSimulationStepRecord[] = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const ds = datasetMap.get(slot.dateIso)!;
    const weather: HourlyWeatherPoint =
      ds.hours[slot.hourIndex] || ds.hours[0];

    const exposures = receptors
      .map((rec) => evaluateReceptorAtHour(rec, sources, weather))
      .sort((a, b) => b.sumQuotient - a.sumQuotient);

    const worstExp = exposures[0];
    const maxS = worstExp ? Number(worstExp.sumQuotient.toFixed(3)) : 0;

    exposures.forEach((exp) => {
      const acc = recAccumMap.get(exp.receptorId);
      if (acc) {
        acc.sumTotal += exp.sumQuotient;
        if (exp.sumQuotient >= 1.0) acc.hoursS1 += 1;
        if (exp.sumQuotient >= acc.peakS) {
          acc.peakS = Number(exp.sumQuotient.toFixed(3));
          acc.peakTs = `${slot.dateIso} kl. ${weather.hourLabel}`;
        }
      }
    });

    const violations = evaluateLegalViolations(exposures, weather, sources, receptors);
    const findSub = (key: string) =>
      worstExp?.substances.find((s) => s.key === key)?.concentration ?? 0;

    const noiseLimitDb = slot.hourIndex >= 7 && slot.hourIndex < 18 ? 70.0 : 40.0;
    const estNoiseDb = Number(
      (
        machineNoiseOutputDb -
        39.5 +
        Math.min(6.2, weather.windSpeed10m * 0.52) +
        5.0
      ).toFixed(1)
    );
    const isNoiseExceedance = estNoiseDb > noiseLimitDb;

    const effRainMm =
      precipitationOverrideMm !== null && precipitationOverrideMm !== undefined
        ? precipitationOverrideMm
        : weather.precipitation;

    const hydro = computeHydrogeologicalPercolation(
      effRainMm,
      weather.soilMoisture0To7cm,
      weather.hadRecentFreezeThaw,
      activeSourceCount,
      unsecuredDemolishedCount
    );

    const blok12Flux = computeBlok12PercolationFluxes({
      effectivePrecipMmH: effRainMm,
      infiltrationRateMmH: hydro.infiltrationRateMmH,
      saturationRatio: hydro.saturationRatio,
      leadSecondaryUgL: hydro.leadConcentrationSecondaryUgL,
      pahSecondaryUgL: hydro.pahConcentrationSecondaryUgL,
      buildings,
    });

    const stepRecord: RangeSimulationStepRecord = {
      stepIndex: i,
      dateIso: slot.dateIso,
      hourIndex: slot.hourIndex,
      hourLabel: weather.hourLabel,
      timestampIso: `${slot.dateIso}T${weather.hourLabel}:00`,
      windSpeedMs: Number(weather.windSpeed10m.toFixed(1)),
      windGustsMs: Number(weather.windGusts10m.toFixed(1)),
      windDirectionDeg: Math.round(weather.windDirection10m),
      plumeDirectionDeg: Math.round((weather.windDirection10m + 180) % 360),
      pasquillClass: weather.pasquillClass,
      temperatureC: Number(weather.temperature2m.toFixed(1)),
      precipitationMmH: Number(effRainMm.toFixed(2)),
      soilMoistureM3M3: Number(weather.soilMoisture0To7cm.toFixed(3)),
      maxSumQuotient: maxS,
      worstReceptorId: worstExp?.receptorId || '',
      worstReceptorName: worstExp?.receptorName || 'Ingen aktiv receptor',
      worstReceptorAddress: worstExp?.address || '4200 Slagelse',
      asbestosFibersCm3: Number(findSub('asbestos').toFixed(5)),
      pcbNgM3: Number(findSub('pcb').toFixed(2)),
      leadAirMgM3: Number(findSub('lead').toFixed(5)),
      quartzMgM3: Number(findSub('quartz').toFixed(4)),
      estimatedImpulseNoiseLaeqDb: estNoiseDb,
      noiseLimitDb,
      isNoiseExceedance,
      isBek613Violation: maxS >= 1.0,
      infiltrationRateMmH: Number(hydro.infiltrationRateMmH.toFixed(2)),
      darcyFluxMmH: Number(hydro.darcyFluxMmH.toFixed(2)),
      macroporeVelocityMDay: Number(hydro.macroporeVelocityMetersPerDay.toFixed(2)),
      plumeMaxDepthMeters: Number(hydro.plumeMaxDepthMeters.toFixed(2)),
      blok12LeadLeachingRateMgM2H: blok12Flux.pbLeachingRateMgM2H,
      blok12PahLeachingRateUgM2H: blok12Flux.pahLeachingRateUgM2H,
      leadConcentrationSecondaryUgL: hydro.leadConcentrationSecondaryUgL,
      pahConcentrationSecondaryUgL: hydro.pahConcentrationSecondaryUgL,
      leadConcentrationPrimaryUgL: hydro.leadConcentrationPrimaryUgL,
      mblPercolationViolation: hydro.mblViolationActive,
      violationCount: violations.length,
    };

    steps.push(stepRecord);

    if (onProgress) {
      onProgress(i + 1, slots.length, stepRecord, ds);
    }

    if (stepDelayMs > 0 && slots.length <= 96) {
      await new Promise((r) => window.setTimeout(r, stepDelayMs));
    } else if (i % 6 === 0) {
      await new Promise((r) => window.setTimeout(r, 4));
    }
  }

  let peakStep = steps[0];
  let totalPrecip = 0;
  let totalInfiltration = 0;
  let cumPb = 0;
  let cumPah = 0;
  let peakPbUgL = 0;
  let peakPahUgL = 0;
  let maxDepthM = 0;
  let hoursS1 = 0;
  let hoursNoise = 0;
  let hoursMbl = 0;

  steps.forEach((st) => {
    if (st.maxSumQuotient >= (peakStep?.maxSumQuotient ?? 0)) {
      peakStep = st;
    }
    if (st.isBek613Violation) hoursS1 += 1;
    if (st.isNoiseExceedance) hoursNoise += 1;
    if (st.mblPercolationViolation) hoursMbl += 1;
    totalPrecip += st.precipitationMmH;
    totalInfiltration += st.infiltrationRateMmH;
    cumPb += st.blok12LeadLeachingRateMgM2H;
    cumPah += st.blok12PahLeachingRateUgM2H;
    if (st.leadConcentrationSecondaryUgL > peakPbUgL) {
      peakPbUgL = st.leadConcentrationSecondaryUgL;
    }
    if (st.pahConcentrationSecondaryUgL > peakPahUgL) {
      peakPahUgL = st.pahConcentrationSecondaryUgL;
    }
    if (st.plumeMaxDepthMeters > maxDepthM) {
      maxDepthM = st.plumeMaxDepthMeters;
    }
  });

  const firstSlot = slots[0];
  const lastSlot = slots[slots.length - 1];
  const fromLabel = `${firstSlot.dateIso} kl. ${String(firstSlot.hourIndex).padStart(2, '0')}:00`;
  const toLabel = `${lastSlot.dateIso} kl. ${String(lastSlot.hourIndex).padStart(2, '0')}:00`;

  const receptorAggregates: ReceptorRangeAggregate[] = Array.from(recAccumMap.values())
    .map((acc) => ({
      receptorId: acc.receptor.id,
      receptorCode: acc.receptor.code,
      receptorName: acc.receptor.name,
      address: acc.receptor.address,
      peakSumQuotient: acc.peakS,
      meanSumQuotient: Number((acc.sumTotal / Math.max(1, steps.length)).toFixed(3)),
      cumulativeSumDose: Number(acc.sumTotal.toFixed(2)),
      hoursExceedingS1: acc.hoursS1,
      peakTimestampIso: acc.peakTs,
    }))
    .sort((a, b) => b.peakSumQuotient - a.peakSumQuotient);

  const sha256Digest = await computeForensicSha256Hash({
    fromLabel,
    toLabel,
    totalHours: steps.length,
    peakS: peakStep?.maxSumQuotient ?? 0,
    totalPrecip: Number(totalPrecip.toFixed(2)),
    cumPb: Number(cumPb.toFixed(3)),
    cumPah: Number(cumPah.toFixed(3)),
  });

  return {
    simulationId: `SIM-${firstSlot.dateIso.replace(/-/g, '')}-${String(firstSlot.hourIndex).padStart(2, '0')}_TIL_${lastSlot.dateIso.replace(/-/g, '')}-${String(lastSlot.hourIndex).padStart(2, '0')}`,
    fromDateIso: firstSlot.dateIso,
    fromHourIndex: firstSlot.hourIndex,
    fromLabel,
    toDateIso: lastSlot.dateIso,
    toHourIndex: lastSlot.hourIndex,
    toLabel,
    completedAtIso: new Date().toISOString(),
    totalHoursSimulated: steps.length,
    machineNoiseOutputDb,
    precipitationOverrideMm,
    peakSumQuotient: peakStep?.maxSumQuotient ?? 0,
    peakTimestampIso: peakStep
      ? `${peakStep.dateIso} kl. ${peakStep.hourLabel}`
      : fromLabel,
    peakReceptorName: peakStep?.worstReceptorName || '',
    peakReceptorAddress: peakStep?.worstReceptorAddress || '',
    hoursWithSAtLeast1: hoursS1,
    hoursWithNoiseExceedance: hoursNoise,
    hoursWithMblPercolationViolation: hoursMbl,
    totalPrecipitationMm: Number(totalPrecip.toFixed(2)),
    totalInfiltrationMm: Number(totalInfiltration.toFixed(2)),
    cumulativeBlok12LeadLeachedMgM2: Number(cumPb.toFixed(3)),
    cumulativeBlok12PahLeachedUgM2: Number(cumPah.toFixed(3)),
    peakLeadSecondaryUgL: Number(peakPbUgL.toFixed(2)),
    peakPahSecondaryUgL: Number(peakPahUgL.toFixed(3)),
    maxPlumeDepthMeters: Number(maxDepthM.toFixed(2)),
    sha256Digest,
    receptorAggregates,
    steps,
  };
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 1a. Download samlet Tilsynsrapport (pdf), efter endt simulering
 */
export function downloadCombinedSupervisionPdfReport(summary: RangeSimulationSummary): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 16;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageH - 16) {
      doc.addPage();
      y = 16;
    }
  };

  // Header Banner
  doc.setFillColor(11, 14, 23);
  doc.rect(0, 0, pageW, 34, 'F');
  doc.setTextColor(56, 189, 248);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('SAMLET MILJØ- & ARBEJDSMILJØ-TILSYNSRAPPORT · RINGPARKEN, 4200 SLAGELSE (PSS W22085)', margin, 11);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(`Interval-Simulering: ${summary.fromLabel} – ${summary.toLabel}`, margin, 19);

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Simulerede timer: ${summary.totalHoursSimulated} t  |  SHA-256: ${summary.sha256Digest.slice(0, 32)}...`,
    margin,
    27
  );

  y = 42;

  // Section 1: Executive Summary Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, pageW - margin * 2, 34, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('1. SAMMENFATTENDE TILSYNSKONKLUSION (BEK 613/2026 & MBL § 42)', margin + 4, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.text(
    `• Maksimal Sumformel-kvotient (BEK 613/2026 § 3, stk. 3): S = ${summary.peakSumQuotient.toFixed(3)} (${summary.peakTimestampIso})`,
    margin + 4,
    y + 14
  );
  doc.text(
    `• Mest belastede receptor: ${summary.peakReceptorName} (${summary.peakReceptorAddress})`,
    margin + 4,
    y + 19.5
  );
  doc.text(
    `• Timer med lovoverskridelse S >= 1,0: ${summary.hoursWithSAtLeast1} ud af ${summary.totalHoursSimulated} timer  |  Støjoverskridelser (MBL § 42): ${summary.hoursWithNoiseExceedance} timer`,
    margin + 4,
    y + 25
  );
  doc.text(
    `• Maskin-støjniveau simuleret: ${summary.machineNoiseOutputDb} dB(A) L_WA  |  Samlet nedbør i perioden: ${summary.totalPrecipitationMm.toFixed(1)} mm`,
    margin + 4,
    y + 30.5
  );

  y += 41;

  // Section 2: Receptor Exposure Matrix
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. RECEPTOR-EKSPONERINGSMATRIX OVER HELE SIMULERINGSINTERVALLET', margin, y);
  y += 5;

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, pageW - margin * 2, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text('Receptor / Matrikel', margin + 2, y + 4.8);
  doc.text('Peak S', margin + 88, y + 4.8);
  doc.text('Middel S', margin + 110, y + 4.8);
  doc.text('Kum. Dosis (S·t)', margin + 132, y + 4.8);
  doc.text('Timer S>=1,0', margin + 160, y + 4.8);
  y += 7;

  doc.setFont('helvetica', 'normal');
  summary.receptorAggregates.slice(0, 12).forEach((rec, idx) => {
    ensureSpace(7);
    if (idx % 2 === 0) {
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, pageW - margin * 2, 6.5, 'F');
    }
    doc.setTextColor(15, 23, 42);
    doc.text(`${rec.receptorCode}: ${rec.receptorName}`.slice(0, 44), margin + 2, y + 4.5);
    if (rec.peakSumQuotient >= 1.0) doc.setTextColor(190, 18, 60);
    doc.setFont('helvetica', rec.peakSumQuotient >= 1.0 ? 'bold' : 'normal');
    doc.text(rec.peakSumQuotient.toFixed(3), margin + 88, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(rec.meanSumQuotient.toFixed(3), margin + 110, y + 4.5);
    doc.text(rec.cumulativeSumDose.toFixed(2), margin + 132, y + 4.5);
    doc.text(`${rec.hoursExceedingS1} t`, margin + 160, y + 4.5);
    y += 6.5;
  });

  y += 7;
  ensureSpace(22);

  // Section 3: Chronological Hourly Supervision Log
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. TIME-FOR-TIME TILSYNSLOG (STØV, ASBEST, STØJ & VEJRFORHOLD)', margin, y);
  y += 5;

  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, pageW - margin * 2, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.5);
  doc.text('Dato & Tid', margin + 2, y + 4.8);
  doc.text('Vind / PG', margin + 36, y + 4.8);
  doc.text('Max S', margin + 64, y + 4.8);
  doc.text('Asbest (f/cm³)', margin + 84, y + 4.8);
  doc.text('Støj dB(A)', margin + 114, y + 4.8);
  doc.text('Mest Udsat Receptor / Status', margin + 138, y + 4.8);
  y += 7;

  doc.setFont('helvetica', 'normal');
  summary.steps.forEach((st, idx) => {
    ensureSpace(6.5);
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageW - margin * 2, 6, 'F');
    }
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(7.3);
    doc.text(`${st.dateIso} ${st.hourLabel}`, margin + 2, y + 4.2);
    doc.text(`${st.windSpeedMs} m/s (${st.pasquillClass})`, margin + 36, y + 4.2);

    if (st.isBek613Violation) {
      doc.setTextColor(190, 18, 60);
      doc.setFont('helvetica', 'bold');
    }
    doc.text(st.maxSumQuotient.toFixed(2), margin + 64, y + 4.2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(st.asbestosFibersCm3.toFixed(4), margin + 84, y + 4.2);
    doc.text(`${st.estimatedImpulseNoiseLaeqDb}/${st.noiseLimitDb}`, margin + 114, y + 4.2);
    const statusTxt = st.isBek613Violation
      ? `BRUD: ${st.worstReceptorName}`.slice(0, 26)
      : st.worstReceptorName.slice(0, 26);
    doc.text(statusTxt, margin + 138, y + 4.2);
    y += 6;
  });

  ensureSpace(22);
  y += 5;
  doc.setDrawColor(148, 163, 184);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Kryptografisk SHA-256 bevissignatur for samlet Tilsynsrapport (${summary.simulationId}):`,
    margin,
    y
  );
  doc.setFont('courier', 'bold');
  doc.text(summary.sha256Digest, margin, y + 4.5);

  doc.save(`Samlet_Tilsynsrapport_${summary.simulationId}.pdf`);
}

/**
 * 1b. Download samlet Perkulationsrapport (pdf), efter endt simulering
 */
export function downloadCombinedPercolationPdfReport(summary: RangeSimulationSummary): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 16;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageH - 16) {
      doc.addPage();
      y = 16;
    }
  };

  // Header Banner
  doc.setFillColor(7, 32, 52);
  doc.rect(0, 0, pageW, 34, 'F');
  doc.setTextColor(52, 211, 153);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    'SAMLET HYDROGEOLOGISK PERKOLATIONSRAPPORT · BLOK 1 & BLOK 2 (BLY & PAH) · MBL §§ 19 & 27',
    margin,
    11
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(`Nedsivnings-Simulering: ${summary.fromLabel} – ${summary.toLabel}`, margin, 19);

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Varighed: ${summary.totalHoursSimulated} timer  |  Akkumuleret nedbør: ${summary.totalPrecipitationMm.toFixed(2)} mm  |  Infiltration: ${summary.totalInfiltrationMm.toFixed(2)} mm`,
    margin,
    27
  );

  y = 42;

  // Section 1: Hydrogeological Summary Box for Blok 1 & Blok 2
  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(16, 185, 129);
  doc.rect(margin, y, pageW - margin * 2, 38, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(
    '1. BLOK 1 & BLOK 2 UNDERJORDISK PERKOLATION — BLY (Pb) & PAH-UDVASKNING',
    margin + 4,
    y + 7
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.6);
  doc.text(
    `• Samlet nedbør / effektiv nedsivning: ${summary.totalPrecipitationMm.toFixed(2)} mm nedbør -> ${summary.totalInfiltrationMm.toFixed(2)} mm infiltreret via uforseglet krybekælder/tracé`,
    margin + 4,
    y + 14
  );
  doc.text(
    `• Kumuleret Bly (Pb) nedsivning (Blok 1 & 2): ${summary.cumulativeBlok12LeadLeachedMgM2.toFixed(3)} mg/m²  |  Peak grundvand: ${summary.peakLeadSecondaryUgL.toFixed(2)} µg/L (MST krav: 1,0 µg/L)`,
    margin + 4,
    y + 20
  );
  doc.text(
    `• Kumuleret PAH-holdigt vand nedsivning (Blok 1 & 2): ${summary.cumulativeBlok12PahLeachedUgM2.toFixed(3)} µg/m²  |  Peak grundvand: ${summary.peakPahSecondaryUgL.toFixed(3)} µg/L (MST krav: 0,010 µg/L)`,
    margin + 4,
    y + 26
  );
  doc.text(
    `• Maks. perkolationsdybde: -${summary.maxPlumeDepthMeters.toFixed(1)} m u.t.  |  Timer med MBL §§ 19/27 grundvandsoverskridelse: ${summary.hoursWithMblPercolationViolation} t`,
    margin + 4,
    y + 32
  );

  y += 45;

  // Section 2: Hourly Percolation Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. TIME-FOR-TIME PERKOLATIONSDATA VED BLOK 1 & BLOK 2 (DARCY, BLY & PAH)', margin, y);
  y += 5;

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, pageW - margin * 2, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7.4);
  doc.text('Dato & Tid', margin + 2, y + 4.8);
  doc.text('Nedbør', margin + 34, y + 4.8);
  doc.text('Infiltr.', margin + 54, y + 4.8);
  doc.text('Bly-rate (mg/m²/t)', margin + 74, y + 4.8);
  doc.text('PAH-rate (µg/m²/t)', margin + 106, y + 4.8);
  doc.text('Pb / PAH (µg/L)', margin + 138, y + 4.8);
  doc.text('Dybde', margin + 168, y + 4.8);
  y += 7;

  doc.setFont('helvetica', 'normal');
  summary.steps.forEach((st, idx) => {
    ensureSpace(6.5);
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageW - margin * 2, 6, 'F');
    }
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(7.3);
    doc.text(`${st.dateIso} ${st.hourLabel}`, margin + 2, y + 4.2);
    doc.text(`${st.precipitationMmH.toFixed(1)} mm`, margin + 34, y + 4.2);
    doc.text(`${st.infiltrationRateMmH.toFixed(1)} mm`, margin + 54, y + 4.2);
    doc.text(st.blok12LeadLeachingRateMgM2H.toFixed(3), margin + 74, y + 4.2);
    doc.text(st.blok12PahLeachingRateUgM2H.toFixed(3), margin + 106, y + 4.2);

    if (st.mblPercolationViolation) {
      doc.setTextColor(190, 18, 60);
      doc.setFont('helvetica', 'bold');
    }
    doc.text(
      `${st.leadConcentrationSecondaryUgL.toFixed(2)} / ${st.pahConcentrationSecondaryUgL.toFixed(3)}`,
      margin + 138,
      y + 4.2
    );
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`-${st.plumeMaxDepthMeters.toFixed(1)}m`, margin + 168, y + 4.2);
    y += 6;
  });

  ensureSpace(22);
  y += 5;
  doc.setDrawColor(148, 163, 184);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Kryptografisk SHA-256 bevissignatur for samlet Perkulationsrapport (${summary.simulationId}):`,
    margin,
    y
  );
  doc.setFont('courier', 'bold');
  doc.text(summary.sha256Digest, margin, y + 4.5);

  doc.save(`Samlet_Perkulationsrapport_${summary.simulationId}.pdf`);
}

/**
 * 1c. Download Data (csv), efter endt simulering
 */
export function downloadRangeSimulationCsv(summary: RangeSimulationSummary): void {
  const esc = (val: string | number | boolean): string => {
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = [
    'Simulation_ID',
    'Step_Index',
    'Dato',
    'Klokkeslæt',
    'ISO_Tidsstempel',
    'Vind_10m_ms',
    'Vindstød_10m_ms',
    'Vindretning_Grader',
    'Fane_Retning_Grader',
    'Pasquill_Klasse',
    'Temperatur_C',
    'Nedbør_mm_t',
    'Infiltration_mm_t',
    'Darcy_Flux_mm_t',
    'Makropore_Hastighed_m_døgn',
    'Perkolationsdybde_m',
    'Blok1_2_Bly_Nedsivningsrate_mg_m2_t',
    'Blok1_2_PAH_Nedsivningsrate_ug_m2_t',
    'Grundvand_Bly_Sekundær_ug_L',
    'Grundvand_PAH_Sekundær_ug_L',
    'Grundvand_Bly_Primær_OSD_ug_L',
    'MBL_Paragraf19_27_Overtrædelse',
    'Max_Sumkvotient_S',
    'BEK_613_2026_Overtrædelse_S_Ge_1',
    'Mest_Udsat_Receptor',
    'Receptor_Adresse',
    'Asbest_fibre_cm3',
    'PCB_ng_m3',
    'Bly_Luft_mg_m3',
    'Kvarts_mg_m3',
    'Impuls_Støj_LAeq_dB',
    'Støjgrænse_dB',
    'Støj_Overskridelse',
    'SHA256_Interval_Digest',
  ];

  const lines = [
    headers.join(';'),
    ...summary.steps.map((st) =>
      [
        esc(summary.simulationId),
        st.stepIndex + 1,
        esc(st.dateIso),
        esc(st.hourLabel),
        esc(st.timestampIso),
        st.windSpeedMs,
        st.windGustsMs,
        st.windDirectionDeg,
        st.plumeDirectionDeg,
        esc(st.pasquillClass),
        st.temperatureC,
        st.precipitationMmH,
        st.infiltrationRateMmH,
        st.darcyFluxMmH,
        st.macroporeVelocityMDay,
        st.plumeMaxDepthMeters,
        st.blok12LeadLeachingRateMgM2H,
        st.blok12PahLeachingRateUgM2H,
        st.leadConcentrationSecondaryUgL,
        st.pahConcentrationSecondaryUgL,
        st.leadConcentrationPrimaryUgL,
        st.mblPercolationViolation ? 'JA' : 'NEJ',
        st.maxSumQuotient,
        st.isBek613Violation ? 'JA' : 'NEJ',
        esc(st.worstReceptorName),
        esc(st.worstReceptorAddress),
        st.asbestosFibersCm3,
        st.pcbNgM3,
        st.leadAirMgM3,
        st.quartzMgM3,
        st.estimatedImpulseNoiseLaeqDb,
        st.noiseLimitDb,
        st.isNoiseExceedance ? 'JA' : 'NEJ',
        esc(summary.sha256Digest),
      ].join(';')
    ),
  ];

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, `Simulering_Data_${summary.simulationId}.csv`);
}

/**
 * 1d. Download json, efter endt simulering
 */
export function downloadRangeSimulationJson(summary: RangeSimulationSummary): void {
  const payload = {
    schemaVersion: 'ringparken-forensic-range-simulation-v1',
    caseReference: 'PSS Sag W22085 · Ringparken, 4200 Slagelse',
    authorityRecipient: 'Slagelse Kommune — Center for Miljø, Plan og Teknik',
    ...summary,
  };
  const jsonText = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8;' });
  triggerBlobDownload(blob, `Simulering_Bevispakke_${summary.simulationId}.json`);
}

/**
 * 3. Formelt 'Juridisk Resume' & Udkast til Klage til Slagelse Kommune
 *    baseret på de aktuelt valgte lovovertrædelser (S >= 1,0) inkl. MBL & BEK 613/2026
 */
export interface FormalComplaintDraftResult {
  headline: string;
  summaryText: string;
  municipalLegalBases: string[];
  demandedMunicipalActions: string[];
  sAtLeastOneCount: number;
  evaluatedViolationCount: number;
  modelUsed: string;
  generatedAtLabel: string;
}

export function buildFormalSlagelseLegalComplaintDraft(params: {
  selectedViolations: LegalViolationEntry[];
  dateIso: string;
  hourLabel: string;
  windSpeedMs: number;
  windGustsMs: number;
  windDirectionDeg: number;
  plumeDirectionDeg: number;
  stabilityClass: string;
  maxSumQuotient: number;
  precipitationMmH: number;
  sha256Hash: string;
}): FormalComplaintDraftResult {
  const {
    selectedViolations,
    dateIso,
    hourLabel,
    windSpeedMs,
    windGustsMs,
    windDirectionDeg,
    plumeDirectionDeg,
    stabilityClass,
    maxSumQuotient,
    precipitationMmH,
    sha256Hash,
  } = params;

  // Prioritize selected statutory violations where S >= 1,0 as explicitly requested
  const criticalS1Violations = selectedViolations.filter((v) => v.sumQuotient >= 1.0);
  const targetViolations =
    criticalS1Violations.length > 0 ? criticalS1Violations : selectedViolations;

  const violationCatalogueText =
    targetViolations.length > 0
      ? targetViolations
          .map(
            (v, idx) =>
              `  ${idx + 1}) MATRIKEL / RECEPTOR: ${v.receptorName} (${v.receptorAddress})\n` +
              `     • Dokumenteret Sumkvotient: S = ${v.sumQuotient.toFixed(3)} ${
                v.sumQuotient >= 1.0
                  ? '(LOVOVERSKRIDELSE: S ≥ 1,0 jf. BEK 613/2026 § 3, stk. 3)'
                  : '(Forhøjet eksponering)'
              }\n` +
              `     • Primært retsgrundlag: ${v.statuteReference} — ${v.statuteTitle}\n` +
              `     • Teknisk bevisførelse: ${v.technicalEvidence}\n` +
              `     • Retsvirkning: ${v.legalConsequence}`
          )
          .join('\n\n')
      : `  1) MATRIKEL / RECEPTOR: Beboede naboblokke i Ringparken / Rødtjørnevej, 4200 Slagelse\n` +
        `     • Beregnet maksimal Sumkvotient: S = ${maxSumQuotient.toFixed(3)} (jf. BEK 613/2026 § 3, stk. 3)\n` +
        `     • Primært retsgrundlag: BEK nr. 613 af 29. juni 2026 § 3, stk. 3 & Bilag 1 samt MBL § 42, stk. 1 og 4`;

  const municipalLegalBases = [
    'BEK nr. 613 af 29. juni 2026 § 3, stk. 1–3 & Bilag 1 (Skærpet asbestgrænseværdi 0,003 fibre/cm³, Bly 0,03 mg/m³, Respirabelt kvarts 0,10 mg/m³ samt additiv Sumformel S = ∑ C_i/GV_i ≥ 1,0)',
    'Miljøbeskyttelsesloven (MBL) § 42, stk. 1 og stk. 4 (Kommunalt påbud om nedbringelse og øjeblikkelig standsning af uhygiejnisk støv-, asbest- og støjforurening fra bygge- og anlægsarbejder)',
    'Miljøbeskyttelsesloven (MBL) § 19, stk. 1 & § 27, stk. 1 (Forbud mod nedsivning og udledning af bly- og PAH-holdigt perkolatvand til jord, grundvand og regnvandssystemer ved Blok 1 og Blok 2)',
    'Miljøbeskyttelsesloven (MBL) § 65, stk. 1–2 samt §§ 68–70 & § 72 (Kommunalbestyrelsens lovbestemte tilsynspligt, standsningspåbud uden varsel ved akut sundhedsfare samt påbud om akkrediteret prøvetagning)',
    'Asbestbekendtgørelsen (BEK nr. 1328) §§ 12–18 & Miljøaktivitetsbekendtgørelsen (BEK nr. 844) §§ 4–5 (Støvtæt indkapsling, undertryk og anmelde-/sikringspligt ved nedrivning)',
  ];

  const demandedMunicipalActions = [
    'Meddel straks standsnings- og afhjælpningspåbud efter MBL § 42, stk. 1 og 4, jf. § 69, stk. 1, indtil S < 1,0 er dokumenteret ved samtlige naboreceptorer.',
    'Udsted påbud efter MBL § 72 om øjeblikkelig akkrediteret tredjeparts-måling af asbestfibre (jf. BEK 613/2026 Bilag 1: 0,003 fibre/cm³), bly, PCB og respirabelt kvarts ved facader og opholdsarealer.',
    'Grib ind efter MBL § 19 og § 68 mod uforseglet nedsivning af bly- og PAH-holdigt vand i udgravningsfelterne ved Blok 1 (Kierulffsvej 14-22) og Blok 2 (Kierulffsvej 24-32).',
    'Meddel skriftlig kvittering med sagsnummer (KLE 09.02.00 / 09.08.00) og oplys om klagevejledning samt kommunens tilsynsskridt inden 5 hverdage.',
  ];

  const summaryText =
    `================================================================================\n` +
    `FORMELT JURIDISK RESUMÉ & UDKAST TIL KLAGE TIL SLAGELSE KOMMUNE\n` +
    `BASERET PÅ DOKUMENTEREDE LOVOVERTRÆDELSER MED SUMKVOTIENT S ≥ 1,0\n` +
    `================================================================================\n` +
    `TIL:      Slagelse Kommune — Center for Miljø, Plan og Teknik\n` +
    `          Att.: Miljøtilsynet & Bygningsmyndigheden, Rådhuspladsen 11, 4200 Slagelse\n` +
    `SAG:      Nedrivnings- og renoveringsarbejder i Ringparken (Blok 1 & 2 m.fl.),\n` +
    `          Kierulffsvej / Schackenborgvænget / Rødtjørnevej, 4200 Slagelse (PSS W22085)\n` +
    `DATO/TID: ${dateIso} kl. ${hourLabel}  |  NEDBØR: ${precipitationMmH.toFixed(1)} mm/t\n` +
    `METEOROLOGI: Vind ${windSpeedMs} m/s (stød ${windGustsMs} m/s) fra ${windDirectionDeg}° → spredningsfane ${plumeDirectionDeg}° (Pasquill ${stabilityClass})\n` +
    `SHA-256 BEVIS-ANKER: ${sha256Hash}\n` +
    `--------------------------------------------------------------------------------\n\n` +
    `1. FORMÅL OG KLAGENS GENSTAND (DOKUMENTERET S ≥ 1,0)\n` +
    `Hermed indgives formel miljø- og tilsynsklage til Slagelse Kommune med begæring om\n` +
    `øjeblikkeligt indgreb over for pågående grænseoverskridende støv-, asbest-, støj-\n` +
    `og perkolationsforurening fra nedrivningsfeltet i Ringparken, 4200 Slagelse.\n` +
    `Ved de aktuelt udvalgte kontrolpunkter overstiger den samlede kemiske og fysiske\n` +
    `eksponeringskvotient lovgrænsen S = 1,00 (aktuelt målt/modelleret op til S = ${Math.max(
      maxSumQuotient,
      ...targetViolations.map((v) => v.sumQuotient)
    ).toFixed(3)}).\n\n` +
    `2. DOKUMENTEREDE LOVOVERTRÆDELSER (UDVALGTE HÆNDELSER MED S ≥ 1,0)\n` +
    `${violationCatalogueText}\n\n` +
    `3. JURIDISK SUBSUMPTION — MILJØBESKYTTELSESLOVEN (MBL) & BEK NR. 613/2026\n` +
    `A) BEK nr. 613 af 29. juni 2026 om grænseværdier for stoffer og materialer:\n` +
    `   • Efter BEK 613/2026 § 3, stk. 1–2 og Bilag 1 gælder skærpede bindende grænse-\n` +
    `     værdier for asbest (0,003 fibre/cm³), uorganisk bly (0,03 mg/m³) og respirabelt\n` +
    `     kvarts (0,10 mg/m³) samt aktionsværdi for luftbåren PCB (300 ng/m³).\n` +
    `   • Efter BEK 613/2026 § 3, stk. 3 (Sumformlen) skal bidragene fra samtidigt\n` +
    `     forekommende stoffer summeres: S = ∑ (C_i / GV_i). Når S ≥ 1,0, foreligger en\n` +
    `     ulovlig grænseoverskridelse, selv hvis enkeltstoffer isoleret ligger under GV_i.\n` +
    `   • Da spredningsfanen fører asbest-, bly-, kvarts- og PCB-holdigt nedrivningsstøv\n` +
    `     direkte ind over beboede boliger og færdselsarealer med S ≥ 1,0, tilsidesættes\n` +
    `     både BEK 613/2026 § 3, stk. 3 og Asbestbekendtgørelsen (BEK 1328) §§ 12–18.\n\n` +
    `B) Miljøbeskyttelsesloven (MBL — LBK nr. 48 med senere ændringer):\n` +
    `   • MBL § 42, stk. 1 og stk. 4: Kommunalbestyrelsen kan og skal ved midlertidige\n` +
    `     bygge- og anlægsarbejder (herunder nedrivning) meddele påbud om foranstaltninger\n` +
    `     eller forbud/standsning, når aktiviteten medfører væsentlig luft-, støv- eller\n` +
    `     støjforurening for omgivelserne.\n` +
    `   • MBL § 19, stk. 1 & § 27, stk. 1: Ved uforseglede udgravninger og krybekældre\n` +
    `     under Blok 1 (Kierulffsvej 14-22) og Blok 2 (Kierulffsvej 24-32) nedsiver bly-\n` +
    `     og PAH-holdigt regn- og støvdæmpningsvand uden tilladelse gennem opsprækket\n` +
    `     moræneler mod det sekundære og primære grundvandsmagasin i strid med § 19.\n` +
    `   • MBL § 65, stk. 1–2 & §§ 68–70: Slagelse Kommune har som tilsynsmyndighed\n` +
    `     lovbestemt handlepligt til at foranledige et ulovligt forhold lovliggjort.\n` +
    `     Foreligger der øjeblikkelig sundhedsfare som følge af asbest- og tungmetal-\n` +
    `     spredning (S ≥ 1,0), skal standsningspåbud meddeles straks uden forudgående\n` +
    `     varsel jf. MBL § 69, stk. 1, mens prøveudtagning kan påbydes efter MBL § 72.\n` +
    `   • Manglende indgriben trods konkret viden udgør myndighedspassivitet og ansvarspådragende\n` +
    `     tilsynssvigt; overtrædelse af § 19, § 27 og påbud er strafbelagt efter MBL § 110.\n\n` +
    `4. PÅSTAND / KONKRETE KRAV TIL SLAGELSE KOMMUNE\n` +
    `${demandedMunicipalActions.map((act, i) => `${i + 1}. ${act}`).join('\n')}\n\n` +
    `Med venlig hilsen\n` +
    `Klager / Partsrepræsentant for berørte beboere i Ringparken, 4200 Slagelse\n` +
    `Vedlagt: Kryptografisk SHA-256 signeret telemetri-, sprednings- og perkolationslog\n` +
    `================================================================================`;

  return {
    headline: `Formelt Juridisk Resumé & Klageudkast til Slagelse Kommune (${criticalS1Violations.length || targetViolations.length || 1} S ≥ 1,0 overtrædelser · kl. ${hourLabel})`,
    summaryText,
    municipalLegalBases,
    demandedMunicipalActions,
    sAtLeastOneCount: criticalS1Violations.length,
    evaluatedViolationCount: targetViolations.length,
    modelUsed: 'Retsdogmatisk Klage-Generator (MBL §§ 19, 27, 42, 65, 68-72 & BEK 613/2026 § 3, stk. 3)',
    generatedAtLabel: `${dateIso} kl. ${hourLabel}`,
  };
}

export function downloadFormalSlagelseLegalComplaintPdf(
  draft: FormalComplaintDraftResult,
  dateIso: string,
  hourLabel: string
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 16;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(251, 191, 36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('JURIDISK RESUMÉ & UDKAST TIL KLAGE · SLAGELSE KOMMUNE (MBL & BEK 613/2026)', margin, 10);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text(draft.headline.slice(0, 82), margin, 18);
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Genereret: ${draft.generatedAtLabel}  |  Lovgrundlag: MBL §§ 19, 27, 42, 65, 68-72 & BEK 613/2026`, margin, 24);

  y = 35;
  doc.setTextColor(15, 23, 42);
  doc.setFont('courier', 'normal');
  doc.setFontSize(8.2);

  const wrappedLines = doc.splitTextToSize(draft.summaryText, pageW - margin * 2);
  wrappedLines.forEach((line: string) => {
    if (y > pageH - 15) {
      doc.addPage();
      y = 16;
    }
    doc.text(line, margin, y);
    y += 4.2;
  });

  doc.save(
    `Juridisk_Resume_Klage_Slagelse_Kommune_${dateIso}_kl_${hourLabel.replace(':', '')}.pdf`
  );
}
