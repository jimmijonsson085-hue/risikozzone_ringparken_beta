import {
  Epsg25832Coordinate,
  KierulffsvejWaterMainPoint,
  KierulffsvejWaterMainSegment,
  LatLngPoint,
  RingparkenBuildingUnit,
  WaterMainCoordinateMode,
  WaterMainHydrantNode,
  WaterMainServiceBranch,
  WaterMainValveNode,
} from '../types/dispersion';

export const WATER_MAIN_LAYER_ID =
  'Infrastruktur_Drikkevand_Hovedroer_Kierulffsvej' as const;
export const WATER_MAIN_OWNER =
  'SK Vand A/S (Jernbjerg Vandværk) / Envafors' as const;
export const WATER_HARDNESS_DH = 16.1;
export const WATER_MAIN_DIMENSION = 'DN200' as const;
export const WATER_MAIN_DEPTH_M = 1.65;
export const WATER_MAIN_DEPTH_INTERVAL_M: [number, number] = [1.45, 1.8];
export const DISTRICT_HEATING_DEPTH_M = 1.05;
export const LER_UNCERTAINTY_M = 2.0;
export const NOMINAL_PRESSURE_BAR = 4.2;
export const NOMINAL_FLOW_LS = 18.5;
export const WATER_MAIN_HISTORICAL_EVIDENCE_DA =
  'Ledningsbrud 7. juni 2018 på Kierulffsvej (60 m rende, ~180 m³ vandtab)' as const;
export const WATER_MAIN_DIN4150_3_THRESHOLDS_DA =
  'Skærpet eternit-advarsel >= 25 mm/s | Plast/murværk: 50 mm/s | Metal/beton: 80 mm/s' as const;
export const WATER_MAIN_DRINKING_WATER_LIMITS_DA =
  'BEK nr. 1272 af 31/10/2025: Bly <= 5,0 µg/L · Sum 4 PAH <= 0,10 µg/L · Vandforsyningslovens § 62' as const;

export interface KierulffsvejControlPointRef {
  code: string;
  label: string;
  lat: number;
  lng: number;
  epsg25832: Epsg25832Coordinate;
  elevationMoh?: number;
  groundwaterDepthM?: number;
  groundwaterRangeM?: [number, number];
  noteDa?: string;
}

/**
 * Lokale scene-koordinater i App.tsx langs Kierulffsvej-korridoren (KP-01, KP-04, KP-05).
 */
export const KIERULFFSVEJ_SCENE_CONTROL_POINTS: KierulffsvejControlPointRef[] = [
  {
    code: 'KP-01',
    label: 'KP-01 Valbyvej udkørsel',
    lat: 55.41235,
    lng: 11.35265,
    epsg25832: wgs84ToEpsg25832(55.41235, 11.35265),
    elevationMoh: 33.2,
    groundwaterDepthM: 1.4,
    groundwaterRangeM: [0.8, 2.1],
  },
  {
    code: 'KP-04',
    label: 'KP-04 Blok 1 front',
    lat: 55.41295,
    lng: 11.35365,
    epsg25832: wgs84ToEpsg25832(55.41295, 11.35365),
    elevationMoh: 33.7,
    groundwaterDepthM: 1.2,
    groundwaterRangeM: [0.8, 2.0],
  },
  {
    code: 'KP-05',
    label: 'KP-05 Kierulffsvej 2-12',
    lat: 55.41335,
    lng: 11.35455,
    epsg25832: wgs84ToEpsg25832(55.41335, 11.35455),
    elevationMoh: 34.1,
    groundwaterDepthM: 1.2,
    groundwaterRangeM: [0.8, 2.0],
  },
];

/**
 * Officielle DAR WGS84-koordinater langs hele Kierulffsvej (til GeoJSON / EPSG:25832).
 */
export const KIERULFFSVEJ_DAR_CONTROL_POINTS: KierulffsvejControlPointRef[] = [
  {
    code: 'DAR-KV-2',
    label: 'Kierulffsvej 2',
    lat: 55.41453,
    lng: 11.3514,
    epsg25832: wgs84ToEpsg25832(55.41453, 11.3514),
    elevationMoh: 33.4,
    noteDa: 'Kote 33,4 m.o.h.',
  },
  {
    code: 'DAR-KV-12',
    label: 'Kierulffsvej 12',
    lat: 55.414717,
    lng: 11.352166,
    epsg25832: wgs84ToEpsg25832(55.414717, 11.352166),
    groundwaterDepthM: 1.4,
    groundwaterRangeM: [0.8, 2.1],
    noteDa: 'GV: 1,4 m / 0,8–2,1 m',
  },
  {
    code: 'DAR-KV-14',
    label: 'Kierulffsvej 14',
    lat: 55.414901,
    lng: 11.353671,
    epsg25832: wgs84ToEpsg25832(55.414901, 11.353671),
    elevationMoh: 33.7,
    groundwaterDepthM: 1.2,
    noteDa: 'Kote 33,7 m.o.h., GV: 1,2 m',
  },
  {
    code: 'DAR-KV-26',
    label: 'Kierulffsvej 26',
    lat: 55.414933,
    lng: 11.35445,
    epsg25832: wgs84ToEpsg25832(55.414933, 11.35445),
    noteDa: 'V-MIDT sektionering',
  },
  {
    code: 'DAR-KV-36',
    label: 'Kierulffsvej 36',
    lat: 55.415091,
    lng: 11.355344,
    epsg25832: wgs84ToEpsg25832(55.415091, 11.355344),
    elevationMoh: 34.8,
    noteDa: 'Kote 34,8 m.o.h.',
  },
  {
    code: 'DAR-KV-66',
    label: 'Kierulffsvej 66',
    lat: 55.415491,
    lng: 11.357963,
    epsg25832: wgs84ToEpsg25832(55.415491, 11.357963),
    groundwaterDepthM: 1.1,
    groundwaterRangeM: [0.5, 1.8],
    noteDa: 'GV ved nr. 52: 1,1 m / min 0,5 m (2018-brudzone)',
  },
  {
    code: 'DAR-KV-104',
    label: 'Kierulffsvej 104',
    lat: 55.415648,
    lng: 11.36126,
    epsg25832: wgs84ToEpsg25832(55.415648, 11.36126),
    noteDa: 'Østlig afgrænsning mod Rosenkildevej (V-ØST)',
  },
];

