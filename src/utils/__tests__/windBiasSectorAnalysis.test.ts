import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  INITIAL_DEMOLITION_SOURCES,
  INITIAL_RECEPTOR_ZONES,
} from '../../data/ringparkenData';
import { compute24HourPuffHistory } from '../../services/dispersionEngine';
import { HourlyWeatherPoint } from '../../types/dispersion';
import {
  COMPASS_SECTORS_8,
  compassSectorIndexFromDeg,
  computeWindBias24hAnalysis,
  signedAngleDeltaDeg,
} from '../windBiasSectorAnalysis';

function makeWeatherHour(
  hourIndex: number,
  windDirection10m: number,
  windSpeed10m = 7.2,
  windGusts10m = 10.4
): HourlyWeatherPoint {
  return {
    isoTime: `2026-04-15T${String(hourIndex).padStart(2, '0')}:00:00Z`,
    hourIndex,
    hourLabel: `${String(hourIndex).padStart(2, '0')}:00`,
    temperature2m: 12,
    relativeHumidity2m: 60,
    precipitation: 0,
    cloudCover: 35,
    windSpeed10m,
    windDirection10m,
    windGusts10m,
    soilMoisture0To7cm: 0.2,
    directRadiation: 360,
    weatherCode: 1,
    pasquillClass: 'D',
    hadRecentFreezeThaw: false,
  };
}

describe('windBiasSectorAnalysis', () => {
  it('wraps signed angular delta across 0/360 boundary accurately', () => {
    assert.equal(signedAngleDeltaDeg(10, 350), 20);
    assert.equal(signedAngleDeltaDeg(350, 10), -20);
    assert.equal(signedAngleDeltaDeg(180, 180), 0);
  });

  it('maps azimuth degrees to the expected 8 compass sectors', () => {
    assert.equal(compassSectorIndexFromDeg(0), 0); // N
    assert.equal(compassSectorIndexFromDeg(45), 1); // NØ
    assert.equal(compassSectorIndexFromDeg(225), 5); // SV
    assert.equal(compassSectorIndexFromDeg(355), 0); // N
  });

  it('computes 24h sector statistics, dominant sector, and over/underestimation verdicts', () => {
    const hours = Array.from({ length: 24 }, (_, idx) =>
      makeWeatherHour(idx, idx < 16 ? 245 : 210, 6.5 + (idx % 5), 10 + (idx % 6))
    );
    const currentWeather = hours[12];
    const puff24h = compute24HourPuffHistory(
      '2026-04-15',
      hours,
      INITIAL_DEMOLITION_SOURCES,
      INITIAL_RECEPTOR_ZONES
    );

    const summary = computeWindBias24hAnalysis({
      hours,
      currentWeather,
      dateIso: '2026-04-15',
      puff24h,
    });

    assert.equal(summary.sectors.length, COMPASS_SECTORS_8.length);
    assert.equal(summary.hourlyTrajectory.length, 24);
    assert.equal(summary.currentPlumePathToDeg, (currentWeather.windDirection10m + 180) % 360);

    const totalHoursCount = summary.sectors.reduce((acc, s) => acc + s.hoursCount, 0);
    assert.equal(totalHoursCount, 24);
    assert.ok(summary.dominant24hSector.hoursCount > 0);

    for (const s of summary.sectors) {
      if (s.hoursCount > 0) {
        const expectedDelta = Number(
          (s.modeledMeanSumQuotient - s.stationAdjustedMeanSumQuotient).toFixed(2)
        );
        assert.equal(s.exposureDeltaS, expectedDelta);
        assert.ok(['OVERESTIMATES', 'UNDERESTIMATES', 'ALIGNED'].includes(s.verdict));
      }
    }
  });
});
