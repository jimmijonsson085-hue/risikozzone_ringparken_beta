import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateCavAnnualHeatLossMwh,
  calculateCavVentilationEnergyLossAndRecovery,
  calculateEmbodiedCarbon,
  calculateEmbodiedCarbonAndCircularLca,
  calculateHydrologicalLarDetention,
  calculateLarDetentionVolume,
} from '../climateLcaEngine';

describe('climateLcaEngine - deterministic LCA, CAV energy & Lokalplan 1269 LAR', () => {
  it('blocks crushed concrete carbon credits when BEK 496/2024 plan is missing and unlocks when documented', () => {
    const blocked = calculateEmbodiedCarbonAndCircularLca({
      scopeId: 'etape1_3_fuld',
      reusedMaterialPct: 75,
      preservedMatureTreesCount: 36,
      hasDocumentedBek496Plan: false,
    });

    assert.equal(blocked.scope.totalAreaM2, 11559);
    assert.equal(blocked.contaminationInterlock.isBlocked, true);
    assert.ok(blocked.crushedConcreteTheoreticalSavingsTonCo2e > 0);
    assert.equal(blocked.crushedConcreteVerifiedSavingsTonCo2e, 0);
    assert.ok(blocked.contaminationInterlock.blockedConcreteTonnes > 0);

    const documented = calculateEmbodiedCarbonAndCircularLca({
      scopeId: 'etape1_3_fuld',
      reusedMaterialPct: 75,
      preservedMatureTreesCount: 36,
      hasDocumentedBek496Plan: true,
    });

    assert.equal(documented.contaminationInterlock.isBlocked, false);
    assert.equal(
      documented.crushedConcreteVerifiedSavingsTonCo2e,
      documented.crushedConcreteTheoreticalSavingsTonCo2e
    );
    assert.ok(
      documented.totalCircularSavingsTonCo2e > blocked.totalCircularSavingsTonCo2e
    );
  });

  it('computes embodied carbon breakdown for commercial (1.959 m2) and residential (Blok 1/9/10 up to 9.600 m2)', () => {
    const embodied = calculateEmbodiedCarbon({
      scopeId: 'etape1_3_fuld',
      reusedMaterialPct: 75,
      preservedMatureTreesCount: 36,
      hasDocumentedBek496Plan: true,
      includeReplacementNewBuild: true,
    });

    assert.equal(embodied.commercialAreaM2, 1959);
    assert.equal(embodied.residentialAreaM2, 9600);
    assert.equal(embodied.residentialUnits, 120);
    assert.ok(embodied.commercialEmbodiedTonCo2e > 500);
    assert.ok(embodied.residentialEmbodiedTonCo2e > 2500);
    assert.equal(embodied.chartBreakdown.length, 6);
    assert.equal(embodied.isConcreteSavingsBlocked, false);
  });

  it('computes annual CAV heat loss and 80-85% heat recovery savings across 732 apartments', () => {
    const res80 = calculateCavVentilationEnergyLossAndRecovery({
      heatRecoveryEfficiencyPct: 80,
    });
    const res85 = calculateCavVentilationEnergyLossAndRecovery({
      heatRecoveryEfficiencyPct: 85,
    });
    const heatSummary = calculateCavAnnualHeatLossMwh({
      apartmentCount: 732,
      heatRecoveryEfficiencyPct: 82.5,
    });

    assert.equal(res80.apartmentCount, 732);
    assert.equal(res80.blockCount, 20);
    assert.ok(res80.annualVentilationHeatLossMwh > 1500);
    assert.ok(res85.netEnergySavedMwhPerYear > res80.netEnergySavedMwhPerYear);
    assert.ok(res85.netCo2eSavedTonPerYear > res80.netCo2eSavedTonPerYear);
    assert.equal(res80.negativePressureEliminated, true);
    assert.equal(heatSummary.annualHeatLossMwh, res80.annualVentilationHeatLossMwh);
  });

  it('calculates Lokalplan 1269 2.0 l/s/ha max runoff and LAR detention volumes for 10-year vs 100-year rain', () => {
    const tenYear = calculateHydrologicalLarDetention({
      presetId: '10_year',
      areaHa: 4.2,
      imperviousSharePct: 58,
      rainIntensityMmPerHour: 28,
      climateFactor: 1.0,
    });

    const hundredYear = calculateHydrologicalLarDetention({
      presetId: '100_year_climate',
      areaHa: 4.2,
      imperviousSharePct: 58,
      rainIntensityMmPerHour: 74,
      climateFactor: 1.35,
    });

    const subareaVol = calculateLarDetentionVolume({
      areaHa: 4.2,
      rainIntensityMmPerHour: 74,
      imperviousSharePct: 58,
    });

    assert.equal(tenYear.maxAllowedRunoffLPerSecPerHa, 2.0);
    assert.equal(tenYear.maxAllowedTotalOutflowLPerSec, 8.4);
    assert.ok(hundredYear.requiredTotalDetentionM3 > tenYear.requiredTotalDetentionM3);
    assert.equal(subareaVol.maxAllowedOutflowLPerSec, 8.4);
    assert.equal(subareaVol.requiredDetentionM3, hundredYear.requiredTotalDetentionM3);
    assert.ok(
      Math.abs(
        hundredYear.grassGridRetentionM3 +
          hundredYear.roadCassettesRequiredM3 +
          hundredYear.openSealedSwaleRequiredM3 -
          hundredYear.requiredTotalDetentionM3
      ) <= 0.3
    );
  });
});
