import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  LatLngPoint,
  RingparkenBuildingUnit,
  VirtualLeakBuildingImpact,
  VirtualLeakPinImpact,
  VirtualLeakSaturationZone,
  WaterMainCoordinateMode,
  WaterMainLegalAlert,
  WaterMainLiveTelemetry,
  WaterMainRiskStatus,
} from '../types/dispersion';
import {
  DAR_VERIFIED_KIERULFFSVEJ_WATER_MAIN,
  DISTRICT_HEATING_DEPTH_M,
  LER_UNCERTAINTY_M,
  NOMINAL_FLOW_LS,
  NOMINAL_PRESSURE_BAR,
  WATER_HARDNESS_DH,
  WATER_MAIN_DEPTH_INTERVAL_M,
  WATER_MAIN_DEPTH_M,
  WATER_MAIN_DIN4150_3_THRESHOLDS_DA,
  WATER_MAIN_DIMENSION,
  WATER_MAIN_DRINKING_WATER_LIMITS_DA,
  WATER_MAIN_HISTORICAL_EVIDENCE_DA,
  WATER_MAIN_LAYER_ID,
  WATER_MAIN_OWNER,
  buildSceneCalibratedKierulffsvejWaterMain,
  buildWaterMainBufferPolygon,
  closestPointOnPolyline,
  haversineDistanceMeters,
  wgs84ToEpsg25832,
} from '../data/kierulffsvejWaterMainData';

export interface ComputeWaterMainTelemetryParams {
  sources: DemolitionSourceNode[];
  buildings: RingparkenBuildingUnit[];
  currentWeather: HourlyWeatherPoint;
  precipitationOverrideMm: number | null;
  manualMachineNoiseOutputDb: number;
  hasSteelRoadPlates: boolean;
  simulatedPipeRuptureActive: boolean;
  isS3ValveLockoutActive?: boolean;
  coordinateMode?: WaterMainCoordinateMode;
}

/**
 * Physical Risk Engine for Kierulffsvej DN200 Drinking Water Main:
 * - Bornitz / DIN 4150-3:2016 Table 3 vibration propagation at 1.65 m depth in saturated moraine clay
 * - Boussinesq vertical crown stress with vs. without Wissenberg PSS W22085 steel road plates
 * - Hydrogeological intrusion & backsiphonage risk (Pb, PAH, PCB, Mold/Sewer)
 * - Calculation in Kind 2.0 hydraulic telemetry (bar, L/s, Watts J/s)
 * - Legal compliance checks: BEK nr. 1272/2025, Vandforsyningsloven § 62, BEK 723/2024, BEK 1328/2025 & BEK 613/2026
 */
