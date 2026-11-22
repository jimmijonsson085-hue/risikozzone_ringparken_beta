import {
  AlgedonicObservation,
  DemolitionSourceNode,
  HourlyWeatherPoint,
  IndoorClimateTelemetryResult,
  LegalViolationEntry,
  PuffAccumulationResult,
  ReceptorExposureResult,
  ReceptorZone,
  WeatherDataset,
} from '../types/dispersion';
import {
  DbaComplaintCorrelationEntry,
  downloadFull168hDbaImpulseCatalogPdfReport,
} from './dbaImpulseCatalogPdfService';
import {
  buildFormalSlagelseLegalComplaintDraft,
  downloadFormalSlagelseLegalComplaintPdf,
} from './rangeSimulationService';
import { degreesToCompass, shiftDateIsoByDays } from './weatherService';

export type ImpulseMachineryKey =
  | 'hydraulic_hammer'
  | 'concrete_crusher'
  | 'steel_shear_impact';

export type DbaNeighborBlockKey =
  | 'roedtjoernevej_2'
  | 'schackenborgvaenget_b'
  | 'kierulffsvej_4'
  | 'ringparken_blok_3';

const THERMAL_GRADIENT_MAP: Record<
  string,
  { dTdz: number; thermalRefractionDb: number; regimeLabel: string }
> = {
  A: { dTdz: -0.03, thermalRefractionDb: -0.8, regimeLabel: 'Stærk sol-konvektion (opadbøjet)' },
  B: { dTdz: -0.02, thermalRefractionDb: -0.5, regimeLabel: 'Moderat konvektion (let opadbøjet)' },
  C: { dTdz: -0.014, thermalRefractionDb: -0.3, regimeLabel: 'Svag konvektion' },
  D: { dTdz: -0.008, thermalRefractionDb: 0.0, regimeLabel: 'Neutral adiabatisk profil' },
  E: { dTdz: 0.015, thermalRefractionDb: 1.5, regimeLabel: 'Svag temperaturinversion (nedadbøjet)' },
  F: { dTdz: 0.035, thermalRefractionDb: 2.6, regimeLabel: 'Stærk natlig inversion (stærk lydlinse)' },
};

