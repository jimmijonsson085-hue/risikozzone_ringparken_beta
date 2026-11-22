import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  ReceptorExposureResult,
  ReceptorZone,
} from '../types/dispersion';

export interface ThermalGradientSpec {
  dTdz: number;
  thermalRefractionDb: number;
  regimeLabel: string;
}

export const THERMAL_GRADIENT_MAP: Record<string, ThermalGradientSpec> = {
  A: {
    dTdz: -0.03,
    thermalRefractionDb: -0.8,
    regimeLabel: 'Stærk sol-konvektion (opadbøjet)',
  },
  B: {
    dTdz: -0.02,
    thermalRefractionDb: -0.5,
    regimeLabel: 'Moderat konvektion (let opadbøjet)',
  },
  C: {
    dTdz: -0.014,
    thermalRefractionDb: -0.3,
    regimeLabel: 'Svag konvektion',
  },
  D: {
    dTdz: -0.008,
    thermalRefractionDb: 0.0,
    regimeLabel: 'Neutral adiabatisk profil',
  },
  E: {
    dTdz: 0.015,
    thermalRefractionDb: 1.5,
    regimeLabel: 'Svag temperaturinversion (nedadbøjet)',
  },
  F: {
    dTdz: 0.035,
    thermalRefractionDb: 2.6,
    regimeLabel: 'Stærk natlig inversion (stærk lydlinse)',
  },
};

export interface InterpolatedRefractionFrame {
  loopIdxA: number;
  animWindSpeed10m: number;
  animWindGusts10m: number;
  animWindDirection10m: number;
  animPlumeDirectionDeg: number;
  animTemp2m: number;
  animPrecipitation: number;
  animPasquillClass: string;
  animTimeLabel: string;
  thermalSpec: ThermalGradientSpec;
  effectiveWindSpeedMs: number;
  windGradientDuDz: number;
  downwindWindRefractionDb: number;
  upwindShadowRefractionDb: number;
  rainSplashBonusDb: number;
  maxDownwindRefractionDb: number;
  soundSpeedGradientPerSec: number;
  speedOfSoundMs: number;
  rayCurvatureRadiusKm: number | null;
  isNoiseAmplificationRisk: boolean;
  isStrongDownwardBending: boolean;
  isModerateDownwardBending: boolean;
}

export interface ReceptorRefractionEvaluation {
  receptorId: string;
  receptorCode: string;
  receptorName: string;
  address: string;
  distanceMeters: number;
  bearingDeg: number;
  angleOffWindDeg: number;
  cosAlign: number;
  windCompDb: number;
  tempRefrDb: number;
  totalRefrDb: number;
  correctedLaeqDb: number;
  impulsePeakLafmaxDb: number;
  sumQuotient: number;
  exceedsNoiseLimit: boolean;
}

export interface HourlyRefractionPoint {
  hourIndex: number;
  hourLabel: string;
  windSpeed10m: number;
  pasquillClass: string;
  windRefractionDb: number;
  thermalRefractionDb: number;
  totalDownwindDb: number;
  exceeds3dB: boolean;
}

