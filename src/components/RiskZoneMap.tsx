import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CloudRain,
  Compass,
  Droplets,
  FileWarning,
  Layers,
  MapPin,
  Search,
  ShieldAlert,
  Sun,
  Trees,
  Wind,
  X,
} from 'lucide-react';
import {
  MATERIAL_SAMPLES,
  PROTECTED_FEATURES,
  RINGPARKEN_BUILDINGS,
  getBuildingById,
  getSamplesForBuilding,
} from '../constants/ringparkenData';
import { ProtectedFeature, RingparkenBuilding } from '../types';
import {
  LOKALPLAN_1269_MAX_RUNOFF_L_PER_S_HA,
  ReceptorExposureResultDetails,
  calculateDistanceAndBearing,
  calculateReceptorExposure,
  checkWorkHoursCompliance,
  classifyMaterialSample,
  computeFuzzySearchScore,
  evaluateLokalplan1269LarCompliance,
} from '../utils/riskEngine';

export interface RiskZoneMapProps {
  initialWindFromDeg?: number;
  initialWindSpeedMs?: number;
  initialIsDryWeather?: boolean;
  initialSelectedBuildingId?: string | null;
  onSelectBuilding?: (building: RingparkenBuilding) => void;
  className?: string;
}

interface LayerVisibilityState {
  demolitionAndShelters: boolean;
  receptorRiskChoropleth: boolean;
  basementAsbestosDust: boolean;
  envelopeAndCav: boolean;
  hydrologyAndLar: boolean;
  protectedTreesAndBats: boolean;
}

interface BuildingPolygonFootprint {
  corners: [number, number][];
}

const RINGPARKEN_MAP_CENTER: [number, number] = [55.4153, 11.3555];

/**
 * Deterministisk beregning af geografisk destinationspunkt ud fra WGS84-startpunkt,
 * retning (grader) og afstand (meter).
 */
function destinationLatLng(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceMeters: number
): [number, number] {
  const R = 6371000;
  const brng = (bearingDeg * Math.PI) / 180;
  const phi1 = (lat * Math.PI) / 180;
  const lambda1 = (lng * Math.PI) / 180;
  const delta = distanceMeters / R;

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) +
      Math.cos(phi1) * Math.sin(delta) * Math.cos(brng)
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
    );

  return [(phi2 * 180) / Math.PI, (lambda2 * 180) / Math.PI];
}

/**
 * Bygger en glat nedvindskegle (+/- halfAngleDeg) ud fra kildekoordinater.
 */
function buildWindConePolygon(
  originLat: number,
  originLng: number,
  downwindDeg: number,
  lengthMeters: number,
  halfAngleDeg: number
): [number, number][] {
  const pts: [number, number][] = [[originLat, originLng]];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const angle = downwindDeg - halfAngleDeg + (i / steps) * (halfAngleDeg * 2);
    pts.push(destinationLatLng(originLat, originLng, angle, lengthMeters));
  }
  return pts;
}

/**
 * Bygger rektangulær bygningsfodaftryk-polygon ud fra center, orientering, længde og dybde.
 */
function buildOrientedBlockFootprint(
  lat: number,
  lng: number,
  axisDeg: number,
  lengthMeters: number,
  widthMeters: number
): BuildingPolygonFootprint {
  const halfL = lengthMeters / 2;
  const halfW = widthMeters / 2;
  const perpDeg = axisDeg + 90;

  const front = destinationLatLng(lat, lng, axisDeg, halfL);
  const back = destinationLatLng(lat, lng, axisDeg + 180, halfL);

  const c1 = destinationLatLng(front[0], front[1], perpDeg, halfW);
  const c2 = destinationLatLng(front[0], front[1], perpDeg + 180, halfW);
  const c3 = destinationLatLng(back[0], back[1], perpDeg + 180, halfW);
  const c4 = destinationLatLng(back[0], back[1], perpDeg, halfW);

  return { corners: [c1, c2, c3, c4] };
}

function getBuildingFootprint(b: RingparkenBuilding): [number, number][] {
  if (b.id === 'byg-1-kierulffsvej-2') {
    return buildOrientedBlockFootprint(b.coordinates.lat, b.coordinates.lng, 22, 34, 16).corners;
  }
  if (b.id === 'byg-2-kierulffsvej-12') {
    return buildOrientedBlockFootprint(b.coordinates.lat, b.coordinates.lng, 8, 44, 24).corners;
  }
  if (b.id === 'byg-3-valbyvej-58') {
    return buildOrientedBlockFootprint(b.coordinates.lat, b.coordinates.lng, 90, 38, 18).corners;
  }
  if (b.id === 'nordcentret-4') {
    return buildOrientedBlockFootprint(b.coordinates.lat, b.coordinates.lng, 82, 46, 22).corners;
  }
  if (b.id === 'albert-ibsens-vej-1-5-etape3') {
    return buildOrientedBlockFootprint(b.coordinates.lat, b.coordinates.lng, 80, 42, 16).corners;
  }
  if (b.fobDepartment === 'Nabo') {
    return buildOrientedBlockFootprint(b.coordinates.lat, b.coordinates.lng, 85, 24, 16).corners;
  }
  if (b.id.startsWith('blok-1-') || b.id.startsWith('blok-2-')) {
    return buildOrientedBlockFootprint(b.coordinates.lat, b.coordinates.lng, 12, 68, 14).corners;
  }
  if (b.id.includes('albert-ibsens') || b.id.includes('jacob-dampes')) {
    return buildOrientedBlockFootprint(b.coordinates.lat, b.coordinates.lng, 82, 72, 14).corners;
  }
  return buildOrientedBlockFootprint(b.coordinates.lat, b.coordinates.lng, 16, 68, 14).corners;
}

function getHighestAsbestosDustIntensity(buildingId: string): 'Ingen' | '+' | '++' | '+++' {
  const samples = getSamplesForBuilding(buildingId);
  let maxRank = 0;
  for (const s of samples) {
    if (!s.asbestosDetected) continue;
    if (s.dustIntensity === '+++') maxRank = Math.max(maxRank, 3);
    else if (s.dustIntensity === '++') maxRank = Math.max(maxRank, 2);
    else if (s.dustIntensity === '+') maxRank = Math.max(maxRank, 1);
  }
  if (maxRank === 3) return '+++';
  if (maxRank === 2) return '++';
  if (maxRank === 1) return '+';
  return 'Ingen';
}

function getRiskColorHex(riskLevel: ReceptorExposureResultDetails['riskLevel']): string {
  switch (riskLevel) {
    case 'KRITISK':
      return '#EF4444';
    case 'HØJ':
      return '#F97316';
    case 'MODERAT':
      return '#F59E0B';
    case 'LAV':
    default:
      return '#10B981';
  }
}

