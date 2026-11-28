/**
 * @file src/services/meteorologicalRefractionPdfContext.ts
 * @description Beregner og indlejrer automatisk 'Meteorological Refraction Context'
 * (lokal vindgradient, temperaturgradient, effektiv lydhastighedsgradient og beregnet
 * dB-påvirkning på lydudbredelse) i PDF-eksporter, når en maskines impulsstøj-hændelse
 * registreres eller eksporteres.
 */

import { jsPDF } from 'jspdf';
import {
  AlgedonicObservation,
  HourlyWeatherPoint,
} from '../types/dispersion';
import { THERMAL_GRADIENT_MAP } from './acousticRefractionMath';
import { deterministicHexHash256 } from './autonomousReceptorMeshService';

export interface MeteorologicalRefractionContextSummary {
  windSpeed10mMs: number;
  windGusts10mMs: number;
  effectiveWindSpeedMs: number;
  windDirectionDeg: number;
  downwindPropagationDeg: number;
  temperature2mC: number;
  pasquillClass: string;
  precipitationMm: number;
  windGradientDuDzPerSec: number; // du/dz (s^-1)
  tempGradientDtDzKPerM: number; // dT/dz (K/m)
  tempGradientDtDzKPer100m: number; // dT/dz (K/100m)
  thermalRegimeLabelDa: string;
  speedOfSoundC0Ms: number;
  effectiveSoundSpeedGradientPerSec: number; // dc_eff/dz = 0.6*dT/dz + du/dz (s^-1)
  rayCurvatureRadiusKm: number | null;
  downwindWindRefractionDb: number;
  thermalRefractionDb: number;
  rainSplashBonusDb: number;
  netDownwindPropagationDeltaDb: number;
  upwindShadowAttenuationDb: number;
  propagationClassificationDa: string;
  scientificSummaryDa: string;
}

export interface MeteorologicalRefractionPdfEntry {
  eventCode: string;
  timestampLabel: string;
  locationLabel: string;
  lafmaxDb?: number;
  context: MeteorologicalRefractionContextSummary;
}

function cleanPdfStr(input: string): string {
  return String(input || '')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/↔/g, '<->')
    .replace(/→/g, '->')
    .replace(/Δ/g, 'd')
    .replace(/∂/g, 'd')
    .replace(/°/g, ' deg')
    .replace(/₁/g, '1')
    .replace(/₀/g, '0')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁻¹/g, '^-1')
    .replace(/·/g, '|')
    .replace(/—/g, '-');
}

