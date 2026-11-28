import {
  computeHydrogeologicalPercolation,
  HydrogeologicalSimulationResult,
} from '../components/UndergroundPercolation2D';
import { runDispersionSimulation } from '../services/dispersionEngine';
import { computePasquillGiffordClass, degreesToCompass } from '../services/weatherService';
import {
  DemolitionSourceNode,
  HourlyWeatherPoint,
  ReceptorZone,
  WeatherDataset,
} from '../types/dispersion';

export type HistoricalExtremeWeatherCategory =
  | 'storm'
  | 'skybrud'
  | 'dry_gale'
  | 'heat_inversion';

export interface HistoricalExtremeWeatherScenario {
  id: string;
  dateIso: string;
  title: string;
  shortTitle: string;
  category: HistoricalExtremeWeatherCategory;
  categoryLabelDa: string;
  regionContextDa: string;
  peakWindMs: number;
  peakGustMs: number;
  windDirectionDeg: number;
  peakPrecipMmH: number;
  totalPrecipMm: number;
  peakTempC: number;
  soilMoisture: number;
  hadFreezeThaw: boolean;
  focusHourIndex: number;
  affectedBlocks: string[];
  primaryReceptorCode: string;
  dispersionRiskMechanismDa: string;
  mitigationLessonDa: string;
  generate24Hours: (dateIso?: string) => HourlyWeatherPoint[];
}

export interface HistoricalExtremeWeatherRiskSummary {
  scenarioId: string;
  maxSumQuotient: number;
  worstReceptorCode: string;
  worstReceptorName: string;
  peakHourLabel: string;
  plumeDirectionDeg: number;
  plumeCompassLabel: string;
  hydroSim: HydrogeologicalSimulationResult;
  primaryRiskDomain: 'AIR_PLUME' | 'HYDRO_PERCOLATION' | 'DUAL_COMBINED';
}

