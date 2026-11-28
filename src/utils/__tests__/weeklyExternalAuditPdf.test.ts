import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildWeeklyExternalAuditSummary,
  generateWeeklyExternalAuditPdf,
} from '../../services/weeklyExternalAuditPdfService';
import {
  INITIAL_DEMOLITION_SOURCES,
  INITIAL_RECEPTOR_ZONES,
} from '../../data/ringparkenData';

describe('Automatisk Ugerapport til Ekstern Revision (Støj, Støv & Vejr)', () => {
  it('aggregerer 7 døgn (168 timer) deterministisk på tværs af støj, støv og vejr med SHA-256 segl', () => {
    const summary = buildWeeklyExternalAuditSummary({
      dateIso: '2026-11-27',
      sources: INITIAL_DEMOLITION_SOURCES,
      receptors: INITIAL_RECEPTOR_ZONES,
      manualMachineNoiseOutputDb: 115,
      isManualMachineNoiseOverrideActive: true,
      merkleRootSignature: 'merkle-root-test-0123456789abcdef',
    });

    assert.equal(summary.totalHoursAnalyzed, 168);
    assert.equal(summary.dailyRows.length, 7);
    assert.ok(summary.topExposedReceptors.length > 0);
    assert.ok(summary.weeklyPeakSumQuotientS > 0);
    assert.ok(summary.weeklyPeakLafmaxDb > 60);
    assert.ok(summary.weeklyMaxGustMs > 10);
    assert.match(summary.auditSha256, /^[0-9a-f]{64}$/i);
    assert.equal(summary.auditFindingsSummaryDa.length, 4);
  });

  it('returnerer revisionsklart PDF-filnavn og valideret summary via dryRun', () => {
    const res = generateWeeklyExternalAuditPdf({
      dateIso: '2026-11-27',
      sources: INITIAL_DEMOLITION_SOURCES,
      receptors: INITIAL_RECEPTOR_ZONES,
      dryRun: true,
    });

    assert.match(
      res.fileName,
      /^Ringparken_Ekstern_Revision_Ugerapport_\d{4}-\d{2}-\d{2}\.pdf$/
    );
    assert.equal(res.summary.dailyRows.length, 7);
    assert.ok(res.exportedAtIso.length > 10);
  });
});
