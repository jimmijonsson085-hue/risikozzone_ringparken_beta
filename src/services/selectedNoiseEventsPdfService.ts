/**
 * @file src/services/selectedNoiseEventsPdfService.ts
 * @description Retsmedicinsk A4 PDF-rapportgenerator for udvalgte støjhændelser i
 * Ringparken, inkl. meteorologisk vindkorrelation (vindhastighed, vindstød, vindvinkel
 * & akustisk refraktion) samt beregnet sumkvotient (S) på hændelsestidspunktet.
 */

import { jsPDF } from 'jspdf';
import { deterministicHexHash256 } from './autonomousReceptorMeshService';

export interface ForensicSelectableNoiseEvent {
  id: string;
  code: string;
  timestampLabel: string;
  hourIndex: number;
  locationLabel: string;
  sourceLabel: string;
  windSpeedMs: number;
  windGustMs: number;
  windDirectionDeg: number;
  windRefractionBoostDb: number;
  estimatedLafmaxDb: number;
  sumQuotientS: number;
  isNoiseLimitExceeded: boolean;
  isSumQuotientExceeded: boolean;
  sha256Signature: string;
}

export interface GenerateSelectedNoiseEventsPdfParams {
  dateIso: string;
  receptorFocusName: string;
  selectedEvents: ForensicSelectableNoiseEvent[];
}

function pearsonR(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  return dx2 > 0 && dy2 > 0 ? Number((num / Math.sqrt(dx2 * dy2)).toFixed(2)) : 0;
}

