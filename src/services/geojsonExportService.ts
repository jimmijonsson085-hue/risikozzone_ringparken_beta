import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LatLngPoint,
  PlumePolygonZone,
  ReceptorExposureResult,
  ReceptorZone,
} from '../types/dispersion';
import { offsetLatLngByMeters } from './dispersionEngine';
import { ViewportVisualizationMode } from '../components/layout/layoutTypes';

type GeoJsonPosition = [number, number];

export interface GeoJsonFeature {
  type: 'Feature';
  id: string;
  geometry:
    | { type: 'Point'; coordinates: GeoJsonPosition }
    | { type: 'LineString'; coordinates: GeoJsonPosition[] }
    | { type: 'Polygon'; coordinates: GeoJsonPosition[][] };
  properties: Record<string, unknown>;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  bbox: [number, number, number, number];
  metadata: {
    schema: string;
    coordinateReferenceSystem: string;
    resolutionProfile: string;
    snapshotTimestampUtc: string;
    simulatedDateIso: string;
    simulatedHourLabel: string;
    viewportMode: ViewportVisualizationMode;
    plumeDirectionDeg: number;
    precipitationMmH: number;
    windSpeed10mMs: number;
    windGusts10mMs: number;
    relativeHumidity2mPct: number;
    maxSiteSumQuotient: number;
    featureCounts: {
      plumePolygons: number;
      plumeCenterlines: number;
      activeSources: number;
      sourceFootprints: number;
      activeReceptors: number;
      receptorZones: number;
      totalFeatures: number;
    };
  };
  features: GeoJsonFeature[];
}

function roundCoord(val: number): number {
  return Number(val.toFixed(7)); // ~1.1 cm WGS84 GIS precision
}

function toPos(pt: LatLngPoint): GeoJsonPosition {
  return [roundCoord(pt.lng), roundCoord(pt.lat)];
}

/**
 * Densifies a closed polygon via smooth Catmull-Rom spline interpolation (for organic plumes)
 * or linear edge subdivision (for architectural footprints) so GIS tools receive high-res geometries.
 */