export function computeMeteorologicalRefractionContext(params: {
  windSpeed10m: number;
  windGusts10m?: number;
  windDirection10m: number;
  temperature2m?: number;
  pasquillClass?: string;
  precipitation?: number;
}): MeteorologicalRefractionContextSummary {
  const windSpeed10mMs = Number((params.windSpeed10m ?? 0).toFixed(1));
  const windGusts10mMs = Number(
    Math.max(windSpeed10mMs, params.windGusts10m ?? windSpeed10mMs * 1.32).toFixed(1)
  );
  const windDirectionDeg = Math.round(((params.windDirection10m ?? 245) + 360) % 360);
  const downwindPropagationDeg = (windDirectionDeg + 180) % 360;
  const temperature2mC = Number((params.temperature2m ?? 9.5).toFixed(1));
  const pasquillClass = (params.pasquillClass || 'D').toUpperCase();
  const precipitationMm = Number(Math.max(0, params.precipitation ?? 0).toFixed(1));

  const effectiveWindSpeedMs = Number(
    (0.65 * windSpeed10mMs + 0.35 * windGusts10mMs).toFixed(2)
  );
  const windGradientDuDzPerSec = Number((0.0311 * effectiveWindSpeedMs).toFixed(3));

  const thermSpec = THERMAL_GRADIENT_MAP[pasquillClass] || THERMAL_GRADIENT_MAP.D;
  const tempGradientDtDzKPerM = thermSpec.dTdz;
  const tempGradientDtDzKPer100m = Number((thermSpec.dTdz * 100).toFixed(1));

  const downwindWindRefractionDb = Number(
    Math.min(6.2, 0.52 * effectiveWindSpeedMs).toFixed(1)
  );
  const thermalRefractionDb = thermSpec.thermalRefractionDb;
  const rainSplashBonusDb = precipitationMm > 2.0 ? 0.6 : 0.0;
  const netDownwindPropagationDeltaDb = Number(
    (downwindWindRefractionDb + thermalRefractionDb + rainSplashBonusDb).toFixed(1)
  );
  const upwindShadowAttenuationDb = Number(
    (-Math.min(4.8, 0.38 * effectiveWindSpeedMs)).toFixed(1)
  );

  const speedOfSoundC0Ms = Number((331.3 + 0.606 * temperature2mC).toFixed(1));
  const effectiveSoundSpeedGradientPerSec = Number(
    (0.6 * tempGradientDtDzKPerM + windGradientDuDzPerSec).toFixed(3)
  );
  const rayCurvatureRadiusKm =
    Math.abs(effectiveSoundSpeedGradientPerSec) > 0.005
      ? Number(
          (
            speedOfSoundC0Ms /
            Math.abs(effectiveSoundSpeedGradientPerSec) /
            1000
          ).toFixed(2)
        )
      : null;

  const propagationClassificationDa =
    netDownwindPropagationDeltaDb >= 3.0
      ? 'KRAFTIG NEDADBØJET LYDLINSE (Høj medvindsforstærkning over støjbarriere)'
      : netDownwindPropagationDeltaDb >= 0.8
      ? 'MODERAT NEDADBØJNING (Forøget lydudbredelse i medvind)'
      : netDownwindPropagationDeltaDb <= -0.5
      ? 'OPADBØJET LYDSKUGGE (Konvektiv dæmpning)'
      : 'NEUTRAL / NÆR-ADIABATISK LYDUDBREDELSE';

  const scientificSummaryDa = `Vindgradient du/dz = +${windGradientDuDzPerSec.toFixed(
    3
  )} s^-1 (${windSpeed10mMs.toFixed(1)} m/s, stod ${windGusts10mMs.toFixed(
    1
  )} m/s fra ${windDirectionDeg} deg -> medvind mod ${downwindPropagationDeg} deg) & temperaturgradient dT/dz = ${
    tempGradientDtDzKPer100m >= 0 ? '+' : ''
  }${tempGradientDtDzKPer100m.toFixed(
    1
  )} K/100m (Pasquill ${pasquillClass}) giver effektiv lydhastighedsgradient dc_eff/dz = ${
    effectiveSoundSpeedGradientPerSec >= 0 ? '+' : ''
  }${effectiveSoundSpeedGradientPerSec.toFixed(3)} s^-1${
    rayCurvatureRadiusKm !== null
      ? ` (krumningsradius R_c = ${rayCurvatureRadiusKm.toFixed(2)} km)`
      : ''
  }. Netto effekt på lydudbredelsen: ${
    netDownwindPropagationDeltaDb >= 0 ? '+' : ''
  }${netDownwindPropagationDeltaDb.toFixed(
    1
  )} dB i medvind (Vind +${downwindWindRefractionDb.toFixed(
    1
  )} dB | Termisk ${
    thermalRefractionDb >= 0 ? '+' : ''
  }${thermalRefractionDb.toFixed(1)} dB${
    rainSplashBonusDb > 0 ? ` | Vaad vej +${rainSplashBonusDb.toFixed(1)} dB` : ''
  }) vs. ${upwindShadowAttenuationDb.toFixed(1)} dB i modvind.`;

  return {
    windSpeed10mMs,
    windGusts10mMs,
    effectiveWindSpeedMs,
    windDirectionDeg,
    downwindPropagationDeg,
    temperature2mC,
    pasquillClass,
    precipitationMm,
    windGradientDuDzPerSec,
    tempGradientDtDzKPerM,
    tempGradientDtDzKPer100m,
    thermalRegimeLabelDa: thermSpec.regimeLabel,
    speedOfSoundC0Ms,
    effectiveSoundSpeedGradientPerSec,
    rayCurvatureRadiusKm,
    downwindWindRefractionDb,
    thermalRefractionDb,
    rainSplashBonusDb,
    netDownwindPropagationDeltaDb,
    upwindShadowAttenuationDb,
    propagationClassificationDa,
    scientificSummaryDa,
  };
}

/**
 * Afgør om en observation repræsenterer en registreret maskin-impulsstøjhændelse,
 * som automatisk skal have tilføjet Meteorological Refraction Context i PDF-rapporter.
 */