/**
 * Exact GRS80 / ETRS89 UTM Zone 32N (EPSG:25832) Transverse Mercator forward projection.
 * Central meridian = 9° E, scale factor k0 = 0.9996, false easting = 500000 m.
 */
export function wgs84ToEpsg25832(latDeg: number, lngDeg: number): Epsg25832Coordinate {
  const a = 6378137.0;
  const f = 1 / 298.257222101; // GRS80
  const e2 = 2 * f - f * f;
  const ep2 = e2 / (1 - e2);
  const k0 = 0.9996;
  const lon0 = (9 * Math.PI) / 180;

  const lat = (latDeg * Math.PI) / 180;
  const lon = (lngDeg * Math.PI) / 180;

  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const tanLat = Math.tan(lat);

  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const T = tanLat * tanLat;
  const C = ep2 * cosLat * cosLat;
  const A = cosLat * (lon - lon0);

  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const M =
    a *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * lat -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * lat) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * lat) -
      ((35 * e6) / 3072) * Math.sin(6 * lat));

  const eastingM =
    500000 +
    k0 *
      N *
      (A +
        ((1 - T + C) * Math.pow(A, 3)) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * Math.pow(A, 5)) / 120);

  const northingM =
    k0 *
    (M +
      N *
        tanLat *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4)) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * Math.pow(A, 6)) /
            720));

  return {
    eastingM: Number(eastingM.toFixed(2)),
    northingM: Number(northingM.toFixed(2)),
  };
}

export function haversineDistanceMeters(a: LatLngPoint, b: LatLngPoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const q =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng *
      sinDLng;
  return 2 * R * Math.atan2(Math.sqrt(q), Math.sqrt(Math.max(0, 1 - q)));
}

export function polylineLengthMeters(pts: LatLngPoint[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += haversineDistanceMeters(pts[i - 1], pts[i]);
  }
  return Number(total.toFixed(1));
}

function enrichPoint(pt: KierulffsvejWaterMainPoint): KierulffsvejWaterMainPoint {
  return {
    ...pt,
    epsg25832: wgs84ToEpsg25832(pt.lat, pt.lng),
  };
}

/**
 * Computes a closed LER 2.0 corridor buffer polygon (±halfWidthMeters) around a polyline.
 */
export function buildWaterMainBufferPolygon(
  waypoints: LatLngPoint[],
  halfWidthMeters = LER_UNCERTAINTY_M
): LatLngPoint[] {
  if (waypoints.length < 2) return [];
  const leftSide: LatLngPoint[] = [];
  const rightSide: LatLngPoint[] = [];

  for (let i = 0; i < waypoints.length; i++) {
    const prev = waypoints[Math.max(0, i - 1)];
    const next = waypoints[Math.min(waypoints.length - 1, i + 1)];
    const curr = waypoints[i];

    const latRad = (curr.lat * Math.PI) / 180;
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos(latRad);

    const dx = (next.lng - prev.lng) * mPerDegLng;
    const dy = (next.lat - prev.lat) * mPerDegLat;
    const len = Math.max(1e-6, Math.hypot(dx, dy));

    // Unit normal vector perpendicular to tangent
    const nx = -dy / len;
    const ny = dx / len;

    const dLng = (nx * halfWidthMeters) / mPerDegLng;
    const dLat = (ny * halfWidthMeters) / mPerDegLat;

    leftSide.push({
      lat: Number((curr.lat + dLat).toFixed(6)),
      lng: Number((curr.lng + dLng).toFixed(6)),
    });
    rightSide.push({
      lat: Number((curr.lat - dLat).toFixed(6)),
      lng: Number((curr.lng - dLng).toFixed(6)),
    });
  }

  return [...leftSide, ...rightSide.reverse()];
}

/**
 * Closest point on a polyline segment + perpendicular distance in meters.
 */
export function closestPointOnPolyline(
  target: LatLngPoint,
  polyline: LatLngPoint[]
): { point: LatLngPoint; distanceMeters: number } {
  if (polyline.length === 0) {
    return { point: target, distanceMeters: 999 };
  }
  if (polyline.length === 1) {
    return {
      point: polyline[0],
      distanceMeters: haversineDistanceMeters(target, polyline[0]),
    };
  }

  const latRad = (target.lat * Math.PI) / 180;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(latRad);

  let bestPoint = polyline[0];
  let bestDist = Infinity;

  for (let i = 1; i < polyline.length; i++) {
    const a = polyline[i - 1];
    const b = polyline[i];

    const ax = (a.lng - target.lng) * mPerDegLng;
    const ay = (a.lat - target.lat) * mPerDegLat;
    const bx = (b.lng - target.lng) * mPerDegLng;
    const by = (b.lat - target.lat) * mPerDegLat;

    const abx = bx - ax;
    const aby = by - ay;
    const abLenSq = abx * abx + aby * aby;
    const t =
      abLenSq > 1e-6
        ? Math.max(0, Math.min(1, -(ax * abx + ay * aby) / abLenSq))
        : 0;

    const cx = ax + t * abx;
    const cy = ay + t * aby;
    const dist = Math.hypot(cx, cy);

    if (dist < bestDist) {
      bestDist = dist;
      bestPoint = {
        lat: Number((a.lat + t * (b.lat - a.lat)).toFixed(6)),
        lng: Number((a.lng + t * (b.lng - a.lng)).toFixed(6)),
      };
    }
  }

  return {
    point: bestPoint,
    distanceMeters: Number(bestDist.toFixed(2)),
  };
}

