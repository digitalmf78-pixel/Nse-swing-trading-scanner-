import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMetricAuditMatrix } from './metric_audit_matrix.ts';

const allMetrics = {
  REVENUE_GROWTH:'VALIDATED',
  PROFIT_GROWTH:'VALIDATED',
  ROE:'VALIDATED',
  ROCE:'VALIDATED',
  DEBT_EQUITY:'VALIDATED',
  INTEREST_COVERAGE:'VALIDATED',
  OPERATING_CASH_FLOW:'VALIDATED',
} as const;

test('non-financial matrix keeps industrial Interest Coverage blocked pending issuer evidence', () => {
  const matrix=buildMetricAuditMatrix('NON_FINANCIAL',allMetrics);
  assert.equal(matrix.metrics.REVENUE_GROWTH.decision,'DATA_VALIDATED_FORMULA_CANDIDATE_ONLY');
  assert.equal(matrix.metrics.PROFIT_GROWTH.decision,'DATA_VALIDATED_FORMULA_CANDIDATE_ONLY');
  assert.equal(matrix.metrics.OPERATING_CASH_FLOW.decision,'DATA_VALIDATED_FORMULA_CANDIDATE_ONLY');
  assert.equal(matrix.metrics.ROE.decision,'DATA_VALIDATED_FORMULA_CANDIDATE_ONLY');
  assert.equal(matrix.metrics.ROCE.decision,'DATA_VALIDATED_FORMULA_CANDIDATE_ONLY');
  assert.equal(matrix.metrics.DEBT_EQUITY.decision,'DATA_VALIDATED_FORMULA_CANDIDATE_ONLY');
  assert.equal(matrix.metrics.INTEREST_COVERAGE.decision,'FORMULA_BLOCKED_DEFINITION');
  assert.equal(matrix.productionApproved,false);
  assert.equal(matrix.readyForProduction,false);
  assert.equal(matrix.candidateCount,6);
  assert.equal(matrix.blockedCount,1);
});

test('absent metric is explicitly missing and never zero-filled', () => {
  const matrix=buildMetricAuditMatrix('NON_FINANCIAL',{});
  for(const row of Object.values(matrix.metrics)) {
    assert.equal(row.sourceDataStatus,'ABSENT');
    assert.equal(row.decision,'DATA_MISSING');
    assert.equal(row.productionApproved,false);
  }
  assert.equal(matrix.candidateCount,0);
  assert.equal(matrix.blockedCount,7);
});

test('conflicts, blocked, N/A and missing remain distinct', () => {
  const matrix=buildMetricAuditMatrix('NON_FINANCIAL',{
    REVENUE_GROWTH:'CONFLICT',
    PROFIT_GROWTH:'BLOCKED',
    ROE:'NOT_APPLICABLE',
    OPERATING_CASH_FLOW:'MISSING',
  });
  assert.equal(matrix.metrics.REVENUE_GROWTH.decision,'DATA_CONFLICT');
  assert.equal(matrix.metrics.PROFIT_GROWTH.decision,'DATA_BLOCKED');
  assert.equal(matrix.metrics.ROE.decision,'DATA_NOT_APPLICABLE');
  assert.equal(matrix.metrics.OPERATING_CASH_FLOW.decision,'DATA_MISSING');
});

test('bank metrics cannot inherit generic industrial formulas', () => {
  const matrix=buildMetricAuditMatrix('BANK',allMetrics);
  assert.equal(matrix.metrics.ROCE.decision,'FORMULA_NOT_APPLICABLE_GENERIC');
  assert.equal(matrix.metrics.DEBT_EQUITY.decision,'FORMULA_NOT_APPLICABLE_GENERIC');
  assert.equal(matrix.metrics.INTEREST_COVERAGE.decision,'FORMULA_NOT_APPLICABLE_GENERIC');
  assert.equal(matrix.metrics.REVENUE_GROWTH.decision,'SECTOR_SPECIFIC_MAPPING_REQUIRED');
  assert.equal(matrix.productionApproved,false);
});

test('NBFC, insurance and unknown sectors stay gated', () => {
  for(const sector of ['NBFC','INSURANCE','UNKNOWN'] as const) {
    const matrix=buildMetricAuditMatrix(sector,allMetrics);
    assert.equal(matrix.candidateCount,0);
    assert.equal(matrix.productionApproved,false);
    for(const row of Object.values(matrix.metrics)) {
      assert.notEqual(row.decision,'DATA_VALIDATED_FORMULA_CANDIDATE_ONLY');
    }
  }
});
