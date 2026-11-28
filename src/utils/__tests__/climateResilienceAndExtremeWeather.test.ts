import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  INITIAL_DEMOLITION_SOURCES,
  INITIAL_RECEPTOR_ZONES,
} from '../../data/ringparkenData';
import {
  CLIMATE_HORIZON_PRESETS,
  ClimateResilienceConfig,
  computeClimateResiliencePercolation,
  DEFAULT_CLIMATE_RESILIENCE_CONFIG,
} from '../climateResiliencePercolation';
import {
  buildWeatherDatasetFromHistoricalExtremeScenario,
  evaluateHistoricalExtremeScenarioRisk,
  HISTORICAL_EXTREME_WEATHER_SCENARIOS,
} from '../historicalExtremeWeatherScenarios';

describe('Historical extreme weather scenarios (Ringparken / Slagelse)', () => {
  it('provides 6 historical extreme episodes with complete 24-hour profiles', () => {
    assert.equal(HISTORICAL_EXTREME_WEATHER_SCENARIOS.length, 6);
    for (const sc of HISTORICAL_EXTREME_WEATHER_SCENARIOS) {
      const hours = sc.generate24Hours(sc.dateIso);
      assert.equal(hours.length, 24);
      assert.ok(sc.focusHourIndex >= 0 && sc.focusHourIndex < 24);
      for (const hr of hours) {
        assert.ok(Number.isFinite(hr.windSpeed10m));
        assert.ok(Number.isFinite(hr.precipitation));
        assert.ok(hr.soilMoisture0To7cm > 0 && hr.soilMoisture0To7cm <= 0.6);
        assert.ok(['A', 'B', 'C', 'D', 'E', 'F'].includes(hr.pasquillClass));
      }
    }
  });

  it('triggers elevated air dispersion quotient during storm scenarios (>= 14 m/s)', () => {
    const stormScenarios = HISTORICAL_EXTREME_WEATHER_SCENARIOS.filter(
      (sc) => sc.category === 'storm'
    );
    assert.ok(stormScenarios.length >= 2);

    for (const sc of stormScenarios) {
      const hours = sc.generate24Hours(sc.dateIso);
      const maxWind = Math.max(...hours.map((h) => h.windSpeed10m));
      assert.ok(maxWind >= 14.0, `${sc.id} maxWind=${maxWind}`);

      const risk = evaluateHistoricalExtremeScenarioRisk(
        sc,
        INITIAL_DEMOLITION_SOURCES,
        INITIAL_RECEPTOR_ZONES
      );
      assert.ok(risk.maxSumQuotient > 0.3, `${sc.id} maxSumQuotient=${risk.maxSumQuotient}`);
      assert.ok(risk.worstReceptorCode.length > 0);
      assert.equal(risk.scenarioId, sc.id);
    }
  });

  it('triggers critical hydrogeological percolation during cloudburst (skybrud) scenarios (>= 30 mm/h)', () => {
    const skybrudScenarios = HISTORICAL_EXTREME_WEATHER_SCENARIOS.filter(
      (sc) => sc.category === 'skybrud'
    );
    assert.ok(skybrudScenarios.length >= 2);

    for (const sc of skybrudScenarios) {
      const hours = sc.generate24Hours(sc.dateIso);
      const maxPrecip = Math.max(...hours.map((h) => h.precipitation));
      assert.ok(maxPrecip >= 30.0, `${sc.id} maxPrecip=${maxPrecip}`);

      const risk = evaluateHistoricalExtremeScenarioRisk(
        sc,
        INITIAL_DEMOLITION_SOURCES,
        INITIAL_RECEPTOR_ZONES
      );
      assert.equal(risk.hydroSim.riskLevel, 'CRITICAL_SKIBRUD');
      assert.ok(
        risk.primaryRiskDomain === 'HYDRO_PERCOLATION' ||
          risk.primaryRiskDomain === 'DUAL_COMBINED'
      );
      assert.ok(risk.hydroSim.plumeMaxDepthMeters > 8);
    }
  });

  it('builds a WeatherDataset override cleanly from a selected extreme scenario', () => {
    const otto = HISTORICAL_EXTREME_WEATHER_SCENARIOS[0];
    const ds = buildWeatherDatasetFromHistoricalExtremeScenario(otto);
    assert.equal(ds.dateIso, otto.dateIso);
    assert.equal(ds.isScenarioOverride, true);
    assert.equal(ds.hours.length, 24);
    assert.ok(ds.sourceApi.includes(otto.shortTitle));
  });
});

