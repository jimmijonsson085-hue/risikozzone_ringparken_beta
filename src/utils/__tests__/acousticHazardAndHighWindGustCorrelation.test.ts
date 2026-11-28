import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeGustMachineImpulseStatistics,
  computeHighWindGustImpulseAnalysis,
} from '../gustNoiseStatistics';
import { computeAcousticHazardHeatmap } from '../acousticHazardHeatmap';
import {
  INITIAL_DEMOLITION_SOURCES,
  INITIAL_RECEPTOR_ZONES,
} from '../../data/ringparkenData';
import { HourlyWeatherPoint } from '../../types/dispersion';
import { buildLast24HoursFromOpenMeteoResponse } from '../../services/weatherService';
import { computeOpenMeteoWindImpulseCorrelation } from '../openMeteoWindImpulseCorrelation';
import { computeRollingGustCumulativeDustCorrelation } from '../rollingGustDustDepositionCorrelation';

function makeWeatherHour(
  hourIndex: number,
  windSpeed10m: number,
  windGusts10m: number,
  windDirection10m = 250,
  pasquillClass: HourlyWeatherPoint['pasquillClass'] = 'D'
): HourlyWeatherPoint {
  return {
    isoTime: `2026-04-14T${String(hourIndex).padStart(2, '0')}:00:00Z`,
    hourIndex,
    hourLabel: `${String(hourIndex).padStart(2, '0')}:00`,
    temperature2m: 11.2,
    relativeHumidity2m: 66,
    precipitation: 0,
    cloudCover: 35,
    windSpeed10m,
    windDirection10m,
    windGusts10m,
    soilMoisture0To7cm: 0.21,
    directRadiation: 360,
    weatherCode: 2,
    pasquillClass,
    hadRecentFreezeThaw: false,
  };
}

describe('High-Wind Gust (>10 m/s) vs. Peak Impulse Noise Statistical Correlation', () => {
  const weatherHours: HourlyWeatherPoint[] = Array.from({ length: 24 }, (_, hr) => {
    // Daytime high-wind gust storm window between 10:00 and 15:00
    if (hr >= 10 && hr <= 15) {
      const gust = 11.5 + (hr - 10) * 1.1; // 11.5 .. 17.0 m/s
      const wind = 8.5 + (hr - 10) * 0.6;
      return makeWeatherHour(hr, wind, gust, 240, 'D');
    }
    // Calm baseline hours
    return makeWeatherHour(hr, 4.2, 6.4, 240, 'C');
  });

  it('isolates >10 m/s gust hours, computes positive correlation and impulse amplification delta', () => {
    const analysis = computeHighWindGustImpulseAnalysis({
      weatherHours,
      machineLwaDb: 118.0,
      impulsePenaltyDb: 14.5,
      distanceMeters: 45,
      activeSourcesCount: 2,
    });

    assert.equal(analysis.highGustThresholdMs, 10.0);
    assert.equal(analysis.highGustHoursCount, 6);
    assert.equal(analysis.calmHoursCount, 18);
    assert.ok(analysis.overallPearsonR > 0.7, `Expected strong r, got ${analysis.overallPearsonR}`);
    assert.ok(
      analysis.highGustSubgroupPearsonR > 0.9,
      `Expected monotonic positive >10 m/s subgroup r, got ${analysis.highGustSubgroupPearsonR}`
    );
    assert.ok(
      analysis.meanAmplificationDeltaDb > 1.5,
      `Expected >1.5 dB amplification under >10 m/s gusts, got ${analysis.meanAmplificationDeltaDb}`
    );
    assert.ok(
      analysis.meanImpulseHighGustDb > analysis.meanImpulseCalmDb,
      'High-wind gust mean impulse noise must exceed calm baseline'
    );
    assert.ok(
      analysis.peakImpulseHighGustDb >= 85.0,
      `Expected Betonknusning peak impulse >= 85 dB under 17 m/s gust, got ${analysis.peakImpulseHighGustDb}`
    );
    assert.ok(analysis.stopWorkEventCount >= 1);
  });

  it('classifies heavy concrete crushing as STOP_WORK vs indoor remediation as non-stop under >10 m/s gusts', () => {
    const analysis = computeHighWindGustImpulseAnalysis({
      weatherHours,
      machineLwaDb: 118.0,
      distanceMeters: 45,
    });

    const concreteCrusher = analysis.operationalScenarios.find(
      (s) => s.modeId === 'hydraulisk_betonknusning'
    );
    const indoorRemediation = analysis.operationalScenarios.find(
      (s) => s.modeId === 'manuel_sanering'
    );

    assert.ok(concreteCrusher);
    assert.ok(indoorRemediation);
    assert.equal(concreteCrusher.riskTier, 'STOP_WORK');
    assert.notEqual(indoorRemediation.riskTier, 'STOP_WORK');
    assert.ok(
      concreteCrusher.peakImpulseDuringHighGustDb >
        indoorRemediation.peakImpulseDuringHighGustDb + 12
    );
  });

  it('preserves backwards compatibility of computeGustMachineImpulseStatistics', () => {
    const legacy = computeGustMachineImpulseStatistics({
      weatherHours,
      machineLwaDb: 118,
      impulsePenaltyDb: 14.5,
    });
    assert.equal(legacy.sampleCount, 24);
    assert.ok(legacy.pearsonR > 0);
  });
});

