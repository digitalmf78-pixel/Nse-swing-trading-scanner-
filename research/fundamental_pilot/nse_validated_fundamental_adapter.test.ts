import assert from 'node:assert/strict';
import test from 'node:test';
import { selectNseScannerFundamentalPatches } from '../../server/nseValidatedFundamentalAdapter.ts';
import type { NseValidatedFundamentalCache } from '../../server/nseValidatedFundamentalCache.ts';
import type { FundamentalProfile } from './fundamental_profile.ts';

function profile(periodEnd='2026-09-30', revenueStatus:'VALIDATED'|'BLOCKED'='VALIDATED'): FundamentalProfile {
  const metrics = Object.fromEntries((['REVENUE_GROWTH','PROFIT_GROWTH','ROE','ROCE','DEBT_EQUITY','INTEREST_COVERAGE','OPERATING_CASH_FLOW'] as const).map(metric => [metric,{
    metric,status:'BLOCKED',value:null,currency:null,unit:null,periodType:'QUARTER',periodStart:'2026-07-01',periodEnd,
    filings:[],rawFacts:[],formulaId:null,formulaVersion:null,validationNotes:['Not validated'],
  }])) as FundamentalProfile['metrics'];
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
