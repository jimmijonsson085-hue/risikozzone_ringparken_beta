/**
 * @file src/utils/acousticHazardHeatmap.ts
 * @description Fysisk 2D-spredningsmotor for det dynamiske 'Acoustic Hazard Heatmap'-kortlag.
 * Beregner et geografisk gitter over Ringparken baseret på aktive nedrivningsmaskiners
 * lydeffektniveau (L_WA) samt lokale vind- og termiske refraktionsforhold (ISO 9613-2 + Pasquill).
 */

import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LatLngPoint,
  ReceptorZone,
} from '../types/dispersion';
import { computeInterpolatedRefractionFrame } from '../services/acousticRefractionMath';

export type AcousticHazardTier =
  | 'critical'
  | 'high'
  | 'moderate'
  | 'elevated'
  | 'low';

export type AcousticHeatmapMetricMode = 'lafmax' | 'laeq';

export interface AcousticHazardHeatmapCell {
  id: string;
  row: number;
  col: number;
  center: LatLngPoint;
  polygon: LatLngPoint[];
  laeqDb: number;
  lafmaxDb: number;
  windRefractionDb: number;
  thermalRefractionDb: number;
  rainSplashBonusDb: number;
  totalRefractionDb: number;
  downwindAlignmentCos: number;
  dominantSourceId: string | null;
  dominantSourceCode: string;
  dominantSourceLwaDb: number;
  nearestSourceDistM: number;
  hazardTier: AcousticHazardTier;
  normalizedIntensity: number;
  fillHex: string;
  strokeHex: string;
  svgFillOpacity: number;
  gmpFillOpacity: number;
}

export interface AcousticHazardContourZone {
  id: string;
  sourceId: string;
  sourceCode: string;
  thresholdDb: 85 | 75 | 65;
  tier: AcousticHazardTier;
  labelDa: string;
  fillHex: string;
  strokeHex: string;
  downwindRadiusM: number;
  upwindRadiusM: number;
  polygon: LatLngPoint[];
}

export interface AcousticSourceRefractionSummary {
  sourceId: string;
  sourceCode: string;
  sourceName: string;
  position: LatLngPoint;
  effectiveLwaDb: number;
  downwindDeg: number;
  maxDownwindRefractionDb: number;
  critical85DbRadiusM: number;
  high75DbRadiusM: number;
  moderate65DbRadiusM: number;
  refractionArrowTip: LatLngPoint;
  hazardZonePolygons: AcousticHazardContourZone[];
}

export interface AcousticReceptorImpactSummary {
  receptorId: string;
  code: string;
  name: string;
  laeqDb: number;
  lafmaxDb: number;
  windRefractionDb: number;
  totalRefractionDb: number;
  hazardTier: AcousticHazardTier;
}

export interface AcousticHazardHeatmapResult {
  cells: AcousticHazardHeatmapCell[];
  renderedCells: AcousticHazardHeatmapCell[];
  hazardZoneContours: AcousticHazardContourZone[];
  activeSourceSummaries: AcousticSourceRefractionSummary[];
  receptorImpacts: AcousticReceptorImpactSummary[];
  worstReceptor: AcousticReceptorImpactSummary | null;
  activeSourcesCount: number;
  maxActiveLwaDb: number;
  combinedSiteLwaDb: number;
  windSpeedMs: number;
  windGustsMs: number;
  windFromDeg: number;
  plumeDownwindDeg: number;
  pasquillClass: string;
  thermalRegimeLabel: string;
  thermalRefractionDb: number;
  downwindWindRefractionDb: number;
  upwindShadowRefractionDb: number;
  rainSplashBonusDb: number;
  peakGridLafmaxDb: number;
  peakGridLaeqDb: number;
  criticalCellCount: number; // >= 85 dB
  highCellCount: number; // 75 - 84.9 dB
  moderateCellCount: number; // 65 - 74.9 dB
  impactedReceptorsOver85Db: number;
  impactedReceptorsOver70Db: number;
}