export function computeWaterMainLiveTelemetry(
  params: ComputeWaterMainTelemetryParams
): WaterMainLiveTelemetry {
  const {
    sources,
    buildings,
    currentWeather,
    precipitationOverrideMm,
    manualMachineNoiseOutputDb,
    hasSteelRoadPlates,
    simulatedPipeRuptureActive,
    isS3ValveLockoutActive = false,
    coordinateMode = 'scene_calibrated',
  } = params;

  const sceneBuilt = buildSceneCalibratedKierulffsvejWaterMain(buildings);
  const fullMainPolyline = sceneBuilt.waypoints;
  const lerBufferPolygon = buildWaterMainBufferPolygon(
    fullMainPolyline,
    LER_UNCERTAINTY_M
  );

  const effectivePrecipMm =
    precipitationOverrideMm !== null
      ? Math.max(0, precipitationOverrideMm)
      : Math.max(0, currentWeather.precipitation);

  // Winter groundwater elevation in Kierulffsvej moraine clay (typical 1.2m; range 0.8–1.4m)
  const rainDrawUp = Math.min(0.45, effectivePrecipMm * 0.032);
  const effectiveGroundwaterDepthMeters = Number(
    Math.max(0.75, Math.min(1.45, 1.24 - rainDrawUp)).toFixed(2)
  );
  const groundwaterAbovePipeCrownMeters = Number(
    Math.max(0, WATER_MAIN_DEPTH_M - effectiveGroundwaterDepthMeters).toFixed(2)
  );

  // 1. Bornitz Vibration Analysis (DIN 4150-3:2016 Table 3)
  const activeSources = sources.filter((s) => s.active);
  const evalSources = activeSources.length > 0 ? activeSources : sources;

  let nearestSource = evalSources[0];
  let minHorizDistM = 45;

  for (const src of evalSources) {
    const { distanceMeters } = closestPointOnPolyline(src.position, fullMainPolyline);
    if (distanceMeters < minHorizDistM) {
      minHorizDistM = distanceMeters;
      nearestSource = src;
    }
  }

  // Acoustic/mechanical excitation scaling from LwA dB(A) (114 dB baseline heavy breaker/demolition rig)
  const machineDb = Math.max(85, manualMachineNoiseOutputDb || 114);
  const dbFactor = Math.pow(10, (machineDb - 114) / 22);
  const soilSaturationAmplifier = effectivePrecipMm > 2 ? 1.14 : 1.04;
  const sourceIntensityScale = nearestSource?.active
    ? Math.max(0.7, Math.min(1.45, nearestSource.sourceEmissionFactor ?? 1.0))
    : 0.25;

  // Bornitz empirical ground velocity v(r) = v0 * (r0 / r)^0.5 * exp(-alpha * (r - r0))
  // Calibrated for heavy hydraulic demolition equipment (v0 = 26 mm/s at r0 = 2.0 m)
  const rPipe3D = Math.max(
    1.65,
    Math.hypot(minHorizDistM, WATER_MAIN_DEPTH_M)
  );
  const alphaClay = 0.036; // moraine clay attenuation coeff (1/m)
  const v0Reference = 26.5;
  const rawPipePpv =
    v0Reference *
    dbFactor *
    sourceIntensityScale *
    soilSaturationAmplifier *
    Math.pow(2.0 / rPipe3D, 0.55) *
    Math.exp(-alphaClay * Math.max(0, rPipe3D - 2.0));

  const pipePpvMmPerSec = Number(
    Math.max(0.4, Math.min(95, rawPipePpv)).toFixed(2)
  );

  // Nearest 2 m service branch PPV right next to building foundation (DIN 4150-3 foundation threshold: 5–20 mm/s)
  let minBranchDistM = 12;
  for (const br of sceneBuilt.serviceBranches) {
    for (const src of evalSources) {
      const d = haversineDistanceMeters(src.position, br.buildingConnection);
      if (d < minBranchDistM) minBranchDistM = d;
    }
  }
  const rBranch3D = Math.max(2.0, Math.hypot(minBranchDistM, 1.35));
  const nearestBranchPpvMmPerSec = Number(
    Math.max(
      0.5,
      Math.min(
        98,
        v0Reference *
          dbFactor *
          sourceIntensityScale *
          Math.pow(2.0 / rBranch3D, 0.55) *
          Math.exp(-alphaClay * Math.max(0, rBranch3D - 2.0))
      )
    ).toFixed(2)
  );

  const ppvThresholdStatus: WaterMainLiveTelemetry['ppvThresholdStatus'] =
    pipePpvMmPerSec >= 50
      ? 'critical_50'
      : pipePpvMmPerSec >= 25
      ? 'warning_25'
      : pipePpvMmPerSec >= 15
      ? 'advisory_15'
      : 'under_15';

  // 2. Boussinesq Vertical Crown Stress at z = 1.65 m (145 kN heavy machine bogie load)
  // Unplated concentrated point/patch load: sigma_z = (3 * P) / (2 * PI * z^2) ≈ 25.4–32.9 kPa (with dynamic impact factor 1.29)
  // With Wissenberg PSS W22085 steel road plates (4.0m x 2.0m load distribution): drops to ~10.2 kPa
  const impactDynamicFactor = machineDb >= 116 ? 1.15 : 1.0;
  const bogieLoadKn = 145 * impactDynamicFactor;
  const zM = WATER_MAIN_DEPTH_M;
  const boussinesqPointKpa = (3 * bogieLoadKn) / (2 * Math.PI * zM * zM); // ~25.4 kPa base -> *1.295 = 32.9 kPa
  const crownStressWithoutPlatesKpa = Number(
    (boussinesqPointKpa * 1.295).toFixed(1)
  );
  const crownStressWithPlatesKpa = Number(
    (crownStressWithoutPlatesKpa * 0.31).toFixed(1)
  );
  const crownStressKpa = hasSteelRoadPlates
    ? crownStressWithPlatesKpa
    : crownStressWithoutPlatesKpa;

  // 3. Hydraulic State & Rupture Simulation (CiK 2.0 Units: bar, L/s, Watts [J/s])
  const isCriticalPpvRupture = pipePpvMmPerSec >= 50;
  const effectiveRupture = simulatedPipeRuptureActive || isCriticalPpvRupture;

  const pressureBar = effectiveRupture
    ? -0.25 // Transient sub-atmospheric suction / backsiphonage pressure drop
    : pipePpvMmPerSec >= 25
    ? 3.1
    : NOMINAL_PRESSURE_BAR;

  const flowLs = effectiveRupture
    ? 62.5 // Surge discharge (~180 m³ / ~48 min like 2018 Kierulffsvej incident)
    : pipePpvMmPerSec >= 25
    ? 22.8
    : NOMINAL_FLOW_LS;

  // Hydraulic power: P [W = J/s] = p [Pa] * Q [m³/s] = |bar| * 100 * L/s
  const hydraulicPowerWatts = Number(
    (Math.abs(pressureBar) * 100 * flowLs).toFixed(1)
  );
  const hydraulicEnergyPerHourKj = Number(
    ((hydraulicPowerWatts * 3600) / 1000).toFixed(1)
  );

  // 4. Hydrogeological Intrusion & PE100 Permeation Risk
  const hasPressureDrop = pressureBar < 1.0;
  const hasUncappedBranches = sceneBuilt.serviceBranches.some(
    (b) => b.cappingStatus === 'uncapped_risk'
  );

  let intrusionRiskLevel: WaterMainLiveTelemetry['intrusionRiskLevel'] = 'none';
  if (effectiveRupture || hasPressureDrop) {
    intrusionRiskLevel = 'active_backsiphonage';
  } else if (
    groundwaterAbovePipeCrownMeters > 0.25 &&
    (pipePpvMmPerSec >= 25 || hasUncappedBranches || !hasSteelRoadPlates)
  ) {
    intrusionRiskLevel = 'high';
  } else if (groundwaterAbovePipeCrownMeters > 0) {
    intrusionRiskLevel = 'moderate';
  }

  const intrusionContaminants = [
    'Pb (Bly)',
    '4-PAH Sum',
    'PCB',
    'Skimmel / Kloak-patogener',
  ];

  // Estimated leached/intruded levels under pressure drop or hairline eternit joint cracks
  const estimatedLeadIntrusionUgL = effectiveRupture
    ? Number((14.8 + effectivePrecipMm * 0.9).toFixed(2))
    : intrusionRiskLevel === 'high'
    ? Number((2.4 + effectivePrecipMm * 0.25).toFixed(2))
    : Number((0.45 + effectivePrecipMm * 0.08).toFixed(2));

  const estimatedPah4SumUgL = effectiveRupture
    ? Number((0.28 + effectivePrecipMm * 0.015).toFixed(3))
    : intrusionRiskLevel === 'high'
    ? Number((0.065 + effectivePrecipMm * 0.004).toFixed(3))
    : Number((0.014 + effectivePrecipMm * 0.002).toFixed(3));

  const estimatedPcbIntrusionUgL = effectiveRupture
    ? Number((0.84 + effectivePrecipMm * 0.045).toFixed(3))
    : intrusionRiskLevel === 'high'
    ? Number((0.22 + effectivePrecipMm * 0.012).toFixed(3))
    : Number((0.04 + effectivePrecipMm * 0.005).toFixed(3));

  const pePermeationRiskScore = Math.min(
    100,
    Math.round(
      groundwaterAbovePipeCrownMeters * 38 +
        effectivePrecipMm * 2.4 +
        (hasUncappedBranches ? 18 : 0) +
        (effectiveRupture ? 35 : 0)
    )
  );

  // 5. Overall Status & Legal Alerts
  let overallStatus: WaterMainRiskStatus = 'nominal';
  let statusLabelDa = 'NOMINEL DRIFT (4,2 bar · 18,5 L/s)';

  if (effectiveRupture) {
    overallStatus = 'critical_rupture';
    statusLabelDa = simulatedPipeRuptureActive
      ? 'KRITISK RØRBRUD & UNDERTRYK (−0,25 bar · Tilbagesug)'
      : `KRITISK VIBRATION ≥50 mm/s (${pipePpvMmPerSec} mm/s · RØRBRUDSALARM)`;
  } else if (
    pipePpvMmPerSec >= 25 ||
    (!hasSteelRoadPlates && crownStressKpa >= 30 && groundwaterAbovePipeCrownMeters > 0.2)
  ) {
    overallStatus = 'warning';
    statusLabelDa = `ADVARSEL: SKRØBELIG 1964-ETERNIT (${pipePpvMmPerSec} mm/s · ${crownStressKpa} kPa)`;
  } else if (
    pipePpvMmPerSec >= 15 ||
    !hasSteelRoadPlates ||
    hasUncappedBranches
  ) {
    overallStatus = 'advisory';
    statusLabelDa = `FORHØJET TILSYN (${pipePpvMmPerSec} mm/s · ${
      hasSteelRoadPlates ? 'Køreplader OK' : 'Mangler køreplader'
    })`;
  }

  const legalAlerts: WaterMainLegalAlert[] = [];

  // BEK nr. 1272 af 31/10/2025 (Drikkevandsbekendtgørelsen)
  if (
    estimatedLeadIntrusionUgL > 5.0 ||
    estimatedPah4SumUgL > 0.1 ||
    estimatedPcbIntrusionUgL > 0.5 ||
    effectiveRupture
  ) {
    legalAlerts.push({
      code: 'BEK-1272-2025',
      statute: 'BEK nr. 1272 af 31/10/2025 (Drikkevandsbekendtgørelsen)',
      title: 'Overskridelse af drikkevandskvalitetskrav ved trykfald/tilbagesug',
      severity: 'critical',
      thresholdText: 'Bly <= 5,0 µg/L · Sum 4 PAH <= 0,10 µg/L · PCB <= 0,50 µg/L',
      measuredText: `Estimeret Pb = ${estimatedLeadIntrusionUgL.toFixed(
        2
      )} µg/L · Sum 4 PAH = ${estimatedPah4SumUgL.toFixed(
        3
      )} µg/L · PCB = ${estimatedPcbIntrusionUgL.toFixed(3)} µg/L`,
      descriptionDa:
        'Ved trykfald under +1,0 bar eller undertryk (-0,25 bar) suges bly-, PAH- og PCB-holdigt grundvand ind i DN200-ledningen (dybde 1,65 m, interval 1,45–1,80 m LIGE UNDER fjernvarmerør ~1,05 m; grundvand i ' +
        effectiveGroundwaterDepthMeters +
        ' m dybde). Historisk evidens: Ledningsbrud 7. juni 2018 på Kierulffsvej (60 m rende, ~180 m³ vandtab).',
    });
  } else {
    legalAlerts.push({
      code: 'BEK-1272-2025-OVERHOLDT',
      statute: 'BEK nr. 1272 af 31/10/2025 (Drikkevandsbekendtgørelsen)',
      title: 'Kvalitetskrav overholdt under nominelt overtryk',
      severity: intrusionRiskLevel === 'high' ? 'warning' : 'advisory',
      thresholdText: 'Bly <= 5,0 µg/L · Sum 4 PAH <= 0,10 µg/L',
      measuredText: `Beredskab: Bly ${estimatedLeadIntrusionUgL.toFixed(
        2
      )} µg/L · Sum 4 PAH ${estimatedPah4SumUgL.toFixed(3)} µg/L`,
      descriptionDa:
        'Overtryk på 4,2 bar hindrer akut indtrængning, men vintergrundvand (' +
        effectiveGroundwaterDepthMeters +
        ' m) står ' +
        groundwaterAbovePipeCrownMeters +
        ' m over rørtop (~1,65 m, interval 1,45–1,80 m LIGE UNDER ~1,05 m fjernvarme).',
    });
  }

  // Vandforsyningslovens § 62 + DIN 4150-3 Tabel 3
  if (!hasSteelRoadPlates || pipePpvMmPerSec >= 15 || effectiveRupture) {
    legalAlerts.push({
      code: 'VFL-62',
      statute: 'Vandforsyningslovens § 62 & DIN 4150-3 Tabel 3',
      title: 'Pligt til beskyttelse af vandforsyningsanlæg mod beskadigelse',
      severity: effectiveRupture || pipePpvMmPerSec >= 25 ? 'critical' : 'warning',
      thresholdText:
        'Skærpet eternit-advarsel >= 25 mm/s | Plast/murværk: 50 mm/s | Metal/beton: 80 mm/s',
      measuredText: `PPV = ${pipePpvMmPerSec} mm/s · Trykspænding = ${crownStressKpa} kPa`,
      descriptionDa: hasSteelRoadPlates
        ? `Køreplader dæmper Boussinesq-kronebelastning fra ${crownStressWithoutPlatesKpa} til ${crownStressWithPlatesKpa} kPa. Overvåg DIN 4150-3 Tabel 3 (>= 25 mm/s skærpet advarsel på 1964-eternit) jf. ledningsbrud 7. juni 2018.`
        : `Manglende køreplader øger kronebelastning i 1,65 m dybde (1,45–1,80 m) til ${crownStressWithoutPlatesKpa} kPa ved tung entreprenørkørsel over LER 2.0-korridoren.`,
    });
  }

  // Asbestos Authorization for Eternit Pipe Intervention (BEK 723/2024, 1328/2025, 613/2026)
  legalAlerts.push({
    code: 'ASBEST-AUTORISATION',
    statute: 'BEK nr. 723/2024, BEK nr. 1328/2025 & BEK nr. 613/2026',
    title: 'Autorisationskrav ved enhver reparation/indgreb på 1964-Eternit (Asbestcement)',
    severity: effectiveRupture ? 'critical' : 'advisory',
    thresholdText: 'Kun autoriseret asbestsanerings-virksomhed (BEK 723/2024)',
    measuredText: 'Primært materiale: ETERNIT_ASBESTCEMENT_1964 (DN200)',
    descriptionDa:
      'Brud, skæring eller opgravning af 1964-eternit/asbestcement-rør på Kierulffsvej må kun udføres af Sikkerhedsstyrelsen-autoriserede firmaer under BEK 723/2024, BEK 1328/2025 og BEK 613/2026.',
  });

  const inspectionCenter = sceneBuilt.waypoints[1]
    ? { lat: sceneBuilt.waypoints[1].lat, lng: sceneBuilt.waypoints[1].lng }
    : { lat: 55.41295, lng: 11.35365 };

  const shouldLockIsolationValves = effectiveRupture || Boolean(isS3ValveLockoutActive);
  const dynamicValves = sceneBuilt.valves.map((v) =>
    shouldLockIsolationValves && (v.code === 'V-VEST' || v.code === 'V-MIDT')
      ? { ...v, status: 'closed' as const }
      : v
  );

  return {
    layerId: WATER_MAIN_LAYER_ID,
    coordinateMode,
    ownerName: WATER_MAIN_OWNER,
    waterHardnessDh: WATER_HARDNESS_DH,
    dimension: WATER_MAIN_DIMENSION,
    primaryMaterial: 'ETERNIT_ASBESTCEMENT_1964',
    burialDepthMeters: WATER_MAIN_DEPTH_M,
    depthIntervalMeters: WATER_MAIN_DEPTH_INTERVAL_M,
    districtHeatingDepthMeters: DISTRICT_HEATING_DEPTH_M,
    lerUncertaintyMeters: LER_UNCERTAINTY_M,
    pressureBar,
    nominalPressureBar: NOMINAL_PRESSURE_BAR,
    flowLs,
    nominalFlowLs: NOMINAL_FLOW_LS,
    hydraulicPowerWatts,
    hydraulicEnergyPerHourKj,
    pipePpvMmPerSec,
    nearestBranchPpvMmPerSec,
    nearestSourceId: nearestSource?.id || 'src-blok-1',
    nearestSourceCode: nearestSource?.code || 'KILDE 4',
    nearestSourceDistanceMeters: Number(minHorizDistM.toFixed(1)),
    ppvThresholdStatus,
    crownStressKpa,
    crownStressWithoutPlatesKpa,
    crownStressWithPlatesKpa,
    hasSteelRoadPlates,
    simulatedPipeRuptureActive: effectiveRupture,
    effectivePrecipitationMmH: Number(effectivePrecipMm.toFixed(1)),
    effectiveGroundwaterDepthMeters,
    groundwaterAbovePipeCrownMeters,
    intrusionRiskLevel,
    intrusionContaminants,
    estimatedLeadIntrusionUgL,
    estimatedPah4SumUgL,
    estimatedPcbIntrusionUgL,
    pePermeationRiskScore,
    overallStatus,
    statusLabelDa,
    inspectionCenter,
    lerBufferPolygon,
    sceneSegments: sceneBuilt.segments,
    darSegments: DAR_VERIFIED_KIERULFFSVEJ_WATER_MAIN,
    valves: dynamicValves,
    hydrants: sceneBuilt.hydrants,
    serviceBranches: sceneBuilt.serviceBranches,
    legalAlerts,
  };
}

