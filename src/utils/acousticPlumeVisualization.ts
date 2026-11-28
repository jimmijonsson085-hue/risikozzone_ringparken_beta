/**
 * @file src/utils/acousticPlumeVisualization.ts
 * @description Fysisk 2D-beregning af 'Akustisk Fane-Visualisering' (impulsstøj-fane)
 * baseret på aktive maskiners nuværende placering og lokal vindretning, koblet direkte
 * til visuel feedback mod registrerede naboklager og receptorer.
 */

import {
  AlgedonicObservation,
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LatLngPoint,
} from '../types/dispersion';
import {
  angularDiffDeg,
  bearingBetweenPointsDeg,
  distanceBetweenPointsMeters,
} from '../services/dispersionEngine';

export interface AcousticPlumeBand {
  id: string;
  sourceId: string;
  sourceCode: string;
  sourceName: string;
  thresholdDb: 65 | 75 | 85;
  labelDa: string;
  fillHex: string;
  strokeHex: string;
  fillOpacity: number;
  downwindReachM: number;
  halfAngleDeg: number;
  polygon: LatLngPoint[];
}

export interface AcousticPlumeSourceFan {
  sourceId: string;
  sourceCode: string;
  sourceName: string;
  position: LatLngPoint;
  effectiveLwaDb: number;
  downwindAxisDeg: number;
  axisTip: LatLngPoint;
  bands: AcousticPlumeBand[];
}

export interface ComplaintAcousticPlumeFeedback {
  observationId: string;
  observationCode: string;
  locationLabel: string;
  position: LatLngPoint;
  nearestSourceId: string;
  nearestSourceCode: string;
  nearestSourcePosition: LatLngPoint;
  distanceMeters: number;
  angularOffsetDeg: number;
  estimatedImpulseLafmaxDb: number;
  isInsideAcousticPlume: boolean;
  isInsideCritical85DbPlume: boolean;
  feedbackLabelDa: string;
}

export interface AcousticPlumeVisualizationResult {
  windFromDeg: number;
  plumeDownwindDeg: number;
  windSpeedMs: number;
  windGustsMs: number;
  activeSourceFans: AcousticPlumeSourceFan[];
  allBandsSorted: AcousticPlumeBand[]; // Outer 65 dB -> 75 dB -> Inner 85 dB
  complaintFeedbacks: ComplaintAcousticPlumeFeedback[];
  complaintsInsidePlumeCount: number;
  complaintsTotalCount: number;
}

