/**
 * @file src/services/highWindContingencyPdfService.ts
 * @description Genererer struktureret 'Høj-Vind Beredskabsplan' (PDF-eksport) ved vindhastighed > 10 m/s
 * inkl. tjeklister til nedstøvning, maskinstop og naboorientering for de mest udsatte receptorer.
 */

import { jsPDF } from 'jspdf';
import {
  ContingencyChecklistItem,
  HighWindContingencyPlan,
} from '../utils/highWindContingencyPlan';

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

export interface HighWindContingencyPdfResult {
  fileName: string;
  generatedAtIso: string;
}

export function generateHighWindContingencyPlanPdf(
  plan: HighWindContingencyPlan,
  checkedItemIds: Set<string> = new Set()
): HighWindContingencyPdfResult {
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

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 38, 'F');
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.8);
  doc.line(margin, 34.5, pageW - margin, 34.5);

  doc.setTextColor(251, 191, 36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.text(
    sanitizePdfText(
      `RINGPARKEN MILJOEBEREDSKAB | HOEJ-VIND BEREDSKABSPLAN (TÆRSKEL > ${plan.windThresholdMs.toFixed(
        1
      )} M/S)`
    ),
    margin,
    9.5
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13.2);
  doc.text(
    sanitizePdfText(
      `Hoej-Vind Beredskabsplan - ${plan.dateIso} kl. ${plan.hourLabel} (${plan.windSpeedMs.toFixed(
        1
      )} m/s)`
    ),
    margin,
    17.2
  );

  doc.setTextColor(203, 213, 225);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.2);
  doc.text(
    sanitizePdfText(
      `Plan-ID: ${plan.planId} | Status: ${
        plan.isHighWindTriggered ? 'AKTIV (>10 m/s ALARM)' : 'PRAEVENTIV PLAN'
      } | Pasquill: ${plan.pasquillClass} | Genereret: ${plan.generatedAtIso}`
    ),
    margin,
    23.8
  );
  doc.text(
    sanitizePdfText(
      `Vind: ${plan.windSpeedMs.toFixed(1)} m/s (stoed ${plan.windGustsMs.toFixed(
        1
      )} m/s) fra ${plan.windFromDeg} deg (${plan.windFromCompass}) -> Fane mod ${
        plan.plumeDownwindDeg
      } deg (${plan.plumeDownwindCompass})`
    ),
    margin,
    29.4
  );

  y = 43;

  // 4 Summary KPI Boxes
  const kpiW = (contentW - 6) / 4;
  const topRec = plan.topExposedReceptors[0];
  const kpis = [
    {
      label: 'VINDHASTIGHED',
      val: `${plan.windSpeedMs.toFixed(1)} m/s`,
      sub: `Stoed: ${plan.windGustsMs.toFixed(1)} m/s (>10 t: ${plan.highWindHoursIn24hCount})`,
    },
    {
      label: 'AKTIVE MASKINER',
      val: `${plan.activeSourcesCount} kilder`,
      sub: `Maks L_WA: ${plan.effectiveSiteLwaDb.toFixed(1)} dB(A)`,
    },
    {
      label: 'MEST UDSAT RECEPTOR',
      val: topRec ? topRec.receptorCode : 'Ingen',
      sub: topRec
        ? `S=${topRec.sumQuotientS.toFixed(2)} | ${topRec.estimatedLafmaxDb.toFixed(1)} dB`
        : '-',
    },
    {
      label: 'BEREDSKABSSTATUS',
      val: plan.isHighWindTriggered ? 'MASKINSTOP' : 'KLAR',
      sub: `${checkedItemIds.size}/${plan.allChecklistItems.length} punkter afkrydset`,
    },
  ];

  kpis.forEach((k, i) => {
    const bx = margin + i * (kpiW + 2);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, y, kpiW, 18, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(sanitizePdfText(k.label), bx + 2.5, y + 4.8);

    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(k.val), bx + 2.5, y + 11.0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.setTextColor(100, 116, 139);
    doc.text(sanitizePdfText(k.sub), bx + 2.5, y + 15.6);
  });

  y += 23;

  // Section 1: Most Exposed Receptors Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    sanitizePdfText('1. PRIORITEREDE UDSATTE RECEPTORER (GRUNDLAG FOR NABOORIENTERING)'),
    margin,
    y
  );
  y += 4;

  // Table header
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentW, 6.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.8);
  doc.text('RECEPTOR', margin + 2, y + 4.4);
  doc.text('ADRESSE / AFSTAND', margin + 42, y + 4.4);
  doc.text('S-KVOT.', margin + 104, y + 4.4);
  doc.text('STØV', margin + 122, y + 4.4);
  doc.text('IMPULS', margin + 140, y + 4.4);
  doc.text('PRIORITET', margin + 160, y + 4.4);
  y += 6.5;

  plan.exposedReceptorsRanked.slice(0, 5).forEach((rec, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentW, 7.2, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 7.2, margin + contentW, y + 7.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(`${rec.receptorCode} ${rec.receptorName}`).slice(0, 24), margin + 2, y + 4.8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(
      sanitizePdfText(`${rec.address} (${rec.distanceMeters} m)`).slice(0, 34),
      margin + 42,
      y + 4.8
    );
    doc.text(rec.sumQuotientS.toFixed(2), margin + 104, y + 4.8);
    doc.text(`${rec.dustUgM3.toFixed(0)} ug/m3`, margin + 122, y + 4.8);
    doc.text(`${rec.estimatedLafmaxDb.toFixed(1)} dB`, margin + 140, y + 4.8);

    doc.setFont('helvetica', 'bold');
    if (rec.priorityTier === 'KRITISK') {
      doc.setTextColor(190, 18, 60);
    } else if (rec.priorityTier === 'HØJ') {
      doc.setTextColor(180, 83, 9);
    } else {
      doc.setTextColor(15, 118, 110);
    }
    doc.text(sanitizePdfText(rec.priorityTier), margin + 160, y + 4.8);
    y += 7.2;
  });

  y += 7;

  const renderChecklistSection = (
    heading: string,
    items: ContingencyChecklistItem[],
    accentRgb: [number, number, number]
  ) => {
    if (y > pageH - 42) {
      doc.addPage();
      y = 16;
    }

    doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
    doc.rect(margin, y, 2.2, 5.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(heading), margin + 4.5, y + 4.1);
    y += 7.5;

    items.forEach((item) => {
      const isChecked = checkedItemIds.has(item.id);
      const detailLines = doc.splitTextToSize(
        sanitizePdfText(`${item.actionDetailsDa} [${item.targetRefDa}]`),
        contentW - 14
      ) as string[];
      const boxH = 7 + detailLines.length * 3.8;

      if (y + boxH > pageH - 16) {
        doc.addPage();
        y = 16;
      }

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.25);
      doc.roundedRect(margin, y, contentW, boxH, 1.2, 1.2, 'FD');

      // Checkbox
      doc.setDrawColor(71, 85, 105);
      doc.rect(margin + 3, y + 2.8, 3.6, 3.6);
      if (isChecked) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(22, 163, 74);
        doc.text('X', margin + 3.8, y + 5.7);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(15, 23, 42);
      doc.text(
        sanitizePdfText(`[${item.priority}] ${item.titleDa}`),
        margin + 9,
        y + 5.5
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.0);
      doc.setTextColor(71, 85, 105);
      doc.text(detailLines, margin + 9, y + 9.6);

      y += boxH + 2.2;
    });

    y += 4;
  };

  renderChecklistSection(
    '2. TJEKLISTE: NEDSTØVNING & STØVBEKÆMPELSE',
    plan.dustSuppressionChecklist,
    [14, 165, 233]
  );

  renderChecklistSection(
    '3. TJEKLISTE: MASKINSTOP & AKUSTISK NEDDROSLING',
    plan.machineryStopChecklist,
    [225, 29, 72]
  );

  renderChecklistSection(
    '4. TJEKLISTE: NABOORIENTERING (MEST UDSATTE RECEPTORER)',
    plan.neighborNotificationChecklist,
    [245, 158, 11]
  );

  // Footer on last page
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, pageH - 13, pageW - margin, pageH - 13);
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    sanitizePdfText(
      `SHA-256 Verifikation: ${plan.sha256Hash || 'LOKAL-BEREDSKABSPLAN'} | Ringparken Slagelse`
    ),
    margin,
    pageH - 8
  );

  const safeHour = plan.hourLabel.replace(':', '');
  const fileName = `Hoj-Vind-Beredskabsplan_${plan.dateIso}_kl${safeHour}.pdf`;
  doc.save(fileName);

  return {
    fileName,
    generatedAtIso: plan.generatedAtIso,
  };
}