export const HISTORICAL_EXTREME_WEATHER_SCENARIOS: HistoricalExtremeWeatherScenario[] = [
  {
    id: 'hist-storm-otto-2023',
    dateIso: '2023-02-17',
    title: 'Stormen "Otto" — Vestsjællandsk VNV-Kuling & Støvfane',
    shortTitle: 'Stormen "Otto" (2023)',
    category: 'storm',
    categoryLabelDa: 'Storm (>15 m/s)',
    regionContextDa: 'DMI Kraftig Vinterstorm over Slagelse · VNV 292°',
    peakWindMs: 15.8,
    peakGustMs: 24.6,
    windDirectionDeg: 292,
    peakPrecipMmH: 0.4,
    totalPrecipMm: 1.8,
    peakTempC: 7.4,
    soilMoisture: 0.24,
    hadFreezeThaw: true,
    focusHourIndex: 15,
    affectedBlocks: ['Blok 1', 'Blok 2', 'Rødtjørnevej 2', 'Valbyvej'],
    primaryReceptorCode: 'REC-RØD2',
    dispersionRiskMechanismDa:
      'Middelvind på 15,8 m/s og vindstød på 24,6 m/s aktiverede fuld mekanisk resuspension (1,75x) og sendte asbest- og blyfanen direkte mod Rødtjørnevej 2 og Valbyvej.',
    mitigationLessonDa:
      'Øjeblikkeligt stop for uafskærmet nedrivning og betonknusning ved v > 10 m/s; overdækning af opgravede depoter.',
    generate24Hours: (dateIso = '2023-02-17') =>
      Array.from({ length: 24 }, (_, h) => {
        const stormEnvelope = Math.exp(-Math.pow((h - 15) / 4.2, 2));
        const windSpeed = Number((7.2 + stormEnvelope * 8.6).toFixed(1));
        const gusts = Number((windSpeed * (1.44 + stormEnvelope * 0.12)).toFixed(1));
        const windDir = (284 + Math.round(Math.sin(h * 0.3) * 10) + 360) % 360;
        const precip = h >= 10 && h <= 13 ? 0.4 : 0;
        const temp = Number((4.2 + stormEnvelope * 3.2).toFixed(1));
        const clouds = h >= 9 && h <= 18 ? 78 : 48;
        const rad = h >= 8 && h <= 16 ? Math.round(160 * Math.sin(((h - 7) / 10) * Math.PI)) : 0;
        return {
          isoTime: `${dateIso}T${String(h).padStart(2, '0')}:00`,
          hourIndex: h,
          hourLabel: `${String(h).padStart(2, '0')}:00`,
          temperature2m: temp,
          relativeHumidity2m: Math.round(74 - stormEnvelope * 14),
          precipitation: precip,
          cloudCover: clouds,
          windSpeed10m: windSpeed,
          windDirection10m: windDir,
          windGusts10m: gusts,
          soilMoisture0To7cm: 0.24,
          directRadiation: Math.max(0, rad),
          weatherCode: precip > 0 ? 61 : 3,
          pasquillClass: computePasquillGiffordClass(windSpeed, rad, clouds, h),
          hadRecentFreezeThaw: true,
        };
      }),
  },
  {
    id: 'hist-storm-pia-2023',
    dateIso: '2023-12-21',
    title: 'Stormen "Pia" — SV-Storm mod Kierulffsvej & Børnehave',
    shortTitle: 'Stormen "Pia" (2023)',
    category: 'storm',
    categoryLabelDa: 'Storm (>14 m/s)',
    regionContextDa: 'Vinterstorm over Slagelse · SV 238° + Frost/Tø',
    peakWindMs: 14.2,
    peakGustMs: 22.1,
    windDirectionDeg: 238,
    peakPrecipMmH: 3.6,
    totalPrecipMm: 14.8,
    peakTempC: 4.1,
    soilMoisture: 0.36,
    hadFreezeThaw: true,
    focusHourIndex: 14,
    affectedBlocks: ['Blok 1', 'Kierulffsvej 2-12', 'Børnehave', 'Afd. 23'],
    primaryReceptorCode: 'REC-BH',
    dispersionRiskMechanismDa:
      'Kraftig SV-vind (14,2 m/s, stød 22,1 m/s) drev støvfanen direkte ind over Kierulffsvej 2–12 og Børnehave/Vuggestue, mens frost/tø-makroporer øgede blyperkolationen under Blok 1.',
    mitigationLessonDa:
      'Kombineret støvdæmpning med vandtåge-barrierer og midlertidig lukning af udearealer ved Børnehave under SV-storm.',
    generate24Hours: (dateIso = '2023-12-21') =>
      Array.from({ length: 24 }, (_, h) => {
        const peak = Math.exp(-Math.pow((h - 14) / 4.8, 2));
        const windSpeed = Number((6.4 + peak * 7.8).toFixed(1));
        const gusts = Number((windSpeed * 1.56).toFixed(1));
        const windDir = (234 + Math.round(Math.cos(h * 0.28) * 11) + 360) % 360;
        const isRain = h >= 9 && h <= 16;
        const precip = isRain ? (h === 12 || h === 13 ? 3.6 : 1.4) : 0;
        const temp = Number((-0.4 + peak * 4.5).toFixed(1));
        const clouds = isRain ? 94 : 68;
        const rad = h >= 9 && h <= 15 ? Math.round(75 * Math.sin(((h - 8) / 8) * Math.PI)) : 0;
        return {
          isoTime: `${dateIso}T${String(h).padStart(2, '0')}:00`,
          hourIndex: h,
          hourLabel: `${String(h).padStart(2, '0')}:00`,
          temperature2m: temp,
          relativeHumidity2m: isRain ? 91 : 78,
          precipitation: precip,
          cloudCover: clouds,
          windSpeed10m: windSpeed,
          windDirection10m: windDir,
          windGusts10m: gusts,
          soilMoisture0To7cm: 0.36,
          directRadiation: Math.max(0, rad),
          weatherCode: isRain ? 63 : 3,
          pasquillClass: computePasquillGiffordClass(windSpeed, rad, clouds, h),
          hadRecentFreezeThaw: true,
        };
      }),
  },
  {
    id: 'hist-skybrud-slagelse-2024',
    dateIso: '2024-08-19',
    title: 'August-Skybrud i Slagelse — Bly/PAH-Afstrømning & Krybekælder',
    shortTitle: 'Skybrud Slagelse (2024)',
    category: 'skybrud',
    categoryLabelDa: 'Skybrud (31,4 mm/t)',
    regionContextDa: 'Konvektiv Skybrudshændelse · 54,2 mm på 4 timer',
    peakWindMs: 9.6,
    peakGustMs: 15.4,
    windDirectionDeg: 312,
    peakPrecipMmH: 31.4,
    totalPrecipMm: 54.2,
    peakTempC: 17.6,
    soilMoisture: 0.45,
    hadFreezeThaw: false,
    focusHourIndex: 16,
    affectedBlocks: ['Blok 1', 'Blok 2', 'Kierulffsvej DN200', 'Sekundært Grundvand'],
    primaryReceptorCode: 'REC-KIER',
    dispersionRiskMechanismDa:
      'Intens nedbør på 31,4 mm/t overskred morænelerets infiltrationskapacitet, skabte mudder- og bly/PAH-afstrømning på Kierulffsvej og udløste hurtig makropore-perkolation til det sekundære magasin (-6,1 m).',
    mitigationLessonDa:
      'Etablér midlertidige slamfang, tæt afdækning af blottede krybekældre (Blok 1–2) og LAR-spærring før skybrudsvarsler.',
    generate24Hours: (dateIso = '2024-08-19') =>
      Array.from({ length: 24 }, (_, h) => {
        const precipProfile: Record<number, number> = {
          14: 4.8,
          15: 13.6,
          16: 31.4,
          17: 4.4,
        };
        const precip = precipProfile[h] ?? (h >= 12 && h <= 19 ? 0.6 : 0);
        const isBurst = h >= 14 && h <= 17;
        const windSpeed = isBurst ? 9.6 - Math.abs(h - 16) * 0.7 : 4.8;
        const gusts = Number((windSpeed * (isBurst ? 1.6 : 1.38)).toFixed(1));
        const windDir = (310 + Math.round(Math.sin(h * 0.3) * 14) + 360) % 360;
        const temp = Number((15.2 + (h >= 10 && h <= 14 ? 3.1 : 1.4)).toFixed(1));
        const clouds = isBurst ? 100 : 72;
        const rad = h >= 7 && h <= 19 ? (isBurst ? 45 : 220) : 0;
        return {
          isoTime: `${dateIso}T${String(h).padStart(2, '0')}:00`,
          hourIndex: h,
          hourLabel: `${String(h).padStart(2, '0')}:00`,
          temperature2m: temp,
          relativeHumidity2m: isBurst ? 97 : 84,
          precipitation: precip,
          cloudCover: clouds,
          windSpeed10m: Number(windSpeed.toFixed(1)),
          windDirection10m: windDir,
          windGusts10m: gusts,
          soilMoisture0To7cm: isBurst ? 0.45 : 0.32,
          directRadiation: rad,
          weatherCode: precip > 15 ? 95 : precip > 0 ? 63 : 3,
          pasquillClass: computePasquillGiffordClass(windSpeed, rad, clouds, h),
          hadRecentFreezeThaw: false,
        };
      }),
  },
  {
    id: 'hist-skybrud-juli-2011',
    dateIso: '2011-07-02',
    title: 'Ekstremt Sjællands-Skybrud (Reference) — Dyb Grundvandsperkolation',
    shortTitle: 'Ekstremt Skybrud (2011)',
    category: 'skybrud',
    categoryLabelDa: 'Ekstremt Skybrud (38,5 mm/t)',
    regionContextDa: 'Historisk Dybderelateret Reference · 86,0 mm Døgnnedbør',
    peakWindMs: 10.4,
    peakGustMs: 16.2,
    windDirectionDeg: 208,
    peakPrecipMmH: 38.5,
    totalPrecipMm: 86.0,
    peakTempC: 18.8,
    soilMoisture: 0.47,
    hadFreezeThaw: false,
    focusHourIndex: 18,
    affectedBlocks: ['Blok 1', 'Blok 2', 'Blok 9-10', 'Primært OSD Magasin'],
    primaryReceptorCode: 'REC-AFD23',
    dispersionRiskMechanismDa:
      'Ekstrem skybrudsintensitet (38,5 mm/t) fyldte kloaktracéer og drev opløst bly (Pb) og PAH gennem moræneleret mod både det sekundære og det primære drikkevandsmagasin (OSD).',
    mitigationLessonDa:
      'Dimensionér LAR-anlæg, pumpesumpe og midlertidig grundvandssænkning efter 100-års skybrudskriterier.',
    generate24Hours: (dateIso = '2011-07-02') =>
      Array.from({ length: 24 }, (_, h) => {
        const precipMap: Record<number, number> = {
          16: 9.2,
          17: 22.8,
          18: 38.5,
          19: 11.4,
          20: 4.1,
        };
        const precip = precipMap[h] ?? 0;
        const isExtreme = h >= 16 && h <= 20;
        const windSpeed = isExtreme ? (h === 18 ? 10.4 : 8.6) : 4.2;
        const gusts = Number((windSpeed * 1.56).toFixed(1));
        const windDir = (206 + Math.round(Math.sin(h * 0.25) * 12) + 360) % 360;
        const clouds = isExtreme ? 100 : 58;
        const rad = h >= 6 && h <= 20 ? (isExtreme ? 30 : 340) : 0;
        return {
          isoTime: `${dateIso}T${String(h).padStart(2, '0')}:00`,
          hourIndex: h,
          hourLabel: `${String(h).padStart(2, '0')}:00`,
          temperature2m: Number((16.0 + (h >= 11 && h <= 15 ? 4.2 : 2.1)).toFixed(1)),
          relativeHumidity2m: isExtreme ? 98 : 79,
          precipitation: precip,
          cloudCover: clouds,
          windSpeed10m: Number(windSpeed.toFixed(1)),
          windDirection10m: windDir,
          windGusts10m: gusts,
          soilMoisture0To7cm: isExtreme ? 0.47 : 0.29,
          directRadiation: rad,
          weatherCode: precip > 15 ? 95 : precip > 0 ? 65 : 2,
          pasquillClass: computePasquillGiffordClass(windSpeed, rad, clouds, h),
          hadRecentFreezeThaw: false,
        };
      }),
  },
  {
    id: 'hist-foraar-toer-kuling-2025',
    dateIso: '2025-04-06',
    title: 'Tør Forårs-Kuling — Udtørret Jord & Langvarig Kvarts/Asbest-Fane',
    shortTitle: 'Tør Forårs-Kuling (2025)',
    category: 'dry_gale',
    categoryLabelDa: 'Tør Blæst (12,6 m/s)',
    regionContextDa: 'Vedvarende Vestenvind & Lav Luftfugtighed (RF 36%)',
    peakWindMs: 12.6,
    peakGustMs: 18.9,
    windDirectionDeg: 264,
    peakPrecipMmH: 0.0,
    totalPrecipMm: 0.0,
    peakTempC: 11.8,
    soilMoisture: 0.11,
    hadFreezeThaw: false,
    focusHourIndex: 13,
    affectedBlocks: ['Kierulffsvej 2-12', 'Børnehave', 'Afd. 24'],
    primaryReceptorCode: 'REC-KIER',
    dispersionRiskMechanismDa:
      '8 sammenhængende timer med vestlig kuling (>10 m/s) kombineret med knastør overfladejord (RF 36%, 0,0 mm/t) gav uhindret afblæsning af respirabel kvarts og asbestfibre.',
    mitigationLessonDa:
      'Kontinuerlig befugtning med vandkanoner hver 30. minut i arbejdstiden ved RF < 45% og u > 8 m/s.',
    generate24Hours: (dateIso = '2025-04-06') =>
      Array.from({ length: 24 }, (_, h) => {
        const dayCurve = Math.max(0, Math.sin(((h - 7) / 13) * Math.PI));
        const windSpeed = Number((5.8 + dayCurve * 6.8).toFixed(1));
        const gusts = Number((windSpeed * 1.5).toFixed(1));
        const windDir = (262 + Math.round(Math.sin(h * 0.25) * 10) + 360) % 360;
        const rad = Math.round(dayCurve * 580);
        return {
          isoTime: `${dateIso}T${String(h).padStart(2, '0')}:00`,
          hourIndex: h,
          hourLabel: `${String(h).padStart(2, '0')}:00`,
          temperature2m: Number((4.5 + dayCurve * 7.3).toFixed(1)),
          relativeHumidity2m: Math.round(68 - dayCurve * 32),
          precipitation: 0,
          cloudCover: 18,
          windSpeed10m: windSpeed,
          windDirection10m: windDir,
          windGusts10m: gusts,
          soilMoisture0To7cm: 0.11,
          directRadiation: rad,
          weatherCode: 1,
          pasquillClass: computePasquillGiffordClass(windSpeed, rad, 18, h),
          hadRecentFreezeThaw: false,
        };
      }),
  },
  {
    id: 'hist-hede-inversion-2022',
    dateIso: '2022-07-20',
    title: 'Julivarmebølge & Natlig Inversion — PCB-Afgasning & Låst Fane',
    shortTitle: 'Varmebølge & PCB (2022)',
    category: 'heat_inversion',
    categoryLabelDa: 'Ekstrem Varme (32,4 °C)',
    regionContextDa: 'Hedebølge + Stabil Natlig Inversion (Pasquill F)',
    peakWindMs: 3.1,
    peakGustMs: 4.9,
    windDirectionDeg: 192,
    peakPrecipMmH: 0.0,
    totalPrecipMm: 0.0,
    peakTempC: 32.4,
    soilMoisture: 0.09,
    hadFreezeThaw: false,
    focusHourIndex: 14,
    affectedBlocks: ['Blok 1', 'Afd. 23', 'Kierulffsvej 2-12'],
    primaryReceptorCode: 'REC-AFD23',
    dispersionRiskMechanismDa:
      'Ekstrem overfladetemperatur (32,4 °C, 780 W/m²) tredoblede afgasningen af flygtigt PCB fra gamle fuger om eftermiddagen, efterfulgt af stille natlig inversion (Pasquill F), der låste dampe langs facaderne.',
    mitigationLessonDa:
      'Planlæg PCB-fugesanering til kølige morgentimer (<18 °C) med aktiv punktudsugning.',
    generate24Hours: (dateIso = '2022-07-20') =>
      Array.from({ length: 24 }, (_, h) => {
        const sunCurve = Math.max(0, Math.sin(((h - 5) / 15) * Math.PI));
        const temp = Number((18.2 + sunCurve * 14.2).toFixed(1));
        const rad = Math.round(sunCurve * 780);
        const windSpeed = Number((1.7 + sunCurve * 1.4).toFixed(1));
        const windDir = (190 + Math.round(Math.cos(h * 0.25) * 14) + 360) % 360;
        return {
          isoTime: `${dateIso}T${String(h).padStart(2, '0')}:00`,
          hourIndex: h,
          hourLabel: `${String(h).padStart(2, '0')}:00`,
          temperature2m: temp,
          relativeHumidity2m: Math.round(74 - sunCurve * 36),
          precipitation: 0,
          cloudCover: 8,
          windSpeed10m: windSpeed,
          windDirection10m: windDir,
          windGusts10m: Number((windSpeed * 1.42).toFixed(1)),
          soilMoisture0To7cm: 0.09,
          directRadiation: rad,
          weatherCode: 0,
          pasquillClass: computePasquillGiffordClass(windSpeed, rad, 8, h),
          hadRecentFreezeThaw: false,
        };
      }),
  },
];