export function computeAcousticPlumeVisualization(params: {
  sources: DemolitionSourceNode[];
  observations: AlgedonicObservation[];
  currentWeather: HourlyWeatherPoint;
  manualMachineNoiseOutputDb?: number;
  isManualMachineNoiseOverrideActive?: boolean;
}): AcousticPlumeVisualizationResult {
  const {
    sources,
    observations,
    currentWeather,
    manualMachineNoiseOutputDb,
    isManualMachineNoiseOverrideActive = false,
  } = params;

  const activeSources = sources.filter((s) => s.active);
  const windFromDeg = Math.round(currentWeather.windDirection10m ?? 240);
  const plumeDownwindDeg = (windFromDeg + 180) % 360;
  const windSpeedMs = Number((currentWeather.windSpeed10m ?? 4.5).toFixed(1));
  const windGustsMs = Number(
    Math.max(windSpeedMs, currentWeather.windGusts10m ?? windSpeedMs * 1.32).toFixed(1)
  );

  const mLat = 111320;
  const refLat = activeSources[0]?.position.lat ?? sources[0]?.position.lat ?? 55.41285;
  const mLng = 111320 * Math.cos((refLat * Math.PI) / 180);

  // Stronger wind narrows lateral spread slightly while elongating downwind impulse plume
  const windRefractionBonusDb = Math.min(
    6.4,
    Math.max(0.4, (windSpeedMs - 2.0) * 0.45 + Math.max(0, windGustsMs - 10) * 0.25)
  );
  const plumeSpreadHalfAngle = Math.max(26, Math.min(52, 46 - windSpeedMs * 1.1));

  const activeSourceFans: AcousticPlumeSourceFan[] = activeSources.map((src) => {
    const srcDefaultLwa = src.baseSoundPowerLwaDb ?? 114.0;
    const effectiveLwaDb =
      isManualMachineNoiseOverrideActive && typeof manualMachineNoiseOutputDb === 'number'
        ? Number(
            Math.max(
              74,
              Math.min(126, manualMachineNoiseOutputDb + (srcDefaultLwa - 114) * 0.35)
            ).toFixed(1)
          )
        : srcDefaultLwa;

    const impulseCrestDb = Math.max(
      6.5,
      Math.min(11.5, 7.5 + (effectiveLwaDb - 95) * 0.14)
    );

    const calcReachForDb = (thresholdDb: number) =>
      Math.max(
        18,
        Math.min(
          275,
          Math.round(
            Math.pow(
              10,
              (effectiveLwaDb + impulseCrestDb - thresholdDb - 11.8 + windRefractionBonusDb) / 20
            )
          )
        )
      );

    const buildFanSectorPolygon = (
      thresholdDb: 65 | 75 | 85,
      reachM: number,
      halfAngleDeg: number
    ): LatLngPoint[] => {
      const pts: LatLngPoint[] = [];
      // Back-lobe around machine (short 14m..22m upwind radius)
      const backRadius = Math.max(10, Math.round(reachM * 0.16));
      const arcSteps = 16;

      // Forward downwind fan arc from (plumeDownwindDeg - halfAngleDeg) to (+halfAngleDeg)
      for (let i = 0; i <= arcSteps; i++) {
        const frac = i / arcSteps;
        const relAngle = -halfAngleDeg + frac * halfAngleDeg * 2;
        const cosRel = Math.cos((relAngle * Math.PI) / 180);
        // Smooth teardrop lobe tapering from full reach at centerline to 0.72 at edges
        const lobeDist = reachM * (0.68 + 0.32 * cosRel);
        const absDeg = ((plumeDownwindDeg + relAngle) * Math.PI) / 180;
        pts.push({
          lat: src.position.lat + (lobeDist * Math.cos(absDeg)) / mLat,
          lng: src.position.lng + (lobeDist * Math.sin(absDeg)) / mLng,
        });
      }

      // Smooth upwind closure arc behind the machine
      for (let j = 1; j < 6; j++) {
        const frac = j / 6;
        const relAngle = halfAngleDeg + frac * (360 - halfAngleDeg * 2);
        const absDeg = ((plumeDownwindDeg + relAngle) * Math.PI) / 180;
        pts.push({
          lat: src.position.lat + (backRadius * Math.cos(absDeg)) / mLat,
          lng: src.position.lng + (backRadius * Math.sin(absDeg)) / mLng,
        });
      }

      return pts;
    };

    const reach65 = calcReachForDb(65);
    const reach75 = calcReachForDb(75);
    const reach85 = calcReachForDb(85);

    const bands: AcousticPlumeBand[] = [
      {
        id: `${src.id}-plume-65`,
        sourceId: src.id,
        sourceCode: src.code,
        sourceName: src.name,
        thresholdDb: 65,
        labelDa: '65 dB Hørbar Impulsfane',
        fillHex: '#0ea5e9',
        strokeHex: '#38bdf8',
        fillOpacity: 0.14,
        downwindReachM: reach65,
        halfAngleDeg: plumeSpreadHalfAngle + 8,
        polygon: buildFanSectorPolygon(65, reach65, plumeSpreadHalfAngle + 8),
      },
      {
        id: `${src.id}-plume-75`,
        sourceId: src.id,
        sourceCode: src.code,
        sourceName: src.name,
        thresholdDb: 75,
        labelDa: '75 dB Skærpet Impulsfane',
        fillHex: '#f59e0b',
        strokeHex: '#fcd34d',
        fillOpacity: 0.22,
        downwindReachM: reach75,
        halfAngleDeg: plumeSpreadHalfAngle,
        polygon: buildFanSectorPolygon(75, reach75, plumeSpreadHalfAngle),
      },
      {
        id: `${src.id}-plume-85`,
        sourceId: src.id,
        sourceCode: src.code,
        sourceName: src.name,
        thresholdDb: 85,
        labelDa: '85 dB Kritisk Impulsfane',
        fillHex: '#e11d48',
        strokeHex: '#fda4af',
        fillOpacity: 0.34,
        downwindReachM: reach85,
        halfAngleDeg: Math.max(20, plumeSpreadHalfAngle - 8),
        polygon: buildFanSectorPolygon(85, reach85, Math.max(20, plumeSpreadHalfAngle - 8)),
      },
    ];

    const axisRad = (plumeDownwindDeg * Math.PI) / 180;
    const axisTip: LatLngPoint = {
      lat: src.position.lat + (reach65 * Math.cos(axisRad)) / mLat,
      lng: src.position.lng + (reach65 * Math.sin(axisRad)) / mLng,
    };

    return {
      sourceId: src.id,
      sourceCode: src.code,
      sourceName: src.name,
      position: src.position,
      effectiveLwaDb,
      downwindAxisDeg: plumeDownwindDeg,
      axisTip,
      bands,
    };
  });

  const allBandsSorted: AcousticPlumeBand[] = activeSourceFans
    .flatMap((f) => f.bands)
    .sort((a, b) => a.thresholdDb - b.thresholdDb);

  // Corroborate neighbor complaints against active acoustic impulse plumes
  const complaintFeedbacks: ComplaintAcousticPlumeFeedback[] =
    activeSourceFans.length === 0
      ? []
      : observations.map((obs) => {
          let bestFan = activeSourceFans[0];
          let bestDb = -Infinity;
          let bestDistM = 999;
          let bestOffsetDeg = 180;

          for (const fan of activeSourceFans) {
            const distM = Math.max(
              8,
              Math.round(distanceBetweenPointsMeters(fan.position, obs.position))
            );
            const bearing = bearingBetweenPointsDeg(fan.position, obs.position);
            const offsetDeg = Math.round(angularDiffDeg(bearing, plumeDownwindDeg));
            const cosAlign = Math.cos((offsetDeg * Math.PI) / 180);
            const dirRefr =
              cosAlign >= 0 ? cosAlign * windRefractionBonusDb : cosAlign * 2.5;
            const impulseCrest = Math.max(
              6.5,
              Math.min(11.5, 7.5 + (fan.effectiveLwaDb - 95) * 0.14)
            );
            const aDiv = 20 * Math.log10(distM) + 11.8;
            const estDb = Number(
              Math.max(44, fan.effectiveLwaDb + impulseCrest - aDiv + dirRefr).toFixed(1)
            );

            if (estDb > bestDb) {
              bestDb = estDb;
              bestFan = fan;
              bestDistM = distM;
              bestOffsetDeg = offsetDeg;
            }
          }

          const band65 = bestFan.bands.find((b) => b.thresholdDb === 65);
          const band85 = bestFan.bands.find((b) => b.thresholdDb === 85);
          const isInsideAcousticPlume =
            bestOffsetDeg <= (band65?.halfAngleDeg ?? 45) + 6 &&
            bestDistM <= (band65?.downwindReachM ?? 140);
          const isInsideCritical85DbPlume =
            bestOffsetDeg <= (band85?.halfAngleDeg ?? 32) + 4 &&
            bestDistM <= (band85?.downwindReachM ?? 65);

          const feedbackLabelDa = isInsideCritical85DbPlume
            ? `Bekræftet i 85 dB kritisk impulsfane (${bestDb.toFixed(1)} dB · ${bestDistM} m)`
            : isInsideAcousticPlume
            ? `Bekræftet i nedvinds støjfane (${bestDb.toFixed(1)} dB · ${bestDistM} m)`
            : `Uden for direkte vindfane (${bestDb.toFixed(1)} dB · ${bestOffsetDeg}° afvigelse)`;

          return {
            observationId: obs.id,
            observationCode: obs.code,
            locationLabel: obs.locationLabel,
            position: obs.position,
            nearestSourceId: bestFan.sourceId,
            nearestSourceCode: bestFan.sourceCode,
            nearestSourcePosition: bestFan.position,
            distanceMeters: bestDistM,
            angularOffsetDeg: bestOffsetDeg,
            estimatedImpulseLafmaxDb: bestDb,
            isInsideAcousticPlume,
            isInsideCritical85DbPlume,
            feedbackLabelDa,
          };
        });

  return {
    windFromDeg,
    plumeDownwindDeg,
    windSpeedMs,
    windGustsMs,
    activeSourceFans,
    allBandsSorted,
    complaintFeedbacks,
    complaintsInsidePlumeCount: complaintFeedbacks.filter((c) => c.isInsideAcousticPlume)
      .length,
    complaintsTotalCount: complaintFeedbacks.length,
  };
}
