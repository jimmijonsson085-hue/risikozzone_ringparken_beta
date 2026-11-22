import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DbaLoggerDatasetEntry,
  buildEsdhMachineImpulseCsv,
} from '../esdhCorrelationCsv';
import { selectWebGlPlumeSources } from '../webglPlumeSelection';
import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  SubstanceKey,
  WeatherDataset,
} from '../../types/dispersion';

function makeSource(id: string, active: boolean): DemolitionSourceNode {
  const details: Record<SubstanceKey, string> = {
    asbestos: 'Test',
    pcb: 'Test',
    heavyMetals: 'Test',
    quartzWool: 'Test',
    moldSewer: 'Test',
  };
  return {
    id,
    code: id.toUpperCase(),
    name: `Kilde ${id}`,
    address: 'Ringparken 1',
    position: { lat: 55.4153, lng: 11.3555 },
    footprint: [],
    releaseHeightMeters: 6,
    substances: ['asbestos'],
    substanceDetails: details,
    pssReference: 'PSS-1',
    active,
  };
}

function makeWeatherHour(hourIndex: number, windSpeed10m: number): HourlyWeatherPoint {
  return {
    isoTime: `2026-04-14T${String(hourIndex).padStart(2, '0')}:00:00Z`,
    hourIndex,
    hourLabel: `${String(hourIndex).padStart(2, '0')}:00`,
    temperature2m: 11.5,
    relativeHumidity2m: 68,
    precipitation: 0,
    cloudCover: 40,
    windSpeed10m,
    windDirection10m: 245,
    windGusts10m: windSpeed10m + 4.8,
    soilMoisture0To7cm: 0.22,
    directRadiation: 320,
    weatherCode: 2,
    pasquillClass: 'D',
    hadRecentFreezeThaw: false,
  };
}

describe('WebGL 2D dust plume selected source prioritization', () => {
  it('places selectedSourceId first with isSelected=true even if inactive', () => {
    const sources = [
      makeSource('src_1', true),
      makeSource('src_2', false),
      makeSource('src_3', true),
    ];

    const prioritized = selectWebGlPlumeSources(sources, 'src_2', 8);
    assert.equal(prioritized.length, 3);
    assert.equal(prioritized[0].source.id, 'src_2');
    assert.equal(prioritized[0].isSelected, true);
    assert.equal(prioritized[1].source.id, 'src_1');
    assert.equal(prioritized[1].isSelected, false);
    assert.equal(prioritized[2].source.id, 'src_3');
    assert.equal(prioritized[2].isSelected, false);
  });

  it('falls back to active sources when selectedSourceId is null', () => {
    const sources = [
      makeSource('src_1', false),
      makeSource('src_2', true),
      makeSource('src_3', true),
    ];

    const prioritized = selectWebGlPlumeSources(sources, null, 8);
    assert.deepEqual(
      prioritized.map((p) => p.source.id),
      ['src_2', 'src_3']
    );
    assert.ok(prioritized.every((p) => p.isSelected === false));
  });
});

describe('ESDH wind-compensated machine impulse-noise CSV export', () => {
  const loggers: DbaLoggerDatasetEntry[] = [
    {
      id: 'blok_a',
      fileName: 'ROEDTJOERNEVEJ2.DBA',
      blockLabel: 'Rødtjørnevej 2 (Syd · 42 m)',
      soundMeterModel: 'Brüel & Kjær Type 2250',
      distanceMeters: 42,
      bearingFromSiteDeg: 186,
      sha256Hex: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff66667777888899990000',
      isUserUploaded: false,
      uploadedSamplesByGlobalHour: {},
    },
    {
      id: 'blok_b',
      fileName: 'SCHACKENBORG_6B.DBA',
      blockLabel: 'Schackenborgvænget 6B (Øst · 34 m)',
      soundMeterModel: 'Norsonic Nor145',
      distanceMeters: 34,
      bearingFromSiteDeg: 92,
      sha256Hex: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
      isUserUploaded: false,
      uploadedSamplesByGlobalHour: {},
    },
    {
      id: 'blok_c',
      fileName: 'KIERULFFSVEJ_4.DBA',
      blockLabel: 'Kierulffsvej 4 (Vest · 65 m)',
      soundMeterModel: 'Brüel & Kjær Type 2270',
      distanceMeters: 65,
      bearingFromSiteDeg: 268,
      sha256Hex: '9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaa',
      isUserUploaded: false,
      uploadedSamplesByGlobalHour: {},
    },
  ];

  const hours = Array.from({ length: 24 }, (_, idx) =>
    makeWeatherHour(idx, idx === 12 ? 12.4 : 7.5)
  );
  const weatherDataset: WeatherDataset = {
    dateIso: '2026-04-14',
    sourceApi: 'Open-Meteo Test',
    fetchedAtIso: '2026-04-14T12:00:00Z',
    isScenarioOverride: false,
    hours,
  };

  it('strictly exports ONLY selected neighbor blocks and excludes unchecked activeLogger', () => {
    const result = buildEsdhMachineImpulseCsv({
      loggers,
      selectedEsdhLoggerIds: ['blok_b', 'blok_c'],
      activeLogger: loggers[0], // blok_a is active in chart, but unchecked for ESDH export!
      weatherDataset,
      currentWeather: hours[12],
      bestMatchedMachine: {
        label: 'Hydraulisk Betonknuser (116 dB)',
        lwaDb: 116.0,
        impulsePenaltyDb: 9.2,
      },
      effectiveSourceLwaDb: 114.5,
    });

    assert.equal(result.exportedCount, 2);
    assert.deepEqual(result.targetBlockLabels, [
      'Schackenborgvænget 6B (Øst · 34 m)',
      'Kierulffsvej 4 (Vest · 65 m)',
    ]);
    assert.ok(result.csvContent.startsWith('\uFEFFESDH_Journal_Ref;'));
    const lines = result.csvContent.slice(1).split('\r\n');
    assert.equal(lines.length, 3); // header + 2 selected neighbor blocks
    assert.ok(lines[0].includes('Maskin_Stoejprofil'));
    assert.ok(lines[0].includes('Vindkomp_Korrelation_Pearson_r'));
    assert.ok(lines[0].includes('SHA256_Signatur'));
    assert.equal(result.csvContent.includes('ROEDTJOERNEVEJ2.DBA'), false);
    assert.ok(lines[1].includes('SCHACKENBORG_6B.DBA'));
    assert.ok(lines[2].includes('KIERULFFSVEJ_4.DBA'));
  });
});
