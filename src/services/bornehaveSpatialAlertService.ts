/**
 * @file src/services/bornehaveSpatialAlertService.ts
 * @description Real-time 3D spatial concentration monitor for the 'Børnehave' (Daycare)
 * receptor area (Bygning 1: Børnehave, Kierulffsvej 2 & Bygning 5: Daginstitution, Kierulffsvej 4).
 * Evaluates 3D Gaussian plume dust & asbestos fiber concentrations at the daycare site against
 * the atmospheric Pasquill stability class threshold and triggers an alert when > 50%.
 */

import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LatLngPoint,
  ReceptorZone,
} from '../types/dispersion';

export interface BornehaveSpatialPlumeAlertStatus {
  isAlertActive: boolean;
  isCriticalAbove100Pct: boolean;
  receptorLabel: string;
  receptorId: string;
  address: string;
  pasquillClass: HourlyWeatherPoint['pasquillClass'];
  pasquillThresholdUgM3: number;
  dustConcentrationUgM3: number;
  pctOfPasquillThreshold: number;
  asbestosFibersCm3: number;
  asbestosPctOfGv: number;
  dominantSourceCode: string;
  dominantSourceName: string;
  evalHeightMeters: number;
  windSpeedMs: number;
  windDirectionDeg: number;
  hourLabel: string;
  timestampIso: string;
}

const BORNEHAVE_PRIMARY_COORDS: LatLngPoint = { lat: 55.4132, lng: 11.3541 };
const BORNEHAVE_DAGINST_COORDS: LatLngPoint = { lat: 55.41278, lng: 11.35495 };

const PASQUILL_DUST_THRESHOLD_UG_M3: Record<HourlyWeatherPoint['pasquillClass'], number> = {
  A: 120,
  B: 105,
  C: 90,
  D: 75,
  E: 60,
  F: 45,
};

const PASQUILL_COEFFS: Record<
  HourlyWeatherPoint['pasquillClass'],
  { ay: number; by: number; az: number; bz: number }
> = {
  A: { ay: 0.32, by: 0.88, az: 0.24, bz: 0.88 },
  B: { ay: 0.24, by: 0.88, az: 0.18, bz: 0.86 },
  C: { ay: 0.16, by: 0.89, az: 0.12, bz: 0.85 },
  D: { ay: 0.11, by: 0.89, az: 0.08, bz: 0.83 },
  E: { ay: 0.08, by: 0.89, az: 0.06, bz: 0.8 },
  F: { ay: 0.06, by: 0.89, az: 0.04, bz: 0.78 },
};

const ASBESTOS_GV_2026 = 0.003;

function latLngToMetersDelta(from: LatLngPoint, to: LatLngPoint): { dxEastM: number; dyNorthM: number } {
  const latRad = (from.lat * Math.PI) / 180;
  const dyNorthM = (to.lat - from.lat) * 111320;
  const dxEastM = (to.lng - from.lng) * 111320 * Math.cos(latRad);
  return { dxEastM, dyNorthM };
}