describe('Climate resilience & 3D underground percolation engine', () => {
  it('exposes calibrated horizon presets and default 2070 configuration', () => {
    assert.equal(CLIMATE_HORIZON_PRESETS.length, 4);
    assert.equal(DEFAULT_CLIMATE_RESILIENCE_CONFIG.horizonId, 'rcp45_2070');
    assert.equal(DEFAULT_CLIMATE_RESILIENCE_CONFIG.enabled, false);
  });

  it('amplifies percolation velocity, plume depth, groundwater uplift, and lead leaching under RCP8.5 2100', () => {
    const baselinePreset = CLIMATE_HORIZON_PRESETS.find((p) => p.id === 'baseline_2026')!;
    const extremePreset = CLIMATE_HORIZON_PRESETS.find((p) => p.id === 'rcp85_2100')!;

    const baseConfig: ClimateResilienceConfig = {
      enabled: false,
      horizonId: baselinePreset.id,
      horizonLabel: baselinePreset.fullLabel,
      precipitationIncreasePct: baselinePreset.precipitationIncreasePct,
      cloudburstSurgeMmH: baselinePreset.cloudburstSurgeMmH,
      groundwaterTableRiseM: baselinePreset.groundwaterTableRiseM,
      soilSaturationBoost: baselinePreset.soilSaturationBoost,
      freezeThawMacroporeAmplificationPct: baselinePreset.freezeThawMacroporeAmplificationPct,
      larRetentionActive: false,
    };

    const extremeConfig: ClimateResilienceConfig = {
      enabled: true,
      horizonId: extremePreset.id,
      horizonLabel: extremePreset.fullLabel,
      precipitationIncreasePct: extremePreset.precipitationIncreasePct,
      cloudburstSurgeMmH: extremePreset.cloudburstSurgeMmH,
      groundwaterTableRiseM: extremePreset.groundwaterTableRiseM,
      soilSaturationBoost: extremePreset.soilSaturationBoost,
      freezeThawMacroporeAmplificationPct: extremePreset.freezeThawMacroporeAmplificationPct,
      larRetentionActive: false,
    };

    const baseRes = computeClimateResiliencePercolation(4.0, 0.28, false, 3, 2, baseConfig);
    const extremeRes = computeClimateResiliencePercolation(4.0, 0.28, false, 3, 2, extremeConfig);

    assert.ok(extremeRes.effectiveClimatePrecipMmH > baseRes.effectiveClimatePrecipMmH);
    assert.ok(
      extremeRes.projected.macroporeVelocityMetersPerDay >
        baseRes.projected.macroporeVelocityMetersPerDay
    );
    assert.ok(
      extremeRes.projected.secondaryWaterTableDepthM <
        baseRes.projected.secondaryWaterTableDepthM
    );
    assert.ok(extremeRes.unsaturatedBufferProjectedM < baseRes.unsaturatedBufferProjectedM);
    assert.ok(extremeRes.projected.plumeMaxDepthMeters > baseRes.projected.plumeMaxDepthMeters);
    assert.ok(
      extremeRes.projected.leadConcentrationSecondaryUgL >
        baseRes.projected.leadConcentrationSecondaryUgL
    );
    assert.ok(extremeRes.resilienceScore0To100 < baseRes.resilienceScore0To100);
    assert.ok(
      extremeRes.resilienceStatus === 'KRITISK' ||
        extremeRes.resilienceStatus === 'GRÆNSEBRUD'
    );
  });

  it('reduces effective infiltration stress and lead leaching when LAR retention is activated', () => {
    const rcp70 = CLIMATE_HORIZON_PRESETS.find((p) => p.id === 'rcp45_2070')!;
    const unmitigated: ClimateResilienceConfig = {
      enabled: true,
      horizonId: rcp70.id,
      horizonLabel: rcp70.fullLabel,
      precipitationIncreasePct: rcp70.precipitationIncreasePct,
      cloudburstSurgeMmH: rcp70.cloudburstSurgeMmH,
      groundwaterTableRiseM: rcp70.groundwaterTableRiseM,
      soilSaturationBoost: rcp70.soilSaturationBoost,
      freezeThawMacroporeAmplificationPct: rcp70.freezeThawMacroporeAmplificationPct,
      larRetentionActive: false,
    };
    const withLar: ClimateResilienceConfig = {
      ...unmitigated,
      larRetentionActive: true,
    };

    const resOff = computeClimateResiliencePercolation(6.0, 0.31, true, 3, 2, unmitigated);
    const resOn = computeClimateResiliencePercolation(6.0, 0.31, true, 3, 2, withLar);

    assert.equal(resOff.larMitigationFactor, 1.0);
    assert.equal(resOn.larMitigationFactor, 0.55);
    assert.ok(resOn.effectiveClimatePrecipMmH < resOff.effectiveClimatePrecipMmH);
    assert.ok(resOn.projected.leadConcentrationSecondaryUgL < resOff.projected.leadConcentrationSecondaryUgL);
    assert.ok(resOn.dn200SubsurfaceStressFactor < resOff.dn200SubsurfaceStressFactor);
    assert.ok(resOn.resilienceScore0To100 > resOff.resilienceScore0To100);
  });
});
