import assert from 'node:assert/strict';
import test from 'node:test';
import { assessMetricApplicability, isEligibleGroupContext } from './sector_metric_policy.ts';

test('bank filings block generic industrial ROCE, debt/equity and interest coverage', () => {
  for (const metric of ['ROCE', 'DEBT_EQUITY', 'INTEREST_COVERAGE'] as const) {
    assert.equal(assessMetricApplicability('BANK', metric), 'NOT_APPLICABLE_GENERIC_FORMULA');
  }
});

test('bank growth, ROE and OCF require bank-specific mapping', () => {
  for (const metric of ['REVENUE_GROWTH', 'PROFIT_GROWTH', 'ROE', 'OPERATING_CASH_FLOW'] as const) {
    assert.equal(assessMetricApplicability('BANK', metric), 'REQUIRES_BANK_SPECIFIC_MAPPING');
  }
});

test('NBFC, insurer and unknown-sector profiles fail closed', () => {
  assert.equal(assessMetricApplicability('NBFC', 'ROE'), 'REQUIRES_NBFC_SPECIFIC_MAPPING');
  assert.equal(assessMetricApplicability('INSURANCE', 'ROE'), 'REQUIRES_INSURANCE_SPECIFIC_MAPPING');
  assert.equal(assessMetricApplicability('UNKNOWN', 'ROE'), 'BLOCKED_UNKNOWN_SECTOR');
});

test('non-financial metrics are not silently production-approved', () => {
  assert.equal(assessMetricApplicability('NON_FINANCIAL', 'ROCE'), 'REQUIRES_FORMULA_VALIDATION');
});

const durationContext = {
  periodStart: '2026-07-01', periodEnd: '2026-09-30', instant: null, dimensions: [],
};
const durationExpectation = {
  periodStart: '2026-07-01', periodEnd: '2026-09-30',
  periodKind: 'DURATION' as const, basis: 'CONSOLIDATED' as const,
  filingBasis: 'CONSOLIDATED' as const,
};

test('accepts exact undimensioned group duration context with matching filing basis', () => {
  assert.equal(isEligibleGroupContext(durationContext, durationExpectation), true);
});

test('rejects segment/dimensional facts from group-total selection', () => {
  assert.equal(isEligibleGroupContext({ ...durationContext, dimensions: ['Segment=FMCG'] }, durationExpectation), false);
});

test('rejects mismatched or missing consolidated/standalone filing basis', () => {
  assert.equal(isEligibleGroupContext(durationContext, { ...durationExpectation, filingBasis: 'STANDALONE' }), false);
  assert.equal(isEligibleGroupContext(durationContext, { ...durationExpectation, filingBasis: null }), false);
});

test('rejects wrong period dates and duration/instant shape', () => {
  assert.equal(isEligibleGroupContext({ ...durationContext, periodEnd: '2026-06-30' }, durationExpectation), false);
  assert.equal(isEligibleGroupContext({ ...durationContext, instant: '2026-09-30' }, durationExpectation), false);
});

test('accepts only exact instant context for balance-sheet facts', () => {
  const instant = { periodStart: null, periodEnd: null, instant: '2026-09-30', dimensions: [] };
  const expected = {
    periodStart: '', periodEnd: '2026-09-30', periodKind: 'INSTANT' as const,
    basis: 'STANDALONE' as const, filingBasis: 'STANDALONE' as const,
  };
  assert.equal(isEligibleGroupContext(instant, expected), true);
  assert.equal(isEligibleGroupContext({ ...instant, instant: null }, expected), false);
});