describe('2D Dynamic Acoustic Hazard Heatmap Spatial Engine', () => {
  const calmWeather = makeWeatherHour(12, 2.0, 3.0, 270, 'D');
  const strongWestWindInversion = makeWeatherHour(12, 11.5, 16.0, 270, 'F');

  it('scales spatially and monotonically when demolition machinery L_WA increases from 96 dB to 122 dB', () => {
    const lowNoise = computeAcousticHazardHeatmap({
      sources: INITIAL_DEMOLITION_SOURCES,
      receptors: INITIAL_RECEPTOR_ZONES,
      currentWeather: calmWeather,
      baseMachineLwaDb: 96,
    });

    const highNoise = computeAcousticHazardHeatmap({
      sources: INITIAL_DEMOLITION_SOURCES,
      receptors: INITIAL_RECEPTOR_ZONES,
      currentWeather: calmWeather,
      baseMachineLwaDb: 122,
    });

    assert.ok(highNoise.peakGridLafmaxDb > lowNoise.peakGridLafmaxDb + 20);
    assert.ok(highNoise.peakGridLaeqDb > lowNoise.peakGridLaeqDb + 20);
    assert.ok(highNoise.criticalCellCount >= lowNoise.criticalCellCount);
  });

  it('applies downwind refraction boost and upwind shadow attenuation under strong wind & Pasquill F inversion', () => {
    const calmResult = computeAcousticHazardHeatmap({
      sources: INITIAL_DEMOLITION_SOURCES,
      receptors: INITIAL_RECEPTOR_ZONES,
      currentWeather: calmWeather,
      baseMachineLwaDb: 114,
    });

    const windyResult = computeAcousticHazardHeatmap({
      sources: INITIAL_DEMOLITION_SOURCES,
      receptors: INITIAL_RECEPTOR_ZONES,
      currentWeather: strongWestWindInversion,
      baseMachineLwaDb: 114,
    });

    assert.equal(windyResult.plumeDownwindDeg, 90); // Wind FROM 270° (W) refracts toward 90° (E)
    assert.ok(windyResult.downwindWindRefractionDb > calmResult.downwindWindRefractionDb + 3.0);
    assert.ok(windyResult.thermalRefractionDb > calmResult.thermalRefractionDb);

    // Downwind cells (east of sources, downwindAlignmentCos > 0.7) must receive higher refraction than upwind cells
    const downwindCells = windyResult.cells.filter((c) => c.downwindAlignmentCos > 0.7);
    const upwindCells = windyResult.cells.filter((c) => c.downwindAlignmentCos < -0.7);
    assert.ok(downwindCells.length > 0 && upwindCells.length > 0);

    const meanDownwindRefr =
      downwindCells.reduce((a, c) => a + c.windRefractionDb, 0) / downwindCells.length;
    const meanUpwindRefr =
      upwindCells.reduce((a, c) => a + c.windRefractionDb, 0) / upwindCells.length;
    assert.ok(
      meanDownwindRefr > meanUpwindRefr + 5.0,
      `Expected downwind refraction >> upwind shadow (${meanDownwindRefr} vs ${meanUpwindRefr})`
    );
  });

  it('drops to baseline ambient noise when all demolition sources are inactive', () => {
    const inactiveSources = INITIAL_DEMOLITION_SOURCES.map((s) => ({
      ...s,
      active: false,
    }));

    const result = computeAcousticHazardHeatmap({
      sources: inactiveSources,
      receptors: INITIAL_RECEPTOR_ZONES,
      currentWeather: strongWestWindInversion,
      baseMachineLwaDb: 118,
    });

    assert.equal(result.activeSourcesCount, 0);
    assert.equal(result.criticalCellCount, 0);
    assert.equal(result.renderedCells.length, 0);
    assert.equal(result.hazardZoneContours.length, 0);
    assert.ok(result.peakGridLafmaxDb <= 46);
  });

  it('projects directional 85/75/65 dB acoustic hazard zone contours further downwind than upwind', () => {
    const result = computeAcousticHazardHeatmap({
      sources: INITIAL_DEMOLITION_SOURCES,
      receptors: INITIAL_RECEPTOR_ZONES,
      currentWeather: strongWestWindInversion,
      baseMachineLwaDb: 118,
    });

    const activeCount = INITIAL_DEMOLITION_SOURCES.filter((s) => s.active).length;
    assert.equal(result.hazardZoneContours.length, activeCount * 3);
    const critZone = result.hazardZoneContours.find((z) => z.thresholdDb === 85);
    assert.ok(critZone);
    assert.equal(critZone.polygon.length, 24);
    assert.ok(
      critZone.downwindRadiusM > critZone.upwindRadiusM,
      `Expected downwind 85 dB reach (${critZone.downwindRadiusM}m) > upwind (${critZone.upwindRadiusM}m)`
    );
  });
});

