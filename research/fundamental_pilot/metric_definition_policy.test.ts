import assert from 'node:assert/strict';
import test from 'node:test';
import { getMetricDefinitionPolicy } from './metric_definition_policy.ts';

test('industrial revenue, profit and OCF have candidate-only definitions',()=>{
  for(const metric of ['REVENUE_GROWTH','PROFIT_GROWTH','OPERATING_CASH_FLOW'] as const) {
    const p=getMetricDefinitionPolicy(metric,'NON_FINANCIAL');
    assert.equal(p.readiness,'CANDIDATE_ONLY');
    assert.ok(p.candidateFormula);
    assert.ok(p.hardGates.length>0);
  }
});

test('industrial ROE, ROCE, Debt/Equity and Interest Coverage stay blocked',()=>{
  for(const metric of ['ROE','ROCE','DEBT_EQUITY','INTEREST_COVERAGE'] as const) {
    const p=getMetricDefinitionPolicy(metric,'NON_FINANCIAL');
    assert.equal(p.readiness,'BLOCKED_DEFINITION');
    assert.equal(p.candidateFormula,null);
  }
});

test('bank generic industrial ratios are not applicable',()=>{
  for(const metric of ['ROCE','DEBT_EQUITY','INTEREST_COVERAGE'] as const) {
    assert.equal(getMetricDefinitionPolicy(metric,'BANK').readiness,'NOT_APPLICABLE_GENERIC');
  }
});

test('bank remaining metrics require bank-specific mapping',()=>{
  for(const metric of ['REVENUE_GROWTH','PROFIT_GROWTH','ROE','OPERATING_CASH_FLOW'] as const) {
    assert.equal(getMetricDefinitionPolicy(metric,'BANK').readiness,'REQUIRES_SECTOR_SPECIFIC_MAPPING');
  }
});

test('NBFC and insurance definitions remain sector-specific',()=>{
  for(const sector of ['NBFC','INSURANCE'] as const) {
    for(const metric of ['REVENUE_GROWTH','ROE','DEBT_EQUITY'] as const) {
      assert.equal(getMetricDefinitionPolicy(metric,sector).readiness,'REQUIRES_SECTOR_SPECIFIC_MAPPING');
    }
  }
});

test('unknown sector blocks every formula',()=>{
  assert.equal(getMetricDefinitionPolicy('REVENUE_GROWTH','UNKNOWN').readiness,'BLOCKED_UNKNOWN_SECTOR');
  assert.equal(getMetricDefinitionPolicy('ROE','UNKNOWN').candidateFormula,null);
});

test('all seven metrics fail closed for every non-industrial sector',()=>{
  const metrics = [
    'REVENUE_GROWTH','PROFIT_GROWTH','ROE','ROCE',
    'DEBT_EQUITY','INTEREST_COVERAGE','OPERATING_CASH_FLOW',
  ] as const;
  for(const sector of ['BANK','NBFC','INSURANCE','UNKNOWN'] as const) {
    for(const metric of metrics) {
      const policy = getMetricDefinitionPolicy(metric,sector);
      assert.equal(policy.candidateFormula,null,sector + ' ' + metric + ' must not inherit an industrial formula');
      if(sector === 'UNKNOWN') assert.equal(policy.readiness,'BLOCKED_UNKNOWN_SECTOR');
      else if(sector === 'BANK' && ['ROCE','DEBT_EQUITY','INTEREST_COVERAGE'].includes(metric)) {
        assert.equal(policy.readiness,'NOT_APPLICABLE_GENERIC');
      } else {
        assert.equal(policy.readiness,'REQUIRES_SECTOR_SPECIFIC_MAPPING');
      }
    }
  }
});
