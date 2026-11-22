import assert from 'node:assert/strict';
import test from 'node:test';
import { validateFundamentalProfile, type FundamentalMetric, type FundamentalProfile } from './fundamental_profile.ts';

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
  }])) as FundamentalProfile['metrics'];
  metrics.REVENUE_GROWTH={
    metric:'REVENUE_GROWTH',status:'VALIDATED',value:12.5,currency:null,unit:'PERCENT',
    periodType:'QUARTER',periodStart:'2026-07-01',periodEnd:'2026-09-30',
    filings:[filing],rawFacts:[fact],formulaId:'revenue-growth-yoy',formulaVersion:'1.0.0',validationNotes:[],
  };
  return {symbol:'KSHINTL',isin:'INE0XYZ01000',basis:'STANDALONE',periodEnd:'2026-09-30',metrics};
}

test('accepts explicit seven-metric profile with one fully traced validated metric and blocked remainder',()=>{
  assert.deepEqual(validateFundamentalProfile(makeProfile()),[]);
});

test('rejects a validated metric without numeric value or provenance',()=>{
  const p=makeProfile();
  p.metrics.REVENUE_GROWTH.value=null;
  p.metrics.REVENUE_GROWTH.rawFacts=[];
  p.metrics.REVENUE_GROWTH.filings=[];
  const codes=validateFundamentalProfile(p).map(x=>x.code);
  assert.ok(codes.includes('INVALID_VALUE'));
  assert.ok(codes.includes('FACT_REQUIRED'));
  assert.ok(codes.includes('FILING_REQUIRED'));
});

test('rejects a non-validated metric that contains a numeric value',()=>{
  const p=makeProfile();
  p.metrics.PROFIT_GROWTH.value=5;
  assert.ok(validateFundamentalProfile(p).some(x=>x.code==='UNVALIDATED_VALUE'));
});

test('rejects cross-basis filing provenance',()=>{
  const p=makeProfile();
  p.metrics.REVENUE_GROWTH.filings[0]={...filing,basis:'CONSOLIDATED'};
  assert.ok(validateFundamentalProfile(p).some(x=>x.code==='BASIS_MISMATCH'));
});

test('rejects unofficial source domains',()=>{
  const p=makeProfile();
  p.metrics.REVENUE_GROWTH.filings[0]={...filing,sourceUrl:'https://nseindia.com.attacker.example/file.xml'};
  assert.ok(validateFundamentalProfile(p).some(x=>x.code==='UNTRUSTED_SOURCE'));
});

test('rejects nil or unresolved raw fact values for validated metric',()=>{
  const p=makeProfile();
  p.metrics.REVENUE_GROWTH.rawFacts[0]={...fact,isNil:true,numericValue:null};
  assert.ok(validateFundamentalProfile(p).some(x=>x.code==='FACT_NOT_NUMERIC'));
});

test('rejects raw fact linked to another document',()=>{
  const p=makeProfile();
  p.metrics.REVENUE_GROWTH.rawFacts[0]={...fact,documentId:'other-doc'};
  assert.ok(validateFundamentalProfile(p).some(x=>x.code==='FACT_DOCUMENT_MISMATCH'));
});

test('rejects mixing NSE and BSE sources in one profile',()=>{
  const p=makeProfile();
  p.metrics.PROFIT_GROWTH={
    metric:'PROFIT_GROWTH',status:'VALIDATED',value:10,currency:'INR',unit:'PERCENT',
    periodType:'QUARTER',periodStart:'2026-07-01',periodEnd:'2026-09-30',
    filings:[{...filing,exchange:'BSE',sourceUrl:'https://www.bseindia.com/corporates/Comp_Resultsnew.aspx',documentId:'doc-bse'}],
    rawFacts:[{...fact,documentId:'doc-bse'}],formulaId:'profit-growth-yoy',formulaVersion:'1.0.0',validationNotes:[],
  };
  assert.ok(validateFundamentalProfile(p).some(x=>x.code==='MIXED_EXCHANGE_SOURCES'));
});

test('rejects instant facts carrying a duration start date',()=>{
  const p=makeProfile();
  p.metrics.REVENUE_GROWTH.periodType='INSTANT';
  assert.ok(validateFundamentalProfile(p).some(x=>x.code==='INSTANT_HAS_START'));
});

test('rejects impossible calendar dates instead of normalizing them',()=>{
  const p=makeProfile();
  p.periodEnd='2026-02-30';
  assert.ok(validateFundamentalProfile(p).some(x=>x.code==='INVALID_DATE'));
});

test('requires revision timestamp and remark for revision provenance',()=>{
  const p=makeProfile();
  p.metrics.REVENUE_GROWTH.filings[0]={...filing,submission:'REVISION',revisedAt:null,revisionRemark:null};
  assert.ok(validateFundamentalProfile(p).some(x=>x.code==='REVISION_METADATA_REQUIRED'));
});

test('rejects currency labels on percentage metrics',()=>{
  const p=makeProfile();
  p.metrics.REVENUE_GROWTH.currency='INR';
  assert.ok(validateFundamentalProfile(p).some(x=>x.code==='CURRENCY_UNIT_MISMATCH'));
});
