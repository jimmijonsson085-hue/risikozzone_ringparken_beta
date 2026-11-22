import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_DEMOLITION_SOURCES,
  INITIAL_RECEPTOR_ZONES,
  SUBSTANCE_SPECS,
} from '../../data/ringparkenData';
import { HourlyWeatherPoint, ReceptorZone } from '../../types/dispersion';
import {
  buildGaussianPlumePolygon,
  evaluatePointInDispersionPlume,
  evaluateReceptorAtHour,
  generatePlumePolygonsForHour,
  runDispersionSimulation,
} from '../dispersionEngine';

function createTestWeather(overrides: Partial<HourlyWeatherPoint> = {}): HourlyWeatherPoint {
  return {
    isoTime: '2026-07-15T13:00:00Z',
    hourIndex: 13,
    hourLabel: '13:00',
    temperature2m: 16.5,
    relativeHumidity2m: 52,
    precipitation: 0,
    cloudCover: 25,
    windSpeed10m: 6.5,
    windDirection10m: 260, // Wind from WSW -> plume travels toward ENE (80 deg)
    windGusts10m: 10.5,
    soilMoisture0To7cm: 0.24,
    directRadiation: 320,
    weatherCode: 1,
    pasquillClass: 'C',
    hadRecentFreezeThaw: false,
    ...overrides,
  };
}