export interface ComputeAcousticHazardHeatmapParams {
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  currentWeather: HourlyWeatherPoint;
  weatherHours?: HourlyWeatherPoint[];
  baseMachineLwaDb?: number;
  metricMode?: AcousticHeatmapMetricMode;
  gridCols?: number;
  gridRows?: number;
  loopProgress?: number;
  isPlayingLoop?: boolean;
}

const DEFAULT_CENTER: LatLngPoint = { lat: 55.41285, lng: 11.35365 };

export function classifyAcousticHazardTier(
  dbValue: number
): {
  tier: AcousticHazardTier;
  fillHex: string;
  strokeHex: string;
  svgFillOpacity: number;
  gmpFillOpacity: number;
  normalizedIntensity: number;
} {
  const normalizedIntensity = Number(
    Math.max(0, Math.min(1, (dbValue - 52) / 42)).toFixed(3)
  );
  if (dbValue >= 85.0) {
    return {
      tier: 'critical',
      fillHex: '#e11d48', // Crimson >= 85 dB
      strokeHex: '#fda4af',
      svgFillOpacity: Math.min(0.62, 0.42 + (dbValue - 85) * 0.018),
      gmpFillOpacity: Math.min(0.56, 0.36 + (dbValue - 85) * 0.015),
      normalizedIntensity,
    };
  }
  if (dbValue >= 75.0) {
    return {
      tier: 'high',
      fillHex: '#f97316', // Orange 75 - 84.9 dB
      strokeHex: '#fdba74',
      svgFillOpacity: 0.28 + ((dbValue - 75) / 10) * 0.12,
      gmpFillOpacity: 0.24 + ((dbValue - 75) / 10) * 0.1,
      normalizedIntensity,
    };
  }
  if (dbValue >= 65.0) {
    return {
      tier: 'moderate',
      fillHex: '#eab308', // Amber 65 - 74.9 dB
      strokeHex: '#fde047',
      svgFillOpacity: 0.17 + ((dbValue - 65) / 10) * 0.09,
      gmpFillOpacity: 0.14 + ((dbValue - 65) / 10) * 0.08,
      normalizedIntensity,
    };
  }
  if (dbValue >= 55.0) {
    return {
      tier: 'elevated',
      fillHex: '#06b6d4', // Cyan 55 - 64.9 dB
      strokeHex: '#67e8f9',
      svgFillOpacity: 0.09 + ((dbValue - 55) / 10) * 0.07,
      gmpFillOpacity: 0.07 + ((dbValue - 55) / 10) * 0.06,
      normalizedIntensity,
    };
  }
  return {
    tier: 'low',
    fillHex: '#0ea5e9',
    strokeHex: '#38bdf8',
    svgFillOpacity: 0.02,
    gmpFillOpacity: 0.02,
    normalizedIntensity,
  };
}

function resolveEffectiveSourceLwa(
  src: DemolitionSourceNode,
  overrideMachineLwaDb?: number
): number {
  const srcDefault =
    typeof src.baseSoundPowerLwaDb === 'number' ? src.baseSoundPowerLwaDb : 114.0;
  if (typeof overrideMachineLwaDb !== 'number' || !Number.isFinite(overrideMachineLwaDb)) {
    return srcDefault;
  }
  // When operator actively adjusts L_WA slider or selects a machinery profile,
  // shift all active machinery relative to the 114 dB baseline so the 2D field responds cleanly.
  const deltaFromSiteBaseline = (srcDefault - 114.0) * 0.35;
  return Number(
    Math.max(72.0, Math.min(128.0, overrideMachineLwaDb + deltaFromSiteBaseline)).toFixed(1)
  );
}

/**
 * Beregner 2D 'Acoustic Hazard Heatmap'-felt ud fra aktive kilders L_WA
 * og de aktuelle lokale vind- og termiske refraktionsbetingelser.
 */
