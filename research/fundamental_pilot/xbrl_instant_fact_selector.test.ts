import assert from 'node:assert/strict';
import test from 'node:test';
import { selectXbrlInstantFact, selectXbrlInstantFactBundle } from './xbrl_instant_fact_selector.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

function filing():XbrlExtraction {
  return {
    contexts:{
      closing:{id:'closing',entityScheme:'https://www.nseindia.com',entityIdentifier:'INE000A01000',periodStart:null,periodEnd:null,instant:'2026-09-30',dimensions:[]},
      prior:{id:'prior',entityScheme:'https://www.nseindia.com',entityIdentifier:'INE000A01000',periodStart:null,periodEnd:null,instant:'2025-09-30',dimensions:[]},
      segment:{id:'segment',entityScheme:'https://www.nseindia.com',entityIdentifier:'INE000A01000',periodStart:null,periodEnd:null,instant:'2026-09-30',dimensions:['in-capmkt:SegmentsAxis=segment:One']},
    },
    units:{INR:['iso4217:INR']},
    facts:[
      {concept:'in-capmkt:Equity',contextRef:'closing',unitRef:'INR',rawValue:'1000',numericValue:1000,decimals:'-3',scale:null,sign:null,format:null,continuedAt:null,isNil:false,isInline:false},
      {concept:'in-capmkt:Equity',contextRef:'prior',unitRef:'INR',rawValue:'800',numericValue:800,decimals:'-3',scale:null,sign:null,format:null,continuedAt:null,isNil:false,isInline:false},
      {concept:'in-capmkt:Equity',contextRef:'segment',unitRef:'INR',rawValue:'300',numericValue:300,decimals:'-3',scale:null,sign:null,format:null,continuedAt:null,isNil:false,isInline:false},
    ],
    contextCount:3,factCount:3,warnings:[],
  };
}
const request={concept:'in-capmkt:Equity',instantDate:'2026-09-30',basis:'STANDALONE' as const,filingBasis:'STANDALONE' as const};

test('selects exact-date undimensioned instant fact and excludes prior/segment contexts',()=>{
  const result=selectXbrlInstantFact(filing(),request);
  assert.equal(result.status,'SELECTED_UNIQUE_GROUP_FACT');
  assert.equal(result.fact?.numericValue,1000);
  assert.equal(result.rejectedContextCount,2);
});
test('blocks when filing basis is absent or mismatched',()=>{
  assert.equal(selectXbrlInstantFact(filing(),{...request,filingBasis:null}).status,'BLOCKED_BASIS_MISMATCH');
});
test('does not select when exact instant date is missing',()=>{
  assert.equal(selectXbrlInstantFact(filing(),{...request,instantDate:'2026-12-31'}).status,'NO_ELIGIBLE_GROUP_FACT');
});
test('blocks duplicate exact group facts as ambiguous',()=>{
  const duplicate=filing();
  duplicate.facts.push({...duplicate.facts[0],rawValue:'1001',numericValue:1001});
  assert.equal(selectXbrlInstantFact(duplicate,request).status,'AMBIGUOUS_GROUP_FACTS');
});
test('does not convert nil or missing-unit facts to zero',()=>{
  const nil=filing();
  nil.facts[0]={...nil.facts[0],isNil:true,numericValue:null};
  assert.equal(selectXbrlInstantFact(nil,request).status,'BLOCKED_NON_NUMERIC_FACT');
  const noUnit=filing();
  noUnit.facts[0]={...noUnit.facts[0],unitRef:null};
  assert.equal(selectXbrlInstantFact(noUnit,request).status,'BLOCKED_MISSING_UNIT');
});


test('selects a complete multi-concept instant bundle only in one currency',()=>{
  const data=filing();
  data.facts.push({concept:'in-capmkt:BorrowingsCurrent',contextRef:'closing',unitRef:'INR',rawValue:'200',numericValue:200,decimals:'-3',scale:null,sign:null,format:null,continuedAt:null,isNil:false,isInline:false});
  const result=selectXbrlInstantFactBundle(data,{
    concepts:{equity:'in-capmkt:Equity',currentBorrowings:'in-capmkt:BorrowingsCurrent'},
    instantDate:'2026-09-30',basis:'STANDALONE',filingBasis:'STANDALONE',
  });
  assert.equal(result.status,'SELECTED_ALL_FACTS');
  assert.equal(result.facts?.equity.numericValue,1000);
  assert.equal(result.facts?.currentBorrowings.numericValue,200);
  assert.equal(result.currency,'iso4217:INR');
});
test('withholds partial bundles when any required concept is missing',()=>{
  const result=selectXbrlInstantFactBundle(filing(),{
    concepts:{equity:'in-capmkt:Equity',debt:'in-capmkt:BorrowingsCurrent'},
    instantDate:'2026-09-30',basis:'STANDALONE',filingBasis:'STANDALONE',
  });
  assert.equal(result.status,'BLOCKED_FACT_SELECTION');
  assert.equal(result.facts,null);
  assert.deepEqual(result.failedConcepts,['debt (in-capmkt:BorrowingsCurrent): MISSING_CONCEPT']);
});