export function computeInterpolatedRefractionFrame(params: {
  hours: HourlyWeatherPoint[];
  fallbackWeather: HourlyWeatherPoint;
  loopProgress: number;
  isPlayingLoop: boolean;
}): InterpolatedRefractionFrame {
  const { hours, fallbackWeather, loopProgress, isPlayingLoop } = params;
  const loopIdxA = Math.max(0, Math.min(23, Math.floor(loopProgress)));
  const loopIdxB = (loopIdxA + 1) % 24;
  const loopFrac = isPlayingLoop
    ? Math.max(0, Math.min(1, loopProgress - Math.floor(loopProgress)))
    : 0;

  const hrLoopA = hours[loopIdxA] || fallbackWeather;
  const hrLoopB = hours[loopIdxB] || hrLoopA;

  const animWindSpeed10m = Number(
    (hrLoopA.windSpeed10m + (hrLoopB.windSpeed10m - hrLoopA.windSpeed10m) * loopFrac).toFixed(1)
  );
  const animWindGusts10m = Number(
    (hrLoopA.windGusts10m + (hrLoopB.windGusts10m - hrLoopA.windGusts10m) * loopFrac).toFixed(1)
  );
  const rawDirDiff = ((hrLoopB.windDirection10m - hrLoopA.windDirection10m + 540) % 360) - 180;
  const animWindDirection10m = Math.round(
    (hrLoopA.windDirection10m + rawDirDiff * loopFrac + 360) % 360
  );
  const animPlumeDirectionDeg = (animWindDirection10m + 180) % 360;
  const animTemp2m = Number(
    (hrLoopA.temperature2m + (hrLoopB.temperature2m - hrLoopA.temperature2m) * loopFrac).toFixed(1)
  );
  const animPrecipitation = Number(
    (hrLoopA.precipitation + (hrLoopB.precipitation - hrLoopA.precipitation) * loopFrac).toFixed(1)
  );
  const animPasquillClass = loopFrac < 0.5 ? hrLoopA.pasquillClass : hrLoopB.pasquillClass;
  const animClockMinutes = Math.floor(loopFrac * 60);
  const animTimeLabel = `${String(loopIdxA).padStart(2, '0')}:${String(
    animClockMinutes
  ).padStart(2, '0')}`;

  const thermA = THERMAL_GRADIENT_MAP[hrLoopA.pasquillClass] || THERMAL_GRADIENT_MAP.D;
  const thermB = THERMAL_GRADIENT_MAP[hrLoopB.pasquillClass] || THERMAL_GRADIENT_MAP.D;
  const thermalSpec: ThermalGradientSpec = {
    dTdz: Number((thermA.dTdz + (thermB.dTdz - thermA.dTdz) * loopFrac).toFixed(3)),
    thermalRefractionDb: Number(
      (
        thermA.thermalRefractionDb +
        (thermB.thermalRefractionDb - thermA.thermalRefractionDb) * loopFrac
      ).toFixed(1)
    ),
    regimeLabel: loopFrac < 0.5 ? thermA.regimeLabel : thermB.regimeLabel,
  };

  const effectiveWindSpeedMs =
    0.65 * animWindSpeed10m + 0.35 * Math.max(animWindSpeed10m, animWindGusts10m);
  const windGradientDuDz = Number((0.0311 * effectiveWindSpeedMs).toFixed(2));
  const downwindWindRefractionDb = Number(
    Math.min(6.2, 0.52 * effectiveWindSpeedMs).toFixed(1)
  );
  const upwindShadowRefractionDb = Number(
    (-Math.min(4.8, 0.38 * effectiveWindSpeedMs)).toFixed(1)
  );
  const rainSplashBonusDb = animPrecipitation > 2.0 ? 0.6 : 0.0;
  const maxDownwindRefractionDb = Number(
    (downwindWindRefractionDb + thermalSpec.thermalRefractionDb + rainSplashBonusDb).toFixed(1)
  );

  const soundSpeedGradientPerSec = Number(
    (0.6 * thermalSpec.dTdz + windGradientDuDz).toFixed(3)
  );
  const speedOfSoundMs = Number((331.3 + 0.606 * animTemp2m).toFixed(1));
  const rayCurvatureRadiusKm =
    Math.abs(soundSpeedGradientPerSec) > 0.005
      ? Number((speedOfSoundMs / Math.abs(soundSpeedGradientPerSec) / 1000).toFixed(2))
      : null;

  const isNoiseAmplificationRisk =
    maxDownwindRefractionDb > 3.0 || downwindWindRefractionDb > 3.0;
  const isStrongDownwardBending = isNoiseAmplificationRisk;
  const isModerateDownwardBending =
    maxDownwindRefractionDb > 0.5 && !isNoiseAmplificationRisk;

  return {
    loopIdxA,
    animWindSpeed10m,
    animWindGusts10m,
    animWindDirection10m,
    animPlumeDirectionDeg,
    animTemp2m,
    animPrecipitation,
    animPasquillClass,
    animTimeLabel,
    thermalSpec,
    effectiveWindSpeedMs,
    windGradientDuDz,
    downwindWindRefractionDb,
    upwindShadowRefractionDb,
    rainSplashBonusDb,
    maxDownwindRefractionDb,
    soundSpeedGradientPerSec,
    speedOfSoundMs,
    rayCurvatureRadiusKm,
    isNoiseAmplificationRisk,
    isStrongDownwardBending,
    isModerateDownwardBending,
  };
}

