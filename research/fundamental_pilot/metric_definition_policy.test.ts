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

test('industrial ROE, ROCE, Debt/Equity and Interest Coverage have explicit non-production candidate formulas',()=>{
  for(const metric of ['ROE','ROCE','DEBT_EQUITY','INTEREST_COVERAGE'] as const) {
    const p=getMetricDefinitionPolicy(metric,'NON_FINANCIAL');
    assert.equal(p.readiness,'CANDIDATE_ONLY');
    assert.ok(p.candidateFormula);
    assert.ok(p.requiredFacts.length>=3);
    assert.ok(p.hardGates.length>=4);
    assert.ok(p.caveats.length>0);
  }
});

test('candidate formula policy does not leak into financial or unknown sectors',()=>{
  for(const sector of ['BANK','NBFC','INSURANCE','UNKNOWN'] as const) {
    for(const metric of ['ROE','ROCE','DEBT_EQUITY','INTEREST_COVERAGE'] as const) {
      const p=getMetricDefinitionPolicy(metric,sector);
      assert.equal(p.candidateFormula,null,`${sector} ${metric} must not inherit an industrial formula`);
      if(sector==='UNKNOWN') assert.equal(p.readiness,'BLOCKED_UNKNOWN_SECTOR');
      else if(sector==='BANK' && ['ROCE','DEBT_EQUITY','INTEREST_COVERAGE'].includes(metric)) assert.equal(p.readiness,'NOT_APPLICABLE_GENERIC');
      else assert.equal(p.readiness,'REQUIRES_SECTOR_SPECIFIC_MAPPING');
    }
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
