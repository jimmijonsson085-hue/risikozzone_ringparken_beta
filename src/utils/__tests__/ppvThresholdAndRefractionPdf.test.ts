import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIN_4150_3_PPV_LIMIT_MM_S,
  PPV_APPROACHING_THRESHOLD_MM_S,
  SOIL_VIBRATION_PROFILES,
  classifyPpvAlertLevel,
  computeBornitzPpvMmPerSec,
  computeSafeSetbackMeters25MmS,
  evaluatePpvThresholdAlert,
} from '../ppvThresholdAlertEngine';
import {
  computeMeteorologicalRefractionContext,
  generateImpulseNoiseEventPdfReport,
  isCapturedImpulseNoiseObservation,
} from '../../services/meteorologicalRefractionPdfContext';
import {
  AlgedonicObservation,
  DemolitionSourceNode,
  HourlyWeatherPoint,
  ReceptorZone,
} from '../../types/dispersion';

const sampleWeather: HourlyWeatherPoint = {
  hourIndex: 13,
  hourLabel: '13:00',
  isoTime: '2026-09-14T13:00',
  windSpeed10m: 11.2,
  windGusts10m: 15.8,
  windDirection10m: 245,
  temperature2m: 12.4,
  relativeHumidity2m: 68,
  precipitation: 0.0,
  soilMoisture0To7cm: 0.28,
  cloudCover: 35,
  directRadiation: 320,
  weatherCode: 3,
  pasquillClass: 'F',
  hadRecentFreezeThaw: false,
};

const sampleSources: DemolitionSourceNode[] = [
  {
    id: 'src-k1',
    code: 'K1',
    name: 'Hydraulisk Nedbrydningshammer K1',
    address: 'Ringparken 22, 4200 Slagelse',
    position: { lat: 55.4126, lng: 11.3532 },
    footprint: [
      { lat: 55.41255, lng: 11.35315 },
      { lat: 55.41265, lng: 11.35325 },
    ],
    releaseHeightMeters: 6,
    substances: ['asbestos', 'pcb'],
    substanceDetails: {
      asbestos: 'Nedbrydning af facadeplader',
      pcb: 'Fugematerialer',
      heavyMetals: 'Blymaling og zinkstøv',
      quartzWool: 'Kvartsstøv fra betonnedbrydning',
      moldSewer: 'Fugtskader i kælder/krybekælder',
    },
    pssReference: 'PSS W22085',
    active: true,
    baseSoundPowerLwaDb: 118,
    sourceEmissionFactor: 1.0,
  },
];

const sampleReceptors: ReceptorZone[] = [
  {
    id: 'rec-afd24',
    code: 'AFD24',
    name: 'Ringparken Afd. 24 Nord',
    address: 'Ringparken 24, 4200 Slagelse',
    category: 'residential_block',
    center: { lat: 55.41285, lng: 11.3534 },
    polygon: [
      { lat: 55.4128, lng: 11.35335 },
      { lat: 55.4129, lng: 11.35345 },
    ],
    vulnerableGroupNote: 'Beboet boligblok',
  },
];

test('Bornitz PPV attenuates with distance and softens further in compact gravel than saturated peat', () => {
  const nearPpv = computeBornitzPpvMmPerSec({
    distanceMeters: 4,
    sourceLwaDb: 118,
    soilProfile: SOIL_VIBRATION_PROFILES.moraine_clay,
  });
  const farPpv = computeBornitzPpvMmPerSec({
    distanceMeters: 28,
    sourceLwaDb: 118,
    soilProfile: SOIL_VIBRATION_PROFILES.moraine_clay,
  });
  assert.ok(nearPpv.ppvMmPerSec > farPpv.ppvMmPerSec);
  assert.ok(farPpv.soilAttenuationPct > nearPpv.soilAttenuationPct);

  const gravelAt15 = computeBornitzPpvMmPerSec({
    distanceMeters: 15,
    sourceLwaDb: 118,
    soilProfile: SOIL_VIBRATION_PROFILES.compact_gravel,
  });
  const peatAt15 = computeBornitzPpvMmPerSec({
    distanceMeters: 15,
    sourceLwaDb: 118,
    soilProfile: SOIL_VIBRATION_PROFILES.saturated_peat,
  });
  assert.ok(gravelAt15.ppvMmPerSec < peatAt15.ppvMmPerSec);
});

