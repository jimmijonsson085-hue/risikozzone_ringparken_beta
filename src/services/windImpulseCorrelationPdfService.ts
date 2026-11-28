/**
 * @file src/services/windImpulseCorrelationPdfService.ts
 * @description Retsmedicinsk PDF-eksport for korrelationen mellem Open-Meteo
 * vindhastighed (v_10m & vindstød) og impulsstøj-hændelser fra maskinkataloget over tid.
 */

import { jsPDF } from 'jspdf';
import {
  computeMeteorologicalRefractionContext,
  renderMeteorologicalRefractionContextPdfSection,
} from './meteorologicalRefractionPdfContext';

function sanitizePdfText(input: string): string {
  return input
    .replace(/∑/g, 'SUM')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/→/g, '->')
    .replace(/↔/g, '<->')
    .replace(/Δ/g, 'Delta ')
    .replace(/•/g, '-')
    .replace(/·/g, '|')
    .replace(/µ/g, 'u')
    .replace(/³/g, '^3')
    .replace(/²/g, '^2');
}

export interface WindImpulseCorrelationPdfRow {
  hourIndex: number;
  hourLabel: string;
  windSpeedMs: number;
  windGustMs: number;
  windDirectionDeg: number;
  refractionBoostDb: number;
  catalogMachineLwaDb: number;
  estimatedLafmaxDb: number;
  sumQuotientS: number;
  impulseEventCount: number;
  dustEventCount: number;
  isHighSensitivity: boolean;
}

export interface WindImpulseCorrelationPdfParams {
  dateIso: string;
  selectedHourLabel: string;
  machineCatalogLabel: string;
  machineCatalogEquipmentDesc: string;
  machineLwaDb: number;
  machineImpulsePenaltyDb: number;
  rWindSpeedToImpulseDb: number;
  rGustToImpulseDb: number;
  rGustToDustS: number;
  highSensitivityHourCount: number;
  totalImpulseEvents: number;
  totalDustEvents: number;
  rows: WindImpulseCorrelationPdfRow[];
  sha256Hash?: string;
  currentWeather?: {
    windSpeed10m: number;
    windGusts10m?: number;
    windDirection10m: number;
    temperature2m?: number;
    pasquillClass?: string;
    precipitation?: number;
  };
}