describe('dispersionEngine - initial demolition sources plume & sum-quotient logic', () => {
  it('includes all four active Ringparken initial demolition sources', () => {
    assert.equal(INITIAL_DEMOLITION_SOURCES.length, 4);
    assert.deepEqual(
      INITIAL_DEMOLITION_SOURCES.map((s) => s.id),
      ['src-bygning-1', 'src-bygning-2', 'src-bygning-3', 'src-blok-1']
    );
    assert.ok(INITIAL_DEMOLITION_SOURCES.every((s) => s.active));
  });

  it('generates yellow, orange, and red plume polygons per active source in dry weather and blue runoff zones in heavy rain', () => {
    const dryWeather = createTestWeather({ precipitation: 0, windDirection10m: 270 });
    const dryZones = generatePlumePolygonsForHour(INITIAL_DEMOLITION_SOURCES, dryWeather);

    // 4 sources x 3 air zones (yellow, orange, red) = 12 zones
    assert.equal(dryZones.length, INITIAL_DEMOLITION_SOURCES.length * 3);
    assert.equal(
      dryZones.filter((z) => z.level === 'blue').length,
      0,
      'Dry weather must not emit blue hydrological runoff zones'
    );

    const expectedPlumeDir = (dryWeather.windDirection10m + 180) % 360;
    for (const src of INITIAL_DEMOLITION_SOURCES) {
      const srcZones = dryZones.filter((z) => z.sourceId === src.id);
      const yellow = srcZones.find((z) => z.level === 'yellow');
      const orange = srcZones.find((z) => z.level === 'orange');
      const red = srcZones.find((z) => z.level === 'red');

      assert.ok(yellow && orange && red, `Expected yellow/orange/red zones for ${src.id}`);
      assert.equal(yellow.plumeDirectionDeg, expectedPlumeDir);
      assert.equal(orange.plumeDirectionDeg, expectedPlumeDir);
      assert.equal(red.plumeDirectionDeg, expectedPlumeDir);

      assert.ok(yellow.downwindDistanceMeters > orange.downwindDistanceMeters);
      assert.ok(orange.downwindDistanceMeters > red.downwindDistanceMeters);
      assert.ok(red.maxSumQuotient >= 1.0);
      assert.ok(red.polygon.length >= 10);
      assert.ok(
        red.polygon.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      );
    }

    const rainyWeather = createTestWeather({ precipitation: 4.8 });
    const rainyZones = generatePlumePolygonsForHour(INITIAL_DEMOLITION_SOURCES, rainyWeather);
    assert.equal(rainyZones.length, INITIAL_DEMOLITION_SOURCES.length * 4);
    assert.equal(
      rainyZones.filter((z) => z.level === 'blue').length,
      INITIAL_DEMOLITION_SOURCES.length
    );
  });

  it('produces zero plumes when demolition sources are inactive or category a_inhabited', () => {
    const weather = createTestWeather();
    const inactiveSources = INITIAL_DEMOLITION_SOURCES.map((s) => ({ ...s, active: false }));
    assert.equal(generatePlumePolygonsForHour(inactiveSources, weather).length, 0);

    const inhabitedSources = INITIAL_DEMOLITION_SOURCES.map((s) => ({
      ...s,
      buildingCategory: 'a_inhabited' as const,
    }));
    assert.equal(generatePlumePolygonsForHour(inhabitedSources, weather).length, 0);
  });

  it('builds closed teardrop Gaussian plume geometry oriented along plumeDirectionDeg', () => {
    const origin = { lat: 55.4129, lng: 11.3522 };
    const eastPlume = buildGaussianPlumePolygon(origin, 90, 200, 80);
    assert.equal(eastPlume.length, 12);

    const maxLng = Math.max(...eastPlume.map((p) => p.lng));
    const minLng = Math.min(...eastPlume.map((p) => p.lng));
    assert.ok(maxLng > origin.lng, 'Eastward plume must extend to greater longitude');
    assert.ok(Math.abs(minLng - origin.lng) < 0.0005, 'Origin edge stays near source longitude');
  });

  it('computes Arbejdstilsynet sum-quotient S = Sum(C_i / GV_i) accurately for initial demolition sources', () => {
    const weather = createTestWeather({
      windDirection10m: 265,
      windSpeed10m: 8.5,
      windGusts10m: 12.0,
      relativeHumidity2m: 44,
      hadRecentFreezeThaw: true,
    });

    const afd23 =
      INITIAL_RECEPTOR_ZONES.find((r) => r.id === 'rec-afd-23') ?? INITIAL_RECEPTOR_ZONES[0];
    const result = evaluateReceptorAtHour(afd23, INITIAL_DEMOLITION_SOURCES, weather);

    assert.equal(result.receptorId, afd23.id);
    assert.equal(result.substances.length, Object.keys(SUBSTANCE_SPECS).length);

    const manualQuotientSum = result.substances.reduce((acc, s) => acc + s.quotient, 0);
    assert.ok(
      Math.abs(result.sumQuotient - manualQuotientSum) <= 0.02,
      `sumQuotient (${result.sumQuotient}) should match sum of substance quotients (${manualQuotientSum})`
    );

    for (const sub of result.substances) {
      assert.equal(sub.limitValue, SUBSTANCE_SPECS[sub.key].limitValue2026);
      if (sub.concentration > 0) {
        const expectedQuotient = sub.concentration / sub.limitValue;
        assert.ok(
          Math.abs(sub.quotient - expectedQuotient) <= 0.05,
          `Quotient for ${sub.key} (${sub.quotient}) should track C/GV (${expectedQuotient})`
        );
      }
    }

    assert.ok(
      result.sumQuotient >= 1.0,
      `Downwind Afd. 23 should reach critical S >= 1.0 under dry gusty WSW wind (got ${result.sumQuotient})`
    );
    assert.equal(result.riskLevel, 'red');
  });

  it('ranks downwind exposure higher than upwind exposure and flags safe far-field receptors', () => {
    const weather = createTestWeather({
      windDirection10m: 270, // Plume goes strictly East (90 deg)
      windSpeed10m: 7.0,
      windGusts10m: 10.0,
    });

    const downwindReceptor: ReceptorZone = {
      id: 'test-downwind',
      code: 'DW',
      name: 'Downwind Test',
      category: 'residential_block',
      address: 'Kierulffsvej East',
      center: { lat: 55.4129, lng: 11.3545 }, // ~145 m east of Blok 1
      polygon: [],
      vulnerableGroupNote: 'Test downwind',
    };

    const upwindReceptor: ReceptorZone = {
      id: 'test-upwind',
      code: 'UW',
      name: 'Upwind Test',
      category: 'residential_block',
      address: 'West of Valbyvej',
      center: { lat: 55.4129, lng: 11.3485 }, // ~235 m west (upwind) of Blok 1
      polygon: [],
      vulnerableGroupNote: 'Test upwind',
    };

    const farReceptor: ReceptorZone = {
      id: 'test-far',
      code: 'FAR',
      name: 'Far Control',
      category: 'custom_receptor',
      address: '5 km away',
      center: { lat: 55.458, lng: 11.3533 },
      polygon: [],
      vulnerableGroupNote: 'Far-field control',
    };

    const dwRes = evaluateReceptorAtHour(downwindReceptor, INITIAL_DEMOLITION_SOURCES, weather);
    const uwRes = evaluateReceptorAtHour(upwindReceptor, INITIAL_DEMOLITION_SOURCES, weather);
    const farRes = evaluateReceptorAtHour(farReceptor, INITIAL_DEMOLITION_SOURCES, weather);

    assert.ok(
      dwRes.sumQuotient > uwRes.sumQuotient * 2,
      `Downwind S (${dwRes.sumQuotient}) must be significantly higher than upwind S (${uwRes.sumQuotient})`
    );
    assert.ok(farRes.sumQuotient < 0.1);
    assert.equal(farRes.riskLevel, 'safe');
  });

  it('amplifies gaseous PCB volatility during hot sunny weather and activates hydrological runoff in heavy rain', () => {
    const blok1 = INITIAL_DEMOLITION_SOURCES.find((s) => s.id === 'src-blok-1')!;
    const target: ReceptorZone = {
      id: 'test-pcb-target',
      code: 'PCB-T',
      name: 'Close Downwind',
      category: 'residential_block',
      address: 'Kierulffsvej 24',
      center: { lat: 55.4129, lng: 11.3538 },
      polygon: [],
      vulnerableGroupNote: 'Test receptor',
    };

    const coolCloudy = createTestWeather({
      temperature2m: 10,
      directRadiation: 60,
      windDirection10m: 270,
    });
    const hotSunny = createTestWeather({
      temperature2m: 28,
      directRadiation: 680,
      windDirection10m: 270,
    });

    const coolRes = evaluateReceptorAtHour(target, [blok1], coolCloudy);
    const hotRes = evaluateReceptorAtHour(target, [blok1], hotSunny);

    const coolPcb = coolRes.substances.find((s) => s.key === 'pcb')!.concentration;
    const hotPcb = hotRes.substances.find((s) => s.key === 'pcb')!.concentration;
    assert.ok(
      hotPcb > coolPcb * 2,
      `Hot sunny weather PCB (${hotPcb}) should exceed cool cloudy PCB (${coolPcb})`
    );

    const heavyRain = createTestWeather({ precipitation: 5.5, windDirection10m: 270 });
    const rainRes = evaluateReceptorAtHour(target, [blok1], heavyRain);
    assert.equal(rainRes.hydrologicalRunoffActive, true);
  });

  it('corroborates downwind observations inside the mathematical plume and executes full simulation', () => {
    const weatherHours: HourlyWeatherPoint[] = Array.from({ length: 24 }, (_, idx) =>
      createTestWeather({
        hourIndex: idx,
        hourLabel: `${String(idx).padStart(2, '0')}:00`,
        isoTime: `2026-07-15T${String(idx).padStart(2, '0')}:00:00Z`,
        windDirection10m: 265,
        windSpeed10m: idx >= 10 && idx <= 16 ? 8.0 : 4.2,
        windGusts10m: idx >= 10 && idx <= 16 ? 12.2 : 6.5,
      })
    );

    const downwindPoint = { lat: 55.4129, lng: 11.3536 }; // Just east of Blok 1
    const corroboration = evaluatePointInDispersionPlume(
      downwindPoint,
      INITIAL_DEMOLITION_SOURCES,
      weatherHours[13],
      'Støvfane & Asbest-støv'
    );
    assert.equal(corroboration.isInsideMathematicalPlume, true);
    assert.ok(['red', 'orange', 'yellow', 'blue'].includes(corroboration.matchedZoneLevel));

    const farPoint = { lat: 55.46, lng: 11.42 };
    const farCorroboration = evaluatePointInDispersionPlume(
      farPoint,
      INITIAL_DEMOLITION_SOURCES,
      weatherHours[13],
      'Kontrol'
    );
    assert.equal(farCorroboration.isInsideMathematicalPlume, false);
    assert.equal(farCorroboration.matchedZoneLevel, 'outside');

    const sim = runDispersionSimulation(
      '2026-07-15',
      13,
      weatherHours,
      INITIAL_DEMOLITION_SOURCES,
      INITIAL_RECEPTOR_ZONES
    );
    assert.equal(sim.receptorExposures.length, INITIAL_RECEPTOR_ZONES.length);
    assert.equal(sim.worstExposedReceptor.receptorId, sim.receptorExposures[0].receptorId);
    assert.ok(sim.maxSiteSumQuotient >= sim.worstExposedReceptor.sumQuotient);
    for (let i = 1; i < sim.receptorExposures.length; i++) {
      assert.ok(
        sim.receptorExposures[i - 1].sumQuotient >= sim.receptorExposures[i].sumQuotient,
        'receptorExposures must be sorted descending by sumQuotient'
      );
    }
  });
});