/**
 * Generates an EPSG:25832 (ETRS89 / UTM Zone 32N) projected GeoJSON FeatureCollection
 * for the Kierulffsvej DN200 drinking water main, LER 2.0 uncertainty buffer, isolation valves,
 * fire hydrants, and service branches. Geometry coordinates are strictly [eastingM, northingM].
 */
export function buildKierulffsvejWaterMainEpsg25832GeoJson(
  buildings: RingparkenBuildingUnit[] = []
): Record<string, unknown> {
  const sceneBuilt = buildSceneCalibratedKierulffsvejWaterMain(buildings);
  const toUtmPair = (lat: number, lng: number): [number, number] => {
    const utm = wgs84ToEpsg25832(lat, lng);
    return [utm.eastingM, utm.northingM];
  };

  const features: Array<Record<string, unknown>> = [];

  // 1. DAR-verified DN200 Water Main Segments projected into EPSG:25832 meters
  DAR_VERIFIED_KIERULFFSVEJ_WATER_MAIN.forEach((seg) => {
    features.push({
      type: 'Feature',
      id: `${seg.id}-epsg25832`,
      properties: {
        layerId: WATER_MAIN_LAYER_ID,
        featureClass: 'water_main_segment',
        crs: 'EPSG:25832',
        coordinateMode: 'dar_verified_epsg25832',
        code: seg.code,
        name: seg.name,
        ownerName: seg.ownerName,
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
        wgs84Waypoints: seg.waypoints.map((w) => [w.lng, w.lat]),
      },
      geometry: {
        type: 'LineString',
        coordinates: seg.waypoints.map((w) => toUtmPair(w.lat, w.lng)),
      },
    });
  });

  // 2. LER 2.0 +/-2.0 m Uncertainty Buffer Polygon projected into EPSG:25832 meters
  const lerRingWgs84 = buildWaterMainBufferPolygon(
    DAR_VERIFIED_KIERULFFSVEJ_WATER_MAIN.flatMap((s) => s.waypoints),
    LER_UNCERTAINTY_M
  );
  if (lerRingWgs84.length >= 3) {
    const utmRing = lerRingWgs84.map((pt) => toUtmPair(pt.lat, pt.lng));
    utmRing.push(utmRing[0]);
    features.push({
      type: 'Feature',
      id: 'kierulffsvej-ler2-buffer-epsg25832',
      properties: {
        layerId: WATER_MAIN_LAYER_ID,
        featureClass: 'ler_uncertainty_buffer',
        crs: 'EPSG:25832',
        bufferRadiusMeters: LER_UNCERTAINTY_M,
        descriptionDa: 'LER 2.0 graveusikkerhedszone (+/- 2,0 m omkring DN200 hovedrør)',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [utmRing],
      },
    });
  }

  // 3. Service Branches (DN32-50) projected into EPSG:25832 meters
  sceneBuilt.serviceBranches.forEach((br) => {
    features.push({
      type: 'Feature',
      id: `${br.id}-epsg25832`,
      properties: {
        layerId: WATER_MAIN_LAYER_ID,
        featureClass: 'service_branch',
        crs: 'EPSG:25832',
        code: br.code,
        targetBuildingCode: br.targetBuildingCode,
        address: br.address,
        material: br.material,
        dimension: br.dimension,
        cappingStatus: br.cappingStatus,
        legalStandard: br.legalStandard,
        lengthMeters: br.lengthMeters,
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          toUtmPair(br.darStartOnMain.lat, br.darStartOnMain.lng),
          toUtmPair(br.darBuildingConnection.lat, br.darBuildingConnection.lng),
        ],
      },
    });
  });

  // 4. Isolation Valves (V-VEST, V-MIDT, V-ØST) in EPSG:25832 meters
  sceneBuilt.valves.forEach((v) => {
    features.push({
      type: 'Feature',
      id: `${v.id}-epsg25832`,
      properties: {
        layerId: WATER_MAIN_LAYER_ID,
        featureClass: 'isolation_valve',
        crs: 'EPSG:25832',
        code: v.code,
        name: v.name,
        address: v.address,
        status: v.status,
        isSectionIsolationValve: v.isSectionIsolationValve,
        wgs84Coordinate: [v.darCoordinate.lng, v.darCoordinate.lat],
      },
      geometry: {
        type: 'Point',
        coordinates: toUtmPair(v.darCoordinate.lat, v.darCoordinate.lng),
      },
    });
  });

  // 5. Hydrants in EPSG:25832 meters
  sceneBuilt.hydrants.forEach((h) => {
    features.push({
      type: 'Feature',
      id: `${h.id}-epsg25832`,
      properties: {
        layerId: WATER_MAIN_LAYER_ID,
        featureClass: 'fire_hydrant',
        crs: 'EPSG:25832',
        code: h.code,
        name: h.name,
        address: h.address,
        flowCapacityLs: h.flowCapacityLs,
        wgs84Coordinate: [h.darCoordinate.lng, h.darCoordinate.lat],
      },
      geometry: {
        type: 'Point',
        coordinates: toUtmPair(h.darCoordinate.lat, h.darCoordinate.lng),
      },
    });
  });

  return {
    type: 'FeatureCollection',
    name: `${WATER_MAIN_LAYER_ID}_EPSG25832`,
    crs: {
      type: 'name',
      properties: {
        name: 'urn:ogc:def:crs:EPSG::25832',
      },
    },
    metadata: {
      exportedAtIso: new Date().toISOString(),
      projectedReferenceCrs: 'EPSG:25832 (ETRS89 / UTM Zone 32N)',
      units: 'meters',
      owner: WATER_MAIN_OWNER,
      waterHardnessDh: WATER_HARDNESS_DH,
      dimension: WATER_MAIN_DIMENSION,
      depthIntervalMeters: WATER_MAIN_DEPTH_INTERVAL_M,
      overlyingDistrictHeatingDepthMeters: DISTRICT_HEATING_DEPTH_M,
      historicalEvidenceDa: WATER_MAIN_HISTORICAL_EVIDENCE_DA,
      din4150Table3ThresholdsDa: WATER_MAIN_DIN4150_3_THRESHOLDS_DA,
      drinkingWaterLimitsDa: WATER_MAIN_DRINKING_WATER_LIMITS_DA,
    },
    features,
  };
}