/**
 * Official DAR-verified (~750 m) Kierulffsvej water main trace in WGS84 + EPSG:25832.
 * Resolves the ~217 m geodetic offset vs. App.tsx's scene-calibrated local coordinates.
 */
export const DAR_VERIFIED_KIERULFFSVEJ_WATER_MAIN: KierulffsvejWaterMainSegment[] = [
  {
    id: 'dar-kierulffsvej-seg-1-eternit',
    code: 'DAR-KV-HOVED-01',
    name: 'Kierulffsvej DN200 Hovedrør (Valbyvej → Nr. 36 · Eternit 1964)',
    ownerName: WATER_MAIN_OWNER,
    waterHardnessDh: WATER_HARDNESS_DH,
    dimension: WATER_MAIN_DIMENSION,
    material: 'ETERNIT_ASBESTCEMENT_1964',
    installYear: 1964,
    burialDepthMeters: WATER_MAIN_DEPTH_M,
    depthIntervalMeters: WATER_MAIN_DEPTH_INTERVAL_M,
    overlyingDistrictHeatingDepthMeters: DISTRICT_HEATING_DEPTH_M,
    lerUncertaintyBufferMeters: LER_UNCERTAINTY_M,
    nominalPressureBar: NOMINAL_PRESSURE_BAR,
    nominalFlowLs: NOMINAL_FLOW_LS,
    coordinateMode: 'dar_verified_wgs84',
    waypoints: (
      [
        {
        lat: 55.41439,
        lng: 11.35062,
        elevationMoh: 33.2,
        groundwaterDepthM: 1.4,
        groundwaterRangeM: [0.8, 2.1],
        label: 'Valbyvej-tilslutning (V-VEST)',
      },
      {
        lat: 55.41453,
        lng: 11.3514,
        elevationMoh: 33.4,
        groundwaterDepthM: 1.4,
        groundwaterRangeM: [0.8, 2.1],
        label: 'Kierulffsvej 2 (kote 33,4 m.o.h.)',
      },
      {
        lat: 55.414717,
        lng: 11.352166,
        elevationMoh: 33.5,
        groundwaterDepthM: 1.4,
        groundwaterRangeM: [0.8, 2.1],
        label: 'Kierulffsvej 12 (GV: 1,4 m / 0,8–2,1 m)',
      },
      {
        lat: 55.414901,
        lng: 11.353671,
        elevationMoh: 33.7,
        groundwaterDepthM: 1.2,
        groundwaterRangeM: [0.8, 2.0],
        label: 'Kierulffsvej 14 (Blok 1 · kote 33,7 m.o.h. · GV: 1,2 m)',
      },
      {
        lat: 55.414933,
        lng: 11.35445,
        elevationMoh: 34.1,
        groundwaterDepthM: 1.2,
        groundwaterRangeM: [0.8, 2.0],
        label: 'Kierulffsvej 26 (V-MIDT)',
      },
      {
        lat: 55.415091,
        lng: 11.355344,
        elevationMoh: 34.8,
        groundwaterDepthM: 1.2,
        groundwaterRangeM: [0.7, 1.9],
        label: 'Kierulffsvej 36 (kote 34,8 m.o.h.)',
      },
      ] as KierulffsvejWaterMainPoint[]
    ).map(enrichPoint),
    lengthMeters: 312.4,
    notesDa:
      'Primært 1964-eternit/asbestcement-hovedrør (DN200) i 1,65 m dybde under fjernvarmerør (~1,05 m). Officielt DAR-tracé inkl. koter og høj vintervandstand i moræneler.',
  },
  {
    id: 'dar-kierulffsvej-seg-2-pe-renoveret',
    code: 'DAR-KV-HOVED-02',
    name: 'Kierulffsvej DN200 Delstræk (Nr. 36 → 52–66 · 2018-Brud & PE100 Splice)',
    ownerName: WATER_MAIN_OWNER,
    waterHardnessDh: WATER_HARDNESS_DH,
    dimension: WATER_MAIN_DIMENSION,
    material: 'PE100_SDR17_IKKE_DIFFUSIONSTAET',
    installYear: 2018,
    burialDepthMeters: WATER_MAIN_DEPTH_M,
    depthIntervalMeters: WATER_MAIN_DEPTH_INTERVAL_M,
    overlyingDistrictHeatingDepthMeters: DISTRICT_HEATING_DEPTH_M,
    lerUncertaintyBufferMeters: LER_UNCERTAINTY_M,
    nominalPressureBar: NOMINAL_PRESSURE_BAR,
    nominalFlowLs: NOMINAL_FLOW_LS,
    coordinateMode: 'dar_verified_wgs84',
    waypoints: (
      [
        {
        lat: 55.415091,
        lng: 11.355344,
        elevationMoh: 34.8,
        groundwaterDepthM: 1.2,
        groundwaterRangeM: [0.7, 1.9],
        label: 'Kierulffsvej 36 (kote 34,8 m.o.h.)',
      },
      {
        lat: 55.415491,
        lng: 11.357963,
        elevationMoh: 35.5,
        groundwaterDepthM: 1.1,
        groundwaterRangeM: [0.5, 1.8],
        label: 'Kierulffsvej 66 (2018-brudsted · GV ved nr. 52: 1,1 m / min 0,5 m)',
      },
      ] as KierulffsvejWaterMainPoint[]
    ).map(enrichPoint),
    lengthMeters: 171.6,
    notesDa:
      'Delstræk udskiftet med PE100 SDR17 (ikke-diffusionstæt mod aromatiske kulbrinter/PAH/BTEX) efter brud på 1964-eternitledning.',
    historicalIncidentDa:
      'Ledningsbrud 7. juni 2018 på Kierulffsvej 52–66: 60 m opgravet rende med ~180 m³ vandtab og lokal undergravning af vejprofil.',
  },
  {
    id: 'dar-kierulffsvej-seg-3-eternit-oest',
    code: 'DAR-KV-HOVED-03',
    name: 'Kierulffsvej DN200 Øst (Nr. 66 → Nr. 104 mod Rosenkildevej)',
    ownerName: WATER_MAIN_OWNER,
    waterHardnessDh: WATER_HARDNESS_DH,
    dimension: WATER_MAIN_DIMENSION,
    material: 'ETERNIT_ASBESTCEMENT_1964',
    installYear: 1964,
    burialDepthMeters: WATER_MAIN_DEPTH_M,
    depthIntervalMeters: WATER_MAIN_DEPTH_INTERVAL_M,
    overlyingDistrictHeatingDepthMeters: DISTRICT_HEATING_DEPTH_M,
    lerUncertaintyBufferMeters: LER_UNCERTAINTY_M,
    nominalPressureBar: NOMINAL_PRESSURE_BAR,
    nominalFlowLs: NOMINAL_FLOW_LS,
    coordinateMode: 'dar_verified_wgs84',
    waypoints: (
      [
        {
        lat: 55.415491,
        lng: 11.357963,
        elevationMoh: 35.5,
        groundwaterDepthM: 1.1,
        groundwaterRangeM: [0.5, 1.8],
        label: 'Kierulffsvej 66 (GV ved nr. 52: 1,1 m / min 0,5 m)',
      },
      {
        lat: 55.415648,
        lng: 11.36126,
        elevationMoh: 36.1,
        groundwaterDepthM: 1.1,
        groundwaterRangeM: [0.5, 1.8],
        label: 'Kierulffsvej 104 mod Rosenkildevej (V-ØST)',
      },
      ] as KierulffsvejWaterMainPoint[]
    ).map(enrichPoint),
    lengthMeters: 209.4,
    notesDa:
      'Østlig fortsættelse af Kierulffsvej DN200 eternit-hovedledning mod Rosenkildevej.',
  },
];

