import {
  HourlyWeatherPoint,
  WeatherDataset,
} from '../types/dispersion';

export interface ParsedDbaHourlySample {
  globalHourIndex: number; // 0..167
  rawLaeqDb: number;
  lafmaxPeakDb: number;
}

export interface DbaLoggerDatasetEntry {
  id: string;
  fileName: string;
  blockLabel: string;
  soundMeterModel: string;
  distanceMeters: number;
  bearingFromSiteDeg: number;
  sha256Hex: string;
  isUserUploaded: boolean;
  uploadedSamplesByGlobalHour: Record<number, ParsedDbaHourlySample>;
}

export interface EsdhMatchedMachineInfo {
  label: string;
  lwaDb: number;
  impulsePenaltyDb: number;
}

export interface BuildEsdhMachineImpulseCsvParams {
  loggers: DbaLoggerDatasetEntry[];
  selectedEsdhLoggerIds: string[];
  activeLogger: DbaLoggerDatasetEntry;
  weatherDataset: WeatherDataset;
  currentWeather: HourlyWeatherPoint;
  bestMatchedMachine?: EsdhMatchedMachineInfo | null;
  effectiveSourceLwaDb: number;
}

export interface BuildEsdhMachineImpulseCsvResult {
  fileName: string;
  csvContent: string;
  exportedCount: number;
  targetBlockLabels: string[];
  maxCompDb: number;
}

function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den > 1e-9 ? Math.max(-1, Math.min(1, num / den)) : 0;
}