export function exportKierulffsvejWaterMainEpsg25832GeoJson(
  buildings: RingparkenBuildingUnit[] = []
): { fileName: string; featureCount: number } {
  const fc = buildKierulffsvejWaterMainEpsg25832GeoJson(buildings);
  const features = (fc.features as unknown[]) || [];
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `Kierulffsvej_Drikkevand_DN200_EPSG25832_${dateStamp}.geojson`;

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

export interface WaterMain6HourVibrationPoint {
  offsetHours: number; // -5 .. 0
  hourIndex: number;
  hourLabel: string;
  precipitationMm: number;
  windSpeedMs: number;
  pipePpvMmPerSec: number;
  threshold25MmPerSec: number;
  threshold50MmPerSec: number;
  isCurrentHour: boolean;
}

/**
 * Computes the last 6 hours of pipe vibration (PPV mm/s) leading up to the current state
 * using real-time hourly weather precipitation/wind gusts and Bornitz moraine-clay physics.
 */
export function computeWaterMainLast6HoursTrend(params: {
  telemetry: WaterMainLiveTelemetry;
  currentWeather: HourlyWeatherPoint;
  weatherHours?: HourlyWeatherPoint[];
  sources: DemolitionSourceNode[];
  buildings: RingparkenBuildingUnit[];
  manualMachineNoiseOutputDb?: number;
  hasSteelRoadPlates?: boolean;
  simulatedPipeRuptureActive?: boolean;
}): WaterMain6HourVibrationPoint[] {
  const {
    telemetry,
    currentWeather,
    weatherHours = [],
    sources,
    buildings,
    manualMachineNoiseOutputDb = 114,
    hasSteelRoadPlates = telemetry.hasSteelRoadPlates,
  } = params;

  const hoursPool = weatherHours.length > 0 ? weatherHours : [currentWeather];
  const currentIdx = Math.max(
    0,
    hoursPool.findIndex((h) => h.hourIndex === currentWeather.hourIndex)
  );

  const points: WaterMain6HourVibrationPoint[] = [];

  for (let offset = -5; offset <= 0; offset++) {
    const isCurrent = offset === 0;
    const targetIdx =
      ((currentIdx + offset) % hoursPool.length + hoursPool.length) % hoursPool.length;
    const hrWeather = isCurrent ? currentWeather : hoursPool[targetIdx] || currentWeather;

    // Historical machinery acoustic modulation: daytime active demolition (07-18) vs quieter shoulder/off-hours + wind gust load
    const hr = hrWeather.hourIndex;
    const isWorkWindow = hr >= 7 && hr < 18;
    const workWindowOffsetDb = isCurrent ? 0 : isWorkWindow ? -0.8 * Math.abs(offset) * 0.25 : -10;
    const gustCouplingDb = Math.max(0, (hrWeather.windGusts10m - 8) * 0.14);
    const effectiveDb = isCurrent
      ? manualMachineNoiseOutputDb
      : Math.max(85, Math.min(125, manualMachineNoiseOutputDb + workWindowOffsetDb + gustCouplingDb));

    const computed = isCurrent
      ? telemetry
      : computeWaterMainLiveTelemetry({
          sources,
          buildings,
          currentWeather: hrWeather,
          precipitationOverrideMm: null,
          manualMachineNoiseOutputDb: effectiveDb,
          hasSteelRoadPlates,
          simulatedPipeRuptureActive: false,
          coordinateMode: telemetry.coordinateMode,
        });

    points.push({
      offsetHours: offset,
      hourIndex: hrWeather.hourIndex,
      hourLabel: hrWeather.hourLabel || `${String(hrWeather.hourIndex).padStart(2, '0')}:00`,
      precipitationMm: Number(hrWeather.precipitation.toFixed(1)),
      windSpeedMs: Number(hrWeather.windSpeed10m.toFixed(1)),
      pipePpvMmPerSec: Number(
        (isCurrent ? telemetry.pipePpvMmPerSec : computed.pipePpvMmPerSec).toFixed(2)
      ),
      threshold25MmPerSec: 25,
      threshold50MmPerSec: 50,
      isCurrentHour: isCurrent,
    });
  }

  return points;
}

function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value);
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC 4180 UTF-8 CSV containing the latest BEK 1272/2025 compliance telemetry
 * for the selected Kierulffsvej water main pipe section.
 */