export function isCapturedImpulseNoiseObservation(
  obs: AlgedonicObservation
): boolean {
  if (obs.audioEvidence) return true;
  if (/^(NOISE-85DB|STØJ)/i.test(obs.code)) return true;
  return /impuls|l_afmax|l_cfmax|støjrapport|støj-hændelse|db\([ac]\)|mejsel|hammer/i.test(
    `${obs.observationType} ${obs.description}`
  );
}

/**
 * Tegner sektionen "METEOROLOGICAL REFRACTION CONTEXT" i et eksisterende jsPDF-dokument
 * når en eller flere impulsstøj-hændelser er registreret. Returnerer opdateret y-position.
 */
export function renderMeteorologicalRefractionContextPdfSection(
  doc: jsPDF,
  options: {
    startY: number;
    margin: number;
    contentW: number;
    pageH: number;
    entries: MeteorologicalRefractionPdfEntry[];
    sectionTitle?: string;
  }
): number {
  const {
    margin,
    contentW,
    pageH,
    entries,
    sectionTitle = 'METEOROLOGICAL REFRACTION CONTEXT (VIND- & TEMPERATURGRADIENTER VED IMPULSSTØJ)',
  } = options;
  if (entries.length === 0) return options.startY;

  let y = options.startY;
  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageH - 16) {
      doc.addPage();
      y = 16;
    }
  };

  ensureSpace(34);

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentW, 8, 'F');
  doc.setTextColor(56, 189, 248);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.text(cleanPdfStr(sectionTitle), margin + 3, y + 5.5);
  y += 10;

  entries.slice(0, 6).forEach((item) => {
    const c = item.context;
    const summaryLines = doc.splitTextToSize(
      cleanPdfStr(c.scientificSummaryDa),
      contentW - 7
    );
    const boxH = 22 + summaryLines.length * 3.6;
    ensureSpace(boxH + 3);

    doc.setFillColor(240, 249, 255);
    doc.setDrawColor(14, 165, 233);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, y, contentW, boxH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(12, 74, 110);
    const peakTag =
      typeof item.lafmaxDb === 'number'
        ? ` | Spids: ${item.lafmaxDb.toFixed(1)} dB`
        : '';
    doc.text(
      cleanPdfStr(
        `${item.eventCode} (${item.timestampLabel})${peakTag} - ${item.locationLabel}`
      ),
      margin + 3,
      y + 5.2
    );

    doc.setFont('courier', 'bold');
    doc.setFontSize(7.0);
    doc.setTextColor(15, 23, 42);
    doc.text(
      cleanPdfStr(
        `du/dz: +${c.windGradientDuDzPerSec.toFixed(3)} s^-1 | dT/dz: ${
          c.tempGradientDtDzKPer100m >= 0 ? '+' : ''
        }${c.tempGradientDtDzKPer100m.toFixed(1)} K/100m | dc_eff/dz: ${
          c.effectiveSoundSpeedGradientPerSec >= 0 ? '+' : ''
        }${c.effectiveSoundSpeedGradientPerSec.toFixed(3)} s^-1 | R_c: ${
          c.rayCurvatureRadiusKm !== null ? `${c.rayCurvatureRadiusKm.toFixed(2)} km` : 'inf'
        } | Netto Effekt: ${
          c.netDownwindPropagationDeltaDb >= 0 ? '+' : ''
        }${c.netDownwindPropagationDeltaDb.toFixed(1)} dB`
      ),
      margin + 3,
      y + 10.6
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.1);
    doc.setTextColor(180, 83, 9);
    doc.text(cleanPdfStr(c.propagationClassificationDa), margin + 3, y + 15.6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.1);
    doc.setTextColor(30, 41, 59);
    doc.text(summaryLines, margin + 3, y + 20.2);

    y += boxH + 2.5;
  });

  return y;
}

/**
 * Genererer en selvstændig A4 retsmedicinsk PDF-rapport for en enkelt fanget
 * maskin-impulsstøjhændelse med fuld 'Meteorological Refraction Context'.
 */
