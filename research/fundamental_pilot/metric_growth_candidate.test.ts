import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateGrowthCandidate, type ComparableMetricFact } from './metric_growth_candidate.ts';

const fact=(overrides:Partial<ComparableMetricFact>={}):ComparableMetricFact=>({
  concept:'in-capmkt:RevenueFromOperations',numericValue:100,rawValue:'100',isNil:false,
  unitMeasures:['iso4217:INR'],dimensions:[],periodStart:'2026-07-01',periodEnd:'2026-09-30',
  periodType:'QUARTER',basis:'CONSOLIDATED',...overrides,
});

test('calculates a same-period revenue growth candidate',()=>{
  const r=calculateGrowthCandidate('REVENUE_GROWTH',fact({numericValue:143.86}),fact({numericValue:100,periodStart:'2025-07-01',periodEnd:'2025-09-30'}));
  assert.equal(r.status,'CANDIDATE_ONLY');
  assert.equal(r.growthPercent,43.86);
  assert.equal(r.productionApproved,false);
});

test('calculates a same-period profit decline candidate',()=>{
  const r=calculateGrowthCandidate('PROFIT_GROWTH',fact({concept:'in-capmkt:ProfitLossForPeriod',numericValue:81.54}),fact({concept:'in-capmkt:ProfitLossForPeriod',numericValue:100,periodStart:'2025-07-01',periodEnd:'2025-09-30'}));
  assert.equal(r.growthPercent,-18.46);
});

test('blocks different XBRL concepts',()=>{
  assert.equal(calculateGrowthCandidate('REVENUE_GROWTH',fact(),fact({concept:'in:Revenue'})).status,'BLOCKED_CONCEPT_MISMATCH');
});

test('blocks unit mismatches',()=>{
  assert.equal(calculateGrowthCandidate('REVENUE_GROWTH',fact(),fact({unitMeasures:['xbrli:pure'],periodStart:'2025-07-01',periodEnd:'2025-09-30'})).status,'BLOCKED_UNIT_MISMATCH');
});

test('blocks segment/dimensional facts',()=>{
  assert.equal(calculateGrowthCandidate('REVENUE_GROWTH',fact({dimensions:['SegmentAxis=FMCG']}),fact({periodStart:'2025-07-01',periodEnd:'2025-09-30'})).status,'BLOCKED_DIMENSIONAL_FACT');
});

test('blocks standalone/consolidated mixing',()=>{
  assert.equal(calculateGrowthCandidate('REVENUE_GROWTH',fact({basis:'CONSOLIDATED'}),fact({basis:'STANDALONE',periodStart:'2025-07-01',periodEnd:'2025-09-30'})).status,'BLOCKED_BASIS_MISMATCH');
});

test('blocks quarter versus YTD and TTM',()=>{
  assert.equal(calculateGrowthCandidate('REVENUE_GROWTH',fact(),fact({periodType:'YTD',periodStart:'2025-07-01',periodEnd:'2025-09-30'})).status,'BLOCKED_PERIOD_TYPE_MISMATCH');
  assert.equal(calculateGrowthCandidate('REVENUE_GROWTH',fact({periodType:'TTM'}),fact({periodType:'TTM',periodStart:'2025-07-01',periodEnd:'2025-09-30'})).status,'BLOCKED_PERIOD_TYPE_MISMATCH');
});

test('blocks date misalignment even when both values exist',()=>{
  assert.equal(calculateGrowthCandidate('REVENUE_GROWTH',fact(),fact({periodStart:'2025-06-30',periodEnd:'2025-09-30'})).status,'BLOCKED_PERIOD_ALIGNMENT');
});

test('blocks zero and negative prior-period bases',()=>{
  assert.equal(calculateGrowthCandidate('PROFIT_GROWTH',fact(),fact({numericValue:0,periodStart:'2025-07-01',periodEnd:'2025-09-30'})).status,'BLOCKED_NON_POSITIVE_PRIOR_BASE');
  assert.equal(calculateGrowthCandidate('PROFIT_GROWTH',fact(),fact({numericValue:-10,periodStart:'2025-07-01',periodEnd:'2025-09-30'})).status,'BLOCKED_NON_POSITIVE_PRIOR_BASE');
});

test('blocks nil and missing numeric facts',()=>{
  assert.equal(calculateGrowthCandidate('REVENUE_GROWTH',fact({isNil:true}),fact({periodStart:'2025-07-01',periodEnd:'2025-09-30'})).status,'BLOCKED_MISSING_VALUE');
});

test('blocks invalid calendar and leap-day alignment',()=>{
  assert.equal(calculateGrowthCandidate('REVENUE_GROWTH',fact({periodEnd:'2026-02-30'}),fact({periodStart:'2025-07-01',periodEnd:'2025-09-30'})).status,'BLOCKED_PERIOD_ALIGNMENT');
  const current=fact({periodStart:'2024-02-29',periodEnd:'2024-03-31',periodType:'YTD'});
  const prior=fact({periodStart:'2023-02-28',periodEnd:'2023-03-31',periodType:'YTD'});
  assert.equal(calculateGrowthCandidate('REVENUE_GROWTH',current,prior).status,'BLOCKED_PERIOD_ALIGNMENT');
});