export function buildWaterMainBek1272ComplianceCsv(params: {
  telemetry: WaterMainLiveTelemetry;
  selectedSectionId?: string;
  observedTimestampIso?: string;
}): { csvContent: string; fileName: string; sectionLabelDa: string } {
  const { telemetry, selectedSectionId, observedTimestampIso } = params;
  const segments =
    telemetry.coordinateMode === 'dar_verified_wgs84'
      ? telemetry.darSegments
      : telemetry.sceneSegments;

  const matched =
    selectedSectionId && selectedSectionId !== 'all'
      ? segments.filter((s) => s.id === selectedSectionId)
      : segments;
  const exportSegments = matched.length > 0 ? matched : segments.slice(0, 1);

  const pbUgL = telemetry.estimatedLeadIntrusionUgL;
  const pah4UgL = telemetry.estimatedPah4SumUgL;
  const pcbUgL = telemetry.estimatedPcbIntrusionUgL ?? 0.08;
  const backsiphonage = telemetry.intrusionRiskLevel === 'active_backsiphonage';

  const pbCompliant = pbUgL <= 5.0 && !backsiphonage;
  const pahCompliant = pah4UgL <= 0.1 && !backsiphonage;
  const pcbCompliant = pcbUgL <= 0.5 && !backsiphonage;
  const overallCompliant = pbCompliant && pahCompliant && pcbCompliant;

  const isoNow = observedTimestampIso || new Date().toISOString();
  const headers = [
    'Tidspunkt_ISO',
    'Roerstraekning_ID',
    'Roerstraekning_Navn',
    'Koordinatbinding',
    'Ledningsejer',
    'Materiale',
    'Dimension',
    'Dybde_m',
    'Driftstryk_bar',
    'Flow_Ls',
    'PPV_Vibration_mm_s',
    'Stikledning_PPV_mm_s',
    'DIN_4150_3_Status',
    'Boussinesq_Kronebelastning_kPa',
    'Koeplader_Aktiv',
    'Simuleret_Roerbrud',
    'Indtraengningsrisiko',
    'Bly_Pb_Estimeret_ug_L',
    'Bly_BEK1272_Graense_ug_L',
    'Bly_Overholdt',
    'Sum4PAH_Estimeret_ug_L',
    'Sum4PAH_BEK1272_Graense_ug_L',
    'Sum4PAH_Overholdt',
    'PCB_Estimeret_ug_L',
    'PCB_BEK1272_Graense_ug_L',
    'PCB_Overholdt',
    'BEK_1272_2025_Samlet_Status',
    'Lovhjemmel_Alarmer',
  ];

  const rows = exportSegments.map((seg) => [
    isoNow,
    seg.id,
    seg.name,
    telemetry.coordinateMode,
    telemetry.ownerName,
    seg.material,
    seg.dimension,
    seg.burialDepthMeters.toFixed(2),
    telemetry.pressureBar.toFixed(2),
    telemetry.flowLs.toFixed(1),
    telemetry.pipePpvMmPerSec.toFixed(2),
    telemetry.nearestBranchPpvMmPerSec.toFixed(2),
    telemetry.ppvThresholdStatus,
    telemetry.crownStressKpa.toFixed(1),
    telemetry.hasSteelRoadPlates ? 'Ja' : 'Nej',
    telemetry.simulatedPipeRuptureActive ? 'Ja' : 'Nej',
    telemetry.intrusionRiskLevel,
    pbUgL.toFixed(2),
    '5.00',
    pbCompliant ? 'OVERHOLDT' : 'OVERSKRIDELSE',
    pah4UgL.toFixed(3),
    '0.100',
    pahCompliant ? 'OVERHOLDT' : 'OVERSKRIDELSE',
    pcbUgL.toFixed(2),
    '0.50',
    pcbCompliant ? 'OVERHOLDT' : 'OVERSKRIDELSE',
    overallCompliant ? 'OVERHOLDT (BEK 1272/2025)' : 'OVERSKRIDELSE (BEK 1272/2025)',
    telemetry.legalAlerts.map((a) => `${a.statute}: ${a.title}`).join(' | ') || 'Ingen aktive alarmer',
  ]);

  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ];
  const csvContent = `\uFEFF${csvLines.join('\r\n')}`;
  const slug =
    exportSegments.length === 1
      ? exportSegments[0].id.replace(/[^a-z0-9_-]/gi, '_')
      : 'alle_straekninger';
  const fileName = `Kierulffsvej_BEK1272_Compliance_${slug}_${isoNow.slice(0, 10)}.csv`;
  const sectionLabelDa =
    exportSegments.length === 1 ? exportSegments[0].name : 'Kierulffsvej DN200 (alle delstrækninger)';

  return { csvContent, fileName, sectionLabelDa };
}

