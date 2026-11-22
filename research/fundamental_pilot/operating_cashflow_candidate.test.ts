import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateOcfCandidate } from './operating_cashflow_candidate.ts';
import type { ComparableMetricFact } from './metric_growth_candidate.ts';

const fact=(overrides:Partial<ComparableMetricFact>={}):ComparableMetricFact=>({
  concept:'in-capmkt:CashFlowsFromUsedInOperatingActivities',numericValue:100,rawValue:'100',isNil:false,
  unitMeasures:['iso4217:INR'],dimensions:[],periodStart:'2026-04-01',periodEnd:'2026-09-30',
  periodType:'YTD',basis:'CONSOLIDATED',...overrides,
});

test('generic OCF candidate preserves negative-to-positive direction and withholds percentage',()=>{
  const r=calculateOcfCandidate(fact({numericValue:42.571}),fact({numericValue:-45.685,periodStart:'2025-04-01',periodEnd:'2025-09-30'}));
  assert.equal(r.status,'CANDIDATE_ONLY');
  assert.equal(r.currentDirection,'POSITIVE');
  assert.equal(r.priorDirection,'NEGATIVE');
  assert.equal(r.percentageChange,null);
  assert.equal(r.productionApproved,false);
});

test('ITC H1 OCF candidate computes percentage only on positive prior base',()=>{
  const r=calculateOcfCandidate(fact({numericValue:8362.97}),fact({numericValue:6162.60,periodStart:'2025-04-01',periodEnd:'2025-09-30'}));
  assert.equal(r.percentageChange,35.71);
});

test('blocks profit or revenue concepts used as OCF',()=>{
  assert.equal(calculateOcfCandidate(fact({concept:'in-capmkt:ProfitLossForPeriod'}),fact({concept:'in-capmkt:ProfitLossForPeriod',periodStart:'2025-04-01',periodEnd:'2025-09-30'})).status,'BLOCKED_CONCEPT_MISMATCH');
});

test('blocks segment OCF facts',()=>{
  assert.equal(calculateOcfCandidate(fact({dimensions:['SegmentAxis=Textiles']}),fact({periodStart:'2025-04-01',periodEnd:'2025-09-30'})).status,'BLOCKED_DIMENSIONAL_FACT');
});

test('blocks standalone and consolidated OCF mixing',()=>{
  assert.equal(calculateOcfCandidate(fact({basis:'CONSOLIDATED'}),fact({basis:'STANDALONE',periodStart:'2025-04-01',periodEnd:'2025-09-30'})).status,'BLOCKED_BASIS_MISMATCH');
});

test('blocks non-aligned OCF periods',()=>{
  assert.equal(calculateOcfCandidate(fact(),fact({periodStart:'2025-03-31',periodEnd:'2025-09-30'})).status,'BLOCKED_PERIOD_ALIGNMENT');
});

test('blocks nil or missing OCF facts',()=>{
  assert.equal(calculateOcfCandidate(fact({isNil:true}),fact({periodStart:'2025-04-01',periodEnd:'2025-09-30'})).status,'BLOCKED_MISSING_VALUE');
});

test('does not infer quarterly OCF from YTD facts',()=>{
  const r=calculateOcfCandidate(fact({periodType:'YTD'}),fact({periodType:'QUARTER',periodStart:'2025-07-01',periodEnd:'2025-09-30'}));
  assert.equal(r.status,'BLOCKED_PERIOD_TYPE_MISMATCH');
});
