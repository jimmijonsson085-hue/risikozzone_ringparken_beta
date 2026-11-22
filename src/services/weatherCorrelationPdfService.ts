import { jsPDF } from 'jspdf';
import {
  computePearsonCorrelation,
  evaluateNoiseAndDustAtPoint,
  SourceActivityConfig,
} from '../components/WeatherNoiseDustCorrelationPanel';
import {
  AlgedonicObservation,
  DemolitionSourceNode,
  DispersionSimulationState,
  ReceptorZone,
  WeatherDataset,
} from '../types/dispersion';
import { evaluateReceptorAtHour } from './dispersionEngine';
import { degreesToCompass } from './weatherService';

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

export interface WeatherCorrelationPdfParams {
  weatherDataset: WeatherDataset;
  simulation: DispersionSimulationState;
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  observations: AlgedonicObservation[];
  sha256Hash: string;
}

/**
 * Generates and downloads a detailed forensic PDF report of the current Weather, Wind Gust,
 * and Dust Correlation including the last 24 hours of meteorological wind gust telemetry,
 * particulate & asbestos dust concentrations (ug/m^3, fibre/cm^3, ug/m^2), ISO 9613-2 acoustic
 * refraction metrics, and SHA-256 forensic chain-of-custody metadata (BEK 613/2026 & L 69).
 */