export function exportWaterMainBek1272ComplianceCsv(params: {
  telemetry: WaterMainLiveTelemetry;
  selectedSectionId?: string;
  observedTimestampIso?: string;
}): { fileName: string; sectionLabelDa: string } {
  const { csvContent, fileName, sectionLabelDa } = buildWaterMainBek1272ComplianceCsv(params);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return { fileName, sectionLabelDa };
}

/**
 * Snaps an arbitrary map click coordinate onto the closest segment of the Kierulffsvej water main.
 */
export function snapPointToWaterMainPolyline(
  clickPoint: LatLngPoint,
  telemetry: WaterMainLiveTelemetry
): {
  snappedPoint: LatLngPoint;
  segmentId: string;
  segmentName: string;
  distanceFromPipeMeters: number;
} {
  const segments =
    telemetry.coordinateMode === 'dar_verified_wgs84'
      ? telemetry.darSegments
      : telemetry.sceneSegments;

  let bestPoint = telemetry.inspectionCenter;
  let bestDist = Infinity;
  let bestSegId = segments[0]?.id || 'scene-kierulffsvej-seg-1-eternit';
  let bestSegName = segments[0]?.name || 'Kierulffsvej DN200 Hovedrør';

  for (const seg of segments) {
    const res = closestPointOnPolyline(clickPoint, seg.waypoints);
    if (res.distanceMeters < bestDist) {
      bestDist = res.distanceMeters;
      bestPoint = res.point;
      bestSegId = seg.id;
      bestSegName = seg.name;
    }
  }

  return {
    snappedPoint: bestPoint,
    segmentId: bestSegId,
    segmentName: bestSegName,
    distanceFromPipeMeters: Number(bestDist.toFixed(1)),
  };
}

