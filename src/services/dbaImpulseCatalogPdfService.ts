import { jsPDF } from 'jspdf';

export interface Dba168HourRow {
  globalHourNumber?: number; // 1..168
  dayIndex: number; // 0..6
  dateIso: string;
  dayLabel: string;
  hourIndex: number; // 0..23
  hourLabel: string;
  v10m: number;
  vGusts: number;
  pasquillClass: string;
  simLaeqDb: number;
  simLafmaxDb: number;
  dbaRawUncompensatedDb: number;
  micWindNoiseCompDb: number;
  dbaWindCompLaeqDb: number;
  dbaLafmaxPeakDb: number;
  simMinusDbaDeltaDb: number;
  exceeds3dBDiscrepancy: boolean;
  limitLaeqDb: number;
  isUnstableHighWind: boolean;
}

export interface DbaComplaintCorrelationEntry {
  complaintId: string;
  hourIndex: number;
  hourLabel: string;
  complainantBlock: string;
  logFileRef: string;
  complaintText: string;
  v10m: number;
  simLaeqDb: number;
  dbaWindCompLaeqDb: number;
  dbaLafmaxPeakDb: number;
  simMinusDbaDeltaDb: number;
}

export interface DbaImpulseCatalogPdfInput {
  blockId: string;
  blockLabel: string;
  dbaFileName: string;
  soundMeterModel: string;
  distanceMeters: number;
  machineLabel: string;
  machineLwaDb: number;
  anchorDateIso: string;
  rows168: Dba168HourRow[];
  complaints?: DbaComplaintCorrelationEntry[];
}

export interface Dba168StatisticalSummary {
  nHours: number;
  meanSimDb: number;
  meanDbaCompDb: number;
  meanDbaRawDb: number;
  meanMicWindCompDb: number;
  pearsonRComp: number;
  rSquaredComp: number;
  pearsonRRaw: number;
  regressionSlope: number;
  regressionIntercept: number;
  rmseDb: number;
  maeDb: number;
  meanBiasDeltaDb: number;
  stdDevDeltaDb: number;
  maxAbsDeltaDb: number;
  discrepancyOver3dBCount: number;
  discrepancyOver3dBPct: number;
  concordanceWithin3dBPct: number;
  highWindOver10msCount: number;
  highWindMeanSimDb: number;
  highWindMeanDbaCompDb: number;
  highWindPearsonR: number;
  calmWindCount: number;
  calmWindPearsonR: number;
  limitExceedanceSimCount: number;
  limitExceedanceDbaCount: number;
}

function computePearsonR(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const denom = Math.sqrt(denX * denY);
  if (denom <= 1e-9) return 0;
  return Math.max(-1, Math.min(1, num / denom));
}