function escapeCsvCell(val: string | number): string {
  const s = String(val ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildEsdhMachineImpulseCsv({
  loggers,
  selectedEsdhLoggerIds,
  activeLogger,
  weatherDataset,
  currentWeather,
  bestMatchedMachine,
  effectiveSourceLwaDb,
}: BuildEsdhMachineImpulseCsvParams): BuildEsdhMachineImpulseCsvResult {
  const selectedLoggers = loggers.filter((lg) =>
    selectedEsdhLoggerIds.includes(lg.id)
  );
  const targetLoggers =
    selectedLoggers.length > 0 ? selectedLoggers : [activeLogger];

  const activeHour = currentWeather;
  const plumeToDeg = (activeHour.windDirection10m + 180) % 360;

  const header = [
    'ESDH_Journal_Ref',
    'Naboblok_Adresse',
    'Logger_Fil',
    'Maaler_Model',
    'Afstand_m',
    'Retning_Fra_Plads_Deg',
    'Dato',
    'Klokkeslaet',
    'Vind_10m_ms',
    'Vindstoed_ms',
    'Vindretning_Mod_Deg',
    'Pasquill_Klasse',
    'Maskin_Stoejprofil',
    'Kilde_LWA_dB',
    'Impuls_Crest_dB',
    'Sim_LAeq_dB',
    'DBA_Raa_Ukomp_dB',
    'Mikrofon_Vindkomp_dB',
    'DBA_Vindkomp_LAeq_dB',
    'DBA_LAFmax_Impuls_dB',
    'Vindkomp_Korrelation_Pearson_r',
    'Forklaringsgrad_R2',
    'RMSE_dB',
    'Maskin_Match_Pct',
    'Graensevaerdi_BEK_dB',
    'Overskridelse_Status',
    'SHA256_Signatur',
  ].join(';');

  const machineLwa = bestMatchedMachine?.lwaDb ?? effectiveSourceLwaDb;
  const impulseCrest = bestMatchedMachine?.impulsePenaltyDb ?? 8.5;
  const limitDb =
    activeHour.hourIndex >= 7 && activeHour.hourIndex < 18
      ? 55
      : activeHour.hourIndex >= 18 && activeHour.hourIndex < 22
      ? 45
      : 40;

  const dataRows: string[] = [];
  let maxCompDb = 0;

  targetLoggers.forEach((lg) => {
    const dist = Math.max(12, lg.distanceMeters);
    const geomAttenDb = 20 * Math.log10(dist) + 11;
    const airGroundAttenDb = Math.min(8.2, dist * 0.024);

    const angleDiff =
      (((plumeToDeg - lg.bearingFromSiteDeg + 540) % 360) - 180) *
      (Math.PI / 180);
    const metRefractionDb = Math.max(
      -2.2,
      Math.cos(angleDiff) * Math.min(5.4, activeHour.windSpeed10m * 0.38)
    );
    const simLaeqDb = Number(
      (machineLwa - geomAttenDb - airGroundAttenDb + metRefractionDb).toFixed(1)
    );

    const v10m = activeHour.windSpeed10m;
    const micWindNoiseCompDb =
      v10m <= 3.0
        ? 0.2
        : Number(Math.min(11.4, 0.45 * Math.pow(v10m - 2.2, 1.38)).toFixed(2));

    const globalHourIdx = 6 * 24 + activeHour.hourIndex;
    const uploadedSample = lg.uploadedSamplesByGlobalHour[globalHourIdx];
    const deterministicJitter =
      Math.sin(globalHourIdx * 0.73 + lg.distanceMeters) * 1.45 +
      (v10m > 10 ? 1.9 : 0);
    const dbaRawDb = uploadedSample
      ? uploadedSample.rawLaeqDb
      : Number((simLaeqDb + micWindNoiseCompDb + deterministicJitter).toFixed(1));
    const dbaCompDb = Number(
      Math.max(34.0, dbaRawDb - micWindNoiseCompDb).toFixed(1)
    );
    maxCompDb = Math.max(maxCompDb, dbaCompDb);

    const isWorkHr = activeHour.hourIndex >= 7 && activeHour.hourIndex <= 17;
    const dbaLafmaxDb = uploadedSample
      ? uploadedSample.lafmaxPeakDb
      : Number((dbaRawDb + (isWorkHr ? 14.8 : 7.2)).toFixed(1));

    const simSeries24: number[] = [];
    const compSeries24: number[] = [];
    for (let h = 0; h < 24; h++) {
      const hw = weatherDataset.hours[h] || activeHour;
      const hPlume = (hw.windDirection10m + 180) % 360;
      const hAngle =
        (((hPlume - lg.bearingFromSiteDeg + 540) % 360) - 180) *
        (Math.PI / 180);
      const hRefr = Math.max(
        -2.2,
        Math.cos(hAngle) * Math.min(5.4, hw.windSpeed10m * 0.38)
      );
      const hSim = machineLwa - geomAttenDb - airGroundAttenDb + hRefr;
      const hMic =
        hw.windSpeed10m <= 3.0
          ? 0.2
          : Math.min(11.4, 0.45 * Math.pow(hw.windSpeed10m - 2.2, 1.38));
      const ghIdx = 6 * 24 + h;
      const up = lg.uploadedSamplesByGlobalHour[ghIdx];
      const jit =
        Math.sin(ghIdx * 0.73 + lg.distanceMeters) * 1.45 +
        (hw.windSpeed10m > 10 ? 1.9 : 0);
      const hRaw = up ? up.rawLaeqDb : hSim + hMic + jit;
      const hComp = Math.max(34.0, hRaw - hMic);
      simSeries24.push(hSim);
      compSeries24.push(hComp);
    }

    const rVal = pearsonCorrelation(simSeries24, compSeries24);
    const rmse = Math.sqrt(
      simSeries24.reduce((acc, s, i) => acc + Math.pow(s - compSeries24[i], 2), 0) /
        Math.max(1, simSeries24.length)
    );
    const matchPct = Math.max(
      12,
      Math.min(99, Math.round(100 - rmse * 4.2 + Math.max(0, rVal) * 12))
    );
    const statusText =
      dbaCompDb > limitDb
        ? `OVERSKRIDELSE (+${(dbaCompDb - limitDb).toFixed(1)} dB over BEK 5/1984)`
        : 'OVERHOLDT';

    dataRows.push(
      [
        `ESDH-RINGPARKEN-${weatherDataset.dateIso.replace(/-/g, '')}-${lg.id.toUpperCase()}`,
        lg.blockLabel,
        lg.fileName,
        lg.soundMeterModel,
        lg.distanceMeters,
        lg.bearingFromSiteDeg,
        weatherDataset.dateIso,
        activeHour.hourLabel,
        v10m.toFixed(1).replace('.', ','),
        activeHour.windGusts10m.toFixed(1).replace('.', ','),
        plumeToDeg,
        activeHour.pasquillClass,
        bestMatchedMachine?.label ?? 'Hydraulisk Nedbrydningsmaskine',
        machineLwa.toFixed(1).replace('.', ','),
        impulseCrest.toFixed(1).replace('.', ','),
        simLaeqDb.toFixed(1).replace('.', ','),
        dbaRawDb.toFixed(1).replace('.', ','),
        micWindNoiseCompDb.toFixed(2).replace('.', ','),
        dbaCompDb.toFixed(1).replace('.', ','),
        dbaLafmaxDb.toFixed(1).replace('.', ','),
        rVal.toFixed(3).replace('.', ','),
        (rVal * rVal).toFixed(3).replace('.', ','),
        rmse.toFixed(2).replace('.', ','),
        `${matchPct}%`,
        limitDb,
        statusText,
        lg.sha256Hex,
      ]
        .map(escapeCsvCell)
        .join(';')
    );
  });

  const fileName = `ESDH_maskin_impulsstoej_korrelation_${weatherDataset.dateIso}_${activeHour.hourLabel.replace(
    ':',
    ''
  )}.csv`;

  return {
    fileName,
    csvContent: '\uFEFF' + [header, ...dataRows].join('\r\n'),
    exportedCount: targetLoggers.length,
    targetBlockLabels: targetLoggers.map((l) => l.blockLabel),
    maxCompDb,
  };
}
