import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildHighWindContingencyPlan } from '../highWindContingencyPlan';
import { computeAcousticPlumeVisualization } from '../acousticPlumeVisualization';
import {
  INITIAL_DEMOLITION_SOURCES,
  INITIAL_RECEPTOR_ZONES,
} from '../../data/ringparkenData';
import {
  AlgedonicObservation,
  HourlyWeatherPoint,
  ReceptorExposureResult,
} from '../../types/dispersion';

function makeWeather(
  windSpeed10m: number,
  windDirection10m = 240,
  windGusts10m?: number
): HourlyWeatherPoint {
  return {
    isoTime: '2026-11-27T14:00:00Z',
    hourIndex: 14,
    hourLabel: '14:00',
    temperature2m: 9.2,
    relativeHumidity2m: 74,
    precipitation: 0,
    cloudCover: 60,
    windSpeed10m,
    windDirection10m,
    windGusts10m: windGusts10m ?? Number((windSpeed10m * 1.35).toFixed(1)),
    soilMoisture0To7cm: 0.21,
    directRadiation: 180,
    weatherCode: 3,
    pasquillClass: 'D',
    hadRecentFreezeThaw: false,
  };
}

function makeReceptorExposures(): ReceptorExposureResult[] {
  return INITIAL_RECEPTOR_ZONES.map((rec, idx) => ({
    receptorId: rec.id,
    receptorName: rec.name,
    receptorCode: rec.code,
    address: rec.address,
    category: rec.category,
    position: rec.center,
    distanceFromNearestSourceMeters: 35 + idx * 18,
    dominantSourceName: INITIAL_DEMOLITION_SOURCES[0].name,
    sumQuotient: idx === 0 ? 1.35 : 0.42,
    riskLevel: idx === 0 ? 'red' : 'yellow',
    hydrologicalRunoffActive: false,
    substances: [],
  }));
}

describe('Høj-Vind Beredskabsplan (>10 m/s)', () => {
  it('aktiveres automatisk når vindhastigheden overstiger 10,0 m/s og indeholder alle 3 tjeklistekategorier', () => {
    const highWindWeather = makeWeather(12.4, 240, 17.8);
    const plan = buildHighWindContingencyPlan({
      dateIso: '2026-11-27',
      currentWeather: highWindWeather,
      weatherHours: [makeWeather(6.5), highWindWeather],
      sources: INITIAL_DEMOLITION_SOURCES,
      receptors: INITIAL_RECEPTOR_ZONES,
      receptorExposures: makeReceptorExposures(),
      manualMachineNoiseOutputDb: 116,
      isManualMachineNoiseOverrideActive: true,
      sha256Hash: 'abc123def456',
    });

    assert.equal(plan.isHighWindTriggered, true);
    assert.equal(plan.windThresholdMs, 10.0);
    assert.equal(plan.highWindHoursIn24hCount, 1);
    assert.equal(plan.dustSuppressionChecklist.length, 3);
    assert.equal(plan.machineryStopChecklist.length, 3);
    assert.equal(plan.neighborNotificationChecklist.length, 3);
    assert.equal(plan.allChecklistItems.length, 9);
    assert.equal(plan.topExposedReceptors.length, 3);
    assert.ok(plan.exposedReceptorsRanked.length >= 3);
  });

  it('forbliver i beredskabsstatus (ikke udløst) ved vind <= 10,0 m/s', () => {
    const calmWeather = makeWeather(9.8, 240, 12.1);
    const plan = buildHighWindContingencyPlan({
      dateIso: '2026-11-27',
      currentWeather: calmWeather,
      weatherHours: [calmWeather],
      sources: INITIAL_DEMOLITION_SOURCES,
      receptors: INITIAL_RECEPTOR_ZONES,
      receptorExposures: makeReceptorExposures(),
    });

    assert.equal(plan.isHighWindTriggered, false);
    assert.equal(plan.highWindHoursIn24hCount, 0);
  });
});

describe('Akustisk Fane-Visualisering (2D Impulsstøj-Fane & Naboklage-Feedback)', () => {
  it('beregner 65/75/85 dB retningsfaner langs nedvindsretningen og bekræfter nedvinds naboklage', () => {
    const src = INITIAL_DEMOLITION_SOURCES.find((s) => s.active) ?? INITIAL_DEMOLITION_SOURCES[0];
    // Wind FROM 270 deg (West) => plume goes TO 90 deg (East)
    const weather = makeWeather(11.2, 270, 15.0);

    // Place one complaint ~55m strictly East (downwind) and one ~140m strictly West (upwind)
    const mLng = 111320 * Math.cos((src.position.lat * Math.PI) / 180);
    const downwindObs: AlgedonicObservation = {
      id: 'obs-downwind',
      code: 'KLG-01',
      createdAtIso: '2026-11-27T14:05:00Z',
      observedDateIso: '2026-11-27',
      observedHourIndex: 14,
      observedHourLabel: '14:00',
      observedTimestampIso: '2026-11-27T14:05:00Z',
      position: {
        lat: src.position.lat,
        lng: src.position.lng + 55 / mLng,
      },
      locationLabel: 'Ringparken Øst (Nedvind)',
      reporterRole: 'Beboer (Ringparken)',
      reporterIdentifier: 'Beboer A',
      evidenceCategory: 'Beboerklage',
      observationType: 'Impulsstøj',
      description: 'Kraftige hydrauliske slag hørt tydeligt øst for blokken.',
      weatherSnapshot: weather,
      plumeCorroboration: {
        isInsideMathematicalPlume: true,
        matchedZoneLevel: 'red',
        zoneLabel: 'Rød zone',
        calculatedSumQuotient: 1.1,
        nearestSourceId: src.id,
        nearestSourceName: src.name,
        distanceFromSourceMeters: 55,
        bearingFromSourceDeg: 90,
        plumeDirectionDeg: 90,
        angularDeviationDeg: 0,
        corroborationSummary: 'Direkte nedvinds',
        violatedRegulations: [],
      },
      sha256Signature: 'sig-1',
    };

    const upwindObs: AlgedonicObservation = {
      ...downwindObs,
      id: 'obs-upwind',
      code: 'KLG-02',
      position: {
        lat: src.position.lat,
        lng: src.position.lng - 140 / mLng,
      },
      locationLabel: 'Vest for plads (Modvind)',
    };

    const result = computeAcousticPlumeVisualization({
      sources: [src],
      observations: [downwindObs, upwindObs],
      currentWeather: weather,
      manualMachineNoiseOutputDb: 116,
      isManualMachineNoiseOverrideActive: true,
    });

    assert.equal(result.plumeDownwindDeg, 90);
    assert.equal(result.activeSourceFans.length, 1);
    assert.equal(result.activeSourceFans[0].bands.length, 3);
    assert.deepEqual(
      result.activeSourceFans[0].bands.map((b) => b.thresholdDb),
      [65, 75, 85]
    );
    assert.equal(result.complaintsTotalCount, 2);
    assert.equal(result.complaintsInsidePlumeCount, 1);

    const fbDown = result.complaintFeedbacks.find((f) => f.observationId === 'obs-downwind');
    const fbUp = result.complaintFeedbacks.find((f) => f.observationId === 'obs-upwind');
    assert.ok(fbDown && fbDown.isInsideAcousticPlume);
    assert.ok(fbUp && !fbUp.isInsideAcousticPlume);
  });
});