/**
 * Dynamically derives the scene-calibrated corridor centerline and building service branches
 * coupled directly to active anchors in RINGPARKEN_MASTER_BUILDINGS.
 */
export function buildSceneCalibratedKierulffsvejWaterMain(
  buildings: RingparkenBuildingUnit[]
): {
  segments: KierulffsvejWaterMainSegment[];
  waypoints: KierulffsvejWaterMainPoint[];
  valves: WaterMainValveNode[];
  hydrants: WaterMainHydrantNode[];
  serviceBranches: WaterMainServiceBranch[];
} {
  const blok1 = buildings.find((b) => b.id === 'BLOK-1');
  const byg1Kierulffsvej2 = buildings.find((b) => b.id === 'BYG-1-BOERNEHAVE');
  const byg2Kierulffsvej12 = buildings.find((b) => b.id === 'BYG-2-BAZAR');
  const byg3Valbyvej58 = buildings.find((b) => b.id === 'BYG-3-FRITIDSHJEM');

  // Anchor points directly along the Kierulffsvej street corridor coupled to building centers
  const blok1Center = blok1?.center ?? { lat: 55.41295, lng: 11.35365 };
  const byg1Center = byg1Kierulffsvej2?.center ?? { lat: 55.4132, lng: 11.3541 };
  const byg2Center = byg2Kierulffsvej12?.center ?? { lat: 55.4135, lng: 11.3535 };
  const byg3Center = byg3Valbyvej58?.center ?? { lat: 55.4129, lng: 11.3545 };

  // Compute road-centerline corridor aligned to App.tsx scene control points KP-01, KP-04, KP-05
  const wpWest = enrichPoint({
    lat: 55.41235,
    lng: 11.35265,
    elevationMoh: 33.2,
    groundwaterDepthM: 1.4,
    groundwaterRangeM: [0.8, 2.1],
    label: 'KP-01 Valbyvej udkørsel (V-VEST)',
  });

  const wpBlok1 = enrichPoint({
    lat: Number(blok1Center.lat.toFixed(6)),
    lng: Number(blok1Center.lng.toFixed(6)),
    elevationMoh: 33.7,
    groundwaterDepthM: 1.2,
    groundwaterRangeM: [0.8, 2.0],
    label: 'KP-04 Blok 1 front (Kierulffsvej 14–22)',
  });

  // Midpoint aligned with KP-05 Kierulffsvej 2–12 frontage corridor (55.41335, 11.35455)
  const wpKierulffsvej2_12 = enrichPoint({
    lat: Number((((byg1Center.lat + byg3Center.lat) * 0.5) + 0.0003).toFixed(6)),
    lng: Number((((byg1Center.lng + byg3Center.lng) * 0.5) + 0.00025).toFixed(6)),
    elevationMoh: 34.1,
    groundwaterDepthM: 1.2,
    groundwaterRangeM: [0.8, 2.0],
    label: 'KP-05 Kierulffsvej 2–12 (V-MIDT)',
  });

  const wpEast = enrichPoint({
    lat: 55.41368,
    lng: 11.35545,
    elevationMoh: 34.8,
    groundwaterDepthM: 1.1,
    groundwaterRangeM: [0.5, 1.8],
    label: 'Kierulffsvej Øst mod Albert Ibsensvej / Rosenkildevej (V-ØST)',
  });

  // Renovated PE100 sub-stretch junction point (72% between V-MIDT and V-ØST)
  const wpPeStart = enrichPoint({
    lat: Number((wpKierulffsvej2_12.lat + (wpEast.lat - wpKierulffsvej2_12.lat) * 0.52).toFixed(6)),
    lng: Number((wpKierulffsvej2_12.lng + (wpEast.lng - wpKierulffsvej2_12.lng) * 0.52).toFixed(6)),
    elevationMoh: 34.5,
    groundwaterDepthM: 1.1,
    groundwaterRangeM: [0.6, 1.9],
    label: 'PE100-Splice (Renoveret delstræk)',
  });

  const seg1Pts = [wpWest, wpBlok1, wpKierulffsvej2_12, wpPeStart];
  const seg2Pts = [wpPeStart, wpEast];

  const segments: KierulffsvejWaterMainSegment[] = [
    {
      id: 'scene-kierulffsvej-seg-1-eternit',
      code: 'KV-HOVED-DN200-ETERNIT',
      name: 'Kierulffsvej DN200 Hovedrør (Eternit / Asbestcement 1964)',
      ownerName: WATER_MAIN_OWNER,
      waterHardnessDh: WATER_HARDNESS_DH,
      dimension: WATER_MAIN_DIMENSION,
      material: 'ETERNIT_ASBESTCEMENT_1964',
      installYear: 1964,
      burialDepthMeters: WATER_MAIN_DEPTH_M,
      depthIntervalMeters: WATER_MAIN_DEPTH_INTERVAL_M,
      overlyingDistrictHeatingDepthMeters: DISTRICT_HEATING_DEPTH_M,
      lerUncertaintyBufferMeters: LER_UNCERTAINTY_M,
      nominalPressureBar: NOMINAL_PRESSURE_BAR,
      nominalFlowLs: NOMINAL_FLOW_LS,
      coordinateMode: 'scene_calibrated',
      waypoints: seg1Pts,
      lengthMeters: polylineLengthMeters(seg1Pts),
      notesDa:
        'Scene-kalibreret hovedrør langs Kierulffsvej (1964 Eternit DN200) i 1,65 m dybde under fjernvarme (~1,05 m). Skrøbelig over for DIN 4150-3 vibration & tung anlægslast.',
    },
    {
      id: 'scene-kierulffsvej-seg-2-pe100',
      code: 'KV-HOVED-DN200-PE100',
      name: 'Kierulffsvej DN200 Delstræk (PE100 SDR17 — Ikke-diffusionstæt)',
      ownerName: WATER_MAIN_OWNER,
      waterHardnessDh: WATER_HARDNESS_DH,
      dimension: WATER_MAIN_DIMENSION,
      material: 'PE100_SDR17_IKKE_DIFFUSIONSTAET',
      installYear: 2018,
      burialDepthMeters: WATER_MAIN_DEPTH_M,
      depthIntervalMeters: WATER_MAIN_DEPTH_INTERVAL_M,
      overlyingDistrictHeatingDepthMeters: DISTRICT_HEATING_DEPTH_M,
      lerUncertaintyBufferMeters: LER_UNCERTAINTY_M,
      nominalPressureBar: NOMINAL_PRESSURE_BAR,
      nominalFlowLs: NOMINAL_FLOW_LS,
      coordinateMode: 'scene_calibrated',
      waypoints: seg2Pts,
      lengthMeters: polylineLengthMeters(seg2Pts),
      notesDa:
        'Renoveret PE100 SDR17 delstræk (ikke-diffusionstæt). Følsom over for PAH/kulbrinte-diffusion fra nærliggende nedrivningsperkolat.',
      historicalIncidentDa:
        'Ledningsbrud 7. juni 2018 på Kierulffsvej (60 m rende, ~180 m³ vandtab).',
    },
  ];

  const fullWaypoints = [wpWest, wpBlok1, wpKierulffsvej2_12, wpPeStart, wpEast];

  const valves: WaterMainValveNode[] = [
    {
      id: 'valve-v-vest',
      code: 'V-VEST',
      name: 'Sektioneringsventil V-VEST (Valbyvej)',
      address: 'Kierulffsvej / Valbyvej-udkørslen, 4200 Slagelse',
      coordinate: { lat: wpWest.lat, lng: wpWest.lng },
      darCoordinate: { lat: 55.41439, lng: 11.35062 },
      epsg25832: wgs84ToEpsg25832(55.41439, 11.35062),
      status: 'open',
      isSectionIsolationValve: true,
      notesDa: 'SK Vand vestlig hovedsektionering ved Valbyvej-tilslutning.',
    },
    {
      id: 'valve-v-midt',
      code: 'V-MIDT',
      name: 'Sektioneringsventil V-MIDT (Kierulffsvej 26)',
      address: 'Kierulffsvej 2–12 / 26, 4200 Slagelse',
      coordinate: { lat: wpKierulffsvej2_12.lat, lng: wpKierulffsvej2_12.lng },
      darCoordinate: { lat: 55.414933, lng: 11.35445 },
      epsg25832: wgs84ToEpsg25832(55.414933, 11.35445),
      status: 'open',
      isSectionIsolationValve: true,
      notesDa: 'SK Vand central sektioneringsventil ved Kierulffsvej 26 / nedrivningskorridor.',
    },
    {
      id: 'valve-v-oest',
      code: 'V-ØST',
      name: 'Sektioneringsventil V-ØST (mod Rosenkildevej)',
      address: 'Kierulffsvej Øst / Rosenkildevej, 4200 Slagelse',
      coordinate: { lat: wpEast.lat, lng: wpEast.lng },
      darCoordinate: { lat: 55.415648, lng: 11.36126 },
      epsg25832: wgs84ToEpsg25832(55.415648, 11.36126),
      status: 'open',
      isSectionIsolationValve: true,
      notesDa: 'SK Vand østlig sektioneringsventil mod Rosenkildevej.',
    },
  ];

  const hydrants: WaterMainHydrantNode[] = [
    {
      id: 'hydrant-kv-1',
      code: 'BH-KV1',
      name: 'Brandhane BH-KV1 (Blok 1 / Kierulffsvej 14–22)',
      address: 'Kierulffsvej 14–22, 4200 Slagelse',
      coordinate: {
        lat: Number(((wpWest.lat + wpBlok1.lat) * 0.5 + 0.00004).toFixed(6)),
        lng: Number(((wpWest.lng + wpBlok1.lng) * 0.5).toFixed(6)),
      },
      darCoordinate: { lat: 55.41478, lng: 11.3529 },
      epsg25832: wgs84ToEpsg25832(55.41478, 11.3529),
      flowCapacityLs: 25,
    },
    {
      id: 'hydrant-kv-2',
      code: 'BH-KV2',
      name: 'Brandhane BH-KV2 (Kierulffsvej 2–12 Øst)',
      address: 'Kierulffsvej 2–12 / 36, 4200 Slagelse',
      coordinate: {
        lat: Number((wpPeStart.lat - 0.00004).toFixed(6)),
        lng: Number((wpPeStart.lng - 0.00008).toFixed(6)),
      },
      darCoordinate: { lat: 55.41512, lng: 11.3555 },
      epsg25832: wgs84ToEpsg25832(55.41512, 11.3555),
      flowCapacityLs: 25,
    },
  ];

  const blok1ShaftAnchor: LatLngPoint = {
    lat: Number((blok1Center.lat + 0.00009).toFixed(6)),
    lng: Number((blok1Center.lng - 0.0001).toFixed(6)),
  };

  const mainStartBlok1 = closestPointOnPolyline(blok1Center, fullWaypoints).point;
  const mainStartByg1 = closestPointOnPolyline(byg1Center, fullWaypoints).point;
  const mainStartByg2 = closestPointOnPolyline(byg2Center, fullWaypoints).point;
  const mainStartByg3 = closestPointOnPolyline(byg3Center, fullWaypoints).point;

  const serviceBranches: WaterMainServiceBranch[] = [
    {
      id: 'branch-blok-1',
      code: 'STIK-BLOK1',
      targetBuildingId: 'BLOK-1',
      targetBuildingCode: 'BLOK 1',
      address: 'Kierulffsvej 14–22 (Afd. 23)',
      material: 'ETERNIT_ASBESTCEMENT_1964',
      dimension: 'DN50',
      startOnMain: mainStartBlok1,
      buildingConnection: blok1ShaftAnchor,
      darStartOnMain: { lat: 55.414901, lng: 11.353671 },
      darBuildingConnection: { lat: 55.41504, lng: 11.35362 },
      lengthMeters: Math.max(
        2,
        Math.round(haversineDistanceMeters(mainStartBlok1, blok1ShaftAnchor))
      ),
      cappingStatus:
        blok1?.category === 'e_demolished_unsecured' ||
        blok1?.category === 'd_under_demolition'
          ? 'uncapped_risk'
          : 'isolated_valve',
      legalStandard: 'DS 439 / DS/EN 1717 (Tilbagestrømningssikring)',
      notesDa:
        'Hovedstik til Blok 1 under nedrivning. Uforseglet stikledning udgør direkte tilbagestrømnings- og forureningsvej jf. DS/EN 1717 ved trykfald.',
    },
    {
      id: 'branch-kierulffsvej-2',
      code: 'STIK-KV2',
      targetBuildingId: 'BYG-1-BOERNEHAVE',
      targetBuildingCode: 'BYG 1',
      address: 'Kierulffsvej 2',
      material: 'GALVANISERET_STÅL_1964',
      dimension: 'DN40',
      startOnMain: mainStartByg1,
      buildingConnection: byg1Center,
      darStartOnMain: { lat: 55.41453, lng: 11.3514 },
      darBuildingConnection: { lat: 55.41465, lng: 11.35138 },
      lengthMeters: Math.max(
        2,
        Math.round(haversineDistanceMeters(mainStartByg1, byg1Center))
      ),
      cappingStatus:
        byg1Kierulffsvej2?.category === 'e_demolished_unsecured'
          ? 'uncapped_risk'
          : 'capped_at_boundary',
      legalStandard: 'DS 439 / DS/EN 1717 (Afpropning ved skel)',
      notesDa:
        'Stikledning til Kierulffsvej 2. Skal afproppes fuldstændigt ved skel/afgrening før nedrivning af jordfundament.',
    },
    {
      id: 'branch-kierulffsvej-12',
      code: 'STIK-KV12',
      targetBuildingId: 'BYG-2-BAZAR',
      targetBuildingCode: 'BYG 2',
      address: 'Kierulffsvej 12',
      material: 'GALVANISERET_STÅL_1964',
      dimension: 'DN40',
      startOnMain: mainStartByg2,
      buildingConnection: byg2Center,
      darStartOnMain: { lat: 55.414717, lng: 11.352166 },
      darBuildingConnection: { lat: 55.41485, lng: 11.35212 },
      lengthMeters: Math.max(
        2,
        Math.round(haversineDistanceMeters(mainStartByg2, byg2Center))
      ),
      cappingStatus:
        byg2Kierulffsvej12?.category === 'e_demolished_unsecured'
          ? 'uncapped_risk'
          : 'capped_at_boundary',
      legalStandard: 'DS 439 / DS/EN 1717 (Afpropning ved skel)',
      notesDa:
        'Stikledning til Kierulffsvej 12. Kræver dokumenteret VVS-afpropning ved hovedafgrening.',
    },
    {
      id: 'branch-valbyvej-58',
      code: 'STIK-VV58',
      targetBuildingId: 'BYG-3-FRITIDSHJEM',
      targetBuildingCode: 'BYG 3',
      address: 'Valbyvej 58',
      material: 'PE100_SDR17_IKKE_DIFFUSIONSTAET',
      dimension: 'DN32',
      startOnMain: mainStartByg3,
      buildingConnection: byg3Center,
      darStartOnMain: { lat: 55.41446, lng: 11.351 },
      darBuildingConnection: { lat: 55.41428, lng: 11.35096 },
      lengthMeters: Math.max(
        2,
        Math.round(haversineDistanceMeters(mainStartByg3, byg3Center))
      ),
      cappingStatus:
        byg3Valbyvej58?.category === 'e_demolished_unsecured'
          ? 'uncapped_risk'
          : 'isolated_valve',
      legalStandard: 'DS 439 / DS/EN 1717 (Afpropning ved skel)',
      notesDa:
        'Stikledning til Valbyvej 58. Afspærrings- og afpropningsstatus overvåges jf. DS/EN 1717.',
    },
  ];

  return {
    segments,
    waypoints: fullWaypoints,
    valves,
    hydrants,
    serviceBranches,
  };
}