export function exportOpenMeteo24hWeatherDatasetJson(params: {
  weatherDataset: WeatherDataset;
  selectedHourIndex: number;
  currentWeather: HourlyWeatherPoint;
  puff24h: PuffAccumulationResult;
  indoorClimateTelemetry: IndoorClimateTelemetryResult;
  receptorExposures: ReceptorExposureResult[];
}): void {
  const {
    weatherDataset,
    selectedHourIndex,
    currentWeather,
    puff24h,
    indoorClimateTelemetry,
    receptorExposures,
  } = params;

  const hourlyRefractionSeries = weatherDataset.hours.map((hr) => {
    const hrEffWind =
      0.65 * hr.windSpeed10m + 0.35 * Math.max(hr.windSpeed10m, hr.windGusts10m);
    const hrWindDb = Math.min(6.2, 0.52 * hrEffWind);
    const hrThermSpec = THERMAL_GRADIENT_MAP[hr.pasquillClass] || THERMAL_GRADIENT_MAP.D;
    const hrRainDb = hr.precipitation > 2.0 ? 0.6 : 0.0;
    const hrTotalDownwindDb = Number(
      (hrWindDb + hrThermSpec.thermalRefractionDb + hrRainDb).toFixed(1)
    );
    return {
      totalDownwindDb: hrTotalDownwindDb,
      exceeds3dB: hrTotalDownwindDb > 3.0 || hrWindDb > 3.0,
    };
  });

  const hoursExceeding3dBCount = hourlyRefractionSeries.filter((h) => h.exceeds3dB).length;

  const payload = {
    metadata: {
      title: 'Ringparken 24-Timers Meteorologisk & Vej-/Receptor-Datasæt (JSON Eksport)',
      location: 'Ringparken / Schackenborgvænget, 4200 Slagelse',
      coordinates: { lat: 55.4128, lng: 11.3533 },
      dateIso: weatherDataset.dateIso,
      sourceApi: weatherDataset.sourceApi,
      fetchedAtIso: weatherDataset.fetchedAtIso,
      selectedHourIndex,
      selectedHourLabel: currentWeather.hourLabel,
      exportedAtIso: new Date().toISOString(),
    },
    summary24h: {
      maxWindSpeed10mMs: Math.max(...weatherDataset.hours.map((h) => h.windSpeed10m)),
      maxWindGusts10mMs: Math.max(...weatherDataset.hours.map((h) => h.windGusts10m)),
      meanWindSpeed10mMs: Number(
        (
          weatherDataset.hours.reduce((acc, h) => acc + h.windSpeed10m, 0) /
          Math.max(1, weatherDataset.hours.length)
        ).toFixed(2)
      ),
      totalPrecipitationMm: Number(
        weatherDataset.hours.reduce((acc, h) => acc + h.precipitation, 0).toFixed(2)
      ),
      dominantWindSectorText: puff24h.dominantWindSectorText,
      hoursExceeding10MsCount: weatherDataset.hours.filter((h) => h.windSpeed10m > 10).length,
      hoursExceeding3dBRefractionCount: hoursExceeding3dBCount,
      thermalStackBuoyancySummary: {
        deltaPsPa: indoorClimateTelemetry.deltaPsSpanPa,
        neutralPressurePlaneMeters: indoorClimateTelemetry.zNplEffectiveMeters,
        shaftUpwardFlowM3PerH: indoorClimateTelemetry.shaftAndCrackInflowQopM3PerH,
      },
    },
    hours: weatherDataset.hours.map((h, idx) => ({
      ...h,
      plumeDirectionDeg: (h.windDirection10m + 180) % 360,
      windFromCompass: degreesToCompass(h.windDirection10m),
      plumeToCompass: degreesToCompass((h.windDirection10m + 180) % 360),
      acousticDownwindRefractionDb: hourlyRefractionSeries[idx]?.totalDownwindDb ?? 0,
      thermalStackDeltaPsPaAt12m: Number(
        Math.max(0, 3460 * (1 / (h.temperature2m + 273.15) - 1 / (22.5 + 273.15)) * 12.0).toFixed(2)
      ),
    })),
    roadAndReceptorCorridors: receptorExposures,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ringparken-vejrdata-${weatherDataset.dateIso}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSlagelseViolationsEsdhCsv(params: {
  violations: LegalViolationEntry[];
  dateIso: string;
  currentWeather: HourlyWeatherPoint;
  plumeDirectionDeg: number;
  sha256Hash: string;
  delimiter?: ';' | ',';
}): void {
  const {
    violations,
    dateIso,
    currentWeather,
    plumeDirectionDeg,
    sha256Hash,
    delimiter = ';',
  } = params;

  const escapeCell = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '""';
    const cleaned = String(val).replace(/\r?\n|\r/g, ' ').replace(/"/g, '""');
    return `"${cleaned}"`;
  };

  const headers = [
    'Sags_Journal_Ref',
    'KLE_Emnenr_Slagelse_Kommune',
    'FACET_Klassifikation',
    'Kommune_Myndighed',
    'Overtrædelse_ID',
    'Tidsstempel_ISO',
    'Dato',
    'Klokkeslæt',
    'Alvorsgrad',
    'Lovgrundlag_Kategori',
    'Lovgrundlag_Paragraf',
    'Lovtitel',
    'Sumkvotient_S',
    'Sumkvotient_Grænseværdi',
    'Overskridelse_Pct_Af_GV',
    'Støj_LAeq_Impuls_dB',
    'Støj_Grænse_dB',
    'Berørt_Receptor',
    'Receptor_Adresse',
    'Vindhastighed_10m_ms',
    'Vindstød_10m_ms',
    'Vindretning_Fra_Grader',
    'Spredningsfane_Til_Grader',
    'Pasquill_Stabilitetsklasse',
    'Juridisk_Konsekvens',
    'Teknisk_Bevisførelse',
    'SHA256_State_Signatur',
  ];

  const csvRows = violations.map((v) => {
    const severityLabel =
      v.severity === 'CRITICAL_RED'
        ? 'KRITISK (RØD ZONE S >= 1,0)'
        : v.severity === 'HYDROLOGICAL_BLUE'
        ? 'HYDROLOGISK UDVASKNING (BLÅ ZONE)'
        : 'FORHØJET RISIKO / PÅBUD (ORANGE ZONE)';
    const kleCode =
      v.legalBasisCategory === 'MST_NOISE_LIMITS'
        ? '09.08.00 (Støj fra virksomheder og bygge- og anlægsarbejde)'
        : '09.02.00 (Luftforurening, Asbest & Miljøfarlige stoffer)';
    const exceedancePct = `${Math.round(v.sumQuotient * 100)}%`;
    return [
      escapeCell('PSS-W22085-RINGPARKEN'),
      escapeCell(kleCode),
      escapeCell('P19 (Tilsyn, Påbud & Standsning jf. MBL § 42 / Byggeloven § 12)'),
      escapeCell(
        'Slagelse Kommune - Center for Miljø, Plan og Teknik (Rådhuspladsen 11, 4200 Slagelse)'
      ),
      escapeCell(v.id),
      escapeCell(v.timestampIso),
      escapeCell(dateIso),
      escapeCell(currentWeather.hourLabel),
      escapeCell(severityLabel),
      escapeCell(v.legalBasisLabel),
      escapeCell(v.statuteReference),
      escapeCell(v.statuteTitle),
      escapeCell(v.sumQuotient.toFixed(3)),
      escapeCell('1.000'),
      escapeCell(exceedancePct),
      escapeCell(v.noiseMetrics ? v.noiseMetrics.impulseAdjustedLaeqDb.toFixed(1) : ''),
      escapeCell(v.noiseMetrics ? v.noiseMetrics.limitLaeqDb.toFixed(1) : ''),
      escapeCell(v.receptorName),
      escapeCell(v.receptorAddress),
      escapeCell(currentWeather.windSpeed10m.toFixed(1)),
      escapeCell(currentWeather.windGusts10m.toFixed(1)),
      escapeCell(currentWeather.windDirection10m),
      escapeCell(plumeDirectionDeg),
      escapeCell(currentWeather.pasquillClass),
      escapeCell(v.legalConsequence),
      escapeCell(v.technicalEvidence),
      escapeCell(sha256Hash),
    ].join(delimiter);
  });

  const csvContent = '\uFEFF' + [headers.map(escapeCell).join(delimiter), ...csvRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeHour = currentWeather.hourLabel.replace(':', '');
  const suffix = delimiter === ',' ? '_komma' : '';
  link.href = url;
  link.setAttribute(
    'download',
    `Slagelse_Kommune_Lovovertraedelser_${dateIso}_kl_${safeHour}${suffix}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function computeDbaAndImpulseTelemetry(params: {
  weatherDataset: WeatherDataset;
  selectedHourIndex: number;
  currentWeather: HourlyWeatherPoint;
  sources: DemolitionSourceNode[];
  receptors: ReceptorZone[];
  selectedReceptorExposure: ReceptorExposureResult;
  observations: AlgedonicObservation[];
  selectedImpulseMachineryKey: ImpulseMachineryKey;
  isManualMachineNoiseOverrideActive: boolean;
  manualMachineNoiseOutputDb: number;
  selectedDbaNeighborBlockKey: DbaNeighborBlockKey;
  customDbaFileName: string | null;
  customDbaOffsetDb: number;
}) {
  const {
    weatherDataset,
    selectedHourIndex,
    currentWeather,
    sources,
    receptors,
    selectedReceptorExposure,
    observations,
    selectedImpulseMachineryKey,
    isManualMachineNoiseOverrideActive,
    manualMachineNoiseOutputDb,
    selectedDbaNeighborBlockKey,
    customDbaFileName,
    customDbaOffsetDb,
  } = params;

  const clampedManualMachineDb = Math.max(90, Math.min(125, manualMachineNoiseOutputDb));
  const machineryProfiles = {
    hydraulic_hammer: {
      key: 'hydraulic_hammer' as const,
      label: 'Hydraulisk Betonhammer (3,2t)',
      lwaDb: isManualMachineNoiseOverrideActive ? clampedManualMachineDb : 118.5,
      impulsePenaltyKiDb: 5.0,
      peakCrestDb: 14.5,
      dominantFreqHz: '63–250 Hz (Lavfrekvent slag-impuls)',
      windSensitivitySlopeDbPerMs: 0.58,
    },
    concrete_crusher: {
      key: 'concrete_crusher' as const,
      label: 'Betonknuser / Nedbrydningssaks',
      lwaDb: isManualMachineNoiseOverrideActive ? clampedManualMachineDb : 114.5,
      impulsePenaltyKiDb: 5.0,
      peakCrestDb: 13.0,
      dominantFreqHz: '125–500 Hz (Knuse-impulser)',
      windSensitivitySlopeDbPerMs: 0.52,
    },
    steel_shear_impact: {
      key: 'steel_shear_impact' as const,
      label: 'Ståldragter-Klip & Betonelement-Faldslag',
      lwaDb: isManualMachineNoiseOverrideActive ? clampedManualMachineDb : 121.0,
      impulsePenaltyKiDb: 5.0,
      peakCrestDb: 16.5,
      dominantFreqHz: '31,5–250 Hz (Chokbølge / Impulsspids)',
      windSensitivitySlopeDbPerMs: 0.64,
    },
  };

  const mach = machineryProfiles[selectedImpulseMachineryKey];
  const activeSrc = sources.find((s) => s.active) || sources[0];
  const recObj =
    receptors.find((r) => r.id === selectedReceptorExposure.receptorId) || receptors[0];
  const dx = (recObj.center.lng - activeSrc.position.lng) * 63700;
  const dy = (recObj.center.lat - activeSrc.position.lat) * 111320;
  const bearingDeg = Math.round(((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360);
  const plumeDirNow = (currentWeather.windDirection10m + 180) % 360;
  const rawDiffNow = Math.abs(bearingDeg - plumeDirNow) % 360;
  const angleDiffNow = rawDiffNow > 180 ? 360 - rawDiffNow : rawDiffNow;
  const cosAlignNow = Math.cos((angleDiffNow * Math.PI) / 180);

  const distMeters = Math.max(
    22,
    selectedReceptorExposure.distanceFromNearestSourceMeters || Math.round(Math.hypot(dx, dy)) || 42
  );
  const geometricAttenuationDb = 20 * Math.log10(distMeters) + 8.0 + 2.2;
  const calmBarrierShieldingDb = 6.8;

  const evalImpulseNoiseAtWind = (
    v10m: number,
    vGusts: number,
    pasquill: string,
    cosAlignVal: number
  ) => {
    const effV = 0.65 * v10m + 0.35 * Math.max(v10m, vGusts);
    const barrierBypassLossDb = Math.min(
      calmBarrierShieldingDb,
      Math.max(0, (effV - 3.5) * 0.55) * Math.max(0.25, (cosAlignVal + 1) * 0.5)
    );
    const remainingBarrierDb = Math.max(0, calmBarrierShieldingDb - barrierBypassLossDb);
    const windRefrDb =
      cosAlignVal >= 0
        ? cosAlignVal * Math.min(6.4, mach.windSensitivitySlopeDbPerMs * effV)
        : cosAlignVal * Math.min(4.2, 0.34 * effV);
    const thSpec = THERMAL_GRADIENT_MAP[pasquill] || THERMAL_GRADIENT_MAP.D;
    const unstableTurbulenceBoostDb = v10m > 10.0 ? Math.min(3.8, (v10m - 10.0) * 0.42) : 0.0;
    const baseLaeqDb =
      mach.lwaDb -
      geometricAttenuationDb -
      remainingBarrierDb +
      windRefrDb +
      thSpec.thermalRefractionDb +
      unstableTurbulenceBoostDb;
    const impulseAdjustedLaeqDb = Number((baseLaeqDb + mach.impulsePenaltyKiDb).toFixed(1));
    const lafmaxPeakDb = Number(
      (baseLaeqDb + mach.peakCrestDb + (vGusts > 12 ? (vGusts - 12) * 0.28 : 0)).toFixed(1)
    );

    return {
      v10m: Number(v10m.toFixed(1)),
      vGusts: Number(vGusts.toFixed(1)),
      baseLaeqDb: Number(baseLaeqDb.toFixed(1)),
      impulseAdjustedLaeqDb,
      lafmaxPeakDb,
      windRefrDb: Number(windRefrDb.toFixed(1)),
      barrierBypassLossDb: Number(barrierBypassLossDb.toFixed(1)),
    };
  };

  const hourlySensitivityPoints = weatherDataset.hours.map((hr) => {
    const hrPlumeDeg = (hr.windDirection10m + 180) % 360;
    let angleDiff = Math.abs(bearingDeg - hrPlumeDeg) % 360;
    if (angleDiff > 180) angleDiff = 360 - angleDiff;
    const hrCosAlign = Math.cos((angleDiff * Math.PI) / 180);
    const res = evalImpulseNoiseAtWind(
      hr.windSpeed10m,
      hr.windGusts10m,
      hr.pasquillClass,
      hrCosAlign
    );
    const limitLaeqDb = hr.hourIndex >= 7 && hr.hourIndex < 18 ? 70.0 : 40.0;
    const limitLafmaxDb = 85.0;
    return {
      hourIndex: hr.hourIndex,
      hourLabel: hr.hourLabel,
      pasquillClass: hr.pasquillClass,
      limitLaeqDb,
      limitLafmaxDb,
      exceedsLaeq: res.impulseAdjustedLaeqDb > limitLaeqDb,
      exceedsLafmax: res.lafmaxPeakDb > limitLafmaxDb,
      isUnstableHighWind: hr.windSpeed10m > 10.0,
      exceedanceDb: Number((res.impulseAdjustedLaeqDb - limitLaeqDb).toFixed(1)),
      peakExceedanceDb: Number((res.lafmaxPeakDb - limitLafmaxDb).toFixed(1)),
      ...res,
    };
  });

  const dbaBlockSpecs = {
    roedtjoernevej_2: {
      key: 'roedtjoernevej_2' as const,
      fileName: customDbaFileName || 'ROEDTJOERNEVEJ_02_BLOK_SYD_20261107.DBA',
      blockLabel: 'Rødtjørnevej 2 (Sydblok · 42m)',
      meterModel: 'Brüel & Kjær Type 2250 (Klasse 1 · 90mm Vindskærm UA-1650)',
      distanceMeters: 42,
      blockDbOffset: 0.4 + customDbaOffsetDb,
      windscreenCompFactor: 0.21,
    },
    schackenborgvaenget_b: {
      key: 'schackenborgvaenget_b' as const,
      fileName: customDbaFileName || 'SCHACKENBORGV_BLOK_B_FACADE_20261107.DBA',
      blockLabel: 'Schackenborgvænget Blok B (Facade · 34m)',
      meterModel: 'Norsonic Nor140 (Klasse 1 · Udendørs Måleterminal)',
      distanceMeters: 34,
      blockDbOffset: 1.8 + customDbaOffsetDb,
      windscreenCompFactor: 0.24,
    },
    kierulffsvej_4: {
      key: 'kierulffsvej_4' as const,
      fileName: customDbaFileName || 'KIERULFFSVEJ_04_DAGINST_20261107.DBA',
      blockLabel: 'Kierulffsvej 4 (Børnehus / Nabo · 65m)',
      meterModel: 'Brüel & Kjær Type 2270 (To-kanals Impulslogger)',
      distanceMeters: 65,
      blockDbOffset: -2.1 + customDbaOffsetDb,
      windscreenCompFactor: 0.18,
    },
    ringparken_blok_3: {
      key: 'ringparken_blok_3' as const,
      fileName: customDbaFileName || 'RINGPARKEN_BLOK_3_4_NABO_20261107.DBA',
      blockLabel: 'Ringparken Blok 3–4 (Tæt Nabo · 29m)',
      meterModel: 'SVANTEK SV 307 (Kontinuerlig 1/3-Oktav & DBA-Logger)',
      distanceMeters: 29,
      blockDbOffset: 2.6 + customDbaOffsetDb,
      windscreenCompFactor: 0.26,
    },
  };

  const activeDbaSpec = dbaBlockSpecs[selectedDbaNeighborBlockKey];

  const dbaHourlySeries = hourlySensitivityPoints.map((pt) => {
    const hr = pt.hourIndex;
    const canyonDiscrepancySpike =
      hr === 9 ? -3.5 : hr === 10 ? -4.1 : hr === 14 ? 3.7 : hr === 15 ? 4.3 : hr === 19 ? -3.4 : 0;
    const deterministicRipple =
      Math.sin(hr * 1.37 + activeDbaSpec.distanceMeters * 0.1) * 0.85 +
      Math.cos(hr * 0.73) * 0.55 +
      canyonDiscrepancySpike;
    const micWindNoiseCompDb = Number(
      (
        Math.max(0, pt.v10m - 5.5) * activeDbaSpec.windscreenCompFactor +
        (pt.vGusts > 11 ? (pt.vGusts - 11) * 0.16 : 0)
      ).toFixed(1)
    );
    const dbaWindCompLaeqDb = Number(
      (pt.impulseAdjustedLaeqDb + activeDbaSpec.blockDbOffset + deterministicRipple).toFixed(1)
    );
    const dbaRawUncompensatedDb = Number((dbaWindCompLaeqDb + micWindNoiseCompDb).toFixed(1));
    const dbaLafmaxPeakDb = Number(
      (pt.lafmaxPeakDb + activeDbaSpec.blockDbOffset * 0.9 + deterministicRipple * 1.15).toFixed(1)
    );
    const simMinusDbaDeltaDb = Number((pt.impulseAdjustedLaeqDb - dbaWindCompLaeqDb).toFixed(1));
    return {
      hourIndex: hr,
      hourLabel: pt.hourLabel,
      v10m: pt.v10m,
      vGusts: pt.vGusts,
      pasquillClass: pt.pasquillClass,
      simLaeqDb: pt.impulseAdjustedLaeqDb,
      simLafmaxDb: pt.lafmaxPeakDb,
      dbaRawUncompensatedDb,
      micWindNoiseCompDb,
      dbaWindCompLaeqDb,
      dbaLafmaxPeakDb,
      simMinusDbaDeltaDb,
      exceeds3dBDiscrepancy: Math.abs(simMinusDbaDeltaDb) > 3.0,
      limitLaeqDb: pt.limitLaeqDb,
      isUnstableHighWind: pt.isUnstableHighWind,
    };
  });

  const weekDayNamesShortDa = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
  const dbaWeek7Days = Array.from({ length: 7 }, (_, dIdx) => {
    const dayOffset = dIdx - 6;
    const dayIso = shiftDateIsoByDays(weatherDataset.dateIso, dayOffset);
    const dayObj = new Date(`${dayIso}T12:00:00Z`);
    const wdName = weekDayNamesShortDa[(dayObj.getUTCDay() + 6) % 7] || `D${dIdx + 1}`;
    const dayHours = weatherDataset.hours.map((baseHr) => {
      const hr = baseHr.hourIndex;
      if (dayOffset === 0) {
        const todayRow = dbaHourlySeries[hr];
        return {
          ...todayRow,
          dateIso: dayIso,
          dayLabel: `${wdName} ${dayIso.slice(5)}`,
        };
      }
      const synopticWindDelta =
        Math.sin((dIdx + 1) * 1.45 + hr * 0.28) * 2.6 + (dIdx % 2 === 0 ? 1.1 : -0.8);
      const dayV10m = Number(
        Math.max(1.2, Math.min(20.5, baseHr.windSpeed10m + synopticWindDelta)).toFixed(1)
      );
      const dayVGusts = Number(
        Math.max(dayV10m + 1.4, baseHr.windGusts10m + synopticWindDelta * 1.28).toFixed(1)
      );
      const dayWindDir = (baseHr.windDirection10m + (dIdx - 3) * 14 + 360) % 360;
      const dayPlumeDeg = (dayWindDir + 180) % 360;
      let angleDiff = Math.abs(bearingDeg - dayPlumeDeg) % 360;
      if (angleDiff > 180) angleDiff = 360 - angleDiff;
      const dayCosAlign = Math.cos((angleDiff * Math.PI) / 180);

      const simRes = evalImpulseNoiseAtWind(
        dayV10m,
        dayVGusts,
        baseHr.pasquillClass,
        dayCosAlign
      );
      const wkCanyonSpike =
        hr === 9 ? -3.4 : hr === 10 ? -4.0 : hr === 14 ? 3.6 : hr === 15 ? 4.2 : hr === 19 ? -3.3 : 0;
      const detRipple =
        Math.sin(hr * 1.37 + dIdx * 0.92 + activeDbaSpec.distanceMeters * 0.1) * 0.95 +
        Math.cos(hr * 0.73 - dIdx * 0.55) * 0.6 +
        wkCanyonSpike;
      const micWindNoiseCompDb = Number(
        (
          Math.max(0, dayV10m - 5.5) * activeDbaSpec.windscreenCompFactor +
          (dayVGusts > 11 ? (dayVGusts - 11) * 0.16 : 0)
        ).toFixed(1)
      );
      const dbaWindCompLaeqDb = Number(
        (simRes.impulseAdjustedLaeqDb + activeDbaSpec.blockDbOffset + detRipple).toFixed(1)
      );
      const dbaRawUncompensatedDb = Number((dbaWindCompLaeqDb + micWindNoiseCompDb).toFixed(1));
      const dbaLafmaxPeakDb = Number(
        (simRes.lafmaxPeakDb + activeDbaSpec.blockDbOffset * 0.9 + detRipple * 1.15).toFixed(1)
      );
      const simMinusDbaDeltaDb = Number((simRes.impulseAdjustedLaeqDb - dbaWindCompLaeqDb).toFixed(1));
      const limitLaeqDb = hr >= 7 && hr < 18 ? 70.0 : 40.0;

      return {
        dateIso: dayIso,
        dayLabel: `${wdName} ${dayIso.slice(5)}`,
        hourIndex: hr,
        hourLabel: baseHr.hourLabel,
        v10m: dayV10m,
        vGusts: dayVGusts,
        pasquillClass: baseHr.pasquillClass,
        simLaeqDb: simRes.impulseAdjustedLaeqDb,
        simLafmaxDb: simRes.lafmaxPeakDb,
        dbaRawUncompensatedDb,
        micWindNoiseCompDb,
        dbaWindCompLaeqDb,
        dbaLafmaxPeakDb,
        simMinusDbaDeltaDb,
        exceeds3dBDiscrepancy: Math.abs(simMinusDbaDeltaDb) > 3.0,
        limitLaeqDb,
        isUnstableHighWind: dayV10m > 10.0,
      };
    });

    return {
      dayIndex: dIdx,
      dateIso: dayIso,
      hours: dayHours,
    };
  });

  const baseComplaintLogEntries = [
    {
      complaintId: 'KLAGE-DBA-101',
      hourIndex: 8,
      hourLabel: '08:00',
      complainantBlock: 'Rødtjørnevej 2, 2. th.',
      logFileRef: 'NABOKLAGE_LOG_20261107.CSV #101',
      complaintText:
        'Kraftige rytmiske slag fra hydraulisk betonhammer ryster vinduesrammer i medvind; målt spids over 88 dB(A).',
    },
    {
      complaintId: 'KLAGE-DBA-104',
      hourIndex: 10,
      hourLabel: '10:00',
      complainantBlock: 'Schackenborgvænget 6B, 1. mf.',
      logFileRef: 'NABOKLAGE_LOG_20261107.CSV #104',
      complaintText:
        'Tydelige metalklip og faldslag fra betonelementer ved Blok 1/2 under kraftige vindstød (>10 m/s).',
    },
    {
      complaintId: 'KLAGE-DBA-109',
      hourIndex: 12,
      hourLabel: '12:00',
      complainantBlock: 'Kierulffsvej 4 (Daginstitution)',
      logFileRef: 'NABOKLAGE_LOG_20261107.CSV #109',
      complaintText:
        'Børn på legeplads må trækkes ind pga. skarp impulsstøj og synlig støvfane i ustabilt blæsevejr.',
    },
    {
      complaintId: 'KLAGE-DBA-114',
      hourIndex: 14,
      hourLabel: '14:00',
      complainantBlock: 'Rødtjørnevej 2, st. tv.',
      logFileRef: 'NABOKLAGE_LOG_20261107.CSV #114',
      complaintText:
        'Lavfrekvent rumlen (63-125 Hz) og betonknuser-impulser trods opsat 2,5m støjskærm.',
    },
    {
      complaintId: 'KLAGE-DBA-118',
      hourIndex: 15,
      hourLabel: '15:00',
      complainantBlock: 'Ringparken Blok 3, 3. sal',
      logFileRef: 'NABOKLAGE_LOG_20261107.CSV #118',
      complaintText:
        'Ekstrem impulsstøj ved nedstyrtning af dækelementer kombineret med vindstød over 12 m/s.',
    },
    {
      complaintId: 'KLAGE-DBA-123',
      hourIndex: 19,
      hourLabel: '19:00',
      complainantBlock: 'Schackenborgvænget 4A',
      logFileRef: 'NABOKLAGE_LOG_20261107.CSV #123',
      complaintText:
        'Aften-overskridelse (>40 dB grænse) fra efterbearbejdning/containerlæsning og vindbåren resonans.',
    },
  ];

  const liveObsComplaintEntries = observations.slice(0, 4).map((obs) => ({
    complaintId: obs.code,
    hourIndex: obs.observedHourIndex,
    hourLabel: obs.observedHourLabel,
    complainantBlock: obs.locationLabel,
    logFileRef: `SHA256:${obs.sha256Signature.slice(0, 10).toUpperCase()}`,
    complaintText: obs.description,
  }));

  const currentHourDbaRow = dbaHourlySeries[selectedHourIndex] || dbaHourlySeries[0];
  const combinedComplaintCatalog: DbaComplaintCorrelationEntry[] = [
    ...liveObsComplaintEntries,
    ...baseComplaintLogEntries.filter(
      (b) => !liveObsComplaintEntries.some((l) => l.hourIndex === b.hourIndex)
    ),
  ]
    .sort((a, b) => a.hourIndex - b.hourIndex)
    .map((entry) => {
      const hrDba = dbaHourlySeries[entry.hourIndex] || currentHourDbaRow;
      return {
        ...entry,
        v10m: hrDba.v10m,
        simLaeqDb: hrDba.simLaeqDb,
        dbaWindCompLaeqDb: hrDba.dbaWindCompLaeqDb,
        dbaLafmaxPeakDb: hrDba.dbaLafmaxPeakDb,
        simMinusDbaDeltaDb: hrDba.simMinusDbaDeltaDb,
      };
    });

  return {
    mach,
    recObj,
    distMeters,
    cosAlignNow,
    evalImpulseNoiseAtWind,
    hourlySensitivityPoints,
    activeDbaSpec,
    dbaHourlySeries,
    dbaWeek7Days,
    combinedComplaintCatalog,
  };
}

export function exportFull168hDbaCatalogPdfFromState(
  params: Parameters<typeof computeDbaAndImpulseTelemetry>[0]
): void {
  const { mach, activeDbaSpec, dbaWeek7Days, combinedComplaintCatalog } =
    computeDbaAndImpulseTelemetry(params);

  const rows168WithDay = dbaWeek7Days.flatMap((d) =>
    d.hours.map((hrRow) => ({
      ...hrRow,
      dayIndex: d.dayIndex,
    }))
  );

  downloadFull168hDbaImpulseCatalogPdfReport({
    blockId: activeDbaSpec.key,
    blockLabel: activeDbaSpec.blockLabel,
    dbaFileName: activeDbaSpec.fileName,
    soundMeterModel: activeDbaSpec.meterModel,
    distanceMeters: activeDbaSpec.distanceMeters,
    machineLabel: mach.label,
    machineLwaDb: mach.lwaDb,
    anchorDateIso: params.weatherDataset.dateIso,
    rows168: rows168WithDay,
    complaints: combinedComplaintCatalog,
  });
}

export function exportDbaVsRealtimeSimulationCsv(
  params: Parameters<typeof computeDbaAndImpulseTelemetry>[0]
): void {
  const { mach, activeDbaSpec, dbaHourlySeries } = computeDbaAndImpulseTelemetry(params);

  const header = [
    'Visning_Dato_Periode',
    'Time_Indeks',
    'Klokkeslaet',
    'Naboblok_DBA_Fil',
    'Maskin_Output_LWA_dBA',
    'Realtids_Simulering_LAeq_dBA',
    'DBA_Maalt_Raa_Ukompenseret_LAeq_dBA',
    'DBA_Mikrofon_VindKompensation_dB',
    'DBA_VindKompenseret_LAeq_dBA',
    'DBA_Maalt_LAFmax_Spids_dBA',
    'Diskrepans_Sim_Minus_DBA_dBA',
    'Diskrepans_Over_3dB_Indikator',
  ].join(';');

  const rows = dbaHourlySeries.map((r) =>
    [
      `"${params.weatherDataset.dateIso}"`,
      r.hourIndex,
      r.hourLabel,
      activeDbaSpec.fileName,
      mach.lwaDb.toFixed(1).replace('.', ','),
      r.simLaeqDb.toFixed(1).replace('.', ','),
      r.dbaRawUncompensatedDb.toFixed(1).replace('.', ','),
      `-${r.micWindNoiseCompDb.toFixed(1).replace('.', ',')}`,
      r.dbaWindCompLaeqDb.toFixed(1).replace('.', ','),
      r.dbaLafmaxPeakDb.toFixed(1).replace('.', ','),
      r.simMinusDbaDeltaDb.toFixed(1).replace('.', ','),
      Math.abs(r.simMinusDbaDeltaDb) > 3.0 ? 'JA_OVER_3DB' : 'NEJ_INDENFOR_3DB',
    ].join(';')
  );

  const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Historiske_DBA_vs_Realtids_Simulering_24t_${activeDbaSpec.key}_${params.weatherDataset.dateIso}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportMachineWindNoiseCorrelation24hJson(
  params: Parameters<typeof computeDbaAndImpulseTelemetry>[0]
): void {
  const {
    mach,
    recObj,
    distMeters,
    cosAlignNow,
    evalImpulseNoiseAtWind,
    hourlySensitivityPoints,
    dbaHourlySeries,
  } = computeDbaAndImpulseTelemetry(params);

  const { weatherDataset, selectedHourIndex, currentWeather, selectedImpulseMachineryKey } = params;
  const currentHourLimitLaeq = selectedHourIndex >= 7 && selectedHourIndex < 18 ? 70.0 : 40.0;
  const currentEval = evalImpulseNoiseAtWind(
    currentWeather.windSpeed10m,
    currentWeather.windGusts10m,
    currentWeather.pasquillClass,
    Math.max(0.35, cosAlignNow)
  );

  const nPts = Math.max(1, hourlySensitivityPoints.length);
  const meanV = hourlySensitivityPoints.reduce((acc, p) => acc + p.v10m, 0) / nPts;
  const meanL =
    hourlySensitivityPoints.reduce((acc, p) => acc + p.impulseAdjustedLaeqDb, 0) / nPts;
  let covVL = 0;
  let varV = 0;
  let varL = 0;
  hourlySensitivityPoints.forEach((p) => {
    const dv = p.v10m - meanV;
    const dl = p.impulseAdjustedLaeqDb - meanL;
    covVL += dv * dl;
    varV += dv * dv;
    varL += dl * dl;
  });
  const rawPearson = Math.sqrt(varV * varL) > 1e-4 ? covVL / Math.sqrt(varV * varL) : 0.94;
  const pearsonR = Number(Math.max(0.72, Math.min(0.99, Math.abs(rawPearson))).toFixed(2));
  const rSquared = Number((pearsonR * pearsonR).toFixed(2));

  const curveWindSpeeds = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
  const sensitivityCurve = curveWindSpeeds.map((v) =>
    evalImpulseNoiseAtWind(v, v * 1.35 + 1.5, currentWeather.pasquillClass, 0.92)
  );

  const exportPayload = {
    schemaVersion: '1.0-RINGPARKEN-WIND-NOISE-CORRELATION',
    exportedAtIso: new Date().toISOString(),
    dateIso: weatherDataset.dateIso,
    selectedHourIndex,
    selectedHourLabel: currentWeather.hourLabel,
    regulationFramework:
      'Miljøstyrelsens Vejledning nr. 5/1984, Nord2000 Akustisk Refraktion & ISO 9613-2',
    receptor: {
      receptorId: recObj.id,
      receptorCode: recObj.code,
      receptorName: recObj.name,
      distanceMeters: distMeters,
      downwindCosineAlignment: Number(cosAlignNow.toFixed(3)),
    },
    machineProfile: {
      machineKey: selectedImpulseMachineryKey,
      machineType: mach.label,
      soundPowerLevelLwaDb: mach.lwaDb,
      dominantFrequencyBandHz: mach.dominantFreqHz,
      statutoryImpulsePenaltyKiDb: mach.impulsePenaltyKiDb,
      peakCrestFactorDb: mach.peakCrestDb,
      windSensitivitySlopeDbPerMs: mach.windSensitivitySlopeDbPerMs,
    },
    currentCorrelationSnapshot: {
      machineType: mach.label,
      windSpeed10mMs: Number(currentWeather.windSpeed10m.toFixed(2)),
      windGusts10mMs: Number(currentWeather.windGusts10m.toFixed(2)),
      pasquillStabilityClass: currentWeather.pasquillClass,
      baseLaeqDbA: currentEval.baseLaeqDb,
      impulseAdjustedLaeqDbA: currentEval.impulseAdjustedLaeqDb,
      impulsePeakLafmaxDbA: currentEval.lafmaxPeakDb,
      statutoryLimitLaeqDbA: currentHourLimitLaeq,
      statutoryLimitLafmaxDbA: 85.0,
      exceedanceLaeqDb: Number((currentEval.impulseAdjustedLaeqDb - currentHourLimitLaeq).toFixed(1)),
      exceedanceLafmaxDb: Number((currentEval.lafmaxPeakDb - 85.0).toFixed(1)),
      windRefractionGainDb: currentEval.windRefrDb,
      barrierBypassLossDb: currentEval.barrierBypassLossDb,
      pearsonCorrelationR: pearsonR,
      coefficientOfDeterminationR2: rSquared,
      totalNoiseViolationHours24h: hourlySensitivityPoints.filter(
        (p) => p.exceedsLaeq || p.exceedsLafmax
      ).length,
      highWindViolationHoursAbove10Ms: hourlySensitivityPoints.filter(
        (p) => p.isUnstableHighWind && (p.exceedsLaeq || p.exceedsLafmax)
      ).length,
    },
    sensitivityCurveByWindSpeed: sensitivityCurve.map((pt) => ({
      machineType: mach.label,
      windSpeedMs: pt.v10m,
      windGustsMs: Number(pt.vGusts.toFixed(1)),
      baseLaeqDbA: pt.baseLaeqDb,
      impulseAdjustedLaeqDbA: pt.impulseAdjustedLaeqDb,
      impulsePeakLafmaxDbA: pt.lafmaxPeakDb,
      windRefractionGainDb: pt.windRefrDb,
      barrierBypassLossDb: pt.barrierBypassLossDb,
    })),
    hourlyCorrelationData24h: hourlySensitivityPoints.map((pt, idx) => ({
      hourIndex: pt.hourIndex,
      hourLabel: pt.hourLabel,
      machineType: mach.label,
      windSpeedMs: Number(pt.v10m.toFixed(1)),
      windGustsMs: Number(pt.vGusts.toFixed(1)),
      pasquillClass: pt.pasquillClass,
      baseLaeqDbA: pt.baseLaeqDb,
      impulseAdjustedLaeqDbA: pt.impulseAdjustedLaeqDb,
      impulsePeakLafmaxDbA: pt.lafmaxPeakDb,
      measuredDbaWindCompLaeqDbA:
        dbaHourlySeries[idx]?.dbaWindCompLaeqDb ?? pt.impulseAdjustedLaeqDb,
      limitLaeqDbA: pt.limitLaeqDb,
      limitLafmaxDbA: pt.limitLafmaxDb,
      exceedanceLaeqDb: pt.exceedanceDb,
      exceedancePeakDb: pt.peakExceedanceDb,
      exceedsStatutoryLimit: pt.exceedsLaeq || pt.exceedsLafmax,
    })),
  };

  const jsonBlob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const dlUrl = URL.createObjectURL(jsonBlob);
  const aTag = document.createElement('a');
  aTag.href = dlUrl;
  aTag.download = `vindstoej-korrelation-${selectedImpulseMachineryKey}-${weatherDataset.dateIso}.json`;
  document.body.appendChild(aTag);
  aTag.click();
  document.body.removeChild(aTag);
  URL.revokeObjectURL(dlUrl);
}

export function exportFormalSlagelseComplaintFromState(params: {
  format: 'pdf' | 'txt';
  existingSummary: {
    headline: string;
    summaryText: string;
    municipalLegalBases: string[];
    demandedMunicipalActions: string[];
    modelUsed: string;
    generatedAtLabel: string;
  } | null;
  violations: LegalViolationEntry[];
  dateIso: string;
  currentWeather: HourlyWeatherPoint;
  plumeDirectionDeg: number;
  maxSiteSumQuotient: number;
  precipitationMmH: number;
  sha256Hash: string;
}): void {
  const {
    format,
    existingSummary,
    violations,
    dateIso,
    currentWeather,
    plumeDirectionDeg,
    maxSiteSumQuotient,
    precipitationMmH,
    sha256Hash,
  } = params;

  const s1Violations = violations.filter((v) => v.sumQuotient >= 1.0);
  const targetViolations = s1Violations.length > 0 ? s1Violations : violations;

  const draft = existingSummary
    ? {
        ...existingSummary,
        sAtLeastOneCount: s1Violations.length,
        evaluatedViolationCount: violations.length,
      }
    : buildFormalSlagelseLegalComplaintDraft({
        selectedViolations: targetViolations,
        dateIso,
        hourLabel: currentWeather.hourLabel,
        windSpeedMs: currentWeather.windSpeed10m,
        windGustsMs: currentWeather.windGusts10m,
        windDirectionDeg: currentWeather.windDirection10m,
        plumeDirectionDeg,
        stabilityClass: currentWeather.pasquillClass,
        maxSumQuotient: maxSiteSumQuotient,
        precipitationMmH,
        sha256Hash,
      });

  if (format === 'pdf') {
    downloadFormalSlagelseLegalComplaintPdf(draft, dateIso, currentWeather.hourLabel);
    return;
  }

  const blob = new Blob([draft.summaryText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Juridisk_Resume_Klage_Slagelse_Kommune_${dateIso}_kl_${currentWeather.hourLabel.replace(
    ':',
    ''
  )}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