export function generateWindImpulseCorrelationPdfReport(
  params: WindImpulseCorrelationPdfParams
): void {
  const {
    dateIso,
    selectedHourLabel,
    machineCatalogLabel,
    machineCatalogEquipmentDesc,
    machineLwaDb,
    machineImpulsePenaltyDb,
    rWindSpeedToImpulseDb,
    rGustToImpulseDb,
    rGustToDustS,
    highSensitivityHourCount,
    totalImpulseEvents,
    totalDustEvents,
    rows,
    sha256Hash,
  } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;
  let y = 14;

  const maxWindMs = rows.reduce((m, r) => Math.max(m, r.windSpeedMs), 0);
  const maxGustMs = rows.reduce((m, r) => Math.max(m, r.windGustMs), 0);
  const maxLafmaxDb = rows.reduce((m, r) => Math.max(m, r.estimatedLafmaxDb), 0);
  const peakRow =
    [...rows].sort((a, b) => b.estimatedLafmaxDb - a.estimatedLafmaxDb)[0] ?? rows[0];

  // Header Banner
  doc.setFillColor(11, 14, 23);
  doc.rect(0, 0, pageW, 35, 'F');
  doc.setDrawColor(6, 182, 212);
  doc.setLineWidth(0.7);
  doc.line(margin, 31.8, pageW - margin, 31.8);

  doc.setTextColor(34, 211, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.0);
  doc.text(
    sanitizePdfText(
      'RINGPARKEN MILJOEOVERVAAGNING | OPEN-METEO VINDHASTIGHED & MASKIN-IMPULSSTOEJ KORRELATION'
    ),
    margin,
    9.2
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12.8);
  doc.text(
    sanitizePdfText(
      `Korrelationsrapport: Open-Meteo Vind vs. Impulsstoej (${dateIso} kl. ${selectedHourLabel})`
    ),
    margin,
    16.6
  );

  doc.setTextColor(148, 163, 184);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.1);
  doc.text(
    sanitizePdfText(
      `Maskinkatalog: ${machineCatalogLabel} | L_WA: ${machineLwaDb.toFixed(
        1
      )} dB(A) | Impulstillaeg: +${machineImpulsePenaltyDb.toFixed(1)} dB`
    ),
    margin,
    23.0
  );
  doc.text(
    sanitizePdfText(
      `Normgrundlag: ISO 9613-2, MST Vejl. 5/1984 & BEK 613/2026 | Genereret: ${new Date().toISOString()}`
    ),
    margin,
    28.2
  );

  y = 40;

  // KPI Boxes
  const kpiW = (contentW - 6) / 4;
  const kpis = [
    {
      label: 'r (VINDHAST. <-> IMPULS)',
      val: `${rWindSpeedToImpulseDb >= 0 ? '+' : ''}${rWindSpeedToImpulseDb.toFixed(2)}`,
      sub: `r(Vindstoed<->Impuls): ${rGustToImpulseDb >= 0 ? '+' : ''}${rGustToImpulseDb.toFixed(2)}`,
    },
    {
      label: 'SPIDS VIND / VINDSTOED',
      val: `${maxWindMs.toFixed(1)} / ${maxGustMs.toFixed(1)} m/s`,
      sub: `Hoeg-sensitivitet: ${highSensitivityHourCount} / 24t`,
    },
    {
      label: 'SPIDS IMPULSSTOEJ',
      val: `${maxLafmaxDb.toFixed(1)} dB(A)`,
      sub: `Spidstime: kl. ${peakRow?.hourLabel ?? '12:00'}`,
    },
    {
      label: 'HAENDELSER (IMPULS/STOEV)',
      val: `${totalImpulseEvents} / ${totalDustEvents}`,
      sub: `r(Vindstoed<->Stoev S): ${rGustToDustS >= 0 ? '+' : ''}${rGustToDustS.toFixed(2)}`,
    },
  ];

  kpis.forEach((k, idx) => {
    const kx = margin + idx * (kpiW + 2);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.35);
    doc.rect(kx, y, kpiW, 18, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(71, 85, 105);
    doc.text(sanitizePdfText(k.label), kx + 2, y + 4.8);

    doc.setFontSize(10.2);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(k.val), kx + 2, y + 11.0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(51, 65, 85);
    doc.text(sanitizePdfText(k.sub), kx + 2, y + 15.6);
  });

  y += 23;

  // Section 01: Machine catalog context
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText('01. VALGT MASKINKATALOG-PROFIL & METEOROLOGISK GRUNDLAG'), margin, y);
  y += 3.5;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentW, 16, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    sanitizePdfText(`Katalogprofil: ${machineCatalogLabel} (L_WA = ${machineLwaDb.toFixed(1)} dB(A))`),
    margin + 2.5,
    y + 5.2
  );
  doc.text(
    sanitizePdfText(`Materiel: ${machineCatalogEquipmentDesc.slice(0, 105)}`),
    margin + 2.5,
    y + 10.2
  );
  doc.text(
    sanitizePdfText(
      `Open-Meteo data: ${dateIso} (24 timer v_10m + vindstoed) | R^2(Vind<->Impuls) = ${(
        rWindSpeedToImpulseDb * rWindSpeedToImpulseDb
      ).toFixed(2)}`
    ),
    margin + 2.5,
    y + 14.4
  );
  y += 21;

  // Section 02: Hourly 24h Matrix
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    sanitizePdfText('02. 24-TIMERS TIDSSERIE: OPEN-METEO VINDHASTIGHED VS. IMPULSSTOEJ-HAENDELSER'),
    margin,
    y
  );
  y += 3.5;

  const colW = [14, 20, 20, 16, 20, 24, 18, 22, 32];
  const headers = [
    'Time',
    'Vind v_10m',
    'Vindstoed',
    'Retn.',
    'Vind +dB',
    'L_AFmax dB',
    'Sumkv. S',
    'Impuls/Stoev',
    'Sensitivitet',
  ];

  const drawHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, contentW, 6.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(255, 255, 255);
    let hx = margin + 1.5;
    headers.forEach((h, i) => {
      doc.text(sanitizePdfText(h), hx, y + 4.3);
      hx += colW[i];
    });
    y += 6.2;
  };

  drawHeader();

  rows.forEach((r, idx) => {
    if (y + 6.5 > pageH - 16) {
      doc.addPage();
      y = 14;
      drawHeader();
    }

    if (r.isHighSensitivity) {
      doc.setFillColor(254, 243, 199);
    } else if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentW, 5.7, 'FD');

    const cells = [
      r.hourLabel,
      `${r.windSpeedMs.toFixed(1)} m/s`,
      `${r.windGustMs.toFixed(1)} m/s`,
      `${Math.round(r.windDirectionDeg)}°`,
      `+${r.refractionBoostDb.toFixed(1)} dB`,
      `${r.estimatedLafmaxDb.toFixed(1)} dB`,
      `${r.sumQuotientS.toFixed(2)}`,
      `${r.impulseEventCount} / ${r.dustEventCount}`,
      r.isHighSensitivity ? 'HOEJ SENSITIVITET' : 'Normal',
    ];

    let cx = margin + 1.5;
    cells.forEach((c, cIdx) => {
      doc.setFont('helvetica', r.isHighSensitivity || cIdx === 0 ? 'bold' : 'normal');
      doc.setFontSize(6.6);
      if (r.isHighSensitivity && (cIdx === 5 || cIdx === 8)) {
        doc.setTextColor(180, 83, 9);
      } else {
        doc.setTextColor(30, 41, 59);
      }
      doc.text(sanitizePdfText(c), cx, y + 4.0);
      cx += colW[cIdx];
    });
    y += 5.7;
  });

  // Automatisk 'Meteorological Refraction Context' når impulsstøj-hændelser er fanget
  if ((totalImpulseEvents > 0 || Boolean(peakRow)) && peakRow) {
    const refractionWeather = params.currentWeather ?? {
      windSpeed10m: peakRow.windSpeedMs,
      windGusts10m: peakRow.windGustMs,
      windDirection10m: peakRow.windDirectionDeg,
    };
    const refractionCtx = computeMeteorologicalRefractionContext({
      windSpeed10m: refractionWeather.windSpeed10m,
      windGusts10m: refractionWeather.windGusts10m,
      windDirection10m: refractionWeather.windDirection10m,
      temperature2m: refractionWeather.temperature2m,
      pasquillClass: refractionWeather.pasquillClass,
      precipitation: refractionWeather.precipitation,
    });
    y = renderMeteorologicalRefractionContextPdfSection(doc, {
      startY: y + 6,
      margin,
      contentW,
      pageH,
      sectionTitle:
        '03. METEOROLOGICAL REFRACTION CONTEXT (VIND- & TEMPERATURGRADIENTER VED IMPULSSTØJ)',
      entries: [
        {
          eventCode: `${machineCatalogLabel.split(' ')[0].toUpperCase()}-IMPULS`,
          timestampLabel: `${dateIso} kl. ${peakRow.hourLabel}`,
          locationLabel: `Ringparken Spids-Receptor (${machineCatalogLabel})`,
          lafmaxDb: peakRow.estimatedLafmaxDb,
          context: refractionCtx,
        },
      ],
    });
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, pageH - 11, pageW - margin, pageH - 11);
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      sanitizePdfText(
        `Ringparken Vind- & Impulsstoej Korrelationsrapport | ${dateIso}${
          sha256Hash ? ` | SHA-256: ${sha256Hash.slice(0, 18)}...` : ''
        } | Side ${p}/${totalPages}`
      ),
      margin,
      pageH - 6.5
    );
  }

  doc.save(
    `Ringparken_Vind_Impulsstoej_Korrelation_${dateIso}_kl_${selectedHourLabel.replace(':', '')}.pdf`
  );
}