export function evaluateHistoricalExtremeScenarioRisk(
  scenario: HistoricalExtremeWeatherScenario,
  sources: DemolitionSourceNode[],
  receptors: ReceptorZone[]
): HistoricalExtremeWeatherRiskSummary {
  const hours = scenario.generate24Hours(scenario.dateIso);
  const focusIdx = Math.max(0, Math.min(23, scenario.focusHourIndex));
  const sim = runDispersionSimulation(scenario.dateIso, focusIdx, hours, sources, receptors);
  const hr = hours[focusIdx];
  const activeCount = sources.filter((s) => s.active).length;
  const unsecuredCount = sources.filter(
    (s) => s.buildingCategory === 'e_demolished_unsecured' || s.buildingHeight3DMeters === 0
  ).length;

  const hydroSim = computeHydrogeologicalPercolation(
    hr.precipitation,
    hr.soilMoisture0To7cm,
    hr.hadRecentFreezeThaw,
    activeCount,
    unsecuredCount
  );

  const plumeDir = (hr.windDirection10m + 180) % 360;
  const primaryRiskDomain: HistoricalExtremeWeatherRiskSummary['primaryRiskDomain'] =
    hr.precipitation >= 10 && sim.maxSiteSumQuotient >= 0.8
      ? 'DUAL_COMBINED'
      : hr.precipitation >= 10 || hydroSim.riskLevel === 'CRITICAL_SKIBRUD'
      ? 'HYDRO_PERCOLATION'
      : 'AIR_PLUME';

  return {
    scenarioId: scenario.id,
    maxSumQuotient: Number(sim.maxSiteSumQuotient.toFixed(2)),
    worstReceptorCode: sim.worstExposedReceptor.receptorCode,
    worstReceptorName: sim.worstExposedReceptor.receptorName,
    peakHourLabel: hr.hourLabel,
    plumeDirectionDeg: plumeDir,
    plumeCompassLabel: degreesToCompass(plumeDir),
    hydroSim,
    primaryRiskDomain,
  };
}

export function buildWeatherDatasetFromHistoricalExtremeScenario(
  scenario: HistoricalExtremeWeatherScenario
): WeatherDataset {
  return {
    dateIso: scenario.dateIso,
    sourceApi: `Historisk Ekstremvejr-Arkiv: ${scenario.shortTitle} (${scenario.dateIso})`,
    fetchedAtIso: new Date().toISOString(),
    isScenarioOverride: true,
    scenarioName: scenario.title,
    hours: scenario.generate24Hours(scenario.dateIso),
  };
}