export function computeAcousticHazardHeatmap(
  params: ComputeAcousticHazardHeatmapParams
): AcousticHazardHeatmapResult {
  const {
    sources,
    receptors,
    currentWeather,
    weatherHours,
    baseMachineLwaDb,
    metricMode = 'lafmax',
    gridCols = 18,
    gridRows = 13,
    loopProgress,
    isPlayingLoop = false,
  } = params;

  const activeSources = sources.filter((s) => s.active);
  const hourIndex = Math.max(0, Math.min(23, currentWeather.hourIndex ?? 0));
  const effectiveHours =
    weatherHours && weatherHours.length > 0 ? weatherHours : Array(24).fill(currentWeather);

  const refractionFrame = computeInterpolatedRefractionFrame({
    hours: effectiveHours,
    fallbackWeather: currentWeather,
    loopProgress: typeof loopProgress === 'number' ? loopProgress : hourIndex,
    isPlayingLoop,
  });

  const mLat = 111320;
  const refLat =
    activeSources[0]?.position.lat ?? receptors[0]?.center.lat ?? DEFAULT_CENTER.lat;
  const mLng = 111320 * Math.cos((refLat * Math.PI) / 180);

  // Build bounding box around all sources & receptors
  const allPoints: LatLngPoint[] = [
    ...sources.map((s) => s.position),
    ...receptors.map((r) => r.center),
  ];
  const anchorPts = allPoints.length > 0 ? allPoints : [DEFAULT_CENTER];
  const rawMinLat = Math.min(...anchorPts.map((p) => p.lat));
  const rawMaxLat = Math.max(...anchorPts.map((p) => p.lat));
  const rawMinLng = Math.min(...anchorPts.map((p) => p.lng));
  const rawMaxLng = Math.max(...anchorPts.map((p) => p.lng));

  const padLat = 95 / mLat;
  const padLng = 115 / mLng;
  const minLat = rawMinLat - padLat;
  const maxLat = rawMaxLat + padLat;
  const minLng = rawMinLng - padLng;
  const maxLng = rawMaxLng + padLng;

  const dLatCell = (maxLat - minLat) / gridRows;
  const dLngCell = (maxLng - minLng) / gridCols;

  const sourceEffectiveMap = activeSources.map((src) => ({
    src,
    effectiveLwaDb: resolveEffectiveSourceLwa(src, baseMachineLwaDb),
  }));

  const combinedSiteLwaDb =
    sourceEffectiveMap.length > 0
      ? Number(
          (
            10 *
            Math.log10(
              sourceEffectiveMap.reduce(
                (acc, item) => acc + Math.pow(10, item.effectiveLwaDb / 10),
                0
              )
            )
          ).toFixed(1)
        )
      : 0;
  const maxActiveLwaDb =
    sourceEffectiveMap.length > 0
      ? Math.max(...sourceEffectiveMap.map((s) => s.effectiveLwaDb))
      : 0;

  const evaluatePoint = (pt: LatLngPoint) => {
    if (sourceEffectiveMap.length === 0) {
      return {
        laeqDb: 42.0,
        lafmaxDb: 45.0,
        windRefractionDb: 0,
        thermalRefractionDb: refractionFrame.thermalSpec.thermalRefractionDb,
        rainSplashBonusDb: refractionFrame.rainSplashBonusDb,
        totalRefractionDb: refractionFrame.thermalSpec.thermalRefractionDb,
        downwindAlignmentCos: 0,
        dominantSourceId: null as string | null,
        dominantSourceCode: 'Ingen aktive kilder',
        dominantSourceLwaDb: 0,
        nearestSourceDistM: 999,
      };
    }

    let laeqPowerSum = 0;
    let lafmaxPowerSum = 0;
    let bestContrib = -Infinity;
    let domSrcId: string | null = sourceEffectiveMap[0].src.id;
    let domSrcCode = sourceEffectiveMap[0].src.code;
    let domSrcLwa = sourceEffectiveMap[0].effectiveLwaDb;
    let domWindRefr = 0;
    let domTotalRefr = 0;
    let domCos = 0;
    let nearestDistM = Infinity;

    for (const item of sourceEffectiveMap) {
      const dLatM = (pt.lat - item.src.position.lat) * mLat;
      const dLngM = (pt.lng - item.src.position.lng) * mLng;
      const distM = Math.max(8, Math.hypot(dLatM, dLngM));
      if (distM < nearestDistM) nearestDistM = distM;

      const bearingDeg = ((Math.atan2(dLngM, dLatM) * 180) / Math.PI + 360) % 360;
      const angleDiffRad = ((bearingDeg - refractionFrame.animPlumeDirectionDeg) * Math.PI) / 180;
      const cosAlign = Math.cos(angleDiffRad);

      // Local directional wind refraction (downwind wave bending vs. upwind acoustic shadow)
      const windCompDb =
        cosAlign >= 0
          ? cosAlign * refractionFrame.downwindWindRefractionDb
          : cosAlign * Math.abs(refractionFrame.upwindShadowRefractionDb);

      const totalRefr =
        windCompDb +
        refractionFrame.thermalSpec.thermalRefractionDb +
        refractionFrame.rainSplashBonusDb;

      // ISO 9613-2 geometric divergence + ground/atmospheric attenuation
      const aDivDb = 20 * Math.log10(distM) + 11.0;
      const aAtmGroundDb = Math.min(7.5, 0.9 + distM * 0.014);

      const srcLaeq = item.effectiveLwaDb - aDivDb - aAtmGroundDb + totalRefr;
      // Impulse peak crest factor scales slightly with machine power (7.5 to 11.5 dB)
      const impulseCrestDb = Math.max(
        6.5,
        Math.min(11.5, 7.5 + (item.effectiveLwaDb - 95) * 0.14)
      );
      const srcLafmax = srcLaeq + impulseCrestDb;

      laeqPowerSum += Math.pow(10, srcLaeq / 10);
      lafmaxPowerSum += Math.pow(10, srcLafmax / 10);

      if (srcLafmax > bestContrib) {
        bestContrib = srcLafmax;
        domSrcId = item.src.id;
        domSrcCode = item.src.code;
        domSrcLwa = item.effectiveLwaDb;
        domWindRefr = windCompDb;
        domTotalRefr = totalRefr;
        domCos = cosAlign;
      }
    }

    const laeqDb = Number(Math.max(42, 10 * Math.log10(Math.max(1e-6, laeqPowerSum))).toFixed(1));
    const lafmaxDb = Number(
      Math.max(45, 10 * Math.log10(Math.max(1e-6, lafmaxPowerSum))).toFixed(1)
    );

    return {
      laeqDb,
      lafmaxDb,
      windRefractionDb: Number(domWindRefr.toFixed(1)),
      thermalRefractionDb: refractionFrame.thermalSpec.thermalRefractionDb,
      rainSplashBonusDb: refractionFrame.rainSplashBonusDb,
      totalRefractionDb: Number(domTotalRefr.toFixed(1)),
      downwindAlignmentCos: Number(domCos.toFixed(2)),
      dominantSourceId: domSrcId,
      dominantSourceCode: domSrcCode,
      dominantSourceLwaDb: domSrcLwa,
      nearestSourceDistM: Math.round(nearestDistM),
    };
  };

  const cells: AcousticHazardHeatmapCell[] = [];
  for (let r = 0; r < gridRows; r++) {
    const lat0 = minLat + r * dLatCell;
    const lat1 = lat0 + dLatCell;
    const centerLat = (lat0 + lat1) / 2;

    for (let c = 0; c < gridCols; c++) {
      const lng0 = minLng + c * dLngCell;
      const lng1 = lng0 + dLngCell;
      const centerLng = (lng0 + lng1) / 2;
      const center: LatLngPoint = { lat: centerLat, lng: centerLng };
      const evalPt = evaluatePoint(center);
      const displayDb = metricMode === 'laeq' ? evalPt.laeqDb : evalPt.lafmaxDb;
      const style = classifyAcousticHazardTier(displayDb);

      cells.push({
        id: `ahm-${r}-${c}`,
        row: r,
        col: c,
        center,
        polygon: [
          { lat: lat0, lng: lng0 },
          { lat: lat0, lng: lng1 },
          { lat: lat1, lng: lng1 },
          { lat: lat1, lng: lng0 },
        ],
        ...evalPt,
        hazardTier: style.tier,
        normalizedIntensity: style.normalizedIntensity,
        fillHex: style.fillHex,
        strokeHex: style.strokeHex,
        svgFillOpacity: style.svgFillOpacity,
        gmpFillOpacity: style.gmpFillOpacity,
      });
    }
  }

  const renderedCells = cells.filter((c) => c.hazardTier !== 'low');

  const activeSourceSummaries: AcousticSourceRefractionSummary[] = sourceEffectiveMap.map(
    ({ src, effectiveLwaDb }) => {
      const impulseCrestDb = Math.max(
        6.5,
        Math.min(11.5, 7.5 + (effectiveLwaDb - 95) * 0.14)
      );
      const levelOffsetDb = metricMode === 'laeq' ? 0 : impulseCrestDb;
      const totalDownwindRefr =
        refractionFrame.downwindWindRefractionDb +
        refractionFrame.thermalSpec.thermalRefractionDb +
        refractionFrame.rainSplashBonusDb;

      const calcDirectionalRadiusM = (thresholdDb: number, cosAlign: number) => {
        const windCompDb =
          cosAlign >= 0
            ? cosAlign * refractionFrame.downwindWindRefractionDb
            : cosAlign * Math.abs(refractionFrame.upwindShadowRefractionDb);
        const totalRefr =
          windCompDb +
          refractionFrame.thermalSpec.thermalRefractionDb +
          refractionFrame.rainSplashBonusDb;
        return Math.max(
          8,
          Math.min(
            265,
            Math.round(
              Math.pow(
                10,
                (effectiveLwaDb + levelOffsetDb - thresholdDb - 12.2 + totalRefr) / 20
              )
            )
          )
        );
      };

      const buildIsoContour = (
        thresholdDb: 85 | 75 | 65,
        tier: AcousticHazardTier,
        labelDa: string,
        fillHex: string,
        strokeHex: string
      ): AcousticHazardContourZone => {
        const polygon: LatLngPoint[] = [];
        const steps = 24;
        for (let i = 0; i < steps; i++) {
          const bearingDeg = (i * 360) / steps;
          const angleDiffRad =
            ((bearingDeg - refractionFrame.animPlumeDirectionDeg) * Math.PI) / 180;
          const cosAlign = Math.cos(angleDiffRad);
          const radiusM = calcDirectionalRadiusM(thresholdDb, cosAlign);
          const bearingRad = (bearingDeg * Math.PI) / 180;
          polygon.push({
            lat: src.position.lat + (radiusM * Math.cos(bearingRad)) / mLat,
            lng: src.position.lng + (radiusM * Math.sin(bearingRad)) / mLng,
          });
        }
        return {
          id: `${src.id}-iso-${thresholdDb}`,
          sourceId: src.id,
          sourceCode: src.code,
          thresholdDb,
          tier,
          labelDa,
          fillHex,
          strokeHex,
          downwindRadiusM: calcDirectionalRadiusM(thresholdDb, 1),
          upwindRadiusM: calcDirectionalRadiusM(thresholdDb, -1),
          polygon,
        };
      };

      const hazardZonePolygons: AcousticHazardContourZone[] = [
        buildIsoContour(65, 'moderate', '65 dB Moderat Farezone', '#eab308', '#fde047'),
        buildIsoContour(75, 'high', '75 dB Høj Farezone', '#f97316', '#fdba74'),
        buildIsoContour(85, 'critical', '85 dB Kritisk Impulszone', '#e11d48', '#fda4af'),
      ];

      const downwindRad = (refractionFrame.animPlumeDirectionDeg * Math.PI) / 180;
      const tipDistM = Math.max(45, calcDirectionalRadiusM(75, 1));
      return {
        sourceId: src.id,
        sourceCode: src.code,
        sourceName: src.name,
        position: src.position,
        effectiveLwaDb,
        downwindDeg: refractionFrame.animPlumeDirectionDeg,
        maxDownwindRefractionDb: Number(totalDownwindRefr.toFixed(1)),
        critical85DbRadiusM: calcDirectionalRadiusM(85, 1),
        high75DbRadiusM: calcDirectionalRadiusM(75, 1),
        moderate65DbRadiusM: calcDirectionalRadiusM(65, 1),
        refractionArrowTip: {
          lat: src.position.lat + (tipDistM * Math.cos(downwindRad)) / mLat,
          lng: src.position.lng + (tipDistM * Math.sin(downwindRad)) / mLng,
        },
        hazardZonePolygons,
      };
    }
  );

  // Render outer 65 dB -> 75 dB -> inner 85 dB contour order
  const hazardZoneContours: AcousticHazardContourZone[] = activeSourceSummaries
    .flatMap((s) => s.hazardZonePolygons)
    .sort((a, b) => a.thresholdDb - b.thresholdDb);

  const receptorImpacts: AcousticReceptorImpactSummary[] = receptors
    .map((rec) => {
      const evalPt = evaluatePoint(rec.center);
      const displayDb = metricMode === 'laeq' ? evalPt.laeqDb : evalPt.lafmaxDb;
      const style = classifyAcousticHazardTier(displayDb);
      return {
        receptorId: rec.id,
        code: rec.code,
        name: rec.name,
        laeqDb: evalPt.laeqDb,
        lafmaxDb: evalPt.lafmaxDb,
        windRefractionDb: evalPt.windRefractionDb,
        totalRefractionDb: evalPt.totalRefractionDb,
        hazardTier: style.tier,
      };
    })
    .sort((a, b) => b.lafmaxDb - a.lafmaxDb);

  const peakGridLafmaxDb =
    cells.length > 0 ? Math.max(...cells.map((c) => c.lafmaxDb)) : 45.0;
  const peakGridLaeqDb =
    cells.length > 0 ? Math.max(...cells.map((c) => c.laeqDb)) : 42.0;

  return {
    cells,
    renderedCells,
    hazardZoneContours,
    activeSourceSummaries,
    receptorImpacts,
    worstReceptor: receptorImpacts[0] ?? null,
    activeSourcesCount: activeSources.length,
    maxActiveLwaDb,
    combinedSiteLwaDb,
    windSpeedMs: refractionFrame.animWindSpeed10m,
    windGustsMs: refractionFrame.animWindGusts10m,
    windFromDeg: refractionFrame.animWindDirection10m,
    plumeDownwindDeg: refractionFrame.animPlumeDirectionDeg,
    pasquillClass: refractionFrame.animPasquillClass,
    thermalRegimeLabel: refractionFrame.thermalSpec.regimeLabel,
    thermalRefractionDb: refractionFrame.thermalSpec.thermalRefractionDb,
    downwindWindRefractionDb: refractionFrame.downwindWindRefractionDb,
    upwindShadowRefractionDb: refractionFrame.upwindShadowRefractionDb,
    rainSplashBonusDb: refractionFrame.rainSplashBonusDb,
    peakGridLafmaxDb,
    peakGridLaeqDb,
    criticalCellCount: cells.filter((c) => c.hazardTier === 'critical').length,
    highCellCount: cells.filter((c) => c.hazardTier === 'high').length,
    moderateCellCount: cells.filter((c) => c.hazardTier === 'moderate').length,
    impactedReceptorsOver85Db: receptorImpacts.filter((r) => r.lafmaxDb >= 85.0).length,
    impactedReceptorsOver70Db: receptorImpacts.filter((r) => r.lafmaxDb >= 70.0).length,
  };
}
