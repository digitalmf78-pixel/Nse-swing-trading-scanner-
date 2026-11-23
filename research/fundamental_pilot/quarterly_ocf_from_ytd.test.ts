import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveQuarterlyOcfFromYtd } from './quarterly_ocf_from_ytd.ts';
import type { ComparableMetricFact } from './metric_growth_candidate.ts';

const fact=(value:number,start:string,end:string,overrides:Partial<ComparableMetricFact>={}):ComparableMetricFact=>({
  concept:'in-capmkt:CashFlowsFromUsedInOperatingActivities',numericValue:value,rawValue:String(value),isNil:false,
  unitMeasures:['iso4217:INR'],dimensions:[],periodStart:start,periodEnd:end,periodType:'YTD',basis:'CONSOLIDATED',...overrides,
});

test('derives Q2 OCF from exact current/prior H1 YTD minus Q1 YTD pairs',()=>{
  const r=deriveQuarterlyOcfFromYtd(
    fact(100,'2026-04-01','2026-09-30'),
    fact(40,'2026-04-01','2026-06-30'),
    fact(80,'2025-04-01','2025-09-30'),
    fact(30,'2025-04-01','2025-06-30'),
  );
  assert.equal(r.status,'CANDIDATE_ONLY');
  assert.equal(r.currentQuarterValue,60);
  assert.equal(r.priorQuarterValue,50);
  assert.equal(r.currentQuarterStart,'2026-07-01');
  assert.equal(r.currentQuarterEnd,'2026-09-30');
  assert.equal(r.yoyPercent,20);
});

test('withholds percentage if prior quarterly OCF derived base is negative',()=>{
  const r=deriveQuarterlyOcfFromYtd(
    fact(20,'2026-04-01','2026-09-30'),fact(40,'2026-04-01','2026-06-30'),
    fact(10,'2025-04-01','2025-09-30'),fact(30,'2025-04-01','2025-06-30'),
  );
  assert.equal(r.currentQuarterValue,-20);
  assert.equal(r.priorQuarterValue,-20);
  assert.equal(r.yoyPercent,null);
});

test('blocks missing or nil facts',()=>{
  const r=deriveQuarterlyOcfFromYtd(
    fact(100,'2026-04-01','2026-09-30'),fact(40,'2026-04-01','2026-06-30'),
    fact(80,'2025-04-01','2025-09-30'),fact(30,'2025-04-01','2025-06-30',{isNil:true,numericValue:null}),
  );
  assert.equal(r.status,'BLOCKED_MISSING_VALUE');
});

test('blocks any non-OCF concept',()=>{
  const r=deriveQuarterlyOcfFromYtd(
    fact(100,'2026-04-01','2026-09-30',{concept:'in-capmkt:ProfitLossForPeriod'}),
    fact(40,'2026-04-01','2026-06-30'),fact(80,'2025-04-01','2025-09-30'),fact(30,'2025-04-01','2025-06-30'),
  );
  assert.equal(r.status,'BLOCKED_SOURCE_MISMATCH');
});

test('blocks unit or basis mismatches',()=>{
  assert.equal(deriveQuarterlyOcfFromYtd(
    fact(100,'2026-04-01','2026-09-30'),fact(40,'2026-04-01','2026-06-30'),
    fact(80,'2025-04-01','2025-09-30'),fact(30,'2025-04-01','2025-06-30',{unitMeasures:['xbrli:pure']}),
  ).status,'BLOCKED_SOURCE_MISMATCH');
  assert.equal(deriveQuarterlyOcfFromYtd(
    fact(100,'2026-04-01','2026-09-30'),fact(40,'2026-04-01','2026-06-30'),
    fact(80,'2025-04-01','2025-09-30'),fact(30,'2025-04-01','2025-06-30',{basis:'STANDALONE'}),
  ).status,'BLOCKED_SOURCE_MISMATCH');
});

test('blocks dimensional segment facts',()=>{
  assert.equal(deriveQuarterlyOcfFromYtd(
    fact(100,'2026-04-01','2026-09-30'),fact(40,'2026-04-01','2026-06-30',{dimensions:['SegmentAxis=Hotels']}),
    fact(80,'2025-04-01','2025-09-30'),fact(30,'2025-04-01','2025-06-30'),
  ).status,'BLOCKED_SOURCE_MISMATCH');
});

test('blocks quarter and TTM facts; only YTD inputs are accepted',()=>{
  assert.equal(deriveQuarterlyOcfFromYtd(
    fact(100,'2026-04-01','2026-09-30'),fact(40,'2026-04-01','2026-06-30',{periodType:'QUARTER'}),
    fact(80,'2025-04-01','2025-09-30'),fact(30,'2025-04-01','2025-06-30'),
  ).status,'BLOCKED_INVALID_YTD_PAIR');
});

test('blocks mismatched YTD start/end dates across years',()=>{
  assert.equal(deriveQuarterlyOcfFromYtd(
    fact(100,'2026-04-01','2026-09-30'),fact(40,'2026-04-01','2026-06-30'),
    fact(80,'2025-04-01','2025-09-30'),fact(30,'2025-03-31','2025-06-30'),
  ).status,'BLOCKED_PERIOD_ALIGNMENT');
});

test('rejects impossible calendar dates without throwing',()=>{
  const r=deriveQuarterlyOcfFromYtd(
    fact(100,'2026-04-01','2026-02-30'),fact(40,'2026-04-01','2026-06-30'),
    fact(80,'2025-04-01','2025-09-30'),fact(30,'2025-04-01','2025-06-30'),
  );
  assert.equal(r.status,'BLOCKED_PERIOD_ALIGNMENT');
});