function evaluatePlumeAtPoint(
  targetPt: LatLngPoint,
  sources: DemolitionSourceNode[],
  weather: HourlyWeatherPoint,
  evalHeightMeters: number,
  waterSuppressionActive: boolean
): {
  dustUgM3: number;
  asbestosFibersCm3: number;
  dominantSourceCode: string;
  dominantSourceName: string;
} {
  const plumeDirDeg = (weather.windDirection10m + 180) % 360;
  const plumeRad = (plumeDirDeg * Math.PI) / 180;
  const ux = Math.sin(plumeRad);
  const uy = Math.cos(plumeRad);
  const u = Math.max(0.8, weather.windSpeed10m);
  const coeff = PASQUILL_COEFFS[weather.pasquillClass] || PASQUILL_COEFFS.D;
  const waterFactor = waterSuppressionActive ? 0.42 : 1.0;

  let totalDustUgM3 = 0;
  let totalAsbestosFibers = 0;
  let dominantSourceCode = 'BLOK-1';
  let dominantSourceName = 'Blok 1';
  let maxContrib = -1;

  for (const src of sources) {
    if (!src.active) continue;
    const { dxEastM, dyNorthM } = latLngToMetersDelta(src.position, targetPt);
    const radialDistM = Math.hypot(dxEastM, dyNorthM);
    const downwindM = dxEastM * ux + dyNorthM * uy;
    const crosswindM = Math.abs(-dxEastM * uy + dyNorthM * ux);

    const H = Math.max(1, src.releaseHeightMeters || 8);
    const fiberIdx = src.fiberReleaseIndex !== undefined ? src.fiberReleaseIndex : 0.72;
    const emissionMult = Math.max(0.15, (src.sourceEmissionFactor ?? 1.0) * (0.4 + fiberIdx * 1.1));

    const heightBonus = 1 + Math.max(0, H - 8) * 0.045;
    const gustSpread = weather.windGusts10m > 8 ? 1 + (weather.windGusts10m - 8) * 0.095 : 1.0;
    const thermalDraft = weather.temperature2m > 18 ? 1 + (weather.temperature2m - 18) * 0.04 : 1.0;
    const humidityFactor = weather.relativeHumidity2m < 55 ? 1.24 : 0.94;
    const rainFactor = weather.precipitation > 0.2 ? 0.55 : 1.0;
    const weatherMult = heightBonus * gustSpread * thermalDraft * humidityFactor * rainFactor;

    let srcNormalizedPlume = 0;

    // Near-source wake turbulence (within 28 m of source)
    if (radialDistM < 28) {
      const wakeKernel = Math.exp(-(radialDistM * radialDistM) / (2 * 10.5 * 10.5));
      const heightKernel = Math.exp(-Math.pow(evalHeightMeters - H * 0.45, 2) / (2 * 7.5 * 7.5));
      srcNormalizedPlume += 0.92 * wakeKernel * (0.55 + 0.45 * heightKernel);
    }

    // Downwind 3D Gaussian Plume evaluation
    if (downwindM > 1.5) {
      const sigmaY = Math.hypot(coeff.ay * Math.pow(downwindM, coeff.by), 8.5);
      const sigmaZ = Math.hypot(coeff.az * Math.pow(downwindM, coeff.bz), 4.5);
      const latTerm = Math.exp(-(crosswindM * crosswindM) / (2 * sigmaY * sigmaY));
      const vertTerm =
        Math.exp(-Math.pow(evalHeightMeters - H, 2) / (2 * sigmaZ * sigmaZ)) +
        Math.exp(-Math.pow(evalHeightMeters + H, 2) / (2 * sigmaZ * sigmaZ));
      const rawGaussian = (1 / (2 * Math.PI * u * sigmaY * sigmaZ)) * latTerm * vertTerm;
      srcNormalizedPlume += Math.min(2.4, rawGaussian * 4800) * 0.62;
    }

    if (srcNormalizedPlume <= 0.001) continue;

    // Respirable demolition dust particle concentration (µg/m³)
    const dustContribUgM3 = 68.0 * srcNormalizedPlume * emissionMult * weatherMult * waterFactor;
    totalDustUgM3 += dustContribUgM3;

    // Asbestos fiber contribution if active at source
    if (src.substances.includes('asbestos')) {
      const fiberMult = Math.max(0.1, 0.35 + fiberIdx * 1.25);
      totalAsbestosFibers +=
        ASBESTOS_GV_2026 * srcNormalizedPlume * fiberMult * weatherMult * waterFactor;
    }

    if (dustContribUgM3 > maxContrib) {
      maxContrib = dustContribUgM3;
      dominantSourceCode = src.code;
      dominantSourceName = src.name.split('—')[0].trim();
    }
  }

  return {
    dustUgM3: totalDustUgM3,
    asbestosFibersCm3: totalAsbestosFibers,
    dominantSourceCode,
    dominantSourceName,
  };
}