export function computeDba168Statistics(rows: Dba168HourRow[]): Dba168StatisticalSummary {
  const n = rows.length || 1;
  const simArr = rows.map((r) => r.simLaeqDb);
  const dbaCompArr = rows.map((r) => r.dbaWindCompLaeqDb);
  const dbaRawArr = rows.map((r) => r.dbaRawUncompensatedDb);
  const deltaArr = rows.map((r) => r.simMinusDbaDeltaDb);

  const meanSimDb = simArr.reduce((s, v) => s + v, 0) / n;
  const meanDbaCompDb = dbaCompArr.reduce((s, v) => s + v, 0) / n;
  const meanDbaRawDb = dbaRawArr.reduce((s, v) => s + v, 0) / n;
  const meanMicWindCompDb = rows.reduce((s, r) => s + r.micWindNoiseCompDb, 0) / n;

  const pearsonRComp = computePearsonR(simArr, dbaCompArr);
  const rSquaredComp = pearsonRComp * pearsonRComp;
  const pearsonRRaw = computePearsonR(simArr, dbaRawArr);

  // OLS Linear regression: DBA_komp = intercept + slope * Sim
  let covXY = 0;
  let varX = 0;
  for (let i = 0; i < rows.length; i++) {
    const dx = simArr[i] - meanSimDb;
    const dy = dbaCompArr[i] - meanDbaCompDb;
    covXY += dx * dy;
    varX += dx * dx;
  }
  const regressionSlope = varX > 1e-9 ? covXY / varX : 1;
  const regressionIntercept = meanDbaCompDb - regressionSlope * meanSimDb;

  const sqErrSum = deltaArr.reduce((s, d) => s + d * d, 0);
  const absErrSum = deltaArr.reduce((s, d) => s + Math.abs(d), 0);
  const meanBiasDeltaDb = deltaArr.reduce((s, d) => s + d, 0) / n;
  const varianceDelta =
    deltaArr.reduce((s, d) => s + (d - meanBiasDeltaDb) * (d - meanBiasDeltaDb), 0) / n;

  const rmseDb = Math.sqrt(sqErrSum / n);
  const maeDb = absErrSum / n;
  const stdDevDeltaDb = Math.sqrt(varianceDelta);
  const maxAbsDeltaDb = deltaArr.reduce((mx, d) => Math.max(mx, Math.abs(d)), 0);

  const discrepancyOver3dBCount = rows.filter((r) => r.exceeds3dBDiscrepancy).length;
  const discrepancyOver3dBPct = (discrepancyOver3dBCount / n) * 100;
  const concordanceWithin3dBPct = 100 - discrepancyOver3dBPct;

  const highWindRows = rows.filter((r) => r.v10m > 10);
  const calmWindRows = rows.filter((r) => r.v10m <= 10);

  const highWindOver10msCount = highWindRows.length;
  const highWindMeanSimDb =
    highWindRows.length > 0
      ? highWindRows.reduce((s, r) => s + r.simLaeqDb, 0) / highWindRows.length
      : 0;
  const highWindMeanDbaCompDb =
    highWindRows.length > 0
      ? highWindRows.reduce((s, r) => s + r.dbaWindCompLaeqDb, 0) / highWindRows.length
      : 0;
  const highWindPearsonR =
    highWindRows.length >= 2
      ? computePearsonR(
          highWindRows.map((r) => r.simLaeqDb),
          highWindRows.map((r) => r.dbaWindCompLaeqDb)
        )
      : pearsonRComp;

  const calmWindCount = calmWindRows.length;
  const calmWindPearsonR =
    calmWindRows.length >= 2
      ? computePearsonR(
          calmWindRows.map((r) => r.simLaeqDb),
          calmWindRows.map((r) => r.dbaWindCompLaeqDb)
        )
      : pearsonRComp;

  const limitExceedanceSimCount = rows.filter((r) => r.simLaeqDb > r.limitLaeqDb).length;
  const limitExceedanceDbaCount = rows.filter((r) => r.dbaWindCompLaeqDb > r.limitLaeqDb).length;

  return {
    nHours: rows.length,
    meanSimDb,
    meanDbaCompDb,
    meanDbaRawDb,
    meanMicWindCompDb,
    pearsonRComp,
    rSquaredComp,
    pearsonRRaw,
    regressionSlope,
    regressionIntercept,
    rmseDb,
    maeDb,
    meanBiasDeltaDb,
    stdDevDeltaDb,
    maxAbsDeltaDb,
    discrepancyOver3dBCount,
    discrepancyOver3dBPct,
    concordanceWithin3dBPct,
    highWindOver10msCount,
    highWindMeanSimDb,
    highWindMeanDbaCompDb,
    highWindPearsonR,
    calmWindCount,
    calmWindPearsonR,
    limitExceedanceSimCount,
    limitExceedanceDbaCount,
  };
}

function fmtDa(val: number, decimals = 2): string {
  return val.toFixed(decimals).replace('.', ',');
}

