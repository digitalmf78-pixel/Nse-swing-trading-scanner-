import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveNseRatioFactMap } from './nse_ratio_fact_map.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

function filing(basis:'STANDALONE'|'CONSOLIDATED'='STANDALONE'):XbrlExtraction {
  const profit=basis==='CONSOLIDATED'?'ProfitOrLossAttributableToOwnersOfParent':'ProfitLossForPeriod';
  const names=[profit,'EquityAttributableToOwnersOfParent','ProfitBeforeTax','FinanceCosts','BorrowingsCurrent','BorrowingsNoncurrent'];
  return {contexts:{},units:{},facts:names.map(n=>({
    concept:'in-capmkt:'+n,contextRef:'ctx',unitRef:'INR',rawValue:'1',numericValue:1,
    decimals:null,scale:null,sign:null,format:null,continuedAt:null,isNil:false,isInline:false,
  })),contextCount:0,factCount:names.length,warnings:[]};
}

test('maps exact observed standalone concepts to candidate roles without approving a ratio',()=>{
  const result=resolveNseRatioFactMap('DEBT_EQUITY','NON_FINANCIAL','STANDALONE',filing());
  assert.equal(result.status,'CANDIDATE_FACT_MAP');
  assert.equal(result.concepts.CURRENT_BORROWINGS,'in-capmkt:BorrowingsCurrent');
  assert.equal(result.concepts.NONCURRENT_BORROWINGS,'in-capmkt:BorrowingsNoncurrent');
  assert.equal(result.concepts.TOTAL_EQUITY,'in-capmkt:EquityAttributableToOwnersOfParent');
  assert.equal(result.productionApproved,false);
});

test('consolidated ROE requires owners-of-parent profit, never unallocated group profit',()=>{
  const result=resolveNseRatioFactMap('ROE','NON_FINANCIAL','CONSOLIDATED',filing('CONSOLIDATED'));
  assert.equal(result.status,'CANDIDATE_FACT_MAP');
  assert.equal(result.concepts.PROFIT_NUMERATOR,'in-capmkt:ProfitOrLossAttributableToOwnersOfParent');
});

test('standalone ROE uses entity profit and blocks if only consolidated attribution is present',()=>{
  const f=filing();
  f.facts=f.facts.filter(x=>!x.concept.endsWith('ProfitLossForPeriod'));
  f.facts.push({...f.facts[0],concept:'in-capmkt:ProfitOrLossAttributableToOwnersOfParent'});
  const result=resolveNseRatioFactMap('ROE','NON_FINANCIAL','STANDALONE',f);
  assert.equal(result.status,'BLOCKED_MISSING_CONCEPT');
  assert.deepEqual(result.missingRoles,['PROFIT_NUMERATOR']);
});

test('blocks ambiguous equity aliases instead of choosing one',()=>{
  const f=filing();
  f.facts.push({...f.facts[0],concept:'in-capmkt:Equity'});
  const result=resolveNseRatioFactMap('DEBT_EQUITY','NON_FINANCIAL','STANDALONE',f);
  assert.equal(result.status,'BLOCKED_AMBIGUOUS_CONCEPT');
  assert.deepEqual(result.ambiguousRoles,['TOTAL_EQUITY']);
});

test('blocks generic ratio mapping for bank and unknown sectors',()=>{
  for(const sector of ['BANK','UNKNOWN','NBFC','INSURANCE'] as const) {
    const result=resolveNseRatioFactMap('INTEREST_COVERAGE',sector,'CONSOLIDATED',filing('CONSOLIDATED'));
    assert.equal(result.status,'BLOCKED_SECTOR');
    assert.deepEqual(result.concepts,{});
  }
});

test('ROCE maps only source input roles and does not invent EBIT',()=>{
  const result=resolveNseRatioFactMap('ROCE','NON_FINANCIAL','STANDALONE',filing());
  assert.equal(result.status,'CANDIDATE_FACT_MAP');
  assert.equal(result.concepts.PBT,'in-capmkt:ProfitBeforeTax');
  assert.equal(result.concepts.FINANCE_COSTS,'in-capmkt:FinanceCosts');
  assert.equal(result.concepts.PROFIT_NUMERATOR,undefined);
  assert.match(result.explanation,/No facts were selected and no ratio was calculated/);
});
