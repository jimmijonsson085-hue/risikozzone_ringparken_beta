import {
  computeHydrogeologicalPercolation,
  HydrogeologicalSimulationResult,
} from '../components/UndergroundPercolation2D';

export type ClimateHorizonId =
  | 'baseline_2026'
  | 'rcp45_2040'
  | 'rcp45_2070'
  | 'rcp85_2100'
  | 'custom';

export interface ClimateResilienceConfig {
  enabled: boolean;
  horizonId: ClimateHorizonId;
  horizonLabel: string;
  precipitationIncreasePct: number; // 0..100 (%)
  cloudburstSurgeMmH: number; // 0..35 (mm/t extra intense rain)
  groundwaterTableRiseM: number; // 0..1.2 (m seasonal groundwater uplift)
  soilSaturationBoost: number; // 0..0.16 (m³/m³ extra soil moisture)
  freezeThawMacroporeAmplificationPct: number; // 0..50 (%)
  larRetentionActive: boolean; // LAR basins + sealed Blok 1-2 crawlspace cover (-45% infiltration stress)
}

export interface ClimateHorizonPreset {
  id: Exclude<ClimateHorizonId, 'custom'>;
  shortLabel: string;
  fullLabel: string;
  sspTag: string;
  descriptionDa: string;
  precipitationIncreasePct: number;
  cloudburstSurgeMmH: number;
  groundwaterTableRiseM: number;
  soilSaturationBoost: number;
  freezeThawMacroporeAmplificationPct: number;
}

export const CLIMATE_HORIZON_PRESETS: ClimateHorizonPreset[] = [
  {
    id: 'baseline_2026',
    shortLabel: '2026 Baseline',
    fullLabel: '2026 Referenceklima (Nuværende Slagelse)',
    sspTag: 'REF',
    descriptionDa: 'Nuværende nedbørsintensitet og grundvandsspejl uden fremtidigt klimatillæg.',
    precipitationIncreasePct: 0,
    cloudburstSurgeMmH: 0,
    groundwaterTableRiseM: 0,
    soilSaturationBoost: 0,
    freezeThawMacroporeAmplificationPct: 0,
  },
  {
    id: 'rcp45_2040',
    shortLabel: '2040 (+18%)',
    fullLabel: '2040 Moderat Klimafremskrivning',
    sspTag: 'SSP2-4.5',
    descriptionDa: '+18% kraftigere regnbyger, +6,0 mm/t skybrudstillæg og +0,22 m højere vintergrundvand.',
    precipitationIncreasePct: 18,
    cloudburstSurgeMmH: 6.0,
    groundwaterTableRiseM: 0.22,
    soilSaturationBoost: 0.04,
    freezeThawMacroporeAmplificationPct: 12,
  },
  {
    id: 'rcp45_2070',
    shortLabel: '2070 (+34%)',
    fullLabel: '2070 Høj Vinterafstrømning & Skybrud',
    sspTag: 'SSP2-4.5',
    descriptionDa: '+34% regnintensitet, +14,0 mm/t skybrudstillæg og +0,45 m løftet grundvandsspejl.',
    precipitationIncreasePct: 34,
    cloudburstSurgeMmH: 14.0,
    groundwaterTableRiseM: 0.45,
    soilSaturationBoost: 0.08,
    freezeThawMacroporeAmplificationPct: 24,
  },
  {
    id: 'rcp85_2100',
    shortLabel: '2100 (+58%)',
    fullLabel: '2100 Ekstrem Klimaændring',
    sspTag: 'SSP5-8.5',
    descriptionDa: '+58% ekstrem nedbør, +24,0 mm/t skybrudspids, +0,78 m grundvandsstigning og kraftig sprækkeperkolation.',
    precipitationIncreasePct: 58,
    cloudburstSurgeMmH: 24.0,
    groundwaterTableRiseM: 0.78,
    soilSaturationBoost: 0.13,
    freezeThawMacroporeAmplificationPct: 38,
  },
];

export const DEFAULT_CLIMATE_RESILIENCE_CONFIG: ClimateResilienceConfig = {
  enabled: false,
  horizonId: 'rcp45_2070',
  horizonLabel: '2070 Høj Vinterafstrømning & Skybrud',
  precipitationIncreasePct: 34,
  cloudburstSurgeMmH: 14.0,
  groundwaterTableRiseM: 0.45,
  soilSaturationBoost: 0.08,
  freezeThawMacroporeAmplificationPct: 24,
  larRetentionActive: false,
};

export interface ClimateResiliencePercolationResult {
  baseline: HydrogeologicalSimulationResult;
  projected: HydrogeologicalSimulationResult;
  effectiveClimatePrecipMmH: number;
  effectiveClimateSoilMoisture: number;
  larMitigationFactor: number; // 1.0 when off, 0.55 when LAR active
  percolationVelocityDeltaPct: number;
  waterTableRiseTotalM: number;
  unsaturatedBufferBaselineM: number; // distance from crawlspace floor (-1.8m) to secondary water table
  unsaturatedBufferProjectedM: number;
  secondaryBreakthroughDeltaHours: number;
  leadConcentrationDeltaUgL: number;
  pahConcentrationDeltaUgL: number;
  dn200SubsurfaceStressFactor: number;
  resilienceScore0To100: number;
  resilienceStatus: 'ROBUST' | 'PRESSET' | 'KRITISK' | 'GRÆNSEBRUD';
}