/**
 * Generates an RFC 7946 GeoJSON FeatureCollection for Kierulffsvej water main layer,
 * including both WGS84 coordinates and EPSG:25832 (ETRS89 / UTM Zone 32N) projection attributes.
 */
export function buildKierulffsvejWaterMainGeoJson(
  mode: WaterMainCoordinateMode,
  buildings: RingparkenBuildingUnit[]
): Record<string, unknown> {
  const sceneData = buildSceneCalibratedKierulffsvejWaterMain(buildings);
  const segments =
    mode === 'dar_verified_wgs84'
      ? DAR_VERIFIED_KIERULFFSVEJ_WATER_MAIN
      : sceneData.segments;

  const features: Array<Record<string, unknown>> = [];

  segments.forEach((seg) => {
    const coords = seg.waypoints.map((w) => [w.lng, w.lat]);
    const epsgPts = seg.waypoints.map((w) =>
      w.epsg25832 ?? wgs84ToEpsg25832(w.lat, w.lng)
    );
    const waypointDetails = seg.waypoints.map((w) => ({
      label: w.label ?? null,
      lat: w.lat,
      lng: w.lng,
      epsg25832: w.epsg25832 ?? wgs84ToEpsg25832(w.lat, w.lng),
      elevationMoh: w.elevationMoh ?? null,
      groundwaterDepthM: w.groundwaterDepthM ?? null,
      groundwaterRangeM: w.groundwaterRangeM ?? null,
    }));
    features.push({
      type: 'Feature',
      id: seg.id,
      properties: {
        layerId: WATER_MAIN_LAYER_ID,
        featureClass: 'water_main_segment',
        coordinateMode: mode,
        code: seg.code,
        name: seg.name,
        owner: seg.ownerName,
        waterHardnessDh: seg.waterHardnessDh,
        dimension: seg.dimension,
        material: seg.material,
        installYear: seg.installYear,
        burialDepthMeters: seg.burialDepthMeters,
        depthIntervalMeters: seg.depthIntervalMeters,
        overlyingDistrictHeatingDepthMeters: seg.overlyingDistrictHeatingDepthMeters,
        lerUncertaintyBufferMeters: seg.lerUncertaintyBufferMeters,
        nominalPressureBar: seg.nominalPressureBar,
        nominalFlowLs: seg.nominalFlowLs,
        lengthMeters: seg.lengthMeters,
        notesDa: seg.notesDa,
        historicalIncidentDa: seg.historicalIncidentDa ?? null,
        epsg25832Vertices: epsgPts,
        waypointDetails,
      },
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
    });
  });

  // LER ±2.0 m uncertainty buffer polygon
  const allMainPts = segments.flatMap((s) => s.waypoints);
  const lerPoly = buildWaterMainBufferPolygon(allMainPts, LER_UNCERTAINTY_M);
  if (lerPoly.length >= 3) {
    const closedRing = [...lerPoly, lerPoly[0]].map((p) => [p.lng, p.lat]);
    features.push({
      type: 'Feature',
      id: `ler-buffer-${mode}`,
      properties: {
        layerId: WATER_MAIN_LAYER_ID,
        featureClass: 'ler_2_0_uncertainty_buffer',
        coordinateMode: mode,
        bufferRadiusMeters: LER_UNCERTAINTY_M,
        standard: 'LER 2.0 (Bekendtgørelse om registrering af ledningsejere)',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [closedRing],
      },
    });
  }

  // Service branches
  sceneData.serviceBranches.forEach((br) => {
    const pStart = mode === 'dar_verified_wgs84' ? br.darStartOnMain : br.startOnMain;
    const pEnd =
      mode === 'dar_verified_wgs84' ? br.darBuildingConnection : br.buildingConnection;
    features.push({
      type: 'Feature',
      id: br.id,
      properties: {
        layerId: WATER_MAIN_LAYER_ID,
        featureClass: 'service_branch',
        coordinateMode: mode,
        code: br.code,
        targetBuildingId: br.targetBuildingId,
        targetBuildingCode: br.targetBuildingCode,
        address: br.address,
        material: br.material,
        dimension: br.dimension,
        cappingStatus: br.cappingStatus,
        legalStandard: br.legalStandard,
        lengthMeters: br.lengthMeters,
        epsg25832Start: wgs84ToEpsg25832(pStart.lat, pStart.lng),
        epsg25832End: wgs84ToEpsg25832(pEnd.lat, pEnd.lng),
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [pStart.lng, pStart.lat],
          [pEnd.lng, pEnd.lat],
        ],
      },
    });
  });

  // Isolation valves
  sceneData.valves.forEach((v) => {
    const pt = mode === 'dar_verified_wgs84' ? v.darCoordinate : v.coordinate;
    features.push({
      type: 'Feature',
      id: v.id,
      properties: {
        layerId: WATER_MAIN_LAYER_ID,
        featureClass: 'isolation_valve',
        coordinateMode: mode,
        code: v.code,
        name: v.name,
        address: v.address,
        status: v.status,
        epsg25832: wgs84ToEpsg25832(pt.lat, pt.lng),
      },
      geometry: {
        type: 'Point',
        coordinates: [pt.lng, pt.lat],
      },
    });
  });

  // Fire hydrants
  sceneData.hydrants.forEach((h) => {
    const pt = mode === 'dar_verified_wgs84' ? h.darCoordinate : h.coordinate;
    features.push({
      type: 'Feature',
      id: h.id,
      properties: {
        layerId: WATER_MAIN_LAYER_ID,
        featureClass: 'fire_hydrant',
        coordinateMode: mode,
        code: h.code,
        name: h.name,
        flowCapacityLs: h.flowCapacityLs,
        epsg25832: wgs84ToEpsg25832(pt.lat, pt.lng),
      },
      geometry: {
        type: 'Point',
        coordinates: [pt.lng, pt.lat],
      },
    });
  });

  // Geodetic control points (either App.tsx KP-01/04/05 or Official DAR WGS84 Kierulffsvej 2–104)
  const controlPts =
    mode === 'dar_verified_wgs84'
      ? KIERULFFSVEJ_DAR_CONTROL_POINTS
      : KIERULFFSVEJ_SCENE_CONTROL_POINTS;

  controlPts.forEach((cp) => {
    features.push({
      type: 'Feature',
      id: `cp-${cp.code.toLowerCase()}`,
      properties: {
        layerId: WATER_MAIN_LAYER_ID,
        featureClass: 'geodetic_control_point',
        coordinateMode: mode,
        code: cp.code,
        label: cp.label,
        elevationMoh: cp.elevationMoh ?? null,
        groundwaterDepthM: cp.groundwaterDepthM ?? null,
        groundwaterRangeM: cp.groundwaterRangeM ?? null,
        noteDa: cp.noteDa ?? null,
        epsg25832: cp.epsg25832,
      },
      geometry: {
        type: 'Point',
        coordinates: [cp.lng, cp.lat],
      },
    });
  });

  return {
    type: 'FeatureCollection',
    name: WATER_MAIN_LAYER_ID,
    metadata: {
      exportedAtIso: new Date().toISOString(),
      coordinateMode: mode,
      wgs84Crs: 'urn:ogc:def:crs:OGC:1.3:CRS84',
      projectedReferenceCrs: 'EPSG:25832 (ETRS89 / UTM Zone 32N)',
      owner: WATER_MAIN_OWNER,
      waterHardnessDh: WATER_HARDNESS_DH,
      dimension: WATER_MAIN_DIMENSION,
      depthIntervalMeters: WATER_MAIN_DEPTH_INTERVAL_M,
      overlyingDistrictHeatingDepthMeters: DISTRICT_HEATING_DEPTH_M,
      historicalEvidenceDa: WATER_MAIN_HISTORICAL_EVIDENCE_DA,
      din4150Table3ThresholdsDa: WATER_MAIN_DIN4150_3_THRESHOLDS_DA,
      drinkingWaterLimitsDa: WATER_MAIN_DRINKING_WATER_LIMITS_DA,
      sceneControlPoints: KIERULFFSVEJ_SCENE_CONTROL_POINTS,
      darControlPoints: KIERULFFSVEJ_DAR_CONTROL_POINTS,
    },
    features,
  };
}

/**
 * Downloads the Kierulffsvej water main vector layer as an RFC 7946 GeoJSON file.
 */
export function exportKierulffsvejWaterMainGeoJson(
  mode: WaterMainCoordinateMode = 'scene_calibrated',
  buildings: RingparkenBuildingUnit[] = []
): { fileName: string; featureCount: number } {
  const fc = buildKierulffsvejWaterMainGeoJson(mode, buildings);
  const features = (fc.features as unknown[]) || [];
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `Kierulffsvej_Drikkevand_DN200_${mode}_${dateStamp}.geojson`;

  const blob = new Blob([JSON.stringify(fc, null, 2)], {
    type: 'application/geo+json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { fileName, featureCount: features.length };
}

export type {
  Epsg25832Coordinate,
  KierulffsvejWaterMainPoint,
  KierulffsvejWaterMainSegment,
  WaterMainCoordinateMode,
  WaterMainHydrantNode,
  WaterMainPipeMaterial,
  WaterMainServiceBranch,
  WaterMainValveNode,
} from '../types/dispersion';