/**
 * Monitors 3D spatial plume concentration specifically at the 'Børnehave' (Daycare)
 * receptor area and evaluates exceedance against the 50% Pasquill-class dust threshold.
 */
export function evaluateBornehaveDaycare3DPlumeAlert(params: {
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  weather: HourlyWeatherPoint;
  evalHeightMeters?: number;
  waterSuppressionActive?: boolean;
}): BornehaveSpatialPlumeAlertStatus {
  const {
    sources,
    receptors,
    weather,
    evalHeightMeters = 1.5,
    waterSuppressionActive = false,
  } = params;

  const daycareReceptor =
    receptors.find(
      (r) =>
        r.id === 'rec-byg-5-daginst' ||
        r.name.toLowerCase().includes('børnehave') ||
        r.name.toLowerCase().includes('daginstitution')
    ) || null;

  const pointsToSample: Array<{ label: string; id: string; address: string; pt: LatLngPoint }> = [
    {
      label: 'Børnehave (Bygning 1 · Legeplads)',
      id: daycareReceptor?.id || 'rec-byg-5-daginst',
      address: 'Kierulffsvej 2, 4200 Slagelse',
      pt: BORNEHAVE_PRIMARY_COORDS,
    },
    {
      label: daycareReceptor?.name || 'Daginstitution & Kvarterhus (Børnehave)',
      id: daycareReceptor?.id || 'rec-byg-5-daginst',
      address: daycareReceptor?.address || 'Kierulffsvej 4, 4200 Slagelse',
      pt: daycareReceptor?.center || BORNEHAVE_DAGINST_COORDS,
    },
  ];

  let bestEval = evaluatePlumeAtPoint(
    pointsToSample[0].pt,
    sources,
    weather,
    evalHeightMeters,
    waterSuppressionActive
  );
  let chosenTarget = pointsToSample[0];

  for (let i = 1; i < pointsToSample.length; i++) {
    const candidate = evaluatePlumeAtPoint(
      pointsToSample[i].pt,
      sources,
      weather,
      evalHeightMeters,
      waterSuppressionActive
    );
    if (candidate.dustUgM3 > bestEval.dustUgM3) {
      bestEval = candidate;
      chosenTarget = pointsToSample[i];
    }
  }

  const pasquillThresholdUgM3 = PASQUILL_DUST_THRESHOLD_UG_M3[weather.pasquillClass] ?? 75;
  const pctOfPasquillThreshold = Number(
    ((bestEval.dustUgM3 / pasquillThresholdUgM3) * 100).toFixed(1)
  );
  const asbestosPctOfGv = Number(
    ((bestEval.asbestosFibersCm3 / ASBESTOS_GV_2026) * 100).toFixed(1)
  );

  return {
    isAlertActive: pctOfPasquillThreshold > 50,
    isCriticalAbove100Pct: pctOfPasquillThreshold >= 100,
    receptorLabel: chosenTarget.label,
    receptorId: chosenTarget.id,
    address: chosenTarget.address,
    pasquillClass: weather.pasquillClass,
    pasquillThresholdUgM3,
    dustConcentrationUgM3: Number(bestEval.dustUgM3.toFixed(1)),
    pctOfPasquillThreshold,
    asbestosFibersCm3: Number(bestEval.asbestosFibersCm3.toFixed(4)),
    asbestosPctOfGv,
    dominantSourceCode: bestEval.dominantSourceCode,
    dominantSourceName: bestEval.dominantSourceName,
    evalHeightMeters,
    windSpeedMs: weather.windSpeed10m,
    windDirectionDeg: weather.windDirection10m,
    hourLabel: weather.hourLabel,
    timestampIso: weather.isoTime,
  };
}
