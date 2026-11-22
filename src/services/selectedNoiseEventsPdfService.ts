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