test('evaluatePpvThresholdAlert triggers visual warning when approaching or exceeding DIN 4150-3 25 mm/s', () => {
  const inactiveEval = evaluatePpvThresholdAlert({
    sources: [{ ...sampleSources[0], active: false }],
    receptors: sampleReceptors,
    currentWeather: sampleWeather,
  });
  assert.equal(inactiveEval.peakPpvMmPerSec, 0);
  assert.equal(inactiveEval.isVisualWarningTriggered, false);
  assert.equal(inactiveEval.alertLevel, 'NOMINAL');

  const approachingEval = evaluatePpvThresholdAlert({
    sources: sampleSources,
    receptors: sampleReceptors,
    currentWeather: sampleWeather,
    manualMachineNoiseOutputDb: 114,
    isManualMachineNoiseOverrideActive: true,
    simulatedProximityOverrideM: 3.4,
  });
  assert.ok(
    approachingEval.peakPpvMmPerSec >= PPV_APPROACHING_THRESHOLD_MM_S,
    `Expected >= ${PPV_APPROACHING_THRESHOLD_MM_S} mm/s, got ${approachingEval.peakPpvMmPerSec}`
  );
  assert.equal(approachingEval.isVisualWarningTriggered, true);
  assert.ok(['APPROACHING', 'EXCEEDED'].includes(approachingEval.alertLevel));

  const exceededEval = evaluatePpvThresholdAlert({
    sources: sampleSources,
    receptors: sampleReceptors,
    currentWeather: sampleWeather,
    manualMachineNoiseOutputDb: 120,
    isManualMachineNoiseOverrideActive: true,
    simulatedProximityOverrideM: 2.0,
  });
  assert.ok(exceededEval.peakPpvMmPerSec >= DIN_4150_3_PPV_LIMIT_MM_S);
  assert.equal(exceededEval.isLimitExceeded, true);
  assert.equal(exceededEval.isVisualWarningTriggered, true);
  assert.equal(exceededEval.alertLevel, 'EXCEEDED');

  const setback = computeSafeSetbackMeters25MmS({
    sourceLwaDb: 118,
    soilProfile: SOIL_VIBRATION_PROFILES.moraine_clay,
  });
  assert.ok(setback >= 2 && setback <= 80);
  assert.equal(classifyPpvAlertLevel(25.1), 'EXCEEDED');
  assert.equal(classifyPpvAlertLevel(19.0), 'APPROACHING');
  assert.equal(classifyPpvAlertLevel(13.0), 'ELEVATED');
  assert.equal(classifyPpvAlertLevel(4.0), 'NOMINAL');
});

test('Meteorological Refraction Context computes wind/temp gradients and generates impulse PDF dryRun summary', () => {
  const ctx = computeMeteorologicalRefractionContext({
    windSpeed10m: sampleWeather.windSpeed10m,
    windGusts10m: sampleWeather.windGusts10m,
    windDirection10m: sampleWeather.windDirection10m,
    temperature2m: sampleWeather.temperature2m,
    pasquillClass: 'F',
    precipitation: 0,
  });

  assert.ok(ctx.windGradientDuDzPerSec > 0.25);
  assert.ok(ctx.tempGradientDtDzKPer100m > 0);
  assert.ok(ctx.effectiveSoundSpeedGradientPerSec > 0);
  assert.ok(ctx.rayCurvatureRadiusKm !== null && ctx.rayCurvatureRadiusKm > 0);
  assert.ok(ctx.netDownwindPropagationDeltaDb > 3.0);
  assert.match(ctx.scientificSummaryDa, /du\/dz/);
  assert.match(ctx.scientificSummaryDa, /dT\/dz/);

  const impulseObs: AlgedonicObservation = {
    id: 'obs-noise-1',
    code: 'NOISE-85DB-01',
    createdAtIso: '2026-09-14T13:05:00Z',
    observedDateIso: '2026-09-14',
    observedHourIndex: 13,
    observedHourLabel: '13:00',
    observedTimestampIso: '2026-09-14T13:00:00Z',
    locationLabel: 'Ringparken Afd. 24 Nord',
    position: { lat: 55.41285, lng: 11.3534 },
    reporterRole: 'Beboer (Ringparken)',
    reporterIdentifier: 'Sensor-01',
    observationType: 'Vedvarende impulsstøj >85 dB(A)',
    description: 'Hydraulisk hammer overskrider L_AFmax 89,2 dB(A) i over 5 min.',
    weatherSnapshot: sampleWeather,
    plumeCorroboration: {
      isInsideMathematicalPlume: true,
      matchedZoneLevel: 'red',
      zoneLabel: 'Kritisk spredningsfane',
      calculatedSumQuotient: 1.42,
      nearestSourceId: 'src-k1',
      nearestSourceName: 'K1',
      distanceFromSourceMeters: 28,
      bearingFromSourceDeg: 45,
      plumeDirectionDeg: 65,
      angularDeviationDeg: 20,
      corroborationSummary: 'Bekræftet i fane',
      violatedRegulations: ['MST Vejl. 5/1984'],
    },
    sha256Signature: 'a'.repeat(64),
  };

  assert.equal(isCapturedImpulseNoiseObservation(impulseObs), true);

  const dustOnlyObs: AlgedonicObservation = {
    ...impulseObs,
    code: 'DUST-01',
    observationType: 'Synlig støvfane',
    description: 'Støvsky ved afspærring',
  };
  assert.equal(isCapturedImpulseNoiseObservation(dustOnlyObs), false);

  const dryPdf = generateImpulseNoiseEventPdfReport({
    eventCode: 'NOISE-85DB-01',
    dateIso: '2026-09-14',
    hourLabel: '13:00',
    receptorCode: 'AFD24',
    receptorName: 'Ringparken Afd. 24 Nord',
    receptorAddress: 'Ringparken 24, 4200 Slagelse',
    dominantSourceName: 'Hydraulisk Nedbrydningshammer K1',
    distanceMeters: 28,
    laeqDb: 74.2,
    peakLafmaxDb: 89.2,
    durationSeconds: 320,
    sumQuotient: 1.42,
    weather: sampleWeather,
    sha256Signature: 'b'.repeat(64),
    unitLabel: 'dB(A)',
    dryRun: true,
  });

  assert.match(dryPdf.fileName, /Refraktionskontekst/);
  assert.equal(dryPdf.reportSha256.length, 64);
  assert.ok(dryPdf.refractionContext.netDownwindPropagationDeltaDb > 3.0);
});
