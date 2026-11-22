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