export function generateWeatherCorrelationPdfReport(
  params: WeatherCorrelationPdfParams
): void {
  const { weatherDataset, simulation, sources, receptors, observations, sha256Hash } = params;
  const { currentWeather, receptorExposures, puff24h, maxSiteSumQuotient } = simulation;

  const worstExposure =
    [...receptorExposures].sort((a, b) => b.sumQuotient - a.sumQuotient)[0] || null;
  const targetReceptor =
    (worstExposure ? receptors.find((r) => r.id === worstExposure.receptorId) : null) ||
    receptors.find((r) => r.id === 'rec-roedtjoornevej-2') ||
    receptors[0];

  const focusPoint = targetReceptor
    ? targetReceptor.center
    : { lat: 55.4122, lng: 11.3522 };
  const focusLabel = targetReceptor
    ? `${targetReceptor.code} - ${targetReceptor.name}`
    : 'Roedtjoernevej 2 (C962+VV Slagelse)';

  const targetPuffProfile =
    (targetReceptor
      ? puff24h.receptorSummaries.find((r) => r.receptorId === targetReceptor.id)
      : null)?.hourlyProfile || puff24h.peakReceptor.hourlyProfile;

  const emptyActivityConfigs: Record<string, SourceActivityConfig> = {};

  const safeTargetReceptor: ReceptorZone = targetReceptor || {
    id: 'fallback-rec',
    code: 'R01',
    name: 'Roedtjoernevej 2',
    address: 'Roedtjoernevej 2, 4200 Slagelse',
    category: 'residential',
    center: focusPoint,
    polygon: [focusPoint],
    description: 'Fokus-receptor',
  };

  const hourly24Series = weatherDataset.hours.map((hr, idx) => {
    const noiseDust = evaluateNoiseAndDustAtPoint(
      focusPoint,
      hr,
      sources,
      emptyActivityConfigs
    );
    const receptorEval = evaluateReceptorAtHour(safeTargetReceptor, sources, hr);
    const puffHour = targetPuffProfile[idx];

    const asbestosConc =
      receptorEval.substances.find((s) => s.key === 'asbestos')?.concentration ?? 0;
    const pcbConc =
      receptorEval.substances.find((s) => s.key === 'pcb')?.concentration ?? 0;
    const heavyMetalsConc =
      receptorEval.substances.find((s) => s.key === 'heavyMetals')?.concentration ?? 0;
    const quartzConc =
      receptorEval.substances.find((s) => s.key === 'quartzWool')?.concentration ?? 0;

    // Total particulate respirable dust concentration in ug/m^3 (PCB + heavy metals + quartz + asbestos mass equivalent)
    const totalDustConcUgM3 = Number(
      (
        pcbConc +
        heavyMetalsConc +
        quartzConc * 1000 +
        asbestosConc * 1200 +
        noiseDust.adjustedDustSumQuotient * 18.5
      ).toFixed(2)
    );
    const depositedDustUgM2 = Number(
      (
        puffHour?.depositedDustUgM2 ??
        Math.max(0.5, noiseDust.adjustedDustSumQuotient * 100)
      ).toFixed(1)
    );

    return {
      ...noiseDust,
      asbestosFibreCm3: asbestosConc,
      totalDustConcUgM3,
      depositedDustUgM2,
    };
  });

  const laeqArr = hourly24Series.map((h) => h.combinedLaeqDb);
  const lafmaxArr = hourly24Series.map((h) => h.combinedLafmaxDb);
  const dustArr = hourly24Series.map((h) => h.adjustedDustSumQuotient);
  const dustConcArr = hourly24Series.map((h) => h.totalDustConcUgM3);
  const refractionArr = hourly24Series.map((h) => h.netWeatherRefractionEffectDb);
  const windSpeedArr = hourly24Series.map((h) => h.weather.windSpeed10m);
  const windGustArr = hourly24Series.map((h) => h.weather.windGusts10m);

  const rWindToNoise = computePearsonCorrelation(refractionArr, laeqArr);
  const rNoiseToDust = computePearsonCorrelation(laeqArr, dustArr);
  const rWindSpeedToDust = computePearsonCorrelation(windSpeedArr, dustArr);
  const rGustsToDustConc = computePearsonCorrelation(windGustArr, dustConcArr);

  const noiseExceedanceHours = hourly24Series.filter(
    (h) => h.exceedsLaeqLimit || h.exceedsLafmaxLimit
  ).length;
  const dualExceedanceHours = hourly24Series.filter(
    (h) =>
      (h.exceedsLaeqLimit || h.exceedsLafmaxLimit) &&
      h.adjustedDustSumQuotient >= 1.0
  ).length;

  const peakNoiseHour = hourly24Series.reduce(
    (best, curr) => (curr.combinedLaeqDb > best.combinedLaeqDb ? curr : best),
    hourly24Series[0]
  );
  const peakDustHour = hourly24Series.reduce(
    (best, curr) =>
      curr.totalDustConcUgM3 > best.totalDustConcUgM3 ? curr : best,
    hourly24Series[0]
  );
  const maxWindHour = hourly24Series.reduce(
    (best, curr) =>
      curr.weather.windSpeed10m > best.weather.windSpeed10m ? curr : best,
    hourly24Series[0]
  );
  const maxGustHour = hourly24Series.reduce(
    (best, curr) =>
      curr.weather.windGusts10m > best.weather.windGusts10m ? curr : best,
    hourly24Series[0]
  );

  const meanWindGustMs =
    windGustArr.reduce((acc, v) => acc + v, 0) / Math.max(1, windGustArr.length);
  const meanDustConcUgM3 =
    dustConcArr.reduce((acc, v) => acc + v, 0) / Math.max(1, dustConcArr.length);

  // Current hour wind-noise-dust evaluation across top 6 exposed receptors
  const topReceptorEvaluations = [...receptorExposures]
    .sort((a, b) => b.sumQuotient - a.sumQuotient)
    .slice(0, 6)
    .map((exp) => {
      const rec = receptors.find((r) => r.id === exp.receptorId);
      const evalRes = evaluateNoiseAndDustAtPoint(
        rec?.center || focusPoint,
        currentWeather,
        sources,
        emptyActivityConfigs
      );
      return { exp, rec, evalRes };
    });

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

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageH - 16) {
      doc.addPage();
      y = 14;
    }
  };

  // Top Header Banner (Forensic Edition)
  doc.setFillColor(11, 14, 23);
  doc.rect(0, 0, pageW, 36, 'F');
  doc.setDrawColor(6, 182, 212);
  doc.setLineWidth(0.7);
  doc.line(margin, 32.5, pageW - margin, 32.5);

  doc.setTextColor(34, 211, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.0);
  doc.text(
    sanitizePdfText(
      'RETSMEDICINSK MILJOE- & SPREDNINGSRAPPORT | VINDSTOED, STOEVKONCENTRATION & STOEJ (PSS SAG W22085)'
    ),
    margin,
    9.2
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13.2);
  doc.text(
    sanitizePdfText(
      `Retsmedicinsk Vejr- & Stoevkorrelationsrapport (24t) - ${weatherDataset.dateIso} kl. ${currentWeather.hourLabel}`
    ),
    margin,
    16.8
  );

  doc.setTextColor(148, 163, 184);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.2);
  doc.text(
    sanitizePdfText(
      `Fokus-Receptor: ${focusLabel} | Stabilitet: Pasquill ${currentWeather.pasquillClass} | SHA-256: ${sha256Hash.slice(
        0,
        28
      )}...`
    ),
    margin,
    23.5
  );

  doc.text(
    sanitizePdfText(
      `Lovgrundlag: BEK nr. 613/2026 § 3 stk. 3, L 69 (BEK 1328/2025), ISO 9613-2 & MST Vejl. 5/1984 | Genereret: ${new Date().toISOString()}`
    ),
    margin,
    28.8
  );

  y = 41;

  // KPI Correlation Summary Grid (4 boxes)
  const kpiW = (contentW - 6) / 4;
  const kpis = [
    {
      label: 'SPIDS VINDSTOED (24T)',
      val: `${maxGustHour?.weather.windGusts10m.toFixed(1) ?? '0.0'} m/s`,
      sub: `Snit: ${meanWindGustMs.toFixed(1)} m/s | Kl. ${maxGustHour?.weather.hourLabel ?? '13:00'}`,
      bg: [236, 254, 255] as [number, number, number],
      border: [6, 182, 212] as [number, number, number],
      text: [14, 116, 144] as [number, number, number],
    },
    {
      label: 'SPIDS STOEVKONC. (24T)',
      val: `${peakDustHour?.totalDustConcUgM3.toFixed(1) ?? '0.0'} ug/m3`,
      sub: `Snit: ${meanDustConcUgM3.toFixed(1)} ug/m3 | S=${peakDustHour?.adjustedDustSumQuotient.toFixed(2) ?? '0.00'}`,
      bg: [255, 247, 237] as [number, number, number],
      border: [234, 88, 12] as [number, number, number],
      text: [194, 65, 12] as [number, number, number],
    },
    {
      label: 'KORRELATION r (STOED<->STOEV)',
      val: `${rGustsToDustConc >= 0 ? '+' : ''}${rGustsToDustConc.toFixed(2)}`,
      sub: `r(Vind<->Stoej): ${rWindToNoise >= 0 ? '+' : ''}${rWindToNoise.toFixed(2)} | r(Stoej<->Stoev): ${rNoiseToDust >= 0 ? '+' : ''}${rNoiseToDust.toFixed(2)}`,
      bg: [248, 250, 252] as [number, number, number],
      border: [100, 116, 139] as [number, number, number],
      text: [15, 23, 42] as [number, number, number],
    },
    {
      label: 'DOBBELT-OVERSKRIDELSE',
      val: `${dualExceedanceHours}t / 24t`,
      sub: `Stoej > GV: ${noiseExceedanceHours}t | Max S=${maxSiteSumQuotient.toFixed(2)}`,
      bg: (dualExceedanceHours > 0 ? [255, 241, 242] : [236, 253, 245]) as [number, number, number],
      border: (dualExceedanceHours > 0 ? [225, 29, 72] : [16, 185, 129]) as [number, number, number],
      text: (dualExceedanceHours > 0 ? [190, 18, 60] : [4, 120, 87]) as [number, number, number],
    },
  ];

  kpis.forEach((k, idx) => {
    const kx = margin + idx * (kpiW + 2);
    doc.setFillColor(...k.bg);
    doc.setDrawColor(...k.border);
    doc.setLineWidth(0.35);
    doc.rect(kx, y, kpiW, 18.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.3);
    doc.setTextColor(71, 85, 105);
    doc.text(sanitizePdfText(k.label), kx + 2, y + 4.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...k.text);
    doc.text(sanitizePdfText(k.val), kx + 2, y + 11.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(51, 65, 85);
    doc.text(sanitizePdfText(k.sub), kx + 2, y + 16.0);
  });
  y += 23;

  // Section 01: Executive Weather-WindGust-Dust Telemetry Summary
  ensureSpace(32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.6);
  doc.setTextColor(15, 23, 42);
  doc.text(
    sanitizePdfText('01. AKTUEL METEOROLOGI, VINDSTOED & 24T STOEVKONCENTRATION'),
    margin,
    y
  );
  y += 4;

  const plumeVectorDeg = (currentWeather.windDirection10m + 180) % 360;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentW, 25, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(30, 41, 59);
  const summaryLines = [
    `Valgt tidspunkt: ${weatherDataset.dateIso} kl. ${currentWeather.hourLabel} | Middelvind: ${currentWeather.windSpeed10m.toFixed(
      1
    )} m/s | Vindstoed: ${currentWeather.windGusts10m.toFixed(1)} m/s fra ${
      currentWeather.windDirection10m
    }° (${degreesToCompass(currentWeather.windDirection10m)}) -> Spredningsfane mod ${plumeVectorDeg}°`,
    `Atmosfaere: Pasquill ${currentWeather.pasquillClass} | Temp: ${currentWeather.temperature2m.toFixed(
      1
    )} °C | Fugt: ${currentWeather.relativeHumidity2m}% | Nedboer: ${currentWeather.precipitation.toFixed(
      1
    )} mm/t | 24t spids middelvind kl. ${maxWindHour?.weather.hourLabel ?? '13:00'} (${
      maxWindHour?.weather.windSpeed10m.toFixed(1) ?? '0.0'
    } m/s)`,
    `24t Spids Vindstoed: ${maxGustHour?.weather.windGusts10m.toFixed(1) ?? '0.0'} m/s kl. ${
      maxGustHour?.weather.hourLabel ?? '13:00'
    } | 24t Spids Stoevkoncentration: ${peakDustHour?.totalDustConcUgM3.toFixed(2) ?? '0.00'} ug/m^3 (Asbest ${
      peakDustHour?.asbestosFibreCm3.toFixed(4) ?? '0.0000'
    } f/cm^3) kl. ${peakDustHour?.weather.hourLabel ?? '13:00'}`,
    `24t Spidsstoej: kl. ${peakNoiseHour?.weather.hourLabel ?? '13:00'} (${peakNoiseHour?.combinedLaeqDb.toFixed(
      1
    )} dB L_Aeq) | r(Vind<->Stoev) = ${rWindSpeedToDust.toFixed(
      2
    )} | r(Vindstoed<->Stoevkonc.) = ${rGustsToDustConc.toFixed(
      2
    )} | 24t Puff spidsreceptor: ${puff24h.peakReceptor.receptorName}`,
  ];
  summaryLines.forEach((line, i) => {
    doc.text(sanitizePdfText(line), margin + 3, y + 5.2 + i * 5.6);
  });
  y += 29;

  // Section 02: Current-Hour Spatial Correlation Across Top 6 Receptor Zones
  ensureSpace(26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.6);
  doc.setTextColor(15, 23, 42);
  doc.text(
    sanitizePdfText(
      `02. RECEPTOR-OPDELT VIND-STOEJ-STOEV KORRELATION (KL. ${currentWeather.hourLabel})`
    ),
    margin,
    y
  );
  y += 3.5;

  const recColWidths = [46, 22, 22, 22, 22, 22, 30];
  const recHeaders = [
    'Receptorzone',
    'L_Aeq (dB)',
    'L_AFmax',
    'Refrakt.',
    'Stoev S',
    'Dom. Kilde',
    'Sambelastning',
  ];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentW, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  let rx = margin + 2;
  recHeaders.forEach((h, idx) => {
    doc.text(sanitizePdfText(h), rx, y + 4.4);
    rx += recColWidths[idx];
  });
  y += 6.5;

  topReceptorEvaluations.forEach(({ exp, evalRes }, rowIdx) => {
    ensureSpace(7);
    const isCritical = evalRes.coExposureSeverity === 'KRITISK DOBBELT-BELASTNING';
    if (isCritical) {
      doc.setFillColor(255, 241, 242);
    } else if (rowIdx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentW, 6.5, 'FD');

    const cells = [
      `${exp.receptorCode} ${exp.receptorName.slice(0, 20)}`,
      `${evalRes.combinedLaeqDb.toFixed(1)}`,
      `${evalRes.combinedLafmaxDb.toFixed(1)}`,
      `${evalRes.netWeatherRefractionEffectDb >= 0 ? '+' : ''}${evalRes.netWeatherRefractionEffectDb.toFixed(
        1
      )} dB`,
      `${evalRes.adjustedDustSumQuotient.toFixed(2)}`,
      `${evalRes.dominantNoiseSourceCode}`,
      `${evalRes.coExposureSeverity.slice(0, 18)}`,
    ];
    let cx = margin + 2;
    cells.forEach((val, idx) => {
      doc.setFont('helvetica', idx === 0 || idx === 6 ? 'bold' : 'normal');
      doc.setFontSize(7.0);
      if (idx === 6 && isCritical) {
        doc.setTextColor(190, 18, 60);
      } else {
        doc.setTextColor(30, 41, 59);
      }
      doc.text(sanitizePdfText(val), cx, y + 4.4);
      cx += recColWidths[idx];
    });
    y += 6.5;
  });
  y += 5;

  // Section 03: Full 24-Hour Time-Series Wind Gust & Dust Concentration Forensic Matrix (00:00 -> 23:00)
  ensureSpace(34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.6);
  doc.setTextColor(15, 23, 42);
  doc.text(
    sanitizePdfText(
      `03. 24-TIMERS VINDSTOED- & STOEVKONCENTRATIONSMATRIX (${focusLabel})`
    ),
    margin,
    y
  );
  y += 3.5;

  const hCols = [13, 17, 19, 17, 24, 21, 16, 25, 34];
  const hHeaders = [
    'Time',
    'Vind m/s',
    'Stoed m/s',
    'Pasq.',
    'Stoev ug/m3',
    'Asbest f/cm3',
    'Sumkv. S',
    'LAeq / Max',
    'Retsstatus',
  ];

  const drawHourlyTableHeader = () => {
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, contentW, 6.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    let hx = margin + 1.5;
    hHeaders.forEach((hdr, i) => {
      doc.text(sanitizePdfText(hdr), hx, y + 4.2);
      hx += hCols[i];
    });
    y += 6.2;
  };

  drawHourlyTableHeader();

  hourly24Series.forEach((row, idx) => {
    if (y + 6.5 > pageH - 16) {
      doc.addPage();
      y = 14;
      drawHourlyTableHeader();
    }
    const isSelected = row.weather.hourIndex === currentWeather.hourIndex;
    const isDual =
      (row.exceedsLaeqLimit || row.exceedsLafmaxLimit) &&
      row.adjustedDustSumQuotient >= 1.0;

    if (isDual) {
      doc.setFillColor(255, 228, 230);
    } else if (isSelected) {
      doc.setFillColor(224, 242, 254);
    } else if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
    } else {
      doc.setFillColor(255, 255, 255);
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentW, 5.6, 'FD');

    const cells = [
      row.weather.hourLabel,
      `${row.weather.windSpeed10m.toFixed(1)}`,
      `${row.weather.windGusts10m.toFixed(1)}`,
      `${row.weather.windDirection10m}° ${row.weather.pasquillClass}`,
      `${row.totalDustConcUgM3.toFixed(1)}`,
      `${row.asbestosFibreCm3.toFixed(4)}`,
      `${row.adjustedDustSumQuotient.toFixed(2)}`,
      `${row.combinedLaeqDb.toFixed(0)}/${row.combinedLafmaxDb.toFixed(0)} dB`,
      row.coExposureSeverity.slice(0, 22),
    ];

    let cx = margin + 1.5;
    cells.forEach((cell, cIdx) => {
      doc.setFont(
        'helvetica',
        isSelected || cIdx === 0 || (isDual && cIdx >= 4) ? 'bold' : 'normal'
      );
      doc.setFontSize(6.5);
      if (isDual && cIdx >= 4) {
        doc.setTextColor(190, 18, 60);
      } else if (isSelected) {
        doc.setTextColor(3, 105, 161);
      } else {
        doc.setTextColor(30, 41, 59);
      }
      doc.text(sanitizePdfText(cell), cx, y + 3.9);
      cx += hCols[cIdx];
    });
    y += 5.6;
  });
  y += 5;

  // Section 04: Field Observations Matched Against Weather-Noise-Dust Model
  if (observations.length > 0) {
    ensureSpace(22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(15, 23, 42);
    doc.text(
      sanitizePdfText(
        `04. FELT-OBSERVATIONER & NABOKLAGER KOBLET TIL VEJR-STOEJ-STOEV MODEL (${observations.length})`
      ),
      margin,
      y
    );
    y += 4;

    observations.slice(0, 8).forEach((obs) => {
      ensureSpace(15);
      const evalAtObs = evaluateNoiseAndDustAtPoint(
        obs.position,
        obs.weatherSnapshot,
        sources,
        emptyActivityConfigs
      );
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(148, 163, 184);
      doc.rect(margin, y, contentW, 13, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(
        sanitizePdfText(
          `${obs.code} (${obs.observedDateIso} kl. ${obs.observedHourLabel}) | ${obs.locationLabel} | ${evalAtObs.coExposureSeverity}`
        ),
        margin + 2.5,
        y + 4.8
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.0);
      doc.setTextColor(51, 65, 85);
      doc.text(
        sanitizePdfText(
          `Vind: ${obs.weatherSnapshot.windSpeed10m.toFixed(1)} m/s (stoed ${obs.weatherSnapshot.windGusts10m.toFixed(
            1
          )} m/s, ${obs.weatherSnapshot.windDirection10m}°) | L_Aeq: ${evalAtObs.combinedLaeqDb.toFixed(
            1
          )} dB | Stoev S: ${evalAtObs.adjustedDustSumQuotient.toFixed(2)} | SHA-256: ${obs.sha256Signature.slice(
            0,
            18
          )}...`
        ),
        margin + 2.5,
        y + 9.8
      );
      y += 14.5;
    });
  }

  // Section 05: Forensic Evidentiary Declaration & SHA-256 Chain-of-Custody Seal
  ensureSpace(34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.6);
  doc.setTextColor(15, 23, 42);
  doc.text(
    sanitizePdfText('05. RETSMEDICINSK ERKLAERING, METODEVALIDERING & SHA-256 BEVISKAEDE'),
    margin,
    y
  );
  y += 4;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(71, 85, 105);
  doc.rect(margin, y, contentW, 24, 'FD');
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(15, 23, 42);
  const forensicLines = [
    `Dokument-ID: PSS-W22085-${weatherDataset.dateIso}-${currentWeather.hourLabel.replace(':', '')} | Kilde-noder aktive: ${
      sources.filter((s) => s.active).length
    }/${sources.length}`,
    `Normgrundlag: BEK nr. 613 af 29/06/2026 § 3 stk. 3 (Sumkvotient S >= 1,0 ulovlig) | L 69 / BEK 1328/2025 | ISO 9613-2`,
    `SHA-256 Integritetssegl (komplet 64-tegn): ${sha256Hash}`,
  ];
  forensicLines.forEach((line, idx) => {
    doc.text(sanitizePdfText(line), margin + 2.5, y + 6 + idx * 5.8);
  });
  y += 28;

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
        `Ringparken Retsmedicinsk Vejr-, Vindstoed- & Stoevrapport | PSS W22085 | SHA-256: ${sha256Hash.slice(
          0,
          18
        )}... | Side ${p}/${totalPages}`
      ),
      margin,
      pageH - 6.5
    );
  }

  const safeHour = currentWeather.hourLabel.replace(':', '');
  doc.save(
    `Ringparken_Retsmedicinsk_Vejr_Stoev_Korrelationsrapport_${weatherDataset.dateIso}_kl_${safeHour}.pdf`
  );
}
