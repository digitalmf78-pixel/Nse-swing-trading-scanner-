import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { appendValidatedNseFundamentalProfile, loadNseValidatedFundamentalCache } from '../../server/nseValidatedFundamentalCache.ts';
import { type FundamentalMetric, type FundamentalProfile } from './fundamental_profile.ts';

const metricKeys: FundamentalMetric[] = ['REVENUE_GROWTH','PROFIT_GROWTH','ROE','ROCE','DEBT_EQUITY','INTEREST_COVERAGE','OPERATING_CASH_FLOW'];
const filing = {
  exchange:'NSE' as const, symbol:'KSHINTL', isin:'INE0XYZ01000', documentId:'doc-2026', sequenceId:'209920',
  sourceUrl:'https://nsearchives.nseindia.in/corporate/xbrl/test.xml', publishedAt:'2026-11-04T21:06:19+05:30',
  submission:'ORIGINAL' as const, revisedAt:null, revisionRemark:null, auditStatus:'UNAUDITED' as const, basis:'STANDALONE' as const, periodEnd:'2026-09-30',
};
const fact = {
  documentId:'doc-2026', concept:'in-capmkt:RevenueFromOperations', contextRef:'ctx-q2',
  unitMeasures:['iso4217:INR'], dimensions:[], rawValue:'100000000', numericValue:100000000,
  isNil:false, scale:null, decimals:'-3',
};
function makeProfile(): FundamentalProfile {
  const metrics=Object.fromEntries(metricKeys.map(metric=>[metric,{
    metric,status:'BLOCKED',value:null,currency:null,unit:null,periodType:'QUARTER',
    periodStart:'2026-07-01',periodEnd:'2026-09-30',filings:[],rawFacts:[],
    formulaId:null,formulaVersion:null,validationNotes:['Awaiting source and formula validation'],
  }])) as unknown as FundamentalProfile['metrics'];
  metrics.REVENUE_GROWTH={
    metric:'REVENUE_GROWTH',status:'VALIDATED',value:12.5,currency:null,unit:'PERCENT',
    periodType:'QUARTER',periodStart:'2026-07-01',periodEnd:'2026-09-30',
    filings:[filing],rawFacts:[fact],formulaId:'revenue-growth-yoy',formulaVersion:'1.0.0',validationNotes:[],
  };
  return {symbol:'KSHINTL',isin:'INE0XYZ01000',basis:'STANDALONE',periodEnd:'2026-09-30',metrics};
}

function withTempCache(run: (file: string) => void): void {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nse-fundamental-cache-'));
  try { run(path.join(dir,'cache.json')); }
  finally { fs.rmSync(dir,{recursive:true,force:true}); }
}

test('persists validated profile and reloads identical data after process-style cache reopen',()=>{
  withTempCache(file=>{
    const profile=makeProfile();
    const saved=appendValidatedNseFundamentalProfile(profile,{cacheFile:file,now:()=>new Date('2026-11-23T05:30:00.000Z')});
    assert.equal(saved.saved,true);
    const reloaded=loadNseValidatedFundamentalCache(file);
    assert.deepEqual(reloaded.symbols.KSHINTL.profiles[0].profile,profile);
    assert.equal(reloaded.symbols.KSHINTL.profiles[0].profileHash,saved.profileHash);
    assert.equal(reloaded.updatedAtUtc,'2026-11-23T05:30:00.000Z');
  });
});

test('does not duplicate an identical profile on repeated save',()=>{
  withTempCache(file=>{
    const profile=makeProfile();
    const first=appendValidatedNseFundamentalProfile(profile,{cacheFile:file});
    const second=appendValidatedNseFundamentalProfile(profile,{cacheFile:file});
    assert.equal(first.saved,true);
    assert.equal(second.saved,false);
    assert.equal(loadNseValidatedFundamentalCache(file).symbols.KSHINTL.profiles.length,1);
  });
});

test('rejects modified profile content when its stored SHA-256 no longer matches',()=>{
  withTempCache(file=>{
    appendValidatedNseFundamentalProfile(makeProfile(),{cacheFile:file});
    const parsed=JSON.parse(fs.readFileSync(file,'utf8'));
    parsed.symbols.KSHINTL.profiles[0].profile.metrics.REVENUE_GROWTH.value=99;
    fs.writeFileSync(file,JSON.stringify(parsed),'utf8');
    assert.throws(()=>loadNseValidatedFundamentalCache(file),/integrity failed/);
  });
});

test('refuses unsupported cache schema without overwriting the file',()=>{
  withTempCache(file=>{
    const original=JSON.stringify({schemaVersion:999,symbols:{}});
    fs.writeFileSync(file,original,'utf8');
    assert.throws(()=>appendValidatedNseFundamentalProfile(makeProfile(),{cacheFile:file}),/schema invalid/);
    assert.equal(fs.readFileSync(file,'utf8'),original);
  });
});

test('refuses malformed JSON and leaves the original cache untouched',()=>{
  withTempCache(file=>{
    const original='{not-json';
    fs.writeFileSync(file,original,'utf8');
    assert.throws(()=>loadNseValidatedFundamentalCache(file));
    assert.equal(fs.readFileSync(file,'utf8'),original);
  });
});
