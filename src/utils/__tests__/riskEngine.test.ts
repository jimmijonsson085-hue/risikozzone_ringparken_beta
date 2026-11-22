import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MATERIAL_SAMPLES,
  PROTECTED_FEATURES,
  RINGPARKEN_BUILDINGS,
  getBuildingById,
  getSamplesForBuilding,
} from '../../constants/ringparkenData';
import {
  BEK_496_2024_AREA_THRESHOLD_M2,
  LOKALPLAN_1269_MAX_RUNOFF_L_PER_S_HA,
  calculateDistanceAndBearing,
  calculateReceptorExposure,
  checkWorkHoursCompliance,
  classifyCanonicalMaterialSample,
  classifyMaterialSample,
  computeDemolitionCo2eKg,
  computeDeterministicReceptorRiskScore,
  evaluateBek496SelectiveDemolition,
  evaluateCanonicalBuildingCompliance,
  evaluateLokalplan1269LarCompliance,
  evaluateWasteAndHp14Classification,
  fuzzySearchCanonicalRingparken,
  fuzzySearchRingparkenRegistry,
  haversineDistanceMeters,
} from '../riskEngine';

describe('riskEngine - deterministic calculations & Danish compliance', () => {
  it('computes accurate Haversine distance between Ringparken blocks', () => {
    const blok1 = { lat: 55.4129, lng: 11.3522 };
    const byg1 = { lat: 55.4132, lng: 11.3541 };
    const dist = haversineDistanceMeters(blok1, byg1);
    assert.ok(dist > 110 && dist < 140, `Expected ~125 m between Blok 1 and Byg 1, got ${dist}`);
    assert.equal(haversineDistanceMeters(blok1, blok1), 0);
  });

  it('performs local Danish fuzzy search over verified Ringparken coordinate registry without DAWA', () => {
    const matchesExact = fuzzySearchRingparkenRegistry('Rødtjørnevej 2');
    assert.ok(matchesExact.length > 0);
    assert.ok(
      matchesExact[0].address.includes('Rødtjørnevej') ||
        matchesExact[0].name.includes('Rødtjørnevej')
    );

    // Tolerates minor typos / missing diacritics ("kierulfsvej" -> Kierulffsvej)
    const matchesTypo = fuzzySearchRingparkenRegistry('kierulfsvej');
    assert.ok(matchesTypo.length > 0);
    assert.ok(matchesTypo.some((m) => m.address.toLowerCase().includes('kierulffsvej')));
  });

  it('classifies waste deterministically using HP14 ecotoxicity summation, BEK 1328/2025, and BEK 1399/2021', () => {
    const hazardousPre1997 = evaluateWasteAndHp14Classification({
      constructionYear: 1968,
      asbestosDetected: true,
      asbestosTonnes: 12.5,
      mineralWoolPre1997Tonnes: 45,
      pcbMgPerKg: 180,
      leadMgPerKg: 950,
      pahMgPerKg: 60,
      cadmiumMgPerKg: 12,
      zincMgPerKg: 500,
    });
    assert.equal(hazardousPre1997.classification, 'FARLIGT_AFFALD');
    assert.equal(hazardousPre1997.bek1328AsbestosTriggered, true);
    assert.equal(hazardousPre1997.bek1399MineralWoolTriggered, true);
    assert.equal(hazardousPre1997.pcbThresholdTriggered, true);
    assert.ok(hazardousPre1997.hp14WeightedSumPercent > 0);

    const hp14OnlyTrigger = evaluateWasteAndHp14Classification({
      constructionYear: 2010,
      asbestosDetected: false,
      pcbMgPerKg: 2600, // 2600 * 0.01 = 26% >= 25% HP14 threshold
      leadMgPerKg: 100,
      pahMgPerKg: 10,
    });
    assert.equal(hp14OnlyTrigger.hp14ExceedsHazardousThreshold, true);
    assert.equal(hp14OnlyTrigger.classification, 'FARLIGT_AFFALD');

    const cleanFraction = evaluateWasteAndHp14Classification({
      constructionYear: 2015,
      asbestosDetected: false,
      pcbMgPerKg: 0.02,
      leadMgPerKg: 12,
      pahMgPerKg: 0.5,
    });
    assert.equal(cleanFraction.classification, 'IKKE_FARLIGT_AFFALD');
  });

  it('computes deterministic CO2e lifecycle emissions and selective demolition savings', () => {
    const lca = computeDemolitionCo2eKg({
      cleanReuseConcreteTonnes: 20000,
      crossContaminatedConcreteTonnes: 8400,
      asbestosTonnes: 142.5,
      pcbTonnes: 198,
      heavyMetalPaintTonnes: 94.5,
      mineralWoolPre1997Tonnes: 215,
      affectedFloorAreaM2: 73420,
    });
    assert.ok(lca.grossEmissionsKgCo2e > 0);
    assert.equal(lca.circularCreditKgCo2e, 20000 * 52);
    assert.equal(lca.netEmissionsKgCo2e, lca.grossEmissionsKgCo2e - lca.circularCreditKgCo2e);
    assert.ok(lca.avoidedBySelectiveDemolitionKgCo2e > 0);
  });

  it('enforces BEK nr. 496 af 21/05/2024 selective demolition rules above 250 m²', () => {
    assert.equal(BEK_496_2024_AREA_THRESHOLD_M2, 250);

    const underLimit = evaluateBek496SelectiveDemolition({
      affectedFloorAreaM2: 240,
      hasStandardizedDemolitionPlan: false,
      hasPreDemolitionResourceMapping: false,
      hasCertifiedDemolitionManager: false,
      hasAuthorizedAsbestosContractor: true,
      hasSeparatePre1997MineralWoolPlan: true,
      municipalityNotifiedTwoWeeksPrior: false,
    });
    assert.equal(underLimit.selectiveDemolitionMandatory, false);
    assert.equal(underLimit.status, 'IKKE_PÅKRÆVET_UNDER_250M2');

    const overLimitMissing = evaluateBek496SelectiveDemolition({
      affectedFloorAreaM2: 1250,
      hasStandardizedDemolitionPlan: false,
      hasPreDemolitionResourceMapping: true,
      hasCertifiedDemolitionManager: false,
      hasAuthorizedAsbestosContractor: true,
      hasSeparatePre1997MineralWoolPlan: true,
      municipalityNotifiedTwoWeeksPrior: true,
    });
    assert.equal(overLimitMissing.selectiveDemolitionMandatory, true);
    assert.equal(overLimitMissing.status, 'MANGLER_DOKUMENTATION');
    assert.equal(overLimitMissing.missingRequirementsDa.length, 2);

    const overLimitCompliant = evaluateBek496SelectiveDemolition({
      affectedFloorAreaM2: 73420,
      hasStandardizedDemolitionPlan: true,
      hasPreDemolitionResourceMapping: true,
      hasCertifiedDemolitionManager: true,
      hasAuthorizedAsbestosContractor: true,
      hasSeparatePre1997MineralWoolPlan: true,
      municipalityNotifiedTwoWeeksPrior: true,
    });
    assert.equal(overLimitCompliant.status, 'OVERHOLDT');
  });

  it('enforces Lokalplan 1269 LAR rainwater runoff cap (max 2.0 l/s/ha)', () => {
    assert.equal(LOKALPLAN_1269_MAX_RUNOFF_L_PER_S_HA, 2.0);

    const lightRain = evaluateLokalplan1269LarCompliance({
      catchmentAreaHa: 4.8,
      imperviousShare: 0.58,
      precipitationMmPerHour: 1.0,
      stormDurationMinutes: 60,
      availableLarDetentionM3: 0,
    });
    assert.ok(lightRain.actualSpecificRunoffLPerSecPerHa <= 2.0);
    assert.equal(lightRain.isCompliant, true);
    assert.equal(lightRain.requiredDetentionVolumeM3, 0);

    const heavyRainWithoutLar = evaluateLokalplan1269LarCompliance({
      catchmentAreaHa: 4.8,
      imperviousShare: 0.58,
      precipitationMmPerHour: 15.0,
      stormDurationMinutes: 60,
      availableLarDetentionM3: 100,
    });
    assert.ok(heavyRainWithoutLar.actualSpecificRunoffLPerSecPerHa > 2.0);
    assert.ok(heavyRainWithoutLar.requiredDetentionVolumeM3 > 100);
    assert.equal(heavyRainWithoutLar.isCompliant, false);
  });

  it('computes deterministic receptor risk score bounded 0-100', () => {
    const highRisk = computeDeterministicReceptorRiskScore({
      sumQuotient: 1.45,
      distanceMeters: 45,
      laeqDb: 74,
      precipitationMmH: 4.5,
      receptorCategory: 'residential_block',
      isVulnerableInstitution: true,
    });
    assert.equal(highRisk.tier, 'KRITISK');
    assert.ok(highRisk.score >= 75 && highRisk.score <= 100);
    assert.equal(highRisk.sumQuotientExceeded, true);
    assert.equal(highRisk.noiseThresholdExceeded, true);
  });

  it('validates canonical RINGPARKEN_BUILDINGS integrity, coordinates, BEK 496/2024 & FOB/DMA cross-referencing', () => {
    assert.ok(RINGPARKEN_BUILDINGS.length >= 16);

    const ids = new Set<string>();
    for (const b of RINGPARKEN_BUILDINGS) {
      assert.ok(!ids.has(b.id), `Duplicate building id: ${b.id}`);
      ids.add(b.id);
      assert.ok(b.coordinates.lat > 55.4 && b.coordinates.lat < 55.43);
      assert.ok(b.coordinates.lng > 11.34 && b.coordinates.lng < 11.37);

      const isDemolition =
        b.stage === 'Aktiv nedrivning (2026)' ||
        b.stage === 'Planlagt nedrivning (Etape 2/3)';
      if (isDemolition && (b.areaM2 ?? 0) > 250) {
        assert.equal(
          b.requiresSelectiveDemolitionPlan,
          true,
          `BEK 496/2024 requires selective demolition plan for ${b.id}`
        );
      }
    }

    // Critical FOB vs. DMA schema collision guard: Kierulffsvej 94-104 vs Albert Ibsens Vej 2-20
    const kierulff94 = getBuildingById('blok-9-10-kierulffsvej-94-104');
    const albert2 = getBuildingById('blok-11-albert-ibsens-vej-2-10');
    const albert12 = getBuildingById('blok-12-albert-ibsens-vej-12-20');
    assert.ok(kierulff94 && albert2 && albert12);
    assert.equal(kierulff94.fobBlockNumber, 9);
    assert.equal(kierulff94.dmaBlockNumber, null);
    assert.equal(albert2.fobBlockNumber, 11);
    assert.equal(albert2.dmaBlockNumber, 9);
    assert.equal(albert12.fobBlockNumber, 12);
    assert.equal(albert12.dmaBlockNumber, 10);

    // Check permit case numbers in Nedrivningsfelt Vest
    assert.equal(getBuildingById('byg-1-kierulffsvej-2')?.permitCaseNumber, '25-019157');
    assert.ok(getBuildingById('byg-2-kierulffsvej-12')?.permitCaseNumber?.includes('25-019352'));
    assert.equal(getBuildingById('byg-3-valbyvej-58')?.permitCaseNumber, '25-019354');
    const blok1 = getBuildingById('blok-1-kierulffsvej-14-22');
    assert.equal(blok1?.permitCaseNumber, '25-019350');
    assert.equal(blok1?.shelterCapacityPersons, 80);
  });

  it('classifies canonical MATERIAL_SAMPLES deterministically (HP14, Bøgh & Helstrup asbestos, MCCP, PAH, THC)', () => {
    const byId = new Map(MATERIAL_SAMPLES.map((s) => [s.id, s]));

    // Bøgh & Helstrup jan. 2026: Anthophyllit + Tremolit in bathroom mosaic
    const b1p4 = byId.get('B1 P4');
    const b1p14 = byId.get('B1 P14');
    assert.ok(b1p4 && b1p14);
    assert.deepEqual(b1p4.asbestosTypes, ['Anthophyllit', 'Tremolit']);
    assert.deepEqual(b1p14.asbestosTypes, ['Anthophyllit', 'Tremolit']);
    assert.equal(classifyCanonicalMaterialSample(b1p4).wasteClass, 'Farligt affald');

    // Wissenberg B1 P7: HP14 sum 48.700 mg/kg -> Farligt affald
    const b1p7 = byId.get('B1 P7');
    assert.ok(b1p7);
    assert.equal(b1p7.reportedHp14SumMgKg, 48700);
    assert.equal(classifyCanonicalMaterialSample(b1p7).wasteClass, 'Farligt affald');

    // DMA Lab 1 (Kierulffsvej 54, 3.tv): HP14 sum 3.300 mg/kg -> Farligt affald
    const lab1 = byId.get('Lab 1');
    assert.ok(lab1);
    assert.equal(lab1.reportedHp14SumMgKg, 3300);
    assert.equal(classifyCanonicalMaterialSample(lab1).wasteClass, 'Farligt affald');

    // DMA Lab 486 (Jacob Dampes Vej 1-5): 1.9% MCCP (19.000 mg/kg) -> Farligt affald
    const lab486 = byId.get('Lab 486');
    assert.ok(lab486);
    assert.equal(lab486.concentrationsMgKg.SCCP_MCCP, 19000);
    assert.equal(classifyCanonicalMaterialSample(lab486).wasteClass, 'Farligt affald');

    // DMA Lab 82 (Kierulffsvej 92): PCB 28.000 mg/kg -> Farligt affald
    const lab82 = byId.get('Lab 82');
    assert.ok(lab82);
    assert.equal(classifyCanonicalMaterialSample(lab82).wasteClass, 'Farligt affald');

    // DMA Lab 731 (Albert Ibsens Vej 3): THC 3.500 mg/kg -> Forurenet affald
    const lab731 = byId.get('Lab 731');
    assert.ok(lab731);
    assert.equal(classifyCanonicalMaterialSample(lab731).wasteClass, 'Forurenet affald');

    // Building-level deterministic summary for Blok 1
    const blok1 = getBuildingById('blok-1-kierulffsvej-14-22')!;
    const blok1Summary = evaluateCanonicalBuildingCompliance(blok1);
    assert.equal(blok1Summary.sampleCount, getSamplesForBuilding(blok1.id).length);
    assert.ok(blok1Summary.asbestosSampleCount >= 4);
    assert.equal(blok1Summary.highestWasteClass, 'Farligt affald');
    assert.equal(blok1Summary.requiresSelectiveDemolitionPlan, true);
  });

  it('includes all required PROTECTED_FEATURES (trees & NBL § 29 a bats) and searches locally', () => {
    assert.equal(PROTECTED_FEATURES.length, 4);
    assert.ok(PROTECTED_FEATURES.some((p) => p.id === 'prot-trees-valbyvej-kierulffsvej' && p.treeCount === 3));
    assert.ok(PROTECTED_FEATURES.some((p) => p.id === 'prot-treeline-matr-22c'));
    assert.ok(PROTECTED_FEATURES.some((p) => p.id === 'prot-treeline-ndr-ringgade'));
    assert.ok(PROTECTED_FEATURES.some((p) => p.id === 'prot-bats-nbl-29a-zone' && p.statutoryBasis.includes('§ 29 a')));

    const batSearch = fuzzySearchCanonicalRingparken('flagermus');
    assert.ok(batSearch.length > 0);
    assert.equal(batSearch[0].kind, 'protected_feature');

    const treeSearch = fuzzySearchCanonicalRingparken('Valbyvej træer');
    assert.ok(treeSearch.some((r) => r.id === 'prot-trees-valbyvej-kierulffsvej'));

    const addressSearch = fuzzySearchCanonicalRingparken('Jacob Dampes Vej 5');
    assert.ok(addressSearch.some((r) => r.id === 'blok-17-jacob-dampes-vej-1-5'));
  });

  it('classifyMaterialSample enforces exact Danish thresholds, HP14 rule, exceedanceRatio & 2026 safety rules', () => {
    const byId = new Map(MATERIAL_SAMPLES.map((s) => [s.id, s]));

    // 1. Lab 82: 28.000 mg/kg PCB -> 560x exceedanceRatio + IN-9-3 / A2P3 + BEK 613 lead rules
    const lab82Res = classifyMaterialSample(byId.get('Lab 82')!);
    assert.equal(lab82Res.wasteClass, 'Farligt affald');
    assert.equal(lab82Res.exceedanceRatio, 560);
    assert.ok(lab82Res.safetyRequirements2026.some((r) => r.includes('A2P3') && r.includes('IN-9-3')));
    assert.ok(lab82Res.safetyRequirements2026.some((r) => r.includes('0,03 mg Pb/m³') && r.includes('4,5 µg Pb/100 ml')));

    // 2. HP14 Upgrade: Lab 1 (PB 1400 < 2500, ZN 1900 < 2500, HP14 sum = 3300 > 2500)
    const lab1Res = classifyMaterialSample(byId.get('Lab 1')!);
    assert.equal(lab1Res.wasteClass, 'Farligt affald');
    assert.equal(lab1Res.hp14SumMgKg, 3300);
    assert.equal(lab1Res.upgradedByHp14, true);

    // 3. Synthetic HP14 threshold check without reportedHp14SumMgKg (only params >= 1000 mg/kg count)
    const belowHp14 = classifyMaterialSample({
      id: 'SYN-HP14-LOW',
      reportSource: 'DMA Maj 2025',
      buildingId: 'blok-1-kierulffsvej-14-22',
      addressLabel: 'Test',
      locationDetail: 'Test',
      material: 'Maling',
      asbestosDetected: false,
      asbestosTypes: [],
      dustIntensity: 'Ingen',
      concentrationsMgKg: { PB: 1600, ZN: 950 }, // ZN 950 < 1000 so excluded -> sum 1600 <= 2500
      reportedHp14SumMgKg: null,
      wholeElementDowngradedNote: null,
    });
    assert.equal(belowHp14.wasteClass, 'Forurenet affald');
    assert.equal(belowHp14.hp14SumMgKg, 1600);
    assert.equal(belowHp14.upgradedByHp14, false);

    const aboveHp14 = classifyMaterialSample({
      id: 'SYN-HP14-HIGH',
      reportSource: 'DMA Maj 2025',
      buildingId: 'blok-1-kierulffsvej-14-22',
      addressLabel: 'Test',
      locationDetail: 'Test',
      material: 'Maling',
      asbestosDetected: false,
      asbestosTypes: [],
      dustIntensity: 'Ingen',
      concentrationsMgKg: { PB: 1400, CU: 1200 }, // 1400 + 1200 = 2600 > 2500
      reportedHp14SumMgKg: null,
      wholeElementDowngradedNote: null,
    });
    assert.equal(aboveHp14.wasteClass, 'Farligt affald');
    assert.equal(aboveHp14.hp14SumMgKg, 2600);
    assert.equal(aboveHp14.upgradedByHp14, true);

    // 4. Asbestos EAK codes & BEK 1328/2025 requirements
    const kiselgurRes = classifyMaterialSample(byId.get('P1.35')!);
    assert.equal(kiselgurRes.wasteClass, 'Farligt affald');
    assert.ok(kiselgurRes.eakCodes.includes('17 06 01*'));
    assert.ok(kiselgurRes.safetyRequirements2026.some((r) => r.includes('Sikkerhedsstyrelsen')));
    assert.ok(kiselgurRes.safetyRequirements2026.some((r) => r.includes('0,003 fibre/cm³')));
    assert.ok(kiselgurRes.safetyRequirements2026.some((r) => r.includes('01.07.2026')));

    const dustAsbestosRes = classifyMaterialSample(byId.get('Prøve 380')!);
    assert.ok(dustAsbestosRes.eakCodes.includes('17 06 06*'));

    const wrappedPlateRes = classifyMaterialSample(
      {
        id: 'SYN-PLATE',
        reportSource: 'DMR Okt 2021',
        buildingId: 'blok-1-kierulffsvej-14-22',
        addressLabel: 'Test',
        locationDetail: 'Facade',
        material: 'Hel eternitplade (indpakket)',
        asbestosDetected: true,
        asbestosTypes: ['Chrysotil'],
        dustIntensity: 'Ingen',
        concentrationsMgKg: {},
        reportedHp14SumMgKg: null,
        wholeElementDowngradedNote: null,
      },
      { isWholeWrappedAsbestosPlates: true }
    );
    assert.equal(wrappedPlateRes.eakCode, '17 06 05');

    // 5. BEK 1399/2021 pre-1997 mineral wool
    const woolRes = classifyMaterialSample(
      {
        id: 'SYN-WOOL',
        reportSource: 'Wissenberg Jan 2026',
        buildingId: 'blok-1-kierulffsvej-14-22',
        addressLabel: 'Kierulffsvej 14-22',
        locationDetail: 'Tagrum & tekniske installationer',
        material: 'Ældre mineraluld før 1997',
        asbestosDetected: false,
        asbestosTypes: [],
        dustIntensity: 'Ingen',
        concentrationsMgKg: {},
        reportedHp14SumMgKg: null,
        wholeElementDowngradedNote: null,
      },
      { constructionYear: 1971 }
    );
    assert.equal(woolRes.wasteClass, 'Farligt affald');
    assert.ok(woolRes.statutoryReferences.some((r) => r.includes('1399')));

    // 6. Sjællandsnetværket single PAH (Benzo(a)pyren 0.3 vs 1000 mg/kg)
    const lab319Res = classifyMaterialSample(byId.get('Lab 319')!);
    assert.equal(lab319Res.wasteClass, 'Farligt affald');
    assert.ok(lab319Res.triggeredSubstances.some((t) => t.code === 'Benzo(a)pyren' && t.valueMgKg === 2300));
    assert.ok(lab319Res.statutoryReferences.some((r) => r.includes('Sjællandsnetværket')));
  });

  it('calculates exact distance & bearing and deterministic wind-driven receptor exposure (0-100)', () => {
    const blok1 = getBuildingById('blok-1-kierulffsvej-14-22')!;
    const blok2 = getBuildingById('blok-2-kierulffsvej-24-32')!;

    const vec = calculateDistanceAndBearing(
      blok1.coordinates.lat,
      blok1.coordinates.lng,
      blok2.coordinates.lat,
      blok2.coordinates.lng
    );
    // Blok 2 is ~49 m east of Blok 1
    assert.ok(vec.distanceMeters > 40 && vec.distanceMeters < 60, `Expected ~49m, got ${vec.distanceMeters}`);
    assert.ok(vec.bearingDeg > 75 && vec.bearingDeg < 100, `Expected ~E bearing, got ${vec.bearingDeg}`);

    // Wind from West (270°) blows East (90°) directly onto Blok 2 in dry weather
    const downwindDry = calculateReceptorExposure(blok2, [blok1], 270, 8, true);
    // Wind from East (90°) blows West (270°) away from Blok 2
    const upwindDry = calculateReceptorExposure(blok2, [blok1], 90, 8, true);
    // Rain reduces downwindFactor by 60%
    const downwindRain = calculateReceptorExposure(blok2, [blok1], 270, 8, false);

    assert.ok(downwindDry.downwindFactor > 0.9);
    assert.equal(upwindDry.downwindFactor, 0);
    assert.ok(Math.abs(downwindRain.downwindFactor - downwindDry.downwindFactor * 0.4) < 0.01);
    assert.ok(downwindDry.receptorRiskScore > upwindDry.receptorRiskScore);
    assert.equal(downwindDry.riskLevel, 'KRITISK');
    assert.ok(downwindDry.receptorRiskScore >= 0 && downwindDry.receptorRiskScore <= 100);
  });

  it('enforces Slagelse Kommune & PSS work hours compliance (weekdays, Saturdays, Sundays/holidays)', () => {
    // Monday 10:30 local -> Allowed, max 70 dB(A)
    const monMorning = checkWorkHoursCompliance(new Date(2026, 4, 18, 10, 30));
    assert.equal(monMorning.isAllowed, true);
    assert.equal(monMorning.dayType, 'HVERDAG');
    assert.equal(monMorning.maxBoundaryNoiseDbA, 70);
    assert.equal(monMorning.internalPssLimitDbA, 80);
    assert.equal(monMorning.heavyBreakingNoticeWorkdays, 5);

    // Monday 18:15 -> Forbidden
    const monEvening = checkWorkHoursCompliance(new Date(2026, 4, 18, 18, 15));
    assert.equal(monEvening.isAllowed, false);

    // Saturday 11:00 -> Allowed, max 64 dB(A)
    const satMorning = checkWorkHoursCompliance(new Date(2026, 4, 23, 11, 0));
    assert.equal(satMorning.isAllowed, true);
    assert.equal(satMorning.dayType, 'LØRDAG');
    assert.equal(satMorning.maxBoundaryNoiseDbA, 64);

    // Saturday 14:30 -> Forbidden
    const satAfternoon = checkWorkHoursCompliance(new Date(2026, 4, 23, 14, 30));
    assert.equal(satAfternoon.isAllowed, false);

    // Sunday 11:00 -> Forbidden
    const sunday = checkWorkHoursCompliance(new Date(2026, 4, 24, 11, 0));
    assert.equal(sunday.isAllowed, false);
    assert.equal(sunday.dayType, 'SØN_ELLER_HELLIGDAG');

    // Public holiday (Christmas Day 2026-12-25, Friday 10:00) -> Forbidden
    const xmas = checkWorkHoursCompliance(new Date(2026, 11, 25, 10, 0));
    assert.equal(xmas.isAllowed, false);
    assert.equal(xmas.dayType, 'SØN_ELLER_HELLIGDAG');
  });
});
