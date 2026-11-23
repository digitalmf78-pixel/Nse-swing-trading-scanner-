import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileStatementPresentations } from './statement_reconciliation.ts';

test('ITC Q2 PBT matches main results while segment presentation includes associate share', () => {
  const result = reconcileStatementPresentations(55976600000, 55976600000, 56946200000);
  assert.equal(result.status, 'MATCHES_PRIMARY_ONLY');
  assert.equal(result.differencePrimaryToAlternate, 969600000);
  assert.equal(result.metricMappingApproved, false);
});

test('ITC H1 PBT matches main results while segment presentation includes associate share', () => {
  const result = reconcileStatementPresentations(113726000000, 113726000000, 115554700000);
  assert.equal(result.status, 'MATCHES_PRIMARY_ONLY');
  assert.equal(result.differencePrimaryToAlternate, 1828700000);
  assert.equal(result.metricMappingApproved, false);
});

test('does not approve mapping even when both presentations happen to match', () => {
  const result = reconcileStatementPresentations(100, 100, 100);
  assert.equal(result.status, 'MATCHES_BOTH');
  assert.equal(result.metricMappingApproved, false);
});

test('fails closed for missing or invalid values', () => {
  assert.equal(reconcileStatementPresentations(null, 100, 110).status, 'MISSING_INPUT');
  assert.equal(reconcileStatementPresentations(100, 100, 110, -1).status, 'MISSING_INPUT');
});

test('reports an unreconciled candidate instead of guessing', () => {
  assert.equal(reconcileStatementPresentations(120, 100, 110).status, 'MATCHES_NEITHER');
});


const evidence = (overrides: Partial<import('./statement_reconciliation.ts').StatementFactEvidence> = {}) => ({
  value: 100,
  issuerSymbol: 'ITC',
  isin: 'INE154A01025',
  filingSequenceId: '208371',
  filingGroupId: 'ITC|2026-04-01|2026-09-30|CONSOLIDATED',
  sourceDocumentType: 'XBRL' as const,
  sourceDocumentSha256: 'a'.repeat(64),
  periodStart: '2026-04-01',
  periodEnd: '2026-09-30',
  periodType: 'YTD' as const,
  basis: 'Consolidated' as const,
  currency: 'INR',
  unit: 'INR',
  ...overrides,
});

test('strict evidence reconciliation accepts XBRL and PDF artifacts in one resolved filing group', async () => {
  const { reconcileStatementEvidence } = await import('./statement_reconciliation.ts');
  const result = reconcileStatementEvidence(
    evidence(),
    evidence({ filingSequenceId: 'ITC-PDF-RESULTS', sourceDocumentType: 'RESULTS_PDF', sourceDocumentSha256: 'b'.repeat(64) }),
    evidence({ filingSequenceId: 'ITC-PDF-ALTERNATE', sourceDocumentType: 'OTHER_OFFICIAL', sourceDocumentSha256: 'c'.repeat(64) }),
  );
  assert.equal(result.status, 'MATCHES_BOTH');
  assert.equal(result.metadataValid, true);
  assert.equal(result.metricMappingApproved, false);
});

test('strict evidence reconciliation blocks cross-issuer facts', async () => {
  const { reconcileStatementEvidence } = await import('./statement_reconciliation.ts');
  const result = reconcileStatementEvidence(evidence(), evidence({ issuerSymbol: 'GAIL', isin: 'INE129A01019' }));
  assert.equal(result.status, 'BLOCKED_METADATA_MISMATCH');
  assert.equal(result.metadataValid, false);
  assert.match(result.metadataIssues.join(' '), /same issuer/);
});

test('strict evidence reconciliation blocks period, basis, unit and filing-group mismatches', async () => {
  const { reconcileStatementEvidence } = await import('./statement_reconciliation.ts');
  for (const mismatch of [
    { periodEnd: '2026-06-30' },
    { basis: 'Standalone' as const },
    { unit: 'INR Lakhs' },
    { filingGroupId: 'ITC|2025-04-01|2025-09-30|CONSOLIDATED' },
    { filingSequenceId: '208372' },
    { periodType: 'QUARTER' as const },
    { issuerSymbol: 'GAIL', isin: 'INE129A01019' },
  ]) {
    const result = reconcileStatementEvidence(evidence(), evidence(mismatch));
    assert.equal(result.status, 'BLOCKED_METADATA_MISMATCH');
    assert.equal(result.metadataValid, false);
  }
});

test('strict evidence reconciliation rejects missing values and invalid tolerance', async () => {
  const { reconcileStatementEvidence } = await import('./statement_reconciliation.ts');
  assert.equal(reconcileStatementEvidence(evidence(), evidence({ value: null })).status, 'MISSING_INPUT');
  assert.equal(reconcileStatementEvidence(evidence(), evidence(), null, -1).status, 'MISSING_INPUT');
});


test('strict evidence reconciliation rejects malformed source document hashes', async () => {
  const { reconcileStatementEvidence } = await import('./statement_reconciliation.ts');
  const result = reconcileStatementEvidence(evidence(), evidence({ sourceDocumentSha256: 'not-a-sha256' }));
  assert.equal(result.status, 'BLOCKED_METADATA_MISMATCH');
  assert.equal(result.metadataValid, false);
});


test('strict evidence reconciliation rejects impossible calendar dates and invalid source types', async () => {
  const { reconcileStatementEvidence } = await import('./statement_reconciliation.ts');
  for (const invalid of [
    { periodEnd: '2026-02-30' },
    { sourceDocumentType: 'UNVERIFIED' as 'OTHER_OFFICIAL' },
  ]) {
    const result = reconcileStatementEvidence(evidence(), evidence(invalid));
    assert.equal(result.status, 'BLOCKED_METADATA_MISMATCH');
    assert.equal(result.metadataValid, false);
  }
});