export function computeReceptorRefractions(params: {
  receptors: ReceptorZone[];
  primaryActiveSource: DemolitionSourceNode;
  receptorExposures: ReceptorExposureResult[];
  frame: InterpolatedRefractionFrame;
  baseMachineryNoiseSourceDb?: number;
}): ReceptorRefractionEvaluation[] {
  const {
    receptors,
    primaryActiveSource,
    receptorExposures,
    frame,
    baseMachineryNoiseSourceDb = 84.5,
  } = params;

  return receptors.map((rec) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;
    const dLng = toRad(rec.center.lng - primaryActiveSource.position.lng);
    const lat1 = toRad(primaryActiveSource.position.lat);
    const lat2 = toRad(rec.center.lat);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const bearingDeg = Math.round((toDeg(Math.atan2(y, x)) + 360) % 360);
    let angleDiff = Math.abs(bearingDeg - frame.animPlumeDirectionDeg) % 360;
    if (angleDiff > 180) angleDiff = 360 - angleDiff;
    const cosAlign = Math.cos((angleDiff * Math.PI) / 180);
    const windCompDb =
      cosAlign >= 0
        ? cosAlign * Math.min(6.2, 0.52 * frame.effectiveWindSpeedMs)
        : cosAlign * Math.min(4.8, 0.38 * frame.effectiveWindSpeedMs);
    const totalRefrDb = Number(
      (windCompDb + frame.thermalSpec.thermalRefractionDb + frame.rainSplashBonusDb).toFixed(1)
    );

    const dLatM = (rec.center.lat - primaryActiveSource.position.lat) * 111320;
    const dLngM =
      (rec.center.lng - primaryActiveSource.position.lng) *
      111320 *
      Math.cos((primaryActiveSource.position.lat * Math.PI) / 180);
    const approxDistMeters = Math.max(35, Math.round(Math.hypot(dLatM, dLngM)));
    const distAttenDb = Number(
      (20 * Math.log10(Math.max(25, approxDistMeters)) - 11).toFixed(1)
    );
    const barrierAttenDb = Number(
      Math.max(2.0, 9.5 - Math.max(0, totalRefrDb) * 1.15).toFixed(1)
    );
    const correctedLaeqDb = Number(
      (baseMachineryNoiseSourceDb - distAttenDb - barrierAttenDb + totalRefrDb).toFixed(1)
    );
    const impulsePeakLafmaxDb = Number(
      (correctedLaeqDb + 14.5 + Math.max(0, (frame.animWindGusts10m - 8) * 0.45)).toFixed(1)
    );
    const expMatch = receptorExposures.find((e) => e.receptorId === rec.id);

    return {
      receptorId: rec.id,
      receptorCode: rec.code,
      receptorName: rec.name,
      address: rec.address,
      distanceMeters: approxDistMeters,
      bearingDeg,
      angleOffWindDeg: Math.round(angleDiff),
      cosAlign,
      windCompDb: Number(windCompDb.toFixed(1)),
      tempRefrDb: frame.thermalSpec.thermalRefractionDb,
      totalRefrDb,
      correctedLaeqDb,
      impulsePeakLafmaxDb,
      sumQuotient: expMatch?.sumQuotient ?? 0,
      exceedsNoiseLimit: correctedLaeqDb > 55.0 || totalRefrDb > 3.0,
    };
  });
}

export function computeHourlyRefractionSeries(
  hours: HourlyWeatherPoint[]
): HourlyRefractionPoint[] {
  return hours.map((hr) => {
    const hrEffWind =
      0.65 * hr.windSpeed10m + 0.35 * Math.max(hr.windSpeed10m, hr.windGusts10m);
    const hrWindDb = Math.min(6.2, 0.52 * hrEffWind);
    const hrThermSpec = THERMAL_GRADIENT_MAP[hr.pasquillClass] || THERMAL_GRADIENT_MAP.D;
    const hrRainDb = hr.precipitation > 2.0 ? 0.6 : 0.0;
    const hrTotalDownwindDb = Number(
      (hrWindDb + hrThermSpec.thermalRefractionDb + hrRainDb).toFixed(1)
    );
    return {
      hourIndex: hr.hourIndex,
      hourLabel: hr.hourLabel,
      windSpeed10m: hr.windSpeed10m,
      pasquillClass: hr.pasquillClass,
      windRefractionDb: Number(hrWindDb.toFixed(1)),
      thermalRefractionDb: hrThermSpec.thermalRefractionDb,
      totalDownwindDb: hrTotalDownwindDb,
      exceeds3dB: hrTotalDownwindDb > 3.0 || hrWindDb > 3.0,
    };
  });
}