export function downloadFull168hDbaImpulseCatalogPdfReport(
  input: DbaImpulseCatalogPdfInput
): void {
  const rows = input.rows168;
  const stats = computeDba168Statistics(rows);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const contentW = pageW - marginX * 2;

  const startDateIso = rows[0]?.dateIso || input.anchorDateIso;
  const endDateIso = rows[rows.length - 1]?.dateIso || input.anchorDateIso;
  const generatedStamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  const drawPageHeader = (subtitle: string) => {
    doc.setFillColor(11, 14, 23);
    doc.rect(0, 0, pageW, 20, 'F');
    doc.setDrawColor(192, 38, 211);
    doc.setLineWidth(0.5);
    doc.line(0, 20, pageW, 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(248, 250, 252);
    doc.text(
      'RINGPARKEN 4200 SLAGELSE — VIND-KOMPENSERET IMPULS-KATALOG (168 TIMERS FULD RAPPORT)',
      marginX,
      8.5
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(216, 180, 254);
    doc.text(
      `${subtitle}  |  DBA-Fil: ${input.dbaFileName}  |  Periode: ${startDateIso} til ${endDateIso}`,
      marginX,
      15
    );
  };

  // =========================================================================
  // PAGE 1: EXECUTIVE METADATA, STATISTICAL CORRELATIONS & 24H WEEKLY VECTOR PLOT
  // =========================================================================
  drawPageHeader('Side 1: Statistisk Korrelationsanalyse (ISO 9613-2 Simulering vs. Kalibreret .DBA Lydlog)');

  let y = 26;

  // Metadata Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, y, contentW, 28, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('RETSMEDICINSK KILDE- OG MÅLEKONFIGURATION (PSS SAG W22085 · ISO 9613-2 / MST VEJL. 5/1984)', marginX + 3, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Naboblok / Målepunkt: ${input.blockLabel} (Afstand d = ${input.distanceMeters} m)`, marginX + 3, y + 11);
  doc.text(`Historisk Lydlog (.DBA): ${input.dbaFileName}`, marginX + 3, y + 15.8);
  doc.text(`Lydmåler & Kalibrering: ${input.soundMeterModel} (Vindhætte-korrigeret 1/3-oktav)`, marginX + 3, y + 20.6);
  doc.text(`Rapport genereret: ${generatedStamp}`, marginX + 3, y + 25.2);

  doc.text(`Valgt Nedrivningsmaskine: ${input.machineLabel}`, marginX + 98, y + 11);
  doc.text(`Kilde-Lydeffekt (L_WA): ${fmtDa(input.machineLwaDb, 1)} dB(A) inkl. K_I impulstillæg`, marginX + 98, y + 15.8);
  doc.text(`Tidsserie-omfang: ${stats.nHours} sammenhængende timer (7 døgn x 24t)`, marginX + 98, y + 20.6);
  doc.text(`Dato-interval: ${startDateIso} kl. 00:00 til ${endDateIso} kl. 23:00`, marginX + 98, y + 25.2);

  y += 33;

  // Section 1: Statistical Correlation KPI Cards (2 rows x 4 columns)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(
    '1. STATISTISKE KORRELATIONER MELLEM REALTIDS-SIMULERING OG HISTORISKE DBA-MÅLINGER (N = 168 TIMER)',
    marginX,
    y
  );
  y += 3.5;

  const kpiCards = [
    {
      label: 'PEARSON KORRELATION (r)',
      value: `r = ${fmtDa(stats.pearsonRComp, 4)}`,
      sub: `Raa ukomp.: r = ${fmtDa(stats.pearsonRRaw, 4)}`,
      accent: [147, 51, 234] as [number, number, number],
    },
    {
      label: 'FORKLARINGSGRAD (R²)',
      value: `R² = ${fmtDa(stats.rSquaredComp * 100, 2)} %`,
      sub: `DBA = ${fmtDa(stats.regressionIntercept, 2)} + ${fmtDa(stats.regressionSlope, 3)}*Sim`,
      accent: [8, 145, 178] as [number, number, number],
    },
    {
      label: 'RMSE & MAE (AFVIGELSE)',
      value: `RMSE = ${fmtDa(stats.rmseDb, 2)} dB`,
      sub: `MAE = ${fmtDa(stats.maeDb, 2)} dB | Max |d| = ${fmtDa(stats.maxAbsDeltaDb, 1)} dB`,
      accent: [37, 99, 235] as [number, number, number],
    },
    {
      label: 'MIDDEL-BIAS (SIM - DBA)',
      value: `${stats.meanBiasDeltaDb >= 0 ? '+' : ''}${fmtDa(stats.meanBiasDeltaDb, 2)} dB`,
      sub: `Spredning SD = ${fmtDa(stats.stdDevDeltaDb, 2)} dB`,
      accent: [5, 150, 105] as [number, number, number],
    },
    {
      label: 'DISKREPANSER (|d| > 3,0 dB)',
      value: `${stats.discrepancyOver3dBCount} / ${stats.nHours} timer`,
      sub: `${fmtDa(stats.discrepancyOver3dBPct, 1)} % (>3 dB) | ${fmtDa(stats.concordanceWithin3dBPct, 1)} % <=3 dB`,
      accent: [225, 29, 72] as [number, number, number],
    },
    {
      label: 'KRAFTIG VIND (v > 10 m/s)',
      value: `${stats.highWindOver10msCount} timer (${fmtDa((stats.highWindOver10msCount / stats.nHours) * 100, 1)} %)`,
      sub: `Korrelation v>10 m/s: r = ${fmtDa(stats.highWindPearsonR, 4)}`,
      accent: [217, 119, 6] as [number, number, number],
    },
    {
      label: '168t GENNEMSNIT (LAeq)',
      value: `Sim ${fmtDa(stats.meanSimDb, 1)} / DBA ${fmtDa(stats.meanDbaCompDb, 1)}`,
      sub: `DBA Raa: ${fmtDa(stats.meanDbaRawDb, 1)} dB (Vindkomp -${fmtDa(stats.meanMicWindCompDb, 1)} dB)`,
      accent: [71, 85, 105] as [number, number, number],
    },
    {
      label: 'GRAENSEOVERSKRIDELSER',
      value: `Sim: ${stats.limitExceedanceSimCount}t | DBA: ${stats.limitExceedanceDbaCount}t`,
      sub: `Rolig vind (v<=10 m/s): r = ${fmtDa(stats.calmWindPearsonR, 4)} (${stats.calmWindCount}t)`,
      accent: [190, 18, 60] as [number, number, number],
    },
  ];

  const cardGap = 2.8;
  const cardW = (contentW - cardGap * 3) / 4;
  const cardH = 18.5;

  kpiCards.forEach((card, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const cx = marginX + col * (cardW + cardGap);
    const cy = y + row * (cardH + 2.5);

    doc.setFillColor(250, 251, 254);
    doc.setDrawColor(card.accent[0], card.accent[1], card.accent[2]);
    doc.setLineWidth(0.35);
    doc.roundedRect(cx, cy, cardW, cardH, 1.2, 1.2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.3);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, cx + 2, cy + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(card.accent[0], card.accent[1], card.accent[2]);
    doc.text(card.value, cx + 2, cy + 10.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.1);
    doc.setTextColor(71, 85, 105);
    doc.text(card.sub, cx + 2, cy + 15.6);
  });

  y += cardH * 2 + 8;

  // Section 2: 7-Day Daily Breakdown Table (Dag 1 .. Dag 7)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('2. DAG-FOR-DAG STATISTISK NEDBRYDNING OVER HELE UGEN (7 DØGN = 168 TIMER)', marginX, y);
  y += 3;

  // Group by dayIndex
  const byDay = new Map<number, Dba168HourRow[]>();
  rows.forEach((r) => {
    const list = byDay.get(r.dayIndex) || [];
    list.push(r);
    byDay.set(r.dayIndex, list);
  });

  const dayHeaders = [
    'Dag / Dato',
    'Timer',
    'Max Vind',
    'v>10 m/s',
    'Snit Sim',
    'Snit DBA Komp.',
    'Snit DBA Raa',
    'Pearson r',
    'RMSE (dB)',
    '|d|>3 dB',
  ];
  const dayColWidths = [32, 13, 18, 16, 19, 23, 21, 18, 17, 15];

  doc.setFillColor(15, 23, 42);
  doc.rect(marginX, y, contentW, 6.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(248, 250, 252);
  let xCursor = marginX + 1.5;
  dayHeaders.forEach((h, i) => {
    doc.text(h, xCursor, y + 4.2);
    xCursor += dayColWidths[i];
  });
  y += 6.2;

  Array.from(byDay.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([dayIdx, dRows], idx) => {
      const dStats = computeDba168Statistics(dRows);
      const maxWind = dRows.reduce((mx, r) => Math.max(mx, r.v10m), 0);
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y, contentW, 5.6, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, y + 5.6, marginX + contentW, y + 5.6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(30, 41, 59);

      const cells = [
        `Dag ${dayIdx + 1} (${dRows[0]?.dateIso || ''})`,
        `${dRows.length}t`,
        `${fmtDa(maxWind, 1)} m/s`,
        `${dStats.highWindOver10msCount}t`,
        `${fmtDa(dStats.meanSimDb, 1)} dB`,
        `${fmtDa(dStats.meanDbaCompDb, 1)} dB`,
        `${fmtDa(dStats.meanDbaRawDb, 1)} dB`,
        fmtDa(dStats.pearsonRComp, 3),
        `${fmtDa(dStats.rmseDb, 2)}`,
        `${dStats.discrepancyOver3dBCount}t`,
      ];

      let cx = marginX + 1.5;
      cells.forEach((txt, cIdx) => {
        if (cIdx === 9 && dStats.discrepancyOver3dBCount > 0) {
          doc.setTextColor(190, 18, 60);
          doc.setFont('helvetica', 'bold');
        } else if (cIdx === 7) {
          doc.setTextColor(109, 40, 217);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setTextColor(30, 41, 59);
          doc.setFont('helvetica', 'normal');
        }
        doc.text(txt, cx, y + 3.9);
        cx += dayColWidths[cIdx];
      });
      y += 5.6;
    });

  y += 6;

  // Section 3: Vector 24-Hour Weekly Diurnal Profile Chart (00:00..23:00 aggregated across 168h)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(
    '3. GRAFISK 24-TIMERS UGEPROFIL (MIDDEL SIMULERING VS. VIND-KOMPENSERET DBA OVER 168 TIMER)',
    marginX,
    y
  );
  y += 3;

  const diurnal24 = Array.from({ length: 24 }, (_, hr) => {
    const hrRows = rows.filter((r) => r.hourIndex === hr);
    const nHr = hrRows.length || 1;
    const simAvg = hrRows.reduce((s, r) => s + r.simLaeqDb, 0) / nHr;
    const dbaCompAvg = hrRows.reduce((s, r) => s + r.dbaWindCompLaeqDb, 0) / nHr;
    const dbaRawAvg = hrRows.reduce((s, r) => s + r.dbaRawUncompensatedDb, 0) / nHr;
    const windAvg = hrRows.reduce((s, r) => s + r.v10m, 0) / nHr;
    const deltaAvg = simAvg - dbaCompAvg;
    return { hr, simAvg, dbaCompAvg, dbaRawAvg, windAvg, deltaAvg };
  });

  const chartX = marginX;
  const chartY = y;
  const chartW = contentW;
  const chartH = 54;
  const plotLeft = chartX + 14;
  const plotRight = chartX + chartW - 6;
  const plotTop = chartY + 8;
  const plotBot = chartY + chartH - 9;
  const plotW = plotRight - plotLeft;
  const plotH = plotBot - plotTop;

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(chartX, chartY, chartW, chartH, 1.5, 1.5, 'F');

  const dbMin = 30;
  const dbMax = 95;
  const mapX = (hr: number) => plotLeft + (hr / 23) * plotW;
  const mapY = (db: number) =>
    plotBot - Math.max(0, Math.min(1, (db - dbMin) / (dbMax - dbMin))) * plotH;

  // Gridlines
  [40, 55, 70, 85].forEach((dbTick) => {
    const gy = mapY(dbTick);
    doc.setDrawColor(dbTick === 70 ? 245 : 51, dbTick === 70 ? 158 : 65, dbTick === 70 ? 11 : 85);
    doc.setLineWidth(dbTick === 70 ? 0.35 : 0.18);
    doc.line(plotLeft, gy, plotRight, gy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(`${dbTick} dB`, chartX + 2.5, gy + 1.5);
  });

  // Highlight >3 dB discrepancy bands
  diurnal24.forEach((pt) => {
    if (Math.abs(pt.deltaAvg) > 3.0) {
      const bx = mapX(pt.hr) - plotW / 46;
      const topY = Math.min(mapY(pt.simAvg), mapY(pt.dbaCompAvg));
      const hBand = Math.max(1.5, Math.abs(mapY(pt.simAvg) - mapY(pt.dbaCompAvg)));
      doc.setFillColor(244, 63, 94);
      doc.rect(bx, topY, plotW / 23, hBand, 'F');
    }
  });

  // Plot Raw DBA (slate dashed look via thin line), Wind-Comp DBA (magenta), Sim (cyan)
  for (let i = 0; i < 23; i++) {
    const a = diurnal24[i];
    const b = diurnal24[i + 1];

    // Raw DBA
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.35);
    doc.line(mapX(a.hr), mapY(a.dbaRawAvg), mapX(b.hr), mapY(b.dbaRawAvg));

    // Wind-compensated DBA
    doc.setDrawColor(232, 121, 249);
    doc.setLineWidth(0.75);
    doc.line(mapX(a.hr), mapY(a.dbaCompAvg), mapX(b.hr), mapY(b.dbaCompAvg));

    // Real-time Simulation
    doc.setDrawColor(34, 211, 238);
    doc.setLineWidth(0.8);
    doc.line(mapX(a.hr), mapY(a.simAvg), mapX(b.hr), mapY(b.simAvg));
  }

  // X-axis hour ticks
  for (let hr = 0; hr < 24; hr += 2) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(203, 213, 225);
    doc.text(`${String(hr).padStart(2, '0')}:00`, mapX(hr) - 3, plotBot + 5);
  }

  // Legend inside chart top
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(34, 211, 238);
  doc.text('— Simuleret LAeq,korr (168t snit)', plotLeft, chartY + 4.8);
  doc.setTextColor(232, 121, 249);
  doc.text('— DBA Vind-Kompenseret LAeq', plotLeft + 52, chartY + 4.8);
  doc.setTextColor(148, 163, 184);
  doc.text('— DBA Raa Ukompenseret', plotLeft + 104, chartY + 4.8);
  doc.setTextColor(251, 113, 133);
  doc.text('■ Diskrepans |d| > 3,0 dB', plotLeft + 146, chartY + 4.8);

  y += chartH + 5;

  // Correlated Neighbor Complaints Summary on Page 1 bottom (if present)
  if (input.complaints && input.complaints.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `4. KORRELEREDE NABOKLAGE-LOGFILER MOD DBA & SIMULERING (${input.complaints.length} REGISTREREDE HÆNDELSER)`,
      marginX,
      y
    );
    y += 2.5;

    input.complaints.slice(0, 5).forEach((c) => {
      if (y + 5.5 > pageH - 12) return;
      doc.setFillColor(254, 242, 242);
      doc.rect(marginX, y, contentW, 5.2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.3);
      doc.setTextColor(159, 18, 57);
      doc.text(
        `${c.complaintId} (kl. ${c.hourLabel} · ${c.complainantBlock})`,
        marginX + 1.5,
        y + 3.6
      );
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(
        `Vind: ${fmtDa(c.v10m, 1)} m/s | Sim: ${fmtDa(c.simLaeqDb, 1)} dB | DBA Komp: ${fmtDa(
          c.dbaWindCompLaeqDb,
          1
        )} dB | Spids: ${fmtDa(c.dbaLafmaxPeakDb, 1)} dB | d=${
          c.simMinusDbaDeltaDb >= 0 ? '+' : ''
        }${fmtDa(c.simMinusDbaDeltaDb, 1)} dB`,
        marginX + 68,
        y + 3.6
      );
      y += 5.6;
    });
  }

  // =========================================================================
  // PAGES 2..N: COMPLETE 168-HOUR HISTORICAL DATA TABLE (ALL 168 HOURS)
  // =========================================================================
  const rowsPerPage = 42;
  const colHeaders = [
    '#',
    'Dag / Dato',
    'Kl.',
    'Vind',
    'Stød',
    'Sim LAeq',
    'DBA Raa',
    'Vindkomp',
    'DBA Komp',
    'DBA Spids',
    'Afvig. d',
    'Status / Flag',
  ];
  const colWidths = [8.5, 25.5, 11, 13, 13, 16, 16, 15, 16.5, 16.5, 14.5, 20.5];

  for (let offset = 0; offset < rows.length; offset += rowsPerPage) {
    doc.addPage();
    const chunk = rows.slice(offset, offset + rowsPerPage);
    const startNum = offset + 1;
    const endNum = offset + chunk.length;

    drawPageHeader(
      `Komplet 168-Timers Historisk Datatabel (Time #${String(startNum).padStart(
        3,
        '0'
      )} til #${String(endNum).padStart(3, '0')} af ${rows.length})`
    );

    let ty = 24.5;

    // Table Header
    doc.setFillColor(15, 23, 42);
    doc.rect(marginX, ty, contentW, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(248, 250, 252);

    let hx = marginX + 1.2;
    colHeaders.forEach((hdr, i) => {
      doc.text(hdr, hx, ty + 4.1);
      hx += colWidths[i];
    });
    ty += 6;

    chunk.forEach((r, idx) => {
      const globalIdx = offset + idx + 1;
      const rowH = 5.65;
      const isHighWind = r.v10m > 10;
      const isDisc = r.exceeds3dBDiscrepancy;

      if (isDisc) {
        doc.setFillColor(255, 241, 242);
        doc.rect(marginX, ty, contentW, rowH, 'F');
      } else if (isHighWind) {
        doc.setFillColor(254, 252, 232);
        doc.rect(marginX, ty, contentW, rowH, 'F');
      } else if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, ty, contentW, rowH, 'F');
      }

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.15);
      doc.line(marginX, ty + rowH, marginX + contentW, ty + rowH);

      const statusFlags: string[] = [];
      if (isDisc) statusFlags.push('|d|>3dB');
      if (isHighWind) statusFlags.push('v>10m/s');
      if (r.dbaWindCompLaeqDb > r.limitLaeqDb) statusFlags.push('>Graense');
      const statusText = statusFlags.length > 0 ? statusFlags.join(' · ') : 'Konkordant';

      const rowCells = [
        String(globalIdx).padStart(3, '0'),
        `D${r.dayIndex + 1} ${r.dateIso}`,
        r.hourLabel,
        `${fmtDa(r.v10m, 1)}`,
        `${fmtDa(r.vGusts, 1)}`,
        `${fmtDa(r.simLaeqDb, 1)}`,
        `${fmtDa(r.dbaRawUncompensatedDb, 1)}`,
        `-${fmtDa(r.micWindNoiseCompDb, 1)}`,
        `${fmtDa(r.dbaWindCompLaeqDb, 1)}`,
        `${fmtDa(r.dbaLafmaxPeakDb, 1)}`,
        `${r.simMinusDbaDeltaDb >= 0 ? '+' : ''}${fmtDa(r.simMinusDbaDeltaDb, 1)}`,
        statusText,
      ];

      let rx = marginX + 1.2;
      rowCells.forEach((cellTxt, cIdx) => {
        doc.setFontSize(6.1);
        if (cIdx === 10 && isDisc) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(190, 18, 60);
        } else if (cIdx === 3 && isHighWind) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(180, 83, 9);
        } else if (cIdx === 11 && (isDisc || isHighWind)) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(isDisc ? 190 : 180, isDisc ? 18 : 83, isDisc ? 60 : 9);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(30, 41, 59);
        }
        doc.text(cellTxt, rx, ty + 3.9);
        rx += colWidths[cIdx];
      });

      ty += rowH;
    });
  }

  // Add page numbers & forensic chain-of-custody footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.line(marginX, pageH - 9, pageW - marginX, pageH - 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Vind-Kompenseret Impuls-Katalog · ${input.dbaFileName} · Pearson r = ${fmtDa(
        stats.pearsonRComp,
        4
      )} · R² = ${fmtDa(stats.rSquaredComp * 100, 1)}% · RMSE = ${fmtDa(stats.rmseDb, 2)} dB`,
      marginX,
      pageH - 5
    );
    doc.text(`Side ${p} af ${totalPages}`, pageW - marginX - 18, pageH - 5);
  }

  const safeBlock = input.blockId.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(
    `Vind_Kompenseret_Impuls_Katalog_168t_Fuld_Rapport_${safeBlock}_${startDateIso}_til_${endDateIso}.pdf`
  );
}