function hasFobDmaMismatch(b: RingparkenBuilding): boolean {
  if (b.fobBlockNumber !== null && b.dmaBlockNumber !== null) {
    return b.fobBlockNumber !== b.dmaBlockNumber;
  }
  if (b.fobBlockNumber !== null && b.dmaBlockNumber === null) {
    return true;
  }
  return false;
}

function formatBlockCrossReferenceLabel(b: RingparkenBuilding): string | null {
  if (b.fobBlockNumber === null && b.dmaBlockNumber === null) return null;
  if (b.fobBlockNumber !== null && b.dmaBlockNumber === null) {
    return `FOB Blok ${b.fobBlockNumber}${b.id.includes('9-10') ? ' & 10' : ''} · DMA: Udeladt/Ikke tildelt`;
  }
  if (b.fobBlockNumber !== b.dmaBlockNumber) {
    return `FOB Blok ${b.fobBlockNumber} ≠ DMA Blok ${b.dmaBlockNumber}`;
  }
  return `FOB & DMA Blok ${b.fobBlockNumber}`;
}

export const RiskZoneMap: React.FC<RiskZoneMapProps> = ({
  initialWindFromDeg = 250,
  initialWindSpeedMs = 6.5,
  initialIsDryWeather = true,
  initialSelectedBuildingId = 'blok-2-kierulffsvej-24-32',
  onSelectBuilding,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dynamicLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [windFromDeg, setWindFromDeg] = useState<number>(initialWindFromDeg);
  const [windSpeedMs, setWindSpeedMs] = useState<number>(initialWindSpeedMs);
  const [isDryWeather, setIsDryWeather] = useState<boolean>(initialIsDryWeather);
  const [baseMapStyle, setBaseMapStyle] = useState<'dark' | 'light'>('dark');

  const [layers, setLayers] = useState<LayerVisibilityState>({
    demolitionAndShelters: true,
    receptorRiskChoropleth: true,
    basementAsbestosDust: true,
    envelopeAndCav: true,
    hydrologyAndLar: true,
    protectedTreesAndBats: true,
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    initialSelectedBuildingId
  );
  const [selectedProtectedFeature, setSelectedProtectedFeature] =
    useState<ProtectedFeature | null>(null);

  const activeDemolitionSources = useMemo(
    () =>
      RINGPARKEN_BUILDINGS.filter(
        (b) => b.stage === 'Aktiv nedrivning (2026)'
      ),
    []
  );

  // Deterministisk risikoberegning pr. bygning ved nuværende vind/vejr
  const exposureByBuildingId = useMemo(() => {
    const map = new Map<string, ReceptorExposureResultDetails>();
    for (const b of RINGPARKEN_BUILDINGS) {
      map.set(
        b.id,
        calculateReceptorExposure(
          b,
          activeDemolitionSources,
          windFromDeg,
          windSpeedMs,
          isDryWeather
        )
      );
    }
    return map;
  }, [activeDemolitionSources, windFromDeg, windSpeedMs, isDryWeather]);

  // Afstand til nærmeste nedrivningsgavl (inkl. Nordgavl/Sydgavl referencepunkter på Blok 1)
  const nearestGableDistanceByBuildingId = useMemo(() => {
    const gablePoints: Array<{ label: string; lat: number; lng: number }> = [];
    for (const src of activeDemolitionSources) {
      if (src.coordinates.referencePoints && src.coordinates.referencePoints.length > 0) {
        for (const rp of src.coordinates.referencePoints) {
          gablePoints.push({
            label: `${src.name.split('(')[0].trim()} · ${rp.label}`,
            lat: rp.lat,
            lng: rp.lng,
          });
        }
      }
      gablePoints.push({
        label: src.name.split('(')[0].trim(),
        lat: src.coordinates.lat,
        lng: src.coordinates.lng,
      });
    }

    const result = new Map<
      string,
      { distanceMeters: number; gableLabel: string; bearingDeg: number }
    >();
    for (const b of RINGPARKEN_BUILDINGS) {
      if (b.stage === 'Aktiv nedrivning (2026)') {
        result.set(b.id, {
          distanceMeters: 0,
          gableLabel: 'Aktivt nedrivningsfelt',
          bearingDeg: 0,
        });
        continue;
      }

      const targetPoints: Array<{ lat: number; lng: number }> = [
        { lat: b.coordinates.lat, lng: b.coordinates.lng },
        ...(b.coordinates.referencePoints ?? []),
      ];

      let bestDist = Number.POSITIVE_INFINITY;
      let bestGable = '';
      let bestBearing = 0;

      for (const tp of targetPoints) {
        for (const gp of gablePoints) {
          const vec = calculateDistanceAndBearing(gp.lat, gp.lng, tp.lat, tp.lng);
          if (vec.distanceMeters < bestDist) {
            bestDist = vec.distanceMeters;
            bestGable = gp.label;
            bestBearing = vec.bearingDeg;
          }
        }
      }

      result.set(b.id, {
        distanceMeters: Number(bestDist.toFixed(1)),
        gableLabel: bestGable,
        bearingDeg: bestBearing,
      });
    }
    return result;
  }, [activeDemolitionSources]);

  // Lokal fuzzy-søgning (0 eksterne kald til lukket DAWA API)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) {
      // Vis vigtige nøglepunkter inkl. FOB vs DMA kollisionspar ved fokus
      return RINGPARKEN_BUILDINGS.slice(0, 10).map((b) => ({
        building: b,
        score: 50,
        mismatch: hasFobDmaMismatch(b),
      }));
    }

    return RINGPARKEN_BUILDINGS.map((b) => {
      const searchable = [
        b.name,
        b.fobDepartment,
        b.fobBlockNumber !== null ? `FOB Blok ${b.fobBlockNumber} Blok ${b.fobBlockNumber}` : '',
        b.dmaBlockNumber !== null ? `DMA Blok ${b.dmaBlockNumber} Blok ${b.dmaBlockNumber}` : '',
        b.id.includes('9-10') ? 'FOB Blok 10 Blok 10 Radiserækkerne Kierulffsvej 90-104' : '',
        ...b.canonicalAddresses,
        b.permitCaseNumber ?? '',
        b.hydrologyNote ?? '',
      ].join(' ');
      return {
        building: b,
        score: computeFuzzySearchScore(q, searchable),
        mismatch: hasFobDmaMismatch(b),
      };
    })
      .filter((item) => item.score >= 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [searchQuery]);

  const selectedBuilding = useMemo(
    () => (selectedBuildingId ? getBuildingById(selectedBuildingId) ?? null : null),
    [selectedBuildingId]
  );

  const selectedBuildingSamples = useMemo(() => {
    if (!selectedBuilding) return [];
    return getSamplesForBuilding(selectedBuilding.id).map((sample) => ({
      sample,
      classification: classifyMaterialSample(sample, {
        constructionYear: 1971,
        isPre1997MineralWool: sample.material.toLowerCase().includes('mineraluld'),
      }),
    }));
  }, [selectedBuilding]);

  const larEvaluation = useMemo(
    () =>
      evaluateLokalplan1269LarCompliance({
        catchmentAreaHa: 4.8,
        imperviousShare: 0.58,
        precipitationMmPerHour: isDryWeather ? 0 : 12.5,
        stormDurationMinutes: 60,
        availableLarDetentionM3: 185,
      }),
    [isDryWeather]
  );

  const workHoursStatus = useMemo(() => checkWorkHoursCompliance(new Date()), []);

  const handleSelectBuildingItem = (b: RingparkenBuilding) => {
    setSelectedBuildingId(b.id);
    setSelectedProtectedFeature(null);
    onSelectBuilding?.(b);
    if (mapRef.current) {
      mapRef.current.flyTo([b.coordinates.lat, b.coordinates.lng], 17, {
        duration: 0.45,
      });
    }
  };

  // 1. Opret Leaflet-kortinstansen ÉN gang ved mount og fjern eksplicit ved unmount (React 19 StrictMode-sikker)
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: RINGPARKEN_MAP_CENTER,
      zoom: 16,
      minZoom: 14,
      maxZoom: 19,
      zoomControl: true,
    });

    const initialTiles = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }
    ).addTo(map);

    const dynamicGroup = L.layerGroup().addTo(map);

    mapRef.current = map;
    tileLayerRef.current = initialTiles;
    dynamicLayerGroupRef.current = dynamicGroup;

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            map.invalidateSize({ animate: false });
          })
        : null;
    resizeObserver?.observe(container);

    return () => {
      resizeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      dynamicLayerGroupRef.current = null;
    };
  }, []);

  // Skift baggrundskort mellem Mørkt GIS og Lys Matrikel/OSM uden at genoprette kortet
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const url =
      baseMapStyle === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    const nextLayer = L.tileLayer(url, {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);
    nextLayer.bringToBack();
    tileLayerRef.current = nextLayer;
  }, [baseMapStyle]);

  // 2. Opdater dynamiske vektorlag, vindkegler, markører & overlays i L.LayerGroup uden at genoprette kortet
  useEffect(() => {
    const layerGroup = dynamicLayerGroupRef.current;
    const map = mapRef.current;
    if (!layerGroup || !map) return;

    layerGroup.clearLayers();
    const downwindDeg = ((windFromDeg + 180) % 360 + 360) % 360;

    // A. HYDROLOGI, LAVNING (KIERULFFSVEJ 12), SYDLIGE LAR-GRØFTER & PERMEABEL GRÆSARMERING
    if (layers.hydrologyAndLar) {
      // Lavning 33,3 m.o.h. + højt vintergrundvand 0,8-2,1 m + 50 % udtjente omfangsdræn ved Kierulffsvej 12
      L.circle([55.41472, 11.35218], {
        radius: 62,
        color: '#38BDF8',
        weight: 2,
        dashArray: '6 4',
        fillColor: '#0284C7',
        fillOpacity: 0.2,
      })
        .bindTooltip(
          'Lavning 33,3 m.o.h. · Moræneler (125–150 mm/dag) · Vintergrundvand 1,4 m u.t. (0,8–2,1 m) · ~50 % udtjente omfangsdræn',
          { sticky: true }
        )
        .addTo(layerGroup);

      // Sydlige grønne gårdrum: Forbud mod nedsivning -> åbne LAR-grøfter m. overløbsriste (maks. 2 l/s/ha jf. Lokalplan 1269)
      const southCourtyardZones: Array<{ label: string; coords: [number, number][] }> = [
        {
          label:
            'Sydligt grønt gårdrum (Afd. 023): Nedsivningsforbud i moræneler -> Åbne LAR-grøfter m. overløbsriste (maks. 2 l/s/ha jf. Lokalplan 1269)',
          coords: [
            [55.41442, 11.35365],
            [55.41455, 11.35785],
            [55.41495, 11.35775],
            [55.41482, 11.35355],
          ],
        },
        {
          label:
            'Sydøstligt grønt gårdrum (Afd. 024): Nedsivningsforbud -> Åbne LAR-grøfter & regnvandsforsinkelse ≤ 2 l/s/ha',
          coords: [
            [55.41492, 11.35815],
            [55.41515, 11.36075],
            [55.4155, 11.36062],
            [55.41528, 11.35802],
          ],
        },
      ];

      for (const zone of southCourtyardZones) {
        L.polygon(zone.coords, {
          color: '#0EA5E9',
          weight: 2,
          dashArray: '5 4',
          fillColor: '#0369A1',
          fillOpacity: 0.16,
        })
          .bindTooltip(zone.label, { sticky: true })
          .addTo(layerGroup);
      }

      // Åben LAR-grøft linje med overløbsriste i sydlige gårdrum
      L.polyline(
        [
          [55.41458, 11.35375],
          [55.41474, 11.3557],
          [55.41492, 11.3578],
          [55.41512, 11.35995],
        ],
        {
          color: '#22D3EE',
          weight: 3,
          dashArray: '8 4',
        }
      )
        .bindTooltip(
          'Åbne LAR-grøfter med overløbsriste (Lokalplan 1269 · maks. 2,0 l/s/ha afledning)',
          { sticky: true }
        )
        .addTo(layerGroup);

      // Vej- & parkeringsarealer med permeabel græsarmering
      L.polygon(
        [
          [55.41512, 11.35185],
          [55.41536, 11.35475],
          [55.4155, 11.3547],
          [55.41527, 11.3518],
        ],
        {
          color: '#14B8A6',
          weight: 1.5,
          dashArray: '3 3',
          fillColor: '#0D9488',
          fillOpacity: 0.18,
        }
      )
        .bindTooltip(
          'Vej- og parkeringsareal: Permeabel græsarmering jf. Dispositionsforslaget (aflaster LAR-bassin)',
          { sticky: true }
        )
        .addTo(layerGroup);
    }

    // B. DYNAMISKE NEDVINDSKEGLER FRA DE 4 AKTIVE NEDRIVNINGSFELTER
    const plumeScaleMeters = Math.max(55, 85 + windSpeedMs * 18) * (isDryWeather ? 1 : 0.62);
    const outerFillOpacity = isDryWeather
      ? Math.min(0.28, 0.08 + windSpeedMs * 0.015)
      : Math.min(0.12, 0.04 + windSpeedMs * 0.006);
    const innerFillOpacity = isDryWeather
      ? Math.min(0.4, 0.14 + windSpeedMs * 0.018)
      : Math.min(0.16, 0.06 + windSpeedMs * 0.008);

    if (windSpeedMs > 0.1) {
      for (const src of activeDemolitionSources) {
        const outerPoly = buildWindConePolygon(
          src.coordinates.lat,
          src.coordinates.lng,
          downwindDeg,
          plumeScaleMeters,
          45
        );
        const innerPoly = buildWindConePolygon(
          src.coordinates.lat,
          src.coordinates.lng,
          downwindDeg,
          plumeScaleMeters * 0.62,
          20
        );

        L.polygon(outerPoly, {
          color: isDryWeather ? '#F59E0B' : '#38BDF8',
          weight: 1,
          opacity: isDryWeather ? 0.55 : 0.35,
          fillColor: isDryWeather ? '#F59E0B' : '#38BDF8',
          fillOpacity: outerFillOpacity,
          interactive: false,
        }).addTo(layerGroup);

        L.polygon(innerPoly, {
          color: isDryWeather ? '#EF4444' : '#0EA5E9',
          weight: 1.2,
          opacity: isDryWeather ? 0.72 : 0.4,
          fillColor: isDryWeather ? '#EF4444' : '#0284C7',
          fillOpacity: innerFillOpacity,
          interactive: false,
        }).addTo(layerGroup);
      }
    }

    // Kritisk 49,3 m spredningskorridor mellem Blok 1 (nr. 14) og Blok 2 (nr. 26)
    L.polyline(
      [
        [55.414901, 11.353671],
        [55.414933, 11.35445],
      ],
      {
        color: '#FBBF24',
        weight: 2.5,
        dashArray: '4 4',
      }
    )
      .bindTooltip('Kritisk gab: 49,3 m mellem Blok 1 (nr. 14) og beboet Blok 2 (nr. 26)', {
        sticky: true,
      })
      .addTo(layerGroup);

    const midGapIcon = L.divIcon({
      className: '',
      iconSize: [64, 20],
      iconAnchor: [32, 10],
      html: `<div style="background:#0F172A;border:1px solid #F59E0B;color:#FDE68A;font-family:JetBrains Mono,monospace;font-size:10px;font-weight:700;padding:1px 4px;border-radius:3px;text-align:center;white-space:nowrap;">49,3 m</div>`,
    });
    L.marker([55.414917, 11.35406], { icon: midGapIcon, interactive: false }).addTo(layerGroup);

    // C. BYGNINGER, NEDRIVNINGSFELTER, RISIKOSCORE, ASBESTSTØV & COWI/CAV
    for (const b of RINGPARKEN_BUILDINGS) {
      const isDemolition = b.stage === 'Aktiv nedrivning (2026)';
      const isPlannedDemolition = b.stage === 'Planlagt nedrivning (Etape 2/3)';
      const isInhabited = b.stage === 'Beboet / Renoveres';
      const isNeighbor = b.stage === 'Ekstern nabo / Institution';
      const isSelected = b.id === selectedBuildingId;
      const exposure = exposureByBuildingId.get(b.id);
      const footprint = getBuildingFootprint(b);

      let strokeColor = '#64748B';
      let fillColor = '#334155';
      let fillOpacity = 0.45;
      let dashArray: string | undefined;
      let weight = isSelected ? 3.5 : 2;

      if (isDemolition) {
        if (!layers.demolitionAndShelters) {
          strokeColor = '#991B1B';
          fillColor = '#7F1D1D';
          fillOpacity = 0.25;
        } else {
          strokeColor = '#DC2626';
          fillColor = '#991B1B';
          fillOpacity = 0.58;
          dashArray = '6 4';
        }
      } else if (isPlannedDemolition) {
        strokeColor = '#F59E0B';
        fillColor = '#B45309';
        fillOpacity = 0.42;
        dashArray = '4 4';
      } else if (layers.receptorRiskChoropleth && exposure && (isInhabited || isNeighbor)) {
        const riskHex = getRiskColorHex(exposure.riskLevel);
        strokeColor = riskHex;
        fillColor = riskHex;
        fillOpacity = 0.46;
      }

      // COWI facadefuger 50-75 % & CAV-undertryk på Afd. 023 & Afd. 024 (orange kontur)
      const hasEnvelopeRisk =
        layers.envelopeAndCav &&
        (b.fobDepartment === 'Afd. 023' || b.fobDepartment === 'Afd. 024') &&
        (b.cowiJointFailurePct >= 50 || b.hasCavNegativePressure);

      if (hasEnvelopeRisk && !isDemolition) {
        strokeColor = '#F97316';
        weight = isSelected ? 4 : 3;
      }

      if (isSelected) {
        strokeColor = '#38BDF8';
        weight = 4;
      }

      const polygon = L.polygon(footprint, {
        color: strokeColor,
        weight,
        dashArray,
        fillColor,
        fillOpacity,
      }).addTo(layerGroup);

      polygon.on('click', () => handleSelectBuildingItem(b));

      const riskSummaryText = exposure
        ? `Risikoscore: ${exposure.receptorRiskScore}/100 (${exposure.riskLevel})`
        : '';
      const mismatchNote = formatBlockCrossReferenceLabel(b);
      polygon.bindTooltip(
        `<div style="font-family:IBM Plex Sans,sans-serif;font-size:12px;">
          <strong>${b.name}</strong><br/>
          <span>${b.stage}${riskSummaryText ? ` · ${riskSummaryText}` : ''}</span>
          ${mismatchNote ? `<br/><span style="color:#B45309;font-weight:600;">${mismatchNote}</span>` : ''}
        </div>`,
        { sticky: true }
      );

      // Vis live score-chip på beboede blokke & naboer
      if (layers.receptorRiskChoropleth && exposure && (isInhabited || isNeighbor)) {
        const badgeColor = getRiskColorHex(exposure.riskLevel);
        const scoreIcon = L.divIcon({
          className: '',
          iconSize: [38, 18],
          iconAnchor: [19, 9],
          html: `<div style="background:#0B0F19;border:1.5px solid ${badgeColor};color:#F8FAFC;font-family:JetBrains Mono,monospace;font-size:10px;font-weight:700;padding:1px 4px;border-radius:3px;text-align:center;line-height:14px;">${exposure.receptorRiskScore}</div>`,
        });
        L.marker([b.coordinates.lat, b.coordinates.lng], { icon: scoreIcon })
          .on('click', () => handleSelectBuildingItem(b))
          .addTo(layerGroup);
      }

      // Asbest i kælderstøv (DMA geltape '+' til '+++')
      if (layers.basementAsbestosDust && b.hasBasementAsbestosDust) {
        const dustLevel = getHighestAsbestosDustIntensity(b.id);
        const label = dustLevel === 'Ingen' ? 'Asbest +' : `Asbest ${dustLevel}`;
        const asbestosIcon = L.divIcon({
          className: '',
          iconSize: [68, 18],
          iconAnchor: [34, -10],
          html: `<div style="background:#4C0519;border:1px solid #FB7185;color:#FFE4E6;font-family:JetBrains Mono,monospace;font-size:9px;font-weight:700;padding:1px 4px;border-radius:3px;text-align:center;white-space:nowrap;">${label}</div>`,
        });
        L.marker([b.coordinates.lat, b.coordinates.lng], { icon: asbestosIcon })
          .on('click', () => handleSelectBuildingItem(b))
          .addTo(layerGroup);
      }

      // Sikringsrum & Nedrivningsfelt-badge
      if (layers.demolitionAndShelters && (isDemolition || b.shelterCapacityPersons || b.id === 'byg-3-valbyvej-58')) {
        const shelterText = b.shelterCapacityPersons
          ? `Nedrivning · Sikringsrum (${b.shelterCapacityPersons} p.)`
          : b.id === 'byg-3-valbyvej-58'
          ? 'Nedrivning · Sikringsrum (efteranmeldt)'
          : 'Aktiv nedrivning';
        const demoIcon = L.divIcon({
          className: '',
          iconSize: [148, 18],
          iconAnchor: [74, 24],
          html: `<div style="background:#7F1D1D;border:1px dashed #FCA5A5;color:#FEF2F2;font-family:JetBrains Mono,monospace;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;text-align:center;white-space:nowrap;">${shelterText}</div>`,
        });
        L.marker([b.coordinates.lat, b.coordinates.lng], { icon: demoIcon })
          .on('click', () => handleSelectBuildingItem(b))
          .addTo(layerGroup);
      }

      // Orange COWI/CAV-markør for Afd. 023 & 024
      if (hasEnvelopeRisk && !isDemolition) {
        const envIcon = L.divIcon({
          className: '',
          iconSize: [86, 16],
          iconAnchor: [43, -27],
          html: `<div style="background:#431407;border:1px solid #FB923C;color:#FFEDD5;font-family:JetBrains Mono,monospace;font-size:9px;font-weight:600;padding:0px 4px;border-radius:3px;text-align:center;white-space:nowrap;">COWI ${b.cowiJointFailurePct}%${b.hasCavNegativePressure ? ' · CAV' : ''}</div>`,
        });
        L.marker([b.coordinates.lat, b.coordinates.lng], { icon: envIcon })
          .on('click', () => handleSelectBuildingItem(b))
          .addTo(layerGroup);
      }
    }

    // D. BESKYTTEDE TRÆER, TRÆRÆKKER, AFSPÆRRET STI V. NDR. RINGGADE & FLAGERMUS (§ 29 a)
    if (layers.protectedTreesAndBats) {
      // Trærække mod Ndr. Ringgade + indvendig sti der nedlægges & afspærres under nedrivning (situationsplan 14.11.2025)
      L.polyline(
        [
          [55.41618, 11.3514],
          [55.41634, 11.3558],
          [55.41646, 11.3605],
        ],
        {
          color: '#16A34A',
          weight: 5,
          opacity: 0.85,
        }
      )
        .bindTooltip('Bevaringsværdig trærække langs Ndr. Ringgade (Lokalplan 1269)', {
          sticky: true,
        })
        .addTo(layerGroup);

      L.polyline(
        [
          [55.41608, 11.35145],
          [55.41624, 11.3558],
          [55.41636, 11.36045],
        ],
        {
          color: '#EF4444',
          weight: 3,
          dashArray: '6 5',
        }
      )
        .bindTooltip(
          'Sti på indersiden af trærækken mod Ndr. Ringgade: Nedlægges og afspærres under nedrivning (Situationsplan 14.11.2025)',
          { sticky: true }
        )
        .addTo(layerGroup);

      const closedPathLabel = L.divIcon({
        className: '',
        iconSize: [230, 18],
        iconAnchor: [115, 9],
        html: `<div style="background:#450A0A;border:1px solid #EF4444;color:#FECACA;font-family:JetBrains Mono,monospace;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;text-align:center;white-space:nowrap;">Nedlægges og afspærres under nedrivning (14.11.2025)</div>`,
      });
      L.marker([55.41624, 11.3558], { icon: closedPathLabel, interactive: false }).addTo(
        layerGroup
      );

      // Trærække mod nabomatrikel 22c
      L.polyline(
        [
          [55.41465, 11.35105],
          [55.41525, 11.35125],
        ],
        {
          color: '#22C55E',
          weight: 5,
        }
      )
        .bindTooltip('Bevaringsværdig trærække mod nabomatrikel 22c (støv- og vindbarriere)', {
          sticky: true,
        })
        .addTo(layerGroup);

      for (const pf of PROTECTED_FEATURES) {
        const isBatZone = pf.category === 'Flagermus-screeningzone';
        const markerColor = isBatZone ? '#A855F7' : '#22C55E';
        const shortTag = isBatZone
          ? '§ 29 a Flagermus'
          : pf.treeCount
          ? `${pf.treeCount} Træer (Fredet)`
          : pf.title.includes('22c')
          ? 'Trærække matr. 22c'
          : 'Trærække Ndr. Ringgade';

        L.circleMarker([pf.coordinates.lat, pf.coordinates.lng], {
          radius: isBatZone ? 9 : 8,
          color: markerColor,
          weight: 2,
          fillColor: markerColor,
          fillOpacity: 0.35,
        })
          .bindTooltip(`${pf.title} — ${pf.statutoryBasis}`, { sticky: true })
          .on('click', () => {
            setSelectedProtectedFeature(pf);
            setSelectedBuildingId(null);
          })
          .addTo(layerGroup);

        const pfIcon = L.divIcon({
          className: '',
          iconSize: [120, 18],
          iconAnchor: [60, -10],
          html: `<div style="background:${isBatZone ? '#2E1065' : '#052E16'};border:1px solid ${markerColor};color:#F8FAFC;font-family:JetBrains Mono,monospace;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;text-align:center;white-space:nowrap;">${shortTag}</div>`,
        });
        L.marker([pf.coordinates.lat, pf.coordinates.lng], { icon: pfIcon })
          .on('click', () => {
            setSelectedProtectedFeature(pf);
            setSelectedBuildingId(null);
          })
          .addTo(layerGroup);
      }
    }
  }, [
    activeDemolitionSources,
    exposureByBuildingId,
    isDryWeather,
    layers,
    selectedBuildingId,
    windFromDeg,
    windSpeedMs,
  ]);

  const toggleLayer = (key: keyof LayerVisibilityState) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section
      aria-label="Interaktivt GIS Risikokort for Ringparken i Slagelse"
      className={`flex flex-col w-full h-full bg-[#0B0F19] text-slate-100 border border-[#334155] rounded-lg overflow-hidden ${className}`}
    >
      {/* ØVERSTE LOKALE ADRESSE- & BLOKSØGEBOKS (0 DAWA-KALD) + ARBEJDSTIDSSTATUS */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#111827] border-b border-[#334155]">
        <div className="flex items-center gap-2.5 min-w-0">
          <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-100 truncate">
              Ringparken GIS Risikokort (4200 Slagelse)
            </h2>
            <p className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
              WGS84 [55.4153, 11.3555] · Lokal geokode uden DAWA · {RINGPARKEN_BUILDINGS.length} kortlagte bygninger &amp; naboer
            </p>
          </div>
        </div>

        {/* Lokal Fuzzy Søgeboks */}
        <div className="relative flex-1 min-w-[260px] max-w-md z-20">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0B0F19] border border-[#334155] rounded-md focus-within:border-cyan-400">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 180)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchFocused(true);
              }}
              placeholder="Søg adresse, FOB Blok-nr. eller DMA Blok-nr. (f.eks. Kierulffsvej 26, Blok 9)..."
              aria-label="Lokal adresse- og bloksøgning i Ringparken"
              className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Ryd søgning"
                className="text-slate-400 hover:text-slate-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isSearchFocused && (
            <div className="absolute left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-[#111827] border border-[#334155] rounded-md shadow-xl z-30 divide-y divide-[#1E293B]">
              {searchResults.length === 0 ? (
                <div className="px-3 py-2.5 text-xs text-slate-400">
                  Ingen lokale bygninger matchede &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                searchResults.map(({ building, mismatch }) => {
                  const crossRef = formatBlockCrossReferenceLabel(building);
                  return (
                    <button
                      key={building.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectBuildingItem(building);
                        setIsSearchFocused(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-[#1E293B] transition-colors flex flex-col gap-0.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-100 truncate">
                          {building.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                          {building.fobDepartment}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span>{building.canonicalAddresses[0]}</span>
                        {crossRef && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                mismatch
                                  ? 'text-amber-300 font-semibold flex items-center gap-1'
                                  : 'text-slate-400'
                              }
                            >
                              {mismatch && (
                                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                              )}
                              <span>{crossRef}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Arbejdstid & Basemap-skift */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className={`px-2.5 py-1 rounded border text-[11px] font-mono font-semibold flex items-center gap-1.5 whitespace-nowrap ${
              workHoursStatus.isAllowed
                ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                : 'bg-rose-950/50 border-rose-500/50 text-rose-200'
            }`}
            title={workHoursStatus.directiveDa}
          >
            {workHoursStatus.isAllowed ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span>{workHoursStatus.statusLabelDa}</span>
          </div>

          <button
            type="button"
            onClick={() => setBaseMapStyle((s) => (s === 'dark' ? 'light' : 'dark'))}
            className="px-2.5 py-1 rounded bg-[#1E293B] hover:bg-[#263449] border border-[#334155] text-[11px] font-mono text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
          >
            {baseMapStyle === 'dark' ? 'Skift til lyst kort' : 'Skift til mørkt GIS'}
          </button>
        </div>
      </header>

      {/* HOVEDARBEJDSFLADE: VENSTRE KONTROLPANEL + MIDT LEAFLET-KORT (ISOLATE) + HØJRE DETALJEPANEL */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto lg:overflow-hidden">
        {/* VENSTRE KONTROLPANEL: VIND- & VEJRSIMULATOR + LAG-VÆLGER */}
        <aside className="lg:col-span-3 min-h-0 bg-[#111827] border-b lg:border-b-0 lg:border-r border-[#334155] p-3.5 lg:overflow-y-auto space-y-4">
          {/* 1. Vind- & Vejrsimulator */}
          <div className="space-y-3 pb-3 border-b border-[#1E293B]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Vind- &amp; Vejrsimulator</span>
              </h3>
              <span className="text-[11px] font-mono text-cyan-300 tabular-nums">
                Fra {windFromDeg}° · {windSpeedMs.toFixed(1)} m/s
              </span>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="risk-map-wind-dir"
                className="flex items-center justify-between text-[11px] text-slate-300"
              >
                <span>Vindretning (blæser fra)</span>
                <span className="font-mono text-slate-100 tabular-nums">
                  {windFromDeg}° → nedvind {(windFromDeg + 180) % 360}°
                </span>
              </label>
              <input
                id="risk-map-wind-dir"
                type="range"
                min={0}
                max={360}
                step={5}
                value={windFromDeg}
                onChange={(e) => setWindFromDeg(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="grid grid-cols-1 gap-1 pt-0.5">
                {[
                  { label: 'Typisk VSV-vind 250°', deg: 250 },
                  { label: 'Vest 270°', deg: 270 },
                  { label: 'Sydvest 225°', deg: 225 },
                ].map((preset) => (
                  <button
                    key={preset.deg}
                    type="button"
                    onClick={() => setWindFromDeg(preset.deg)}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono text-left border transition-colors cursor-pointer whitespace-nowrap ${
                      windFromDeg === preset.deg
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-semibold'
                        : 'bg-[#0B0F19] border-[#334155] text-slate-300 hover:bg-[#1E293B]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="risk-map-wind-speed"
                className="flex items-center justify-between text-[11px] text-slate-300"
              >
                <span>Vindhastighed</span>
                <span className="font-mono text-slate-100 tabular-nums">
                  {windSpeedMs.toFixed(1)} m/s
                </span>
              </label>
              <input
                id="risk-map-wind-speed"
                type="range"
                min={0}
                max={15}
                step={0.5}
                value={windSpeedMs}
                onChange={(e) => setWindSpeedMs(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 bg-[#0B0F19] border border-[#334155] rounded-md">
              <button
                type="button"
                onClick={() => setIsDryWeather(true)}
                className={`px-1.5 py-1.5 rounded text-[10.5px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer min-w-0 ${
                  isDryWeather
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sun className="w-3 h-3 shrink-0" />
                <span className="truncate">Tørvejr / Støvende</span>
              </button>
              <button
                type="button"
                onClick={() => setIsDryWeather(false)}
                className={`px-1.5 py-1.5 rounded text-[10.5px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer min-w-0 ${
                  !isDryWeather
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <CloudRain className="w-3 h-3 shrink-0" />
                <span className="truncate">Regn / Vanding</span>
              </button>
            </div>
          </div>

          {/* 2. Lag-vælger (checkbox-toggles) */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>GIS Risikolag</span>
            </h3>

            <div className="space-y-1.5 text-[11px]">
              <label className="flex items-start gap-2 p-1.5 rounded hover:bg-[#1E293B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers.demolitionAndShelters}
                  onChange={() => toggleLayer('demolitionAndShelters')}
                  className="mt-0.5 accent-rose-500 cursor-pointer"
                />
                <span>
                  <strong className="text-rose-300 block">
                    Nedrivningsfelter &amp; Sikringsrum
                  </strong>
                  <span className="text-slate-400">
                    Dyb rød m. stiplet omrids (Blok 1 80 p. &amp; Valbyvej 58)
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 p-1.5 rounded hover:bg-[#1E293B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers.receptorRiskChoropleth}
                  onChange={() => toggleLayer('receptorRiskChoropleth')}
                  className="mt-0.5 accent-amber-400 cursor-pointer"
                />
                <span>
                  <strong className="text-amber-300 block">
                    Beboede blokke: Risikoscore (0-100)
                  </strong>
                  <span className="text-slate-400">
                    Live eksponeringsfarve ved vindskift
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 p-1.5 rounded hover:bg-[#1E293B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers.basementAsbestosDust}
                  onChange={() => toggleLayer('basementAsbestosDust')}
                  className="mt-0.5 accent-rose-400 cursor-pointer"
                />
                <span>
                  <strong className="text-rose-200 block">
                    Asbest i kælderstøv (DMA &lsquo;+&rsquo; til &lsquo;+++&rsquo;)
                  </strong>
                  <span className="text-slate-400">
                    Advarselsbadges på berørte boligblokke
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 p-1.5 rounded hover:bg-[#1E293B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers.envelopeAndCav}
                  onChange={() => toggleLayer('envelopeAndCav')}
                  className="mt-0.5 accent-orange-400 cursor-pointer"
                />
                <span>
                  <strong className="text-orange-300 block">
                    Utætte facadefuger &amp; CAV (COWI 50-75 %)
                  </strong>
                  <span className="text-slate-400">
                    Orange kontur på Afd. 023 (50 %) &amp; Afd. 024 (75 %)
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 p-1.5 rounded hover:bg-[#1E293B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers.hydrologyAndLar}
                  onChange={() => toggleLayer('hydrologyAndLar')}
                  className="mt-0.5 accent-sky-400 cursor-pointer"
                />
                <span>
                  <strong className="text-sky-300 block">
                    Hydrologi, Lavning &amp; Grundvand (0,8-2,1 m)
                  </strong>
                  <span className="text-slate-400">
                    Kierulffsvej 12, 50 % udtjente dræn, sydlige LAR-grøfter (≤ 2 l/s/ha) &amp; permeabel græsarmering
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 p-1.5 rounded hover:bg-[#1E293B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={layers.protectedTreesAndBats}
                  onChange={() => toggleLayer('protectedTreesAndBats')}
                  className="mt-0.5 accent-emerald-400 cursor-pointer"
                />
                <span>
                  <strong className="text-emerald-300 block">
                    Beskyttede træer &amp; Flagermus (§ 29 a)
                  </strong>
                  <span className="text-slate-400">
                    Valbyvej/Kierulffsvej, matr. 22c &amp; afspærret sti mod Ndr. Ringgade
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* Hydrologi & Dispositionsforslag Kortstatus */}
          {layers.hydrologyAndLar && (
            <div className="p-2.5 rounded bg-[#0B0F19] border border-sky-500/40 space-y-1 text-[11px]">
              <div className="font-semibold text-sky-300 flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 shrink-0" />
                <span>Dispositionsforslag · LAR &amp; Permeabilitet</span>
              </div>
              <p className="text-slate-300 leading-snug">
                Sydlige gårdrum: Nedsivningsforbud i moræneler → åbne LAR-grøfter m. overløbsriste og maks.{' '}
                <span className="font-mono font-semibold text-sky-200">
                  {LOKALPLAN_1269_MAX_RUNOFF_L_PER_S_HA.toFixed(1)} l/s/ha
                </span>{' '}
                (Lokalplan 1269). Vej/P-arealer anlægges med permeabel græsarmering.
              </p>
              <div className="font-mono text-[10px] text-slate-400 pt-0.5">
                LAR-status nu: {larEvaluation.statusLabelDa}
              </div>
            </div>
          )}
        </aside>

        {/* MIDT: LEAFLET KORTCONTAINER MED ISOLATE Z-0 */}
        <div className="lg:col-span-5 relative isolate z-0 min-h-[420px] lg:min-h-[540px] bg-[#07090E]">
          <div
            ref={mapContainerRef}
            className="w-full h-full min-h-[420px] lg:min-h-[540px]"
            aria-label="Leaflet GIS kort over Ringparken"
          />
        </div>

        {/* HØJRE DETALJEPANEL: BYGNING / LABORATORIEPRØVER / HP14 / AFSTAND */}
        <aside className="lg:col-span-4 min-h-0 bg-[#111827] border-t lg:border-t-0 lg:border-l border-[#334155] p-3.5 lg:overflow-y-auto space-y-3">
          {selectedProtectedFeature ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#1E293B]">
                <div>
                  <div className="text-[11px] font-mono text-emerald-300">
                    {selectedProtectedFeature.category}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-100 mt-0.5 flex items-center gap-1.5">
                    <Trees className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{selectedProtectedFeature.title}</span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProtectedFeature(null)}
                  className="p-1 rounded hover:bg-[#1E293B] text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Luk detaljevisning"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedProtectedFeature.locationDescription}
              </p>
              <div className="p-2.5 rounded bg-[#0B0F19] border border-[#334155] space-y-1 text-xs">
                <div className="font-mono text-[11px] text-emerald-300 font-semibold">
                  {selectedProtectedFeature.statutoryBasis}
                </div>
                <div className="text-slate-200">
                  {selectedProtectedFeature.protectionDirectiveDa}
                </div>
                <div className="text-[11px] font-mono text-amber-300 pt-1">
                  Status: {selectedProtectedFeature.restrictionStatus}
                </div>
              </div>
            </div>
          ) : selectedBuilding ? (
            (() => {
              const exposure = exposureByBuildingId.get(selectedBuilding.id);
              const gableDist = nearestGableDistanceByBuildingId.get(selectedBuilding.id);
              const mismatch = hasFobDmaMismatch(selectedBuilding);
              const crossRef = formatBlockCrossReferenceLabel(selectedBuilding);
              const isOverBek496 =
                selectedBuilding.requiresSelectiveDemolitionPlan &&
                (selectedBuilding.areaM2 ?? 0) > 250;

              return (
                <div className="space-y-3">
                  {/* Bygningsheader */}
                  <div className="pb-2.5 border-b border-[#1E293B] space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-400">
                          <span>{selectedBuilding.fobDepartment}</span>
                          <span aria-hidden="true">·</span>
                          <span>{selectedBuilding.stage}</span>
                          {selectedBuilding.areaM2 !== null && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{selectedBuilding.areaM2.toLocaleString('da-DK')} m²</span>
                            </>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-100 mt-0.5 flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span>{selectedBuilding.name}</span>
                        </h3>
                      </div>

                      {exposure && (
                        <div
                          className="px-2 py-1 rounded border text-right font-mono shrink-0"
                          style={{
                            borderColor: getRiskColorHex(exposure.riskLevel),
                            backgroundColor: '#0B0F19',
                          }}
                        >
                          <div
                            className="text-xs font-bold tabular-nums"
                            style={{ color: getRiskColorHex(exposure.riskLevel) }}
                          >
                            {exposure.receptorRiskScore}/100
                          </div>
                          <div className="text-[10px] text-slate-300">
                            {exposure.riskLevel}
                          </div>
                        </div>
                      )}
                    </div>

                    {crossRef && (
                      <div
                        className={`px-2.5 py-1.5 rounded border text-[11px] font-mono flex items-center gap-1.5 ${
                          mismatch
                            ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                            : 'bg-[#0B0F19] border-[#334155] text-slate-300'
                        }`}
                      >
                        {mismatch && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span>Krydsreference: {crossRef}</span>
                      </div>
                    )}
                  </div>

                  {/* Afstand til nærmeste nedrivningsgavl + Eksponeringsnedbrydning */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#334155]">
                      <div className="text-[11px] text-slate-400">
                        Afstand til nærmeste gavl
                      </div>
                      <div className="text-sm font-mono font-bold text-cyan-300 tabular-nums mt-0.5">
                        {gableDist ? `${gableDist.distanceMeters.toLocaleString('da-DK')} m` : '–'}
                      </div>
                      {gableDist && (
                        <div className="text-[10px] text-slate-400 truncate">
                          Fra {gableDist.gableLabel}
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#334155]">
                      <div className="text-[11px] text-slate-400">
                        Klimaskærm &amp; Kælder
                      </div>
                      <div className="text-xs font-mono font-semibold text-slate-100 mt-0.5">
                        COWI fugefejl {selectedBuilding.cowiJointFailurePct}%
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {selectedBuilding.hasCavNegativePressure ? 'CAV-undertryk · ' : ''}
                        {selectedBuilding.basementType}
                      </div>
                    </div>
                  </div>

                  {exposure && (
                    <div className="p-2.5 rounded bg-[#0B0F19] border border-[#334155] space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between font-mono text-slate-300">
                        <span>Delscorer (vind {windFromDeg}° · {windSpeedMs} m/s):</span>
                        <span className="text-cyan-300">
                          Vindfaktor {(exposure.downwindFactor * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 font-mono text-[10px] tabular-nums text-center">
                        <div className="p-1 rounded bg-[#111827] border border-[#1E293B]">
                          <div className="text-slate-400">Afstand</div>
                          <div className="text-slate-100 font-bold">{exposure.proximityScore}</div>
                        </div>
                        <div className="p-1 rounded bg-[#111827] border border-[#1E293B]">
                          <div className="text-slate-400">Vindfane</div>
                          <div className="text-slate-100 font-bold">{exposure.windPlumeScore}</div>
                        </div>
                        <div className="p-1 rounded bg-[#111827] border border-[#1E293B]">
                          <div className="text-slate-400">Fuger/CAV</div>
                          <div className="text-slate-100 font-bold">{exposure.envelopeInfiltrationScore}</div>
                        </div>
                        <div className="p-1 rounded bg-[#111827] border border-[#1E293B]">
                          <div className="text-slate-400">Kælder</div>
                          <div className="text-slate-100 font-bold">{exposure.internalBurdenScore}</div>
                        </div>
                      </div>
                      <p className="text-slate-300 leading-snug pt-0.5">
                        {exposure.recommendationsDa[0]}
                      </p>
                    </div>
                  )}

                  {selectedBuilding.hydrologyNote && (
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      <strong className="text-slate-100">Sagsnotat: </strong>
                      {selectedBuilding.hydrologyNote}
                      {isOverBek496 &&
                        ' · Omfattet af BEK nr. 496/2024 (> 250 m² krav om selektiv nedrivningsplan).'}
                    </p>
                  )}

                  {/* Tilknyttede laboratorieprøver med HP14-sum & overskridelsesfaktor */}
                  <div className="space-y-2 pt-1 border-t border-[#1E293B]">
                    <div className="flex items-center justify-between text-xs">
                      <h4 className="font-semibold text-slate-100 flex items-center gap-1.5">
                        <FileWarning className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          Tilknyttede laboratorieprøver ({selectedBuildingSamples.length})
                        </span>
                      </h4>
                      {selectedBuilding.permitCaseNumber && (
                        <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]">
                          Sag {selectedBuilding.permitCaseNumber}
                        </span>
                      )}
                    </div>

                    {selectedBuildingSamples.length === 0 ? (
                      <div className="p-2.5 rounded bg-[#0B0F19] border border-[#334155] text-[11px] text-slate-400">
                        Ingen direkte udtagne materialeprøver knyttet til denne nabo-/receptorzone ({MATERIAL_SAMPLES.length} prøver i øvrige blokke).
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedBuildingSamples.map(({ sample, classification }) => {
                          const isHaz = classification.wasteClass === 'Farligt affald';
                          const isContam = classification.wasteClass === 'Forurenet affald';

                          return (
                            <div
                              key={sample.id}
                              className={`p-2.5 rounded border space-y-1.5 text-[11px] ${
                                isHaz
                                  ? 'bg-rose-950/20 border-rose-500/45'
                                  : isContam
                                  ? 'bg-amber-950/20 border-amber-500/45'
                                  : 'bg-[#0B0F19] border-[#334155]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono font-bold text-slate-100">
                                  {sample.id} · {sample.reportSource}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                                    isHaz
                                      ? 'bg-rose-500/20 text-rose-200 border border-rose-500/50'
                                      : isContam
                                      ? 'bg-amber-500/20 text-amber-200 border border-amber-500/50'
                                      : 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/50'
                                  }`}
                                >
                                  {classification.wasteClass} · EAK {classification.eakCode}
                                </span>
                              </div>

                              <div className="text-slate-200">
                                <strong>{sample.locationDetail}:</strong> {sample.material}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-slate-300 tabular-nums">
                                <span>
                                  HP14-sum:{' '}
                                  <strong className="text-amber-200">
                                    {classification.hp14SumMgKg.toLocaleString('da-DK')} mg/kg
                                  </strong>
                                  {classification.upgradedByHp14 ? ' (Opklassificeret via HP14)' : ''}
                                </span>
                                <span>
                                  Overskridelse:{' '}
                                  <strong className="text-rose-200">
                                    {classification.exceedanceRatio.toLocaleString('da-DK')}x
                                  </strong>
                                </span>
                                {sample.asbestosDetected && (
                                  <span className="text-rose-300 font-semibold">
                                    Asbest: {sample.asbestosTypes.join(', ')} ({sample.dustIntensity})
                                  </span>
                                )}
                              </div>

                              {Object.keys(sample.concentrationsMgKg).length > 0 && (
                                <div className="font-mono text-[10px] text-slate-400">
                                  Målt:{' '}
                                  {Object.entries(sample.concentrationsMgKg)
                                    .map(
                                      ([k, v]) =>
                                        `${k}: ${Number(v).toLocaleString('da-DK')} mg/kg`
                                    )
                                    .join(' · ')}
                                </div>
                              )}

                              {classification.safetyRequirements2026.length > 0 && (
                                <div className="pt-1 border-t border-[#1E293B] text-[10px] text-cyan-200">
                                  <strong>2026-krav:</strong>{' '}
                                  {classification.safetyRequirements2026[0]}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
              <MapPin className="w-6 h-6 text-cyan-400" />
              <div className="text-xs font-semibold text-slate-200">
                Klik på en bygning eller et beskyttet område på kortet
              </div>
              <p className="text-[11px]">
                Se laboratorieprøver, beregnet HP14-sum, overskridelsesfaktor og eksakt afstand i meter til nærmeste nedrivningsgavl.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
};

export default RiskZoneMap;