describe('Open-Meteo 24-Hour Wind Speed (m/s) vs. Impulse Noise (dB) Correlation', () => {
  it('extracts exact trailing 24 hours up to reference time from Open-Meteo response', () => {
    const times: string[] = [];
    const windSpeeds: number[] = [];
    const gusts: number[] = [];
    const dirs: number[] = [];

    for (let day = 26; day <= 27; day++) {
      for (let h = 0; h < 24; h++) {
        times.push(`2026-11-${day}T${String(h).padStart(2, '0')}:00`);
        windSpeeds.push(Number((3.0 + ((day - 26) * 24 + h) * 0.25).toFixed(1)));
        gusts.push(Number((4.5 + ((day - 26) * 24 + h) * 0.35).toFixed(1)));
        dirs.push(240);
      }
    }

    const refDate = new Date('2026-11-27T11:30:00Z'); // 12:30 CET
    const trailing24 = buildLast24HoursFromOpenMeteoResponse(
      {
        hourly: {
          time: times,
          wind_speed_10m: windSpeeds,
          wind_gusts_10m: gusts,
          wind_direction_10m: dirs,
        },
      },
      refDate
    );

    assert.ok(trailing24);
    assert.equal(trailing24.length, 24);
    assert.equal(trailing24[trailing24.length - 1].isoTime, '2026-11-27T12:00');
    assert.equal(trailing24[0].isoTime, '2026-11-26T13:00');
  });

  it('computes strong positive Pearson r and slope when Open-Meteo wind speed rises across 24h', () => {
    const risingWindHours: HourlyWeatherPoint[] = Array.from({ length: 24 }, (_, idx) =>
      makeWeatherHour(idx, Number((2.5 + idx * 0.4).toFixed(1)), Number((4.0 + idx * 0.55).toFixed(1)), 245, 'D')
    );

    const summary = computeOpenMeteoWindImpulseCorrelation({
      weatherHours: risingWindHours,
      machineLwaDb: 114,
      impulsePenaltyDb: 14.5,
      distanceMeters: 45,
      ignoreWorkScheduleAttenuation: true,
    });

    assert.equal(summary.sampleCount, 24);
    assert.ok(summary.pearsonR > 0.95, `Expected r > 0.95, got ${summary.pearsonR}`);
    assert.ok(summary.slopeDbPerMs > 0.4, `Expected positive dB/(m/s) slope, got ${summary.slopeDbPerMs}`);
    assert.equal(summary.minWindSpeedMs, 2.5);
    assert.equal(summary.maxWindSpeedMs, 11.7);
  });
});

describe('Rolling Correlation: Open-Meteo Wind Gusts (>10 m/s) vs. Cumulative Respirable Dust Deposition', () => {
  it('tracks monotonically increasing cumulative dust (µg/m²) and flags high-risk/critical gust events', () => {
    const stormHours: HourlyWeatherPoint[] = Array.from({ length: 24 }, (_, hr) => {
      if (hr >= 9 && hr <= 15) {
        const wind = Number((6.2 + (hr - 9) * 0.65).toFixed(1));
        const gust = Number((9.5 + (hr - 9) * 1.1).toFixed(1)); // crosses >10 m/s cleanly
        return makeWeatherHour(hr, wind, gust, 250, 'D');
      }
      return makeWeatherHour(hr, 3.8, 5.9, 250, 'C');
    });

    const summary = computeRollingGustCumulativeDustCorrelation({
      weatherHours: stormHours,
      windowSpanHours: 6,
      gustThresholdMs: 10.0,
    });

    assert.equal(summary.sampleCount, 24);
    assert.equal(summary.highGustHoursCount, 6); // hours 10..15 have gust >= 10.6 m/s
    assert.ok(summary.totalCumulativeDustUgM2 > 50);
    assert.ok(
      summary.dustResuspensionMultiplier > 1.5,
      `Expected >1.5x dust deposition under >10 m/s gusts, got ${summary.dustResuspensionMultiplier}`
    );
    assert.ok(
      summary.peakRollingR > 0.7,
      `Expected strong rolling r > 0.7 during rising gust storm, got ${summary.peakRollingR}`
    );
    assert.ok(
      summary.highRiskEventCount >= 2,
      `Expected multiple high-risk/critical weather events, got ${summary.highRiskEventCount}`
    );

    // Cumulative dust must strictly never decrease
    for (let i = 1; i < summary.points.length; i++) {
      assert.ok(
        summary.points[i].cumulativeDustUgM2 >= summary.points[i - 1].cumulativeDustUgM2,
        'Cumulative dust deposition must increase monotonically across 24h'
      );
    }
  });
});