export function computeClimateResiliencePercolation(
  basePrecipMmH: number,
  baseSoilMoisture: number,
  hadRecentFreezeThaw: boolean,
  activeSourceCount: number,
  unsecuredDemolishedCount: number,
  config: ClimateResilienceConfig
): ClimateResiliencePercolationResult {
  const safeBasePrecip = Math.max(0, basePrecipMmH);
  const safeBaseMoisture = Math.max(0.08, Math.min(0.48, baseSoilMoisture));

  const baseline = computeHydrogeologicalPercolation(
    safeBasePrecip,
    safeBaseMoisture,
    hadRecentFreezeThaw,
    activeSourceCount,
    unsecuredDemolishedCount
  );

  const larMitigationFactor = config.larRetentionActive ? 0.55 : 1.0;

  // Projected future rainfall combining relative intensity amplification + convective cloudburst surge
  const rawFuturePrecip =
    safeBasePrecip * (1 + Math.max(0, config.precipitationIncreasePct) / 100) +
    Math.max(0, config.cloudburstSurgeMmH);
  const effectiveClimatePrecipMmH = Number((rawFuturePrecip * larMitigationFactor).toFixed(1));

  // Projected future soil moisture in Weichsel moraine clay
  const effectiveClimateSoilMoisture = Number(
    Math.min(
      0.48,
      Math.max(
        0.1,
        safeBaseMoisture + config.soilSaturationBoost * (config.larRetentionActive ? 0.65 : 1.0)
      )
    ).toFixed(3)
  );

  const effectiveFreezeThaw =
    hadRecentFreezeThaw || config.freezeThawMacroporeAmplificationPct >= 20;

  const rawProjected = computeHydrogeologicalPercolation(
    effectiveClimatePrecipMmH,
    effectiveClimateSoilMoisture,
    effectiveFreezeThaw,
    activeSourceCount,
    unsecuredDemolishedCount
  );

  // Apply explicit climate groundwater table uplift and macropore fracture amplification
  const macroporeScale =
    1 + (Math.max(0, config.freezeThawMacroporeAmplificationPct) / 100) * (config.larRetentionActive ? 0.5 : 1.0);
  const projectedMacroporeVel = Number(
    (rawProjected.macroporeVelocityMetersPerDay * macroporeScale).toFixed(2)
  );
  const projectedSecondaryDepthM = Number(
    Math.max(3.2, rawProjected.secondaryWaterTableDepthM - config.groundwaterTableRiseM).toFixed(1)
  );
  const projectedPrimaryDepthM = Number(
    Math.max(12.2, rawProjected.primaryWaterTableDepthM - config.groundwaterTableRiseM * 0.72).toFixed(1)
  );

  // Plume penetration increases when cracks widen and water table sits higher
  const projectedPlumeDepthM = Number(
    Math.min(
      24.6,
      rawProjected.plumeMaxDepthMeters * (0.94 + macroporeScale * 0.06) +
        (effectiveClimatePrecipMmH > 12 ? 0.6 : 0)
    ).toFixed(1)
  );
  const reachesSecondary = projectedPlumeDepthM >= projectedSecondaryDepthM;
  const reachesPrimary = projectedPlumeDepthM >= projectedPrimaryDepthM;

  const effVelMPerHr = Math.max(0.015, projectedMacroporeVel / 24);
  const breakthroughHoursSecondary = Number(
    Math.max(0.4, projectedSecondaryDepthM / effVelMPerHr).toFixed(1)
  );
  const breakthroughDaysPrimary = Number(
    Math.max(0.3, projectedPrimaryDepthM / Math.max(0.18, projectedMacroporeVel * 0.45)).toFixed(1)
  );

  // Contaminant concentrations respond to higher infiltration + closer water table + LAR mitigation
  const waterTableProximityBoost = 1 + Math.max(0, 7.2 - projectedSecondaryDepthM) * 0.14;
  const leadSecondaryUgL = Number(
    (
      rawProjected.leadConcentrationSecondaryUgL *
      waterTableProximityBoost *
      (config.larRetentionActive ? 0.62 : 1.0)
    ).toFixed(2)
  );
  const pahSecondaryUgL = Number(
    (
      rawProjected.pahConcentrationSecondaryUgL *
      waterTableProximityBoost *
      (config.larRetentionActive ? 0.62 : 1.0)
    ).toFixed(3)
  );
  const pcbSecondaryUgL = Number(
    (
      rawProjected.pcbConcentrationSecondaryUgL *
      waterTableProximityBoost *
      (config.larRetentionActive ? 0.64 : 1.0)
    ).toFixed(3)
  );

  const mblViolationActive =
    activeSourceCount > 0 &&
    (leadSecondaryUgL >= 1.0 ||
      pcbSecondaryUgL >= 0.01 ||
      effectiveClimatePrecipMmH >= 1.5 ||
      (rawProjected.saturationRatio >= 0.7 && effectiveFreezeThaw));

  let riskLevel: HydrogeologicalSimulationResult['riskLevel'] = rawProjected.riskLevel;
  if (effectiveClimatePrecipMmH >= 12 || reachesPrimary) {
    riskLevel = 'CRITICAL_SKIBRUD';
  } else if (effectiveClimatePrecipMmH >= 2.5 || reachesSecondary || mblViolationActive) {
    riskLevel = 'HIGH';
  }

  const projected: HydrogeologicalSimulationResult = {
    ...rawProjected,
    macroporeVelocityMetersPerDay: projectedMacroporeVel,
    secondaryWaterTableDepthM: projectedSecondaryDepthM,
    primaryWaterTableDepthM: projectedPrimaryDepthM,
    plumeMaxDepthMeters: projectedPlumeDepthM,
    reachesSecondaryAquifer: reachesSecondary,
    reachesPrimaryAquifer: reachesPrimary,
    breakthroughHoursSecondary,
    breakthroughDaysPrimary,
    leadConcentrationSecondaryUgL: leadSecondaryUgL,
    pahConcentrationSecondaryUgL: pahSecondaryUgL,
    pcbConcentrationSecondaryUgL: pcbSecondaryUgL,
    mblViolationActive,
    riskLevel,
  };

  const baseVel = Math.max(0.05, baseline.macroporeVelocityMetersPerDay);
  const percolationVelocityDeltaPct = Math.round(
    ((projected.macroporeVelocityMetersPerDay - baseVel) / baseVel) * 100
  );
  const waterTableRiseTotalM = Number(
    Math.max(0, baseline.secondaryWaterTableDepthM - projected.secondaryWaterTableDepthM).toFixed(2)
  );

  // Crawlspace foundation floor at Blok 1 & 2 sits at -1.8 m depth
  const CRAWLSPACE_FLOOR_M = 1.8;
  const unsaturatedBufferBaselineM = Number(
    Math.max(0, baseline.secondaryWaterTableDepthM - CRAWLSPACE_FLOOR_M).toFixed(2)
  );
  const unsaturatedBufferProjectedM = Number(
    Math.max(0, projected.secondaryWaterTableDepthM - CRAWLSPACE_FLOOR_M).toFixed(2)
  );

  const secondaryBreakthroughDeltaHours = Number(
    (baseline.breakthroughHoursSecondary - projected.breakthroughHoursSecondary).toFixed(1)
  );
  const leadConcentrationDeltaUgL = Number(
    (projected.leadConcentrationSecondaryUgL - baseline.leadConcentrationSecondaryUgL).toFixed(2)
  );
  const pahConcentrationDeltaUgL = Number(
    (projected.pahConcentrationSecondaryUgL - baseline.pahConcentrationSecondaryUgL).toFixed(3)
  );

  const dn200SubsurfaceStressFactor = Number(
    (
      1 +
      Math.min(0.6, effectiveClimatePrecipMmH * 0.015) +
      waterTableRiseTotalM * 0.25 +
      (config.larRetentionActive ? -0.18 : 0)
    ).toFixed(2)
  );

  // Resilience score (100 = fully resilient buffer, 0 = severe aquifer breach)
  const rawPenalty =
    Math.min(40, effectiveClimatePrecipMmH * 1.1) +
    Math.min(25, waterTableRiseTotalM * 18) +
    (leadSecondaryUgL >= 1.0 ? 20 : leadSecondaryUgL * 14) +
    (reachesPrimary ? 15 : 0) -
    (config.larRetentionActive ? 18 : 0);
  const resilienceScore0To100 = Math.round(Math.max(4, Math.min(98, 100 - rawPenalty)));

  let resilienceStatus: ClimateResiliencePercolationResult['resilienceStatus'] = 'ROBUST';
  if (reachesPrimary || leadSecondaryUgL >= 2.2 || resilienceScore0To100 < 35) {
    resilienceStatus = 'GRÆNSEBRUD';
  } else if (leadSecondaryUgL >= 1.0 || reachesSecondary || resilienceScore0To100 < 60) {
    resilienceStatus = 'KRITISK';
  } else if (resilienceScore0To100 < 80) {
    resilienceStatus = 'PRESSET';
  }

  return {
    baseline,
    projected,
    effectiveClimatePrecipMmH,
    effectiveClimateSoilMoisture,
    larMitigationFactor,
    percolationVelocityDeltaPct,
    waterTableRiseTotalM,
    unsaturatedBufferBaselineM,
    unsaturatedBufferProjectedM,
    secondaryBreakthroughDeltaHours,
    leadConcentrationDeltaUgL,
    pahConcentrationDeltaUgL,
    dn200SubsurfaceStressFactor,
    resilienceScore0To100,
    resilienceStatus,
  };
}
