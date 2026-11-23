import assert from 'node:assert/strict';
import test from 'node:test';
import { selectNseScannerFundamentalPatches } from '../../server/nseValidatedFundamentalAdapter.ts';
import type { NseValidatedFundamentalCache } from '../../server/nseValidatedFundamentalCache.ts';
import type { FundamentalProfile } from './fundamental_profile.ts';

function profile(periodEnd='2026-09-30', revenueStatus:'VALIDATED'|'BLOCKED'='VALIDATED'): FundamentalProfile {
  const metrics = Object.fromEntries((['REVENUE_GROWTH','PROFIT_GROWTH','ROE','ROCE','DEBT_EQUITY','INTEREST_COVERAGE','OPERATING_CASH_FLOW'] as const).map(metric => [metric,{
    metric,status:'BLOCKED',value:null,currency:null,unit:null,periodType:'QUARTER',periodStart:'2026-07-01',periodEnd,
    filings:[],rawFacts:[],formulaId:null,formulaVersion:null,validationNotes:['Not validated'],
  }])) as unknown as FundamentalProfile['metrics'];
  metrics.REVENUE_GROWTH = {...metrics.REVENUE_GROWTH,status:revenueStatus,value:revenueStatus==='VALIDATED'?15:null,unit:revenueStatus==='VALIDATED'?'PERCENT':null};
  return {symbol:'ABC',isin:'INE0ABC01010',basis:'STANDALONE',periodEnd,metrics};
}
function cache(profiles: FundamentalProfile[]): NseValidatedFundamentalCache {
  return {schemaVersion:1,updatedAtUtc:'',symbols:{ABC:{symbol:'ABC',profiles:profiles.map((profile,i)=>({profile,profileHash:String(i).padStart(64,'0'),savedAtUtc:''}))}}};
}

test('releases validated metric and explicitly nulls blocked metrics',()=>{
  const patch=selectNseScannerFundamentalPatches(cache([profile()])).get('ABC')!;
  assert.equal(patch.revenueGrowthPct,15);
  assert.equal(patch.profitGrowthPct,null);
  assert.equal(patch.roePct,null);
});
test('does not fall back to older period when latest profile exists',()=>{
  const patch=selectNseScannerFundamentalPatches(cache([profile('2026-06-30'),profile('2026-09-30','BLOCKED')])).get('ABC')!;
  assert.equal(patch.revenueGrowthPct,null);
  assert.equal(patch.financialPeriodEnd,'2026-09-30');
});
test('blocks ambiguous same-period profile revisions instead of choosing one',()=>{
  const patch=selectNseScannerFundamentalPatches(cache([profile(),profile()])).get('ABC')!;
  assert.equal(patch.conflict,true);
  assert.equal(patch.revenueGrowthPct,null);
});
test('blocks a validated metric with unexpected scanner unit',()=>{
  const p=profile(); p.metrics.REVENUE_GROWTH.unit='INR';
  const patch=selectNseScannerFundamentalPatches(cache([p])).get('ABC')!;
  assert.equal(patch.revenueGrowthPct,null);
});


import { applyNseValidatedFundamentalPatches } from '../../server/nseValidatedFundamentalAdapter.ts';
import type { FundamentalProfile as ScannerFundamentalProfile } from '../../src/types/trading.ts';

test('pipeline adapter clears legacy seven-metric values and never falls back for blocked metrics', () => {
  const legacy = {
    symbol:'ABC', revenueGrowthPct:44, profitGrowthPct:33, roePct:22, rocePct:21,
    debtToEquity:0.2, interestCoverage:8, operatingCashFlowInr:900,
    trailingPE:28, priceToBook:4, dividendYieldPct:2, freeCashFlowInr:500, earningsQualityStatus:'PASS', valuationStatus:'PASS', epsPrev:4.2, epsCurr:3.1, epsTtmPrev:15, epsTtmCurr:12,
    epsPrevPeriod:'2026-03-31', epsCurrPeriod:'2026-06-30',
    source:'Yahoo Finance (.NS)',
    fundamentalSources:['Yahoo Finance (.NS)','Free Source Cache'],
  } as unknown as ScannerFundamentalProfile;
  const existing = new Map([['ABC',legacy]]);
  const patch = selectNseScannerFundamentalPatches(cache([profile()]));
  const applied = applyNseValidatedFundamentalPatches(existing,patch).get('ABC')!;
  assert.equal(applied.revenueGrowthPct,15);
  assert.equal(applied.profitGrowthPct,null);
  assert.equal(applied.roePct,null);
  assert.equal(applied.rocePct,null);
  assert.equal(applied.debtToEquity,null);
  assert.equal(applied.interestCoverage,null);
  assert.equal(applied.operatingCashFlowInr,null);
  assert.equal(applied.trailingPE,null);
  assert.equal(applied.priceToBook,null);
  assert.equal(applied.dividendYieldPct,null);
  assert.equal(applied.freeCashFlowInr,null);
  assert.equal(applied.earningsQualityStatus,'BLOCKED');
  assert.equal(applied.valuationStatus,'BLOCKED');
  assert.equal(applied.epsPrev,null);
  assert.equal(applied.epsCurr,null);
  assert.equal(applied.epsTtmPrev,null);
  assert.equal(applied.epsTtmCurr,null);
  assert.equal(applied.epsPrevPeriod,'');
  assert.equal(applied.epsCurrPeriod,'');
  assert.deepEqual(applied.fundamentalSources,['NSE Official XBRL (validated)']);
});

