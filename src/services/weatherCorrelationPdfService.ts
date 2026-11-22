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
    .replace(/·/g, '|');
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
 * Generates and downloads a detailed PDF summary of Wind-Noise-Dust correlation
 * extracted from the 24-hour meteorological telemetry, ISO 9613-2 acoustic refraction model,
 * and BEK 613/2026 dust sum-quotient dispersion simulation.
 */
export function generateWeatherCorrelationPdfReport(
  params: WeatherCorrelationPdfParams
): void {
  const { weatherDataset, simulation, sources, receptors, observations, sha256Hash } = params;
  const { currentWeather, receptorExposures, puff24h, maxSiteSumQuotient } = simulation;

  // Determine highest-priority target point (worst current receptor or primary residential anchor)
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

  const emptyActivityConfigs: Record<string, SourceActivityConfig> = {};

  const hourly24Series = weatherDataset.hours.map((hr) =>
    evaluateNoiseAndDustAtPoint(focusPoint, hr, sources, emptyActivityConfigs)
  );

  const laeqArr = hourly24Series.map((h) => h.combinedLaeqDb);
  const lafmaxArr = hourly24Series.map((h) => h.combinedLafmaxDb);
  const dustArr = hourly24Series.map((h) => h.adjustedDustSumQuotient);
  const refractionArr = hourly24Series.map((h) => h.netWeatherRefractionEffectDb);
  const windSpeedArr = hourly24Series.map((h) => h.weather.windSpeed10m);

  const rWindToNoise = computePearsonCorrelation(refractionArr, laeqArr);
  const rNoiseToDust = computePearsonCorrelation(laeqArr, dustArr);
  const rWindSpeedToDust = computePearsonCorrelation(windSpeedArr, dustArr);

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
      curr.adjustedDustSumQuotient > best.adjustedDustSumQuotient ? curr : best,
    hourly24Series[0]
  );
  const maxWindHour = hourly24Series.reduce(
    (best, curr) => (curr.weather.windSpeed10m > best.weather.windSpeed10m ? curr : best),
    hourly24Series[0]
  );

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

  // Top Header Banner
  doc.setFillColor(11, 14, 23);
  doc.rect(0, 0, pageW, 34, 'F');
  doc.setDrawColor(6, 182, 212);
  doc.setLineWidth(0.7);
  doc.line(margin, 30.5, pageW - margin, 30.5);

  doc.setTextColor(34, 211, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.text(
    sanitizePdfText(
      'RINGPARKEN MILJOE- & SPREDNINGSTELEMETRI | VIND-STOEJ-STOEV KORRELATIONSRAPPORT (PSS SAG W22085)'
    ),
    margin,
    9.5
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13.5);
  doc.text(
    sanitizePdfText(
      `Vejr-, Stoej- & Stoevkorrelationsrapport (${weatherDataset.dateIso} kl. ${currentWeather.hourLabel})`
    ),
    margin,
    17
  );

  doc.setTextColor(148, 163, 184);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.4);
  doc.text(
    sanitizePdfText(
      `Fokus-Receptor: ${focusLabel} | Stabilitet: Pasquill ${currentWeather.pasquillClass} | SHA-256: ${sha256Hash.slice(
        0,
        24
      )}...`
    ),
    margin,
    24
  );

  doc.text(
    sanitizePdfText(
      `Model: ISO 9613-2 Akustisk Refraktion + MST Vejl. 5/1984 + BEK 613/2026 Gaussisk Plume/Puff`
    ),
    margin,
    28.5
  );

  y = 40;

  // KPI Correlation Summary Grid (4 boxes)
  const kpiW = (contentW - 6) / 4;
  const kpis = [
    {
      label: 'PEARSON r (VIND <-> STOEJ)',
      val: `${rWindToNoise >= 0 ? '+' : ''}${rWindToNoise.toFixed(2)}`,
      sub: `Refraktion vs L_Aeq`,
      bg: [236, 254, 255] as [number, number, number],
      border: [6, 182, 212] as [number, number, number],
      text: [14, 116, 144] as [number, number, number],
    },
    {
      label: 'PEARSON r (STOEJ <-> STOEV)',
      val: `${rNoiseToDust >= 0 ? '+' : ''}${rNoiseToDust.toFixed(2)}`,
      sub: `r(Vind<->Stoev): ${rWindSpeedToDust >= 0 ? '+' : ''}${rWindSpeedToDust.toFixed(2)}`,
      bg: [255, 247, 237] as [number, number, number],
      border: [234, 88, 12] as [number, number, number],
      text: [194, 65, 12] as [number, number, number],
    },
    {
      label: 'DOBBELT-OVERSKRIDELSE',
      val: `${dualExceedanceHours}t / 24t`,
      sub: `Stoej > GV: ${noiseExceedanceHours}t`,
      bg: (dualExceedanceHours > 0 ? [255, 241, 242] : [236, 253, 245]) as [number, number, number],
      border: (dualExceedanceHours > 0 ? [225, 29, 72] : [16, 185, 129]) as [number, number, number],
      text: (dualExceedanceHours > 0 ? [190, 18, 60] : [4, 120, 87]) as [number, number, number],
    },
    {
      label: 'SPIDS STOEJ & STOEV (24T)',
      val: `${peakNoiseHour?.combinedLaeqDb.toFixed(1) ?? '0.0'} dB`,
      sub: `L_AFmax ${Math.max(...lafmaxArr, 0).toFixed(0)} dB | Max S=${maxSiteSumQuotient.toFixed(2)}`,
      bg: [248, 250, 252] as [number, number, number],
      border: [100, 116, 139] as [number, number, number],
      text: [15, 23, 42] as [number, number, number],
    },
  ];

  kpis.forEach((k, idx) => {
    const kx = margin + idx * (kpiW + 2);
    doc.setFillColor(...k.bg);
    doc.setDrawColor(...k.border);
    doc.setLineWidth(0.35);
    doc.rect(kx, y, kpiW, 18.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(71, 85, 105);
    doc.text(sanitizePdfText(k.label), kx + 2, y + 4.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...k.text);
    doc.text(sanitizePdfText(k.val), kx + 2, y + 11.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(51, 65, 85);
    doc.text(sanitizePdfText(k.sub), kx + 2, y + 16.0);
  });
  y += 23;

  // Section 01: Executive Weather-Noise-Dust Telemetry Summary
  ensureSpace(28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.setTextColor(15, 23, 42);
  doc.text(
    sanitizePdfText('01. AKTUEL METEOROLOGI & VIND-STOEJ-STOEV SAMMENHÆNG'),
    margin,
    y
  );
  y += 4;

  const plumeVectorDeg = (currentWeather.windDirection10m + 180) % 360;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentW, 20, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(30, 41, 59);
  const summaryLines = [
    `Valgt tidspunkt: ${weatherDataset.dateIso} kl. ${currentWeather.hourLabel} | Vind: ${currentWeather.windSpeed10m.toFixed(
      1
    )} m/s (stød ${currentWeather.windGusts10m.toFixed(1)} m/s) fra ${
      currentWeather.windDirection10m
    }° (${degreesToCompass(currentWeather.windDirection10m)}) -> Spredningsfane mod ${plumeVectorDeg}°`,
    `Atmosfærisk stabilitet: Pasquill ${currentWeather.pasquillClass} | Temp: ${currentWeather.temperature2m.toFixed(
      1
    )} °C | Fugt: ${currentWeather.relativeHumidity2m}% | Nedbør: ${currentWeather.precipitation.toFixed(
      1
    )} mm/t | 24t spidsvind kl. ${maxWindHour?.weather.hourLabel ?? '13:00'} (${
      maxWindHour?.weather.windSpeed10m.toFixed(1) ?? '0.0'
    } m/s)`,
    `24t Spidsstøj: kl. ${peakNoiseHour?.weather.hourLabel ?? '13:00'} (${peakNoiseHour?.combinedLaeqDb.toFixed(
      1
    )} dB L_Aeq) | 24t Spidsstøv ved fokus: kl. ${peakDustHour?.weather.hourLabel ?? '13:00'} (S = ${peakDustHour?.adjustedDustSumQuotient.toFixed(
      2
    )}) | 24t Puff spidsreceptor: ${puff24h.peakReceptor.receptorName}`,
  ];
  summaryLines.forEach((line, i) => {
    doc.text(sanitizePdfText(line), margin + 3, y + 5.2 + i * 5.6);
  });
  y += 24;

  // Section 02: Current-Hour Spatial Correlation Across Top 6 Receptor Zones
  ensureSpace(26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
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

  // Section 03: Full 24-Hour Time-Series Wind-Noise-Dust Matrix (00:00 -> 23:00)
  ensureSpace(32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.setTextColor(15, 23, 42);
  doc.text(
    sanitizePdfText(`03. 24-TIMERS VIND-, STOEJ- & STOEV-KORRELATIONSMATRIX (${focusLabel})`),
    margin,
    y
  );
  y += 3.5;

  const hCols = [14, 24, 20, 16, 18, 19, 19, 18, 38];
  const hHeaders = [
    'Time',
    'Vind (m/s)',
    'Retn.',
    'Pasq.',
    'Refr. dB',
    'L_Aeq',
    'L_AFmax',
    'Stoev S',
    'Sambelastning',
  ];

  const drawHourlyTableHeader = () => {
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, y, contentW, 6.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.9);
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
      `${row.weather.windSpeed10m.toFixed(1)} (${row.weather.windGusts10m.toFixed(0)})`,
      `${row.weather.windDirection10m}°`,
      row.weather.pasquillClass,
      `${row.netWeatherRefractionEffectDb >= 0 ? '+' : ''}${row.netWeatherRefractionEffectDb.toFixed(
        1
      )}`,
      `${row.combinedLaeqDb.toFixed(1)}`,
      `${row.combinedLafmaxDb.toFixed(1)}`,
      `${row.adjustedDustSumQuotient.toFixed(2)}`,
      row.coExposureSeverity.slice(0, 24),
    ];

    let cx = margin + 1.5;
    cells.forEach((cell, cIdx) => {
      doc.setFont(
        'helvetica',
        isSelected || cIdx === 0 || (isDual && cIdx >= 5) ? 'bold' : 'normal'
      );
      doc.setFontSize(6.8);
      if (isDual && cIdx >= 5) {
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
    doc.setFontSize(9.8);
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
      doc.setFontSize(7.6);
      doc.setTextColor(15, 23, 42);
      doc.text(
        sanitizePdfText(
          `${obs.code} (${obs.observedDateIso} kl. ${obs.observedHourLabel}) | ${obs.locationLabel} | ${evalAtObs.coExposureSeverity}`
        ),
        margin + 2.5,
        y + 4.8
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.1);
      doc.setTextColor(51, 65, 85);
      doc.text(
        sanitizePdfText(
          `Vind: ${obs.weatherSnapshot.windSpeed10m.toFixed(1)} m/s (${obs.weatherSnapshot.windDirection10m}°) | L_Aeq: ${evalAtObs.combinedLaeqDb.toFixed(
            1
          )} dB | L_AFmax: ${evalAtObs.combinedLafmaxDb.toFixed(
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
        `Ringparken Vind-Stoej-Stoev Korrelationsrapport | PSS W22085 | SHA-256: ${sha256Hash.slice(
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
    `Ringparken_Vejr_Stoej_Stoev_Korrelationsrapport_${weatherDataset.dateIso}_kl_${safeHour}.pdf`
  );
}
