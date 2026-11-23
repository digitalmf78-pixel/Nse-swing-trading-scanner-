import assert from 'node:assert/strict';
import test from 'node:test';
import { selectXbrlMetricFact } from './xbrl_metric_fact_selector.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

const base=():XbrlExtraction=>({
  contexts:{
    current:{id:'current',entityScheme:'https://www.nseindia.com',entityIdentifier:'INE000A01000',periodStart:'2026-04-01',periodEnd:'2026-09-30',instant:null,dimensions:[]},
    prior:{id:'prior',entityScheme:'https://www.nseindia.com',entityIdentifier:'INE000A01000',periodStart:'2025-04-01',periodEnd:'2025-09-30',instant:null,dimensions:[]},
    segment:{id:'segment',entityScheme:'https://www.nseindia.com',entityIdentifier:'INE000A01000',periodStart:'2026-04-01',periodEnd:'2026-09-30',instant:null,dimensions:['in:SegmentAxis=in:Retail']},
  },
  units:{INR:['iso4217:INR'],pure:['xbrli:pure']},
  facts:[
    {concept:'in-capmkt:RevenueFromOperations',contextRef:'current',unitRef:'INR',rawValue:'1200',numericValue:1200,decimals:'-3',scale:null,sign:null,format:null,continuedAt:null,isNil:false,isInline:false},
  ],
  contextCount:3,factCount:1,warnings:[],
});
const request={
  concept:'in-capmkt:RevenueFromOperations',periodStart:'2026-04-01',
  periodEnd:'2026-09-30',periodType:'YTD' as const,
  basis:'CONSOLIDATED' as const,filingBasis:'CONSOLIDATED' as const,
};

test('selects one exact-period undimensioned group fact and retains its unit',()=>{
  const result=selectXbrlMetricFact(base(),request);
  assert.equal(result.status,'SELECTED_UNIQUE_GROUP_FACT');
  assert.equal(result.fact?.numericValue,1200);
  assert.deepEqual(result.fact?.unitMeasures,['iso4217:INR']);
  assert.equal(result.fact?.periodType,'YTD');
  assert.deepEqual(result.fact?.dimensions,[]);
});

test('blocks an absent or mismatched filing-level basis',()=>{
  const result=selectXbrlMetricFact(base(),{...request,filingBasis:null});
  assert.equal(result.status,'BLOCKED_BASIS_MISMATCH');
  assert.equal(result.fact,null);
});

test('does not select a segment fact as a group total',()=>{
  const extraction=base();
  extraction.facts.push({...extraction.facts[0],contextRef:'segment',numericValue:1300,rawValue:'1300'});
  const result=selectXbrlMetricFact(extraction,request);
  assert.equal(result.status,'SELECTED_UNIQUE_GROUP_FACT');
  assert.equal(result.fact?.numericValue,1200);
  assert.equal(result.rejectedContextCount,1);
});

test('blocks ambiguous duplicate group facts',()=>{
  const extraction=base();
  extraction.facts.push({...extraction.facts[0],numericValue:1250,rawValue:'1250'});
  const result=selectXbrlMetricFact(extraction,request);
  assert.equal(result.status,'AMBIGUOUS_GROUP_FACTS');
  assert.equal(result.fact,null);
  assert.equal(result.eligibleCount,2);
});

test('returns missing concept separately from an ineligible context',()=>{
  const absent=selectXbrlMetricFact(base(),{...request,concept:'in-capmkt:UnknownConcept'});
  assert.equal(absent.status,'MISSING_CONCEPT');
  const wrongPeriod=selectXbrlMetricFact(base(),{...request,periodStart:'2025-04-01',periodEnd:'2025-09-30'});
  assert.equal(wrongPeriod.status,'NO_ELIGIBLE_GROUP_FACT');
});

test('withholds nil and non-numeric values rather than zero-filling',()=>{
  const extraction=base();
  extraction.facts[0]={...extraction.facts[0],isNil:true,numericValue:null,rawValue:null};
  const result=selectXbrlMetricFact(extraction,request);
  assert.equal(result.status,'BLOCKED_NON_NUMERIC_FACT');
  assert.equal(result.fact,null);
});

test('blocks facts with unresolved units',()=>{
  const extraction=base();
  extraction.facts[0]={...extraction.facts[0],unitRef:'missing'};
  const result=selectXbrlMetricFact(extraction,request);
  assert.equal(result.status,'BLOCKED_MISSING_UNIT');
  assert.equal(result.fact,null);
});

test('blocks share-count and pure units for monetary statement metrics',()=>{
  const extraction=base();
  extraction.units.shares=['xbrli:shares'];
  extraction.facts[0]={...extraction.facts[0],unitRef:'shares'};
  const result=selectXbrlMetricFact(extraction,request);
  assert.equal(result.status,'BLOCKED_NON_CURRENCY_UNIT');
  assert.equal(result.fact,null);
});
