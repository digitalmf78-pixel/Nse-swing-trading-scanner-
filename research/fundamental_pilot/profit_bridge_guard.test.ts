import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileProfitAfterTaxBridge, type ProfitBridgeFact } from './profit_bridge_guard.ts';

const fact = (value: number | null, overrides: Partial<ProfitBridgeFact> = {}): ProfitBridgeFact => ({
  value, periodStart: '2026-04-01', periodEnd: '2026-09-30', basis: 'STANDALONE', unit: 'INR',
  ...overrides,
});

test('reconciles PAT using PBT plus signed negative tax expense', () => {
  const result = reconcileProfitAfterTaxBridge(fact(4654.33), fact(6701.60), fact(-2047.27), 0.01);
  assert.equal(result.status, 'RECONCILED_CANDIDATE_ONLY');
  assert.equal(result.expectedProfitAfterTax, 4654.33);
  assert.equal(result.difference, 0);
  assert.equal(result.productionApproved, false);
});

test('blocks TEMBO-style profit candidate that subtracts negative tax', () => {
  const result = reconcileProfitAfterTaxBridge(fact(8747.86), fact(6701.60), fact(-2047.27), 0.01);
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.equal(result.expectedProfitAfterTax, 4654.33);
  assert.equal(result.difference, 4093.53);
  assert.equal(result.productionApproved, false);
});

test('blocks period mismatch', () => {
  assert.equal(reconcileProfitAfterTaxBridge(fact(100), fact(120), fact(-20, {
    periodStart: '2025-04-01', periodEnd: '2025-09-30',
  })).status, 'BLOCKED_PERIOD_MISMATCH');
});

test('blocks standalone/consolidated mixing', () => {
  assert.equal(reconcileProfitAfterTaxBridge(fact(100), fact(120, { basis: 'CONSOLIDATED' }), fact(-20)).status,
    'BLOCKED_BASIS_MISMATCH');
});

test('blocks unit mismatch', () => {
  assert.equal(reconcileProfitAfterTaxBridge(fact(100), fact(120), fact(-20, { unit: 'USD' })).status,
    'BLOCKED_UNIT_MISMATCH');
});

test('blocks missing values and invalid tolerance', () => {
  assert.equal(reconcileProfitAfterTaxBridge(fact(null), fact(120), fact(-20)).status, 'BLOCKED_MISSING_INPUT');
  assert.equal(reconcileProfitAfterTaxBridge(fact(100), fact(120), fact(-20), -1).status, 'BLOCKED_MISSING_INPUT');
});

test('a reconciled arithmetic bridge never approves production', () => {
  const result = reconcileProfitAfterTaxBridge(fact(80), fact(100), fact(-20));
  assert.equal(result.status, 'RECONCILED_CANDIDATE_ONLY');
  assert.equal(result.productionApproved, false);
});