test('pipeline adapter clears legacy seven-metric values when no approved NSE profile exists', () => {
  const legacy = {
    symbol:'XYZ', revenueGrowthPct:44, profitGrowthPct:33, roePct:22, rocePct:21,
    debtToEquity:0.2, interestCoverage:8, operatingCashFlowInr:900,
    trailingPE:31, epsPrev:5, epsCurr:2, epsTtmPrev:17, epsTtmCurr:9,
    source:'Yahoo Finance (.NS)',
    fundamentalSources:['Yahoo Finance (.NS)'],
  } as unknown as ScannerFundamentalProfile;
  const applied = applyNseValidatedFundamentalPatches(new Map([['XYZ',legacy]]),new Map()).get('XYZ')!;
  assert.equal(applied.revenueGrowthPct,null);
  assert.equal(applied.profitGrowthPct,null);
  assert.equal(applied.roePct,null);
  assert.equal(applied.rocePct,null);
  assert.equal(applied.debtToEquity,null);
  assert.equal(applied.interestCoverage,null);
  assert.equal(applied.operatingCashFlowInr,null);
  assert.equal(applied.trailingPE,null);
  assert.equal(applied.epsPrev,null);
  assert.equal(applied.epsCurr,null);
  assert.equal(applied.epsTtmPrev,null);
  assert.equal(applied.epsTtmCurr,null);
  assert.deepEqual(applied.fundamentalSources,[]);
});


test('pipeline adapter withholds EPS and valuation even when legacy source label is not Yahoo', () => {
  const legacy = {
    symbol:'NO-SOURCE', revenueGrowthPct:10, profitGrowthPct:20, roePct:12, rocePct:14,
    debtToEquity:0.5, interestCoverage:3, operatingCashFlowInr:100,
    trailingPE:19, priceToBook:2.1, dividendYieldPct:1.5, freeCashFlowInr:40,
    epsPrev:3, epsCurr:4, epsTtmPrev:10, epsTtmCurr:12,
    epsPrevPeriod:'2025-09-30', epsCurrPeriod:'2026-09-30',
    earningsQualityStatus:'PASS', valuationStatus:'PASS',
    promoterHoldingPct:30, fiiHoldingPct:10, diiHoldingPct:5, publicHoldingPct:55,
    marketCapInr:1000000000, enterpriseValueInr:2000000000,
    firstTradeDateIso:'2025-01-01', nextEarningsDate:'2026-01-01',
    source:'Unknown', fundamentalSources:['Unknown provider'],
  } as unknown as ScannerFundamentalProfile;
  const applied = applyNseValidatedFundamentalPatches(new Map([['NO-SOURCE',legacy]]),new Map()).get('NO-SOURCE')!;
  assert.equal(applied.trailingPE,null);
  assert.equal(applied.priceToBook,null);
  assert.equal(applied.dividendYieldPct,null);
  assert.equal(applied.freeCashFlowInr,null);
  assert.equal(applied.epsPrev,null);
  assert.equal(applied.epsCurr,null);
  assert.equal(applied.epsTtmPrev,null);
  assert.equal(applied.epsTtmCurr,null);
  assert.equal(applied.epsPrevPeriod,'');
  assert.equal(applied.epsCurrPeriod,'');
  assert.equal(applied.earningsQualityStatus,'BLOCKED');
  assert.equal(applied.valuationStatus,'BLOCKED');
  assert.equal(applied.promoterHoldingPct,30);
  assert.equal(applied.fiiHoldingPct,10);
  assert.equal(applied.diiHoldingPct,5);
  assert.equal(applied.publicHoldingPct,55);
  assert.equal(applied.marketCapInr,1000000000);
  assert.equal(applied.enterpriseValueInr,2000000000);
  assert.equal(applied.firstTradeDateIso,'2025-01-01');
  assert.equal(applied.nextEarningsDate,'2026-01-01');
  assert.deepEqual(applied.fundamentalSources,[]);
});