export function generateImpulseNoiseEventPdfReport(params: {
  eventCode: string;
  dateIso: string;
  hourLabel: string;
  receptorCode: string;
  receptorName: string;
  receptorAddress: string;
  dominantSourceName: string;
  distanceMeters: number;
  laeqDb: number;
  peakLafmaxDb: number;
  durationSeconds: number;
  sumQuotient: number;
  weather: HourlyWeatherPoint;
  sha256Signature: string;
  unitLabel?: 'dB(A)' | 'dB(C)';
  dryRun?: boolean;
}): {
  fileName: string;
  reportSha256: string;
  refractionContext: MeteorologicalRefractionContextSummary;
} {
  const {
    eventCode,
    dateIso,
    hourLabel,
    receptorCode,
    receptorName,
    receptorAddress,
    dominantSourceName,
    distanceMeters,
    laeqDb,
    peakLafmaxDb,
    durationSeconds,
    sumQuotient,
    weather,
    sha256Signature,
    unitLabel = 'dB(A)',
    dryRun = false,
  } = params;

  const refractionContext = computeMeteorologicalRefractionContext({
    windSpeed10m: weather.windSpeed10m,
    windGusts10m: weather.windGusts10m,
    windDirection10m: weather.windDirection10m,
    temperature2m: weather.temperature2m,
    pasquillClass: weather.pasquillClass,
    precipitation: weather.precipitation,
  });

  const reportSha256 = deterministicHexHash256(
    `IMPULSE_REFRACTION_PDF|${eventCode}|${dateIso}|${hourLabel}|${peakLafmaxDb}|${refractionContext.netDownwindPropagationDeltaDb}|${sha256Signature}`
  );

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const margin = 12;
  const pageW = 210;
  const pageH = 297;
  const contentW = pageW - margin * 2;

  doc.setFillColor(11, 14, 23);
  doc.rect(0, 0, pageW, 34, 'F');
  doc.setFillColor(244, 63, 94);
  doc.rect(0, 32.8, pageW, 1.2, 'F');

  doc.setTextColor(253, 224, 71);
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.4);
  doc.text(
    cleanPdfStr(
      `RETSMEDICINSK IMPULSSTØJ-RAPPORT & METEOROLOGICAL REFRACTION CONTEXT  |  PSS SAG W22085`
    ),
    margin,
    8
  );

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(
    cleanPdfStr(`Impulsstøj-Hændelse ${eventCode}: ${peakLafmaxDb.toFixed(1)} ${unitLabel} @ ${receptorCode}`),
    margin,
    15.5
  );

  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    cleanPdfStr(
      `Dato: ${dateIso} kl. ${hourLabel}  |  Receptor: ${receptorName} (${receptorAddress})  |  Kilde: ${dominantSourceName} (${distanceMeters} m)`
    ),
    margin,
    22
  );

  doc.setTextColor(103, 232, 249);
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.8);
  doc.text(
    cleanPdfStr(`SHA-256 Bevis-Segl: ${reportSha256}`),
    margin,
    28.5
  );

  let y = 41;
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(239, 68, 68);
  doc.roundedRect(margin, y, contentW, 23, 1.5, 1.5, 'FD');

  doc.setTextColor(127, 29, 29);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.text('1. REGISTREREDE MASKIN-IMPULSSTØJDATA', margin + 3, y + 6);

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(15, 23, 42);
  doc.text(
    cleanPdfStr(
      `Spidsniveau: ${peakLafmaxDb.toFixed(1)} ${unitLabel}  |  Aekvivalent niveau: ${laeqDb.toFixed(
        1
      )} ${unitLabel}  |  Varighed: ${(durationSeconds / 60).toFixed(1)} min. (${durationSeconds} sek.)`
    ),
    margin + 3,
    y + 12.2
  );
  doc.text(
    cleanPdfStr(
      `Samtidig sprednings-sumkvotient S = ${sumQuotient.toFixed(
        2
      )}  |  Event-Signatur: ${sha256Signature.slice(0, 32)}...`
    ),
    margin + 3,
    y + 18.2
  );

  y += 29;
  y = renderMeteorologicalRefractionContextPdfSection(doc, {
    startY: y,
    margin,
    contentW,
    pageH,
    sectionTitle:
      '2. METEOROLOGICAL REFRACTION CONTEXT (VIND- & TEMPERATURGRADIENTER)',
    entries: [
      {
        eventCode,
        timestampLabel: `${dateIso} kl. ${hourLabel}`,
        locationLabel: `${receptorCode} · ${receptorName}`,
        lafmaxDb: peakLafmaxDb,
        context: refractionContext,
      },
    ],
  });

  const fileName = `Ringparken_Impulsstoej_${eventCode}_Refraktionskontekst_${dateIso}.pdf`;
  if (!dryRun) {
    doc.save(fileName);
  }
  return { fileName, reportSha256, refractionContext };
}