/**
 * Computes soil saturation zones and immediate percolation impact on Ringparken buildings
 * around a user-placed virtual leak/rupture pin on the Kierulffsvej water main.
 */
export function computeVirtualLeakPercolationImpact(params: {
  pinPoint: LatLngPoint;
  telemetry: WaterMainLiveTelemetry;
  buildings: RingparkenBuildingUnit[];
}): VirtualLeakPinImpact {
  const { pinPoint, telemetry, buildings } = params;
  const snapped = snapPointToWaterMainPolyline(pinPoint, telemetry);

  const rainFactor = 1 + Math.min(0.35, telemetry.effectivePrecipitationMmH * 0.025);
  const dischargeLs = Number((54.0 * rainFactor).toFixed(1));
  const pressureDropBar = Number(
    Math.max(2.6, Math.abs(telemetry.nominalPressureBar - 0.1)).toFixed(2)
  );
  const immediatePercolationDepthM = Number(
    Math.min(5.2, 2.4 + telemetry.effectivePrecipitationMmH * 0.11).toFixed(2)
  );

  const saturationZones: VirtualLeakSaturationZone[] = [
    {
      tier: 'core_saturated',
      radiusMeters: Number((9.5 * rainFactor).toFixed(1)),
      saturationPct: 100,
      labelDa: 'Akut vandmættet kerne (100% porefyldning · udvaskning)',
      colorHex: '#ef4444',
    },
    {
      tier: 'capillary_front',
      radiusMeters: Number((21.0 * rainFactor).toFixed(1)),
      saturationPct: 78,
      labelDa: 'Kapillær spredningsfront (78% mætning · PAH/Bly-mobilisering)',
      colorHex: '#0ea5e9',
    },
    {
      tier: 'clay_wetting_fringe',
      radiusMeters: Number((36.0 * rainFactor).toFixed(1)),
      saturationPct: 52,
      labelDa: 'Moræneler makropore-randzone (52% · kælderniveau)',
      colorHex: '#38bdf8',
    },
  ];

  const evaluated: VirtualLeakBuildingImpact[] = buildings
    .map((b) => {
      const distM = Math.max(3.0, haversineDistanceMeters(snapped.snappedPoint, b.center));
      const effectiveDarcyVelocityMMin =
        0.42 * rainFactor * Math.max(0.45, Math.min(1.4, 24 / distM));
      const arrivalMinutes = Math.max(2, Math.round(distM / effectiveDarcyVelocityMMin));
      const intrusionRateLh = Math.round(
        (dischargeLs * 3600 * 0.035) / Math.pow(distM / 8, 1.35)
      );
      const foundationDepthExposureM = Number(
        Math.min(2.4, Math.max(0.4, 1.85 - distM * 0.014)).toFixed(2)
      );
      const severity: VirtualLeakBuildingImpact['severity'] =
        distM <= saturationZones[0].radiusMeters * 1.45
          ? 'critical'
          : distM <= saturationZones[1].radiusMeters * 1.35
          ? 'high'
          : 'moderate';

      const summaryDa =
        severity === 'critical'
          ? `Akut fundaments-perkolation (${arrivalMinutes} min · ~${intrusionRateLh} L/t ved -${foundationDepthExposureM} m)`
          : severity === 'high'
          ? `Høj fugt- & perkolatfront (${arrivalMinutes} min · ~${intrusionRateLh} L/t)`
          : `Moderat grundvandsstigning (${arrivalMinutes} min · ~${intrusionRateLh} L/t)`;

      return {
        buildingId: b.id,
        buildingCode: b.code,
        buildingName: b.name,
        address: b.address,
        center: b.center,
        distanceMeters: Number(distM.toFixed(1)),
        arrivalMinutes,
        intrusionRateLh,
        foundationDepthExposureM,
        severity,
        summaryDa,
      };
    })
    .filter((item) => item.distanceMeters <= 95)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 6);

  return {
    pinPoint: snapped.snappedPoint,
    snappedSegmentId: snapped.segmentId,
    snappedSegmentName: snapped.segmentName,
    pressureDropBar,
    dischargeLs,
    immediatePercolationDepthM,
    saturationZones,
    impactedBuildings: evaluated,
  };
}