function densifyPolygonRing(
  points: LatLngPoint[],
  mode: 'smooth_spline' | 'linear_edge',
  subdivisionsPerSegment: number
): GeoJsonPosition[] {
  if (points.length < 3) return [];
  const base = points.slice();
  // Remove duplicate closing point if present
  if (
    base.length > 3 &&
    Math.abs(base[0].lat - base[base.length - 1].lat) < 1e-9 &&
    Math.abs(base[0].lng - base[base.length - 1].lng) < 1e-9
  ) {
    base.pop();
  }
  const n = base.length;
  const ring: GeoJsonPosition[] = [];

  if (mode === 'smooth_spline' && n >= 4) {
    for (let i = 0; i < n; i++) {
      const p0 = base[(i - 1 + n) % n];
      const p1 = base[i];
      const p2 = base[(i + 1) % n];
      const p3 = base[(i + 2) % n];

      for (let s = 0; s < subdivisionsPerSegment; s++) {
        const t = s / subdivisionsPerSegment;
        const t2 = t * t;
        const t3 = t2 * t;

        const lat =
          0.5 *
          (2 * p1.lat +
            (-p0.lat + p2.lat) * t +
            (2 * p0.lat - 5 * p1.lat + 4 * p2.lat - p3.lat) * t2 +
            (-p0.lat + 3 * p1.lat - 3 * p2.lat + p3.lat) * t3);
        const lng =
          0.5 *
          (2 * p1.lng +
            (-p0.lng + p2.lng) * t +
            (2 * p0.lng - 5 * p1.lng + 4 * p2.lng - p3.lng) * t2 +
            (-p0.lng + 3 * p1.lng - 3 * p2.lng + p3.lng) * t3);

        ring.push([roundCoord(lng), roundCoord(lat)]);
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      const p1 = base[i];
      const p2 = base[(i + 1) % n];
      for (let s = 0; s < subdivisionsPerSegment; s++) {
        const t = s / subdivisionsPerSegment;
        ring.push([
          roundCoord(p1.lng + (p2.lng - p1.lng) * t),
          roundCoord(p1.lat + (p2.lat - p1.lat) * t),
        ]);
      }
    }
  }

  if (ring.length > 0) {
    ring.push([ring[0][0], ring[0][1]]);
  }
  return ring;
}

export interface BuildGeoJsonSnapshotParams {
  plumeZones: PlumePolygonZone[];
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  receptorExposures: ReceptorExposureResult[];
  selectedSourceId: string | null;
  currentWeather: HourlyWeatherPoint;
  selectedDateIso: string;
  viewportMode: ViewportVisualizationMode;
  plumeDirectionDeg: number;
  precipitationOverrideMm: number | null;
  maxSiteSumQuotient: number;
  effectiveMachineDb: number;
}

export function buildCurrentViewGeoJsonSnapshot(
  params: BuildGeoJsonSnapshotParams
): GeoJsonFeatureCollection {
  const {
    plumeZones,
    sources,
    receptors,
    receptorExposures,
    selectedSourceId,
    currentWeather,
    selectedDateIso,
    viewportMode,
    plumeDirectionDeg,
    precipitationOverrideMm,
    maxSiteSumQuotient,
    effectiveMachineDb,
  } = params;

  const features: GeoJsonFeature[] = [];
  const activeSources = sources.filter((s) => s.active);
  const exposureByReceptorId = new Map<string, ReceptorExposureResult>(
    receptorExposures.map((exp) => [exp.receptorId, exp])
  );
  const sourceById = new Map<string, DemolitionSourceNode>(sources.map((s) => [s.id, s]));

  let plumePolygons = 0;
  let plumeCenterlines = 0;
  let activeSourceNodes = 0;
  let sourceFootprints = 0;
  let activeReceptorNodes = 0;
  let receptorZonePolygons = 0;

  // 1. High-resolution smoothed plume polygons + downwind trajectory centerlines
  for (const zone of plumeZones) {
    const subs = zone.polygon.length < 24 ? 4 : 2;
    const ring = densifyPolygonRing(zone.polygon, 'smooth_spline', subs);
    if (ring.length >= 4) {
      plumePolygons++;
      features.push({
        type: 'Feature',
        id: `plume-poly-${zone.id}`,
        geometry: {
          type: 'Polygon',
          coordinates: [ring],
        },
        properties: {
          layer: 'dispersion_plume_polygon',
          plumeId: zone.id,
          sourceId: zone.sourceId,
          sourceName: zone.sourceName,
          riskLevel: zone.level,
          label: zone.label,
          sumQuotientRange: zone.sumQuotientRange,
          maxSumQuotient: zone.maxSumQuotient,
          downwindDistanceMeters: zone.downwindDistanceMeters,
          crosswindWidthMeters: zone.crosswindWidthMeters,
          plumeDirectionDeg: zone.plumeDirectionDeg,
          hourLabel: zone.hourLabel || currentWeather.hourLabel,
          vertexCount: ring.length,
        },
      });
    }

    const originSrc = sourceById.get(zone.sourceId);
    if (originSrc) {
      const steps = 16;
      const lineCoords: GeoJsonPosition[] = [];
      for (let i = 0; i <= steps; i++) {
        const dist = (zone.downwindDistanceMeters * i) / steps;
        lineCoords.push(
          toPos(offsetLatLngByMeters(originSrc.position, dist, zone.plumeDirectionDeg))
        );
      }
      plumeCenterlines++;
      features.push({
        type: 'Feature',
        id: `plume-axis-${zone.id}`,
        geometry: {
          type: 'LineString',
          coordinates: lineCoords,
        },
        properties: {
          layer: 'plume_centerline_trajectory',
          plumeId: zone.id,
          sourceId: zone.sourceId,
          riskLevel: zone.level,
          plumeDirectionDeg: zone.plumeDirectionDeg,
          downwindDistanceMeters: zone.downwindDistanceMeters,
        },
      });
    }
  }

  // 2. Active source nodes (Points + Building Footprints)
  for (const src of activeSources) {
    activeSourceNodes++;
    features.push({
      type: 'Feature',
      id: `source-node-${src.id}`,
      geometry: {
        type: 'Point',
        coordinates: toPos(src.position),
      },
      properties: {
        layer: 'active_source_node',
        sourceId: src.id,
        code: src.code,
        name: src.name,
        address: src.address,
        active: src.active,
        isSelected: src.id === selectedSourceId,
        releaseHeightMeters: src.releaseHeightMeters,
        buildingCategory: src.buildingCategory ?? null,
        sourceEmissionFactor: src.sourceEmissionFactor ?? null,
        fiberReleaseIndex: src.fiberReleaseIndex ?? null,
        substances: src.substances,
        pssReference: src.pssReference,
      },
    });

    if (src.footprint && src.footprint.length >= 3) {
      const fpRing = densifyPolygonRing(src.footprint, 'linear_edge', 3);
      if (fpRing.length >= 4) {
        sourceFootprints++;
        features.push({
          type: 'Feature',
          id: `source-footprint-${src.id}`,
          geometry: {
            type: 'Polygon',
            coordinates: [fpRing],
          },
          properties: {
            layer: 'active_source_footprint',
            sourceId: src.id,
            code: src.code,
            name: src.name,
            buildingCategory: src.buildingCategory ?? null,
            buildingHeight3DMeters: src.buildingHeight3DMeters ?? null,
          },
        });
      }
    }
  }

  // 3. Active receptor nodes (Points + Zone Polygons + live substance breakdown)
  for (const rec of receptors) {
    const exp = exposureByReceptorId.get(rec.id);
    const substanceMap: Record<string, { concentration: number; quotient: number; unit: string }> =
      {};
    if (exp) {
      for (const s of exp.substances) {
        substanceMap[s.key] = {
          concentration: s.concentration,
          quotient: s.quotient,
          unit: s.unit,
        };
      }
    }

    activeReceptorNodes++;
    features.push({
      type: 'Feature',
      id: `receptor-node-${rec.id}`,
      geometry: {
        type: 'Point',
        coordinates: toPos(rec.center),
      },
      properties: {
        layer: 'active_receptor_node',
        receptorId: rec.id,
        code: rec.code,
        name: rec.name,
        address: rec.address,
        category: rec.category,
        department: rec.department ?? null,
        residentCountEstimate: rec.residentCountEstimate ?? null,
        sumQuotient: exp ? Number(exp.sumQuotient.toFixed(4)) : 0,
        riskLevel: exp ? exp.riskLevel : 'safe',
        dominantSourceName: exp ? exp.dominantSourceName : null,
        distanceFromNearestSourceMeters: exp ? exp.distanceFromNearestSourceMeters : null,
        hydrologicalRunoffActive: exp ? exp.hydrologicalRunoffActive : false,
        substanceTelemetry: substanceMap,
        estimatedSourceMachineDb: effectiveMachineDb,
      },
    });

    if (rec.polygon && rec.polygon.length >= 3) {
      const recRing = densifyPolygonRing(rec.polygon, 'linear_edge', 3);
      if (recRing.length >= 4) {
        receptorZonePolygons++;
        features.push({
          type: 'Feature',
          id: `receptor-zone-${rec.id}`,
          geometry: {
            type: 'Polygon',
            coordinates: [recRing],
          },
          properties: {
            layer: 'receptor_zone_polygon',
            receptorId: rec.id,
            code: rec.code,
            name: rec.name,
            sumQuotient: exp ? Number(exp.sumQuotient.toFixed(4)) : 0,
            riskLevel: exp ? exp.riskLevel : 'safe',
          },
        });
      }
    }
  }

  // Compute RFC 7946 bbox across all features
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const visitCoord = (pos: GeoJsonPosition) => {
    if (pos[0] < minLng) minLng = pos[0];
    if (pos[0] > maxLng) maxLng = pos[0];
    if (pos[1] < minLat) minLat = pos[1];
    if (pos[1] > maxLat) maxLat = pos[1];
  };

  for (const f of features) {
    if (f.geometry.type === 'Point') {
      visitCoord(f.geometry.coordinates);
    } else if (f.geometry.type === 'LineString') {
      f.geometry.coordinates.forEach(visitCoord);
    } else if (f.geometry.type === 'Polygon') {
      f.geometry.coordinates.forEach((ring) => ring.forEach(visitCoord));
    }
  }

  if (!Number.isFinite(minLng)) {
    minLng = 11.348;
    maxLng = 11.36;
    minLat = 55.409;
    maxLat = 55.417;
  }

  const effectivePrecipMm =
    precipitationOverrideMm !== null ? precipitationOverrideMm : currentWeather.precipitation;

  return {
    type: 'FeatureCollection',
    bbox: [roundCoord(minLng), roundCoord(minLat), roundCoord(maxLng), roundCoord(maxLat)],
    metadata: {
      schema: 'RFC 7946 GeoJSON (WGS84 / EPSG:4326)',
      coordinateReferenceSystem: 'urn:ogc:def:crs:OGC:1.3:CRS84',
      resolutionProfile: 'HIGH_RESOLUTION_7DEC_CATMULL_ROM',
      snapshotTimestampUtc: new Date().toISOString(),
      simulatedDateIso: selectedDateIso,
      simulatedHourLabel: currentWeather.hourLabel,
      viewportMode,
      plumeDirectionDeg,
      precipitationMmH: Number(effectivePrecipMm.toFixed(2)),
      windSpeed10mMs: currentWeather.windSpeed10m,
      windGusts10mMs: currentWeather.windGusts10m,
      relativeHumidity2mPct: currentWeather.relativeHumidity2m,
      maxSiteSumQuotient: Number(maxSiteSumQuotient.toFixed(4)),
      featureCounts: {
        plumePolygons,
        plumeCenterlines,
        activeSources: activeSourceNodes,
        sourceFootprints,
        activeReceptors: activeReceptorNodes,
        receptorZones: receptorZonePolygons,
        totalFeatures: features.length,
      },
    },
    features,
  };
}

export function downloadGeoJsonSnapshot(
  params: BuildGeoJsonSnapshotParams
): { filename: string; featureCount: number; collection: GeoJsonFeatureCollection } {
  const collection = buildCurrentViewGeoJsonSnapshot(params);
  const hourSlug = params.currentWeather.hourLabel.replace(':', '');
  const filename = `ringparken-gis-snapshot-${params.selectedDateIso}-${hourSlug}-${params.viewportMode}.geojson`;

  const json = JSON.stringify(collection, null, 2);
  const blob = new Blob([json], { type: 'application/geo+json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);

  return {
    filename,
    featureCount: collection.features.length,
    collection,
  };
}
