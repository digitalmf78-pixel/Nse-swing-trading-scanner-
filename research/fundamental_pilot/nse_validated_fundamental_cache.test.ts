import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendValidatedNseFundamentalProfile, loadNseValidatedFundamentalCache } from '../../server/nseValidatedFundamentalCache.ts';
import type { FundamentalMetric, FundamentalProfile } from './fundamental_profile.ts';

const keys: FundamentalMetric[] = ['REVENUE_GROWTH','PROFIT_GROWTH','ROE','ROCE','DEBT_EQUITY','INTEREST_COVERAGE','OPERATING_CASH_FLOW'];
function profile(value = 12.5, periodEnd = '2026-09-30'): FundamentalProfile {
  const filing = { exchange:'NSE' as const, symbol:'ABC', isin:'INE0ABC01010', documentId:'doc-1', sequenceId:'seq-1',
    sourceUrl:'https://nsearchives.nseindia.in/corporate/xbrl/a.xml', publishedAt:'2026-11-01T10:00:00+05:30',
    submission:'ORIGINAL' as const, revisedAt:null, revisionRemark:null, auditStatus:'UNAUDITED' as const,
    basis:'STANDALONE' as const, periodEnd };
  const fact = { documentId:'doc-1', concept:'in-capmkt:RevenueFromOperations', contextRef:'ctx', unitMeasures:['iso4217:INR'],
    dimensions:[], rawValue:'100', numericValue:100, isNil:false, scale:null, decimals:'0' };
  const metrics = Object.fromEntries(keys.map(metric => [metric, {
    metric,status:'BLOCKED',value:null,currency:null,unit:null,periodType:'QUARTER',periodStart:'2026-07-01',
    periodEnd,filings:[],rawFacts:[],formulaId:null,formulaVersion:null,validationNotes:['Not yet validated'],
  }])) as unknown as FundamentalProfile['metrics'];
  metrics.REVENUE_GROWTH = { metric:'REVENUE_GROWTH',status:'VALIDATED',value,currency:null,unit:'PERCENT',
    periodType:'QUARTER',periodStart:'2026-07-01',periodEnd,filings:[filing],rawFacts:[fact],
    formulaId:'revenue-growth-yoy',formulaVersion:'1.0.0',validationNotes:[] };
  return { symbol:'ABC',isin:'INE0ABC01010',basis:'STANDALONE',periodEnd,metrics };
}
function tempFile() { return path.join(fs.mkdtempSync(path.join(os.tmpdir(),'nse-fund-cache-')),'cache.json'); }

test('persists only validated issuer profile and reloads it from disk', () => {
  const file=tempFile();
  const result=appendValidatedNseFundamentalProfile(profile(),{cacheFile:file});
  assert.equal(result.saved,true);
  const loaded=loadNseValidatedFundamentalCache(file);
  assert.equal(loaded.symbols.ABC.profiles.length,1);
  assert.equal(loaded.symbols.ABC.profiles[0].profile.metrics.REVENUE_GROWTH.value,12.5);
});
test('exact profile replay is idempotent', () => {
  const file=tempFile(); appendValidatedNseFundamentalProfile(profile(),{cacheFile:file});
  const result=appendValidatedNseFundamentalProfile(profile(),{cacheFile:file});
  assert.equal(result.saved,false); assert.equal(result.profilesForSymbol,1);
});
test('keeps changed profile/revision evidence instead of overwriting earlier profile', () => {
  const file=tempFile(); appendValidatedNseFundamentalProfile(profile(),{cacheFile:file});
  appendValidatedNseFundamentalProfile(profile(13.2),{cacheFile:file});
  assert.equal(loadNseValidatedFundamentalCache(file).symbols.ABC.profiles.length,2);
});
test('rejects unvalidated numeric metrics', () => {
  const file=tempFile(); const p=profile(); p.metrics.ROE.value=15;
  assert.throws(()=>appendValidatedNseFundamentalProfile(p,{cacheFile:file}),/Fundamental profile rejected/);
  assert.equal(fs.existsSync(file),false);
});
test('rejects corrupted cache rather than overwriting it', () => {
  const file=tempFile(); fs.writeFileSync(file,JSON.stringify({schemaVersion:99,symbols:{}}));
  assert.throws(()=>appendValidatedNseFundamentalProfile(profile(),{cacheFile:file}),/schema invalid/);
});