export function downloadSelectedNoiseEventsForensicPdf(
  params: GenerateSelectedNoiseEventsPdfParams
): { fileName: string; reportSha256: string } {
  const { dateIso, receptorFocusName, selectedEvents } = params;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const exportedAtIso = new Date().toISOString();
  const reportSha256 = deterministicHexHash256(
    `NOISE_WIND_PDF|${dateIso}|${selectedEvents.map((e) => `${e.id}:${e.estimatedLafmaxDb}:${e.sumQuotientS}`).join('|')}`
  );

  const rGustDb = pearsonR(
    selectedEvents.map((e) => e.windGustMs),
    selectedEvents.map((e) => e.estimatedLafmaxDb)
  );
  const rWindS = pearsonR(
    selectedEvents.map((e) => e.windGustMs),
    selectedEvents.map((e) => e.sumQuotientS)
  );
  const peakDb = selectedEvents.reduce((m, e) => Math.max(m, e.estimatedLafmaxDb), 0);
  const peakS = selectedEvents.reduce((m, e) => Math.max(m, e.sumQuotientS), 0);
  const meanWind = selectedEvents.length
    ? selectedEvents.reduce((s, e) => s + e.windSpeedMs, 0) / selectedEvents.length
    : 0;

  // Top Header Banner
  doc.setFillColor(11, 14, 23);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(251, 191, 36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.text('RETSMEDICINSK STØJ-, VINDKORRELATIONS- & SUMKVOTIENT-RAPPORT', 14, 13);

  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Lokalitet: Ringparken / Schackenborgvænget, 4200 Slagelse · Fokus: ${receptorFocusName}`, 14, 20);
  doc.text(`Dato: ${dateIso} · Antal valgte støj-hændelser: ${selectedEvents.length} · Retsgrundlag: MST Vejl. 5/1984 & BEK 613/2026`, 14, 25.5);
  doc.setTextColor(56, 189, 248);
  doc.text(`SHA-256 Rapport-Segl: ${reportSha256}`, 14, 31);

  // Sektion 1: Statistisk Korrelationsresumé
  let y = 43;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.roundedRect(14, y - 5, 182, 24, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('1. METEOROLOGISK VINDKORRELATION & TOKSIKOLOGISK SAMTIDIGHED (RESUMÉ)', 18, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `• Pearson korrelation r(Vindstød, LAFmax dB) = ${rGustDb.toFixed(2)}  |  r(Vindstød, Sumkvotient S) = ${rWindS.toFixed(2)}`,
    18,
    y + 6.5
  );
  doc.text(
    `• Spidsstøj: ${peakDb.toFixed(1)} dB(A) (Grænse: 80,0 dB)  |  Maks. Sumkvotient S = ${peakS.toFixed(2)} (Grænse: S >= 1,00)  |  Middelvind: ${meanWind.toFixed(1)} m/s`,
    18,
    y + 12.5
  );

  // Sektion 2: Tabel over valgte støjhændelser, vinddata & S-kvotient
  y = 76;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('2. DOKUMENTEREDE STØJ-HÆNDELSER, VINDDATA & BEREGNET SUMKVOTIENT (S)', 14, y);

  y += 5;
  const renderTableHeader = (topY: number) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(14, topY, 182, 7.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Kode / Tid', 16, topY + 5);
    doc.text('Receptor / Blok', 48, topY + 5);
    doc.text('Vind / Pust / Retn.', 98, topY + 5);
    doc.text('Vind-Bidrag', 135, topY + 5);
    doc.text('LAFmax', 157, topY + 5);
    doc.text('Sumkvot. S', 176, topY + 5);
  };

  renderTableHeader(y);
  y += 7.5;

  selectedEvents.forEach((ev, idx) => {
    if (y > 262) {
      doc.addPage();
      y = 18;
      renderTableHeader(y);
      y += 7.5;
    }

    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, 182, 13, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y + 13, 196, y + 13);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`${ev.code}`, 16, y + 4.8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${ev.timestampLabel}`, 16, y + 9.8);

    const locShort = ev.locationLabel.length > 27 ? `${ev.locationLabel.slice(0, 26)}…` : ev.locationLabel;
    doc.text(locShort, 48, y + 4.8);
    doc.setTextColor(71, 85, 105);
    doc.text(ev.sourceLabel.slice(0, 28), 48, y + 9.8);

    doc.setTextColor(15, 23, 42);
    doc.text(`${ev.windSpeedMs.toFixed(1)} / ${ev.windGustMs.toFixed(1)} m/s`, 98, y + 4.8);
    doc.text(`Fra ${Math.round(ev.windDirectionDeg)} deg`, 98, y + 9.8);

    doc.text(`${ev.windRefractionBoostDb >= 0 ? '+' : ''}${ev.windRefractionBoostDb.toFixed(1)} dB(A)`, 135, y + 7);

    if (ev.isNoiseLimitExceeded) doc.setTextColor(185, 28, 28);
    else doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(`${ev.estimatedLafmaxDb.toFixed(1)} dB`, 157, y + 4.8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.text(ev.isNoiseLimitExceeded ? 'OVER 80 dB' : 'Under 80 dB', 157, y + 9.8);

    doc.setFontSize(7.5);
    if (ev.isSumQuotientExceeded) doc.setTextColor(185, 28, 28);
    else doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(`S = ${ev.sumQuotientS.toFixed(2)}`, 176, y + 4.8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(`SHA:${ev.sha256Signature.slice(0, 8)}`, 176, y + 9.8);

    y += 13;
  });

  // Retsmedicinsk Konklusion & Footer
  if (y > 248) {
    doc.addPage();
    y = 20;
  } else {
    y += 8;
  }

  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(239, 68, 68);
  doc.roundedRect(14, y, 182, 22, 2, 2, 'FD');
  doc.setTextColor(127, 29, 29);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('3. RETSMEDICINSK KONKLUSION TIL TILSYNSMYNDIGHED (SLAGELSE KOMMUNE & ARBEJDSTILSYNET)', 18, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.text(
    'Ovenstående støj-hændelser dokumenterer samtidig akustisk medvinds-refraktion og partikelspredning (Sumkvotient S).',
    18,
    y + 12
  );
  doc.text(
    `Genereret UTC: ${exportedAtIso} · Uforanderligt SHA-256 bevis-aftryk: ${reportSha256.slice(0, 40)}…`,
    18,
    y + 17.5
  );

  const fileName = `Ringparken_Retsmedicinsk_Stoejhaendelser_Vindkorrelation_${dateIso}.pdf`;
  doc.save(fileName);
  return { fileName, reportSha256 };
}

export interface NeighborBlockGustNoiseCorrelationRow {
  receptorId: string;
  receptorCode: string;
  receptorName: string;
  address: string;
  distanceMeters: number;
  dominantSourceCode: string;
  currentGustMs: number;
  currentLaeqDb: number;
  currentLafmaxDb: number;
  windRefractionBoostDb: number;
  pearsonR: number;
  rSquared: number;
  slopeDbPerMs: number;
  peak24hGustMs: number;
  peak24hLafmaxDb: number;
  hoursOver55Db: number;
  hoursOver85Db: number;
  complianceStatusDa: 'KRITISK (>85 dB)' | 'OVERSKRIDELSE (>55 dB)' | 'OVERHOLDELSE';
}

export interface NeighborGustNoiseTechnicalAppendixDataset {
  dateIso: string;
  hourLabel: string;
  machineProfileLabel: string;
  effectiveLwaDb: number;
  rows: NeighborBlockGustNoiseCorrelationRow[];
  meanPearsonR: number;
  maxGustMs: number;
  maxLafmaxDb: number;
  reportSha256: string;
}

export function computeSelectedNeighborGustNoiseAppendixData(params: {
  dateIso: string;
  hourLabel: string;
  weatherHours: Array<{
    hourIndex: number;
    hourLabel: string;
    windSpeed10m: number;
    windGusts10m: number;
    windDirection10m: number;
  }>;
  currentWeather: {
    hourIndex: number;
    hourLabel: string;
    windSpeed10m: number;
    windGusts10m: number;
    windDirection10m: number;
  };
  sources: Array<{
    id: string;
    code: string;
    name: string;
    active: boolean;
    position: { lat: number; lng: number };
    baseSoundPowerLwaDb?: number;
  }>;
  selectedReceptors: Array<{
    id: string;
    code: string;
    name: string;
    address: string;
    center: { lat: number; lng: number };
  }>;
  effectiveLwaDb: number;
  machineProfileLabel: string;
}): NeighborGustNoiseTechnicalAppendixDataset {
  const {
    dateIso,
    hourLabel,
    weatherHours,
    currentWeather,
    sources,
    selectedReceptors,
    effectiveLwaDb,
    machineProfileLabel,
  } = params;

  const activeSources = sources.filter((s) => s.active);
  const effectiveSources = activeSources.length > 0 ? activeSources : sources.slice(0, 1);
  const hours = weatherHours.length > 0 ? weatherHours.slice(0, 24) : [currentWeather];

  const evalBlockAtWeather = (
    rec: { center: { lat: number; lng: number } },
    w: { hourIndex: number; windSpeed10m: number; windGusts10m: number; windDirection10m: number }
  ) => {
    const downwindDeg = ((w.windDirection10m ?? 245) + 180) % 360;
    const gust = Math.max(w.windSpeed10m ?? 0, w.windGusts10m || (w.windSpeed10m ?? 0) * 1.32);
    const isDay = w.hourIndex >= 7 && w.hourIndex < 18;
    const schedAtten = isDay ? 0 : w.hourIndex >= 18 && w.hourIndex < 22 ? -11.0 : -15.5;

    let energySum = 0;
    let maxLafmax = 42;
    let bestSrcCode = effectiveSources[0]?.code ?? 'K1';
    let nearestDist = 999;
    let bestRefraction = 0;

    effectiveSources.forEach((src) => {
      const dLatM = (rec.center.lat - src.position.lat) * 111320;
      const dLngM = (rec.center.lng - src.position.lng) * 63180;
      const dist = Math.max(15, Math.hypot(dLatM, dLngM));
      const bearing = ((Math.atan2(dLngM, dLatM) * 180) / Math.PI + 360) % 360;
      const alignCos = Math.cos(((bearing - downwindDeg) * Math.PI) / 180);
      const speedFactor = Math.min(1.5, Math.max(0.4, (w.windSpeed10m + gust * 0.4) / 12));
      const refrDb =
        alignCos >= 0 ? alignCos * 6.5 * speedFactor : alignCos * 4.2 * speedFactor;
      const lwa =
        typeof src.baseSoundPowerLwaDb === 'number'
          ? Math.max(effectiveLwaDb, src.baseSoundPowerLwaDb)
          : effectiveLwaDb;
      const laeq = Math.max(36, lwa - (20 * Math.log10(dist) + 11.0 + dist * 0.004) + schedAtten + refrDb);
      const gustImpulseBonus = Math.max(0, (gust - 7.5) * 0.34 * (0.45 + 0.55 * Math.max(0, alignCos)));
      const lafmax = laeq + 14.5 * (isDay ? 1 : 0.72) + gustImpulseBonus;

      energySum += Math.pow(10, laeq / 10);
      if (lafmax > maxLafmax) {
        maxLafmax = lafmax;
        bestSrcCode = src.code;
        bestRefraction = refrDb + gustImpulseBonus;
      }
      if (dist < nearestDist) nearestDist = dist;
    });

    return {
      gust: Number(gust.toFixed(1)),
      laeqDb: Number((energySum > 0 ? 10 * Math.log10(energySum) : 42).toFixed(1)),
      lafmaxDb: Number(maxLafmax.toFixed(1)),
      windRefractionBoostDb: Number(bestRefraction.toFixed(1)),
      dominantSourceCode: bestSrcCode,
      distanceMeters: Math.round(nearestDist),
    };
  };

  const rows: NeighborBlockGustNoiseCorrelationRow[] = selectedReceptors
    .map((rec) => {
      const curr = evalBlockAtWeather(rec, currentWeather);
      const series = hours.map((h) => evalBlockAtWeather(rec, h));
      const xs = series.map((s) => s.gust);
      const ys = series.map((s) => s.lafmaxDb);
      const r = pearsonR(xs, ys);
      const rSq = Number((r * r).toFixed(2));
      const mx = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
      const my = ys.reduce((a, b) => a + b, 0) / Math.max(1, ys.length);
      let sXY = 0,
        sXX = 0;
      for (let i = 0; i < xs.length; i++) {
        sXY += (xs[i] - mx) * (ys[i] - my);
        sXX += (xs[i] - mx) * (xs[i] - mx);
      }
      const slopeDbPerMs = sXX > 1e-6 ? Number((sXY / sXX).toFixed(2)) : 0;
      const peak24hGustMs = Number(Math.max(...xs, curr.gust).toFixed(1));
      const peak24hLafmaxDb = Number(Math.max(...ys, curr.lafmaxDb).toFixed(1));
      const hoursOver55Db = series.filter((s) => s.laeqDb > 55 || s.lafmaxDb > 55).length;
      const hoursOver85Db = series.filter((s) => s.lafmaxDb > 85).length;
      const complianceStatusDa: NeighborBlockGustNoiseCorrelationRow['complianceStatusDa'] =
        peak24hLafmaxDb > 85 || curr.lafmaxDb > 85
          ? 'KRITISK (>85 dB)'
          : curr.laeqDb > 55 || curr.lafmaxDb > 55
          ? 'OVERSKRIDELSE (>55 dB)'
          : 'OVERHOLDELSE';

      return {
        receptorId: rec.id,
        receptorCode: rec.code,
        receptorName: rec.name,
        address: rec.address,
        distanceMeters: curr.distanceMeters,
        dominantSourceCode: curr.dominantSourceCode,
        currentGustMs: curr.gust,
        currentLaeqDb: curr.laeqDb,
        currentLafmaxDb: curr.lafmaxDb,
        windRefractionBoostDb: curr.windRefractionBoostDb,
        pearsonR: r,
        rSquared: rSq,
        slopeDbPerMs,
        peak24hGustMs,
        peak24hLafmaxDb,
        hoursOver55Db,
        hoursOver85Db,
        complianceStatusDa,
      };
    })
    .sort((a, b) => b.currentLafmaxDb - a.currentLafmaxDb);

  const meanPearsonR = rows.length
    ? Number((rows.reduce((s, r) => s + r.pearsonR, 0) / rows.length).toFixed(2))
    : 0;
  const maxGustMs = rows.reduce((m, r) => Math.max(m, r.peak24hGustMs), 0);
  const maxLafmaxDb = rows.reduce((m, r) => Math.max(m, r.peak24hLafmaxDb), 0);
  const reportSha256 = deterministicHexHash256(
    `TECH_APPENDIX_GUST_NOISE|${dateIso}|${hourLabel}|${rows
      .map((r) => `${r.receptorCode}:${r.pearsonR}:${r.currentLafmaxDb}`)
      .join('|')}`
  );

  return {
    dateIso,
    hourLabel,
    machineProfileLabel,
    effectiveLwaDb,
    rows,
    meanPearsonR,
    maxGustMs,
    maxLafmaxDb,
    reportSha256,
  };
}

export function downloadNeighborGustNoiseTechnicalAppendixPdf(params: {
  dateIso: string;
  hourLabel: string;
  weatherHours: Array<{
    hourIndex: number;
    hourLabel: string;
    windSpeed10m: number;
    windGusts10m: number;
    windDirection10m: number;
  }>;
  currentWeather: {
    hourIndex: number;
    hourLabel: string;
    windSpeed10m: number;
    windGusts10m: number;
    windDirection10m: number;
  };
  sources: Array<{
    id: string;
    code: string;
    name: string;
    active: boolean;
    position: { lat: number; lng: number };
    baseSoundPowerLwaDb?: number;
  }>;
  selectedReceptors: Array<{
    id: string;
    code: string;
    name: string;
    address: string;
    center: { lat: number; lng: number };
  }>;
  effectiveLwaDb: number;
  machineProfileLabel: string;
  selectedEventsCount?: number;
}): { fileName: string; reportSha256: string; dataset: NeighborGustNoiseTechnicalAppendixDataset } {
  const dataset = computeSelectedNeighborGustNoiseAppendixData(params);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const exportedAtIso = new Date().toISOString();

  // Header Banner (Miljøtilsyn Teknisk Bilag)
  doc.setFillColor(11, 15, 25);
  doc.rect(0, 0, 210, 36, 'F');
  doc.setTextColor(56, 189, 248);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TEKNISK BILAG TIL MILJØTILSYN: VINDSTØD × MASKINSTØJ', 14, 12.5);

  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.3);
  doc.text(
    `Lokalitet: Ringparken, 4200 Slagelse · Dato: ${dataset.dateIso} kl. ${dataset.hourLabel} · Valgte naboblokke: ${dataset.rows.length}`,
    14,
    19.5
  );
  doc.text(
    `Maskinprofil: ${dataset.machineProfileLabel} (L_WA = ${dataset.effectiveLwaDb.toFixed(
      1
    )} dB) · Hjemmel: Miljøbeskyttelsesloven § 42 & MST Vejl. 5/1984`,
    14,
    25
  );
  doc.setTextColor(52, 211, 153);
  doc.text(`SHA-256 Teknisk Bilags-Segl: ${dataset.reportSha256}`, 14, 31);

  // Sektion 1: Samlet Korrelations- & Eksponeringsresumé
  let y = 44;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.roundedRect(14, y - 4, 182, 23, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('1. METODE & KORRELATIONSRESUMÉ FOR VALGTE NABOBLOKKE', 18, y + 1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.text(
    `• Middel-korrelation på tværs af valgte blokke: r(Vindstød, L_AFmax) = ${dataset.meanPearsonR.toFixed(
      2
    )}  |  Spidsvindstød (24t): ${dataset.maxGustMs.toFixed(1)} m/s`,
    18,
    y + 7.5
  );
  doc.text(
    `• Spidsstøj ved nabo: ${dataset.maxLafmaxDb.toFixed(
      1
    )} dB(A) (Advarsel >85 dB / Overvågning >55 dB)  |  Krydsref. støjhændelser: ${
      params.selectedEventsCount ?? 0
    } stk.`,
    18,
    y + 13.5
  );

  // Sektion 2: Tabel pr. valgt naboblok
  y = 74;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.setTextColor(15, 23, 42);
  doc.text('2. KORRELATION MELLEM VINDSTØD & MASKINSTØJ PR. VALGT NABOBLOK', 14, y);
  y += 4.5;

  const drawTableHeader = (topY: number) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(14, topY, 182, 7.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.1);
    doc.text('Naboblok / Adresse', 16, topY + 5);
    doc.text('Afstand', 68, topY + 5);
    doc.text('Akt. Vindstød / LAFmax', 86, topY + 5);
    doc.text('Pearson r / R²', 124, topY + 5);
    doc.text('24t Peak', 151, topY + 5);
    doc.text('Tilsynsstatus', 171, topY + 5);
  };
  drawTableHeader(y);
  y += 7.5;

  dataset.rows.forEach((row, idx) => {
    if (y > 260) {
      doc.addPage();
      y = 18;
      drawTableHeader(y);
      y += 7.5;
    }
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, 182, 12.5, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y + 12.5, 196, y + 12.5);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.3);
    doc.text(`${row.receptorCode} · ${row.receptorName.slice(0, 22)}`, 16, y + 4.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(6.7);
    doc.text(row.address.slice(0, 32), 16, y + 9.6);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(7.2);
    doc.text(`${row.distanceMeters} m (${row.dominantSourceCode})`, 68, y + 7);

    doc.text(
      `${row.currentGustMs.toFixed(1)} m/s -> ${row.currentLafmaxDb.toFixed(1)} dB`,
      86,
      y + 4.8
    );
    doc.setTextColor(71, 85, 105);
    doc.text(
      `L_Aeq ${row.currentLaeqDb.toFixed(1)} dB (ΔL +${row.windRefractionBoostDb.toFixed(1)})`,
      86,
      y + 9.6
    );

    doc.setTextColor(14, 116, 144);
    doc.setFont('helvetica', 'bold');
    doc.text(`r=${row.pearsonR.toFixed(2)} · R²=${row.rSquared.toFixed(2)}`, 124, y + 4.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`+${row.slopeDbPerMs.toFixed(2)} dB/(m/s)`, 124, y + 9.6);

    doc.setTextColor(15, 23, 42);
    doc.text(`${row.peak24hLafmaxDb.toFixed(1)} dB`, 151, y + 4.8);
    doc.setTextColor(71, 85, 105);
    doc.text(`@${row.peak24hGustMs.toFixed(1)} m/s`, 151, y + 9.6);

    if (row.complianceStatusDa.startsWith('KRITISK')) doc.setTextColor(185, 28, 28);
    else if (row.complianceStatusDa.startsWith('OVERSKRIDELSE')) doc.setTextColor(180, 83, 9);
    else doc.setTextColor(21, 128, 61);
    doc.setFont('helvetica', 'bold');
    doc.text(row.complianceStatusDa, 171, y + 4.8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`>55dB: ${row.hoursOver55Db}t · >85dB: ${row.hoursOver85Db}t`, 171, y + 9.6);

    y += 12.5;
  });

  // Sektion 3: Teknisk bilags-attestation
  if (y > 246) {
    doc.addPage();
    y = 20;
  } else {
    y += 8;
  }

  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(14, 165, 233);
  doc.roundedRect(14, y, 182, 22, 2, 2, 'FD');
  doc.setTextColor(12, 74, 110);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.text('3. TEKNISK BILAGS-ERKLÆRING TIL SLAGELSE KOMMUNE MILJØTILSYN', 18, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.7);
  doc.text(
    'Dette tekniske bilag dokumenterer den kvantitative sammenhæng mellem Open-Meteo vindstød og impulsstøj på nabofacader.',
    18,
    y + 12
  );
  doc.text(
    `Genereret UTC: ${exportedAtIso} · Uforanderligt SHA-256 bilags-segl: ${dataset.reportSha256}`,
    18,
    y + 17.5
  );

  const fileName = `Ringparken_Teknisk_Bilag_Vindstoed_Maskinstoej_${dataset.dateIso}.pdf`;
  doc.save(fileName);
  return { fileName, reportSha256: dataset.reportSha256, dataset };
}

