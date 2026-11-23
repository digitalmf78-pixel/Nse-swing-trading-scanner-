import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveNseConceptMap } from './nse_concept_map_resolver.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

function filing(prefix='in-capmkt:', basis:'STANDALONE'|'CONSOLIDATED'='CONSOLIDATED'):XbrlExtraction {
  const profit=basis==='CONSOLIDATED'
    ? 'ProfitOrLossAttributableToOwnersOfParent'
    : 'ProfitLossForPeriod';
  const concepts=[
    prefix+'RevenueFromOperations',
    prefix+profit,
    prefix+'CashFlowsFromUsedInOperatingActivities',
  ];
  return {
    contexts:{},units:{},facts:concepts.map(concept=>({
      concept,contextRef:'ctx',unitRef:'INR',rawValue:'1',numericValue:1,
      decimals:'-3',scale:null,sign:null,format:null,continuedAt:null,isNil:false,isInline:false,
    })),
    contextCount:0,factCount:concepts.length,warnings:[],
  };
}

test('automatically maps the same exact QName across consolidated filings',()=>{
  const current=filing();
  const prior=filing();
  const result=resolveNseConceptMap('NON_FINANCIAL','CONSOLIDATED',current,prior);
  assert.equal(result.status,'MAPPED');
  assert.equal(result.conceptMap?.profit,'in-capmkt:ProfitOrLossAttributableToOwnersOfParent');
  assert.equal(result.conceptMap?.profitAttribution,'OWNERS_OF_PARENT');
  assert.equal(result.productionApproved,false);
});

test('uses entity profit for standalone, never owners-of-parent profit',()=>{
  const result=resolveNseConceptMap('NON_FINANCIAL','STANDALONE',filing('in-capmkt:','STANDALONE'),filing('in-capmkt:','STANDALONE'));
  assert.equal(result.status,'MAPPED');
  assert.equal(result.conceptMap?.profit,'in-capmkt:ProfitLossForPeriod');
  assert.equal(result.conceptMap?.profitAttribution,'STANDALONE_ENTITY');
});

test('blocks if required concept is missing instead of guessing an extension',()=>{
  const prior=filing();
  const current=filing();
  current.facts=current.facts.filter(f=>!f.concept.endsWith('RevenueFromOperations'));
  const result=resolveNseConceptMap('NON_FINANCIAL','CONSOLIDATED',current,prior);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.metrics.REVENUE.status,'MISSING_CONCEPT');
  assert.equal(result.conceptMap,null);
});

test('keeps Revenue and Profit mapping when OCF concept is missing',()=>{
  const current=filing();
  const prior=filing();
  current.facts=current.facts.filter(f=>!f.concept.endsWith('CashFlowsFromUsedInOperatingActivities'));
  prior.facts=prior.facts.filter(f=>!f.concept.endsWith('CashFlowsFromUsedInOperatingActivities'));
  const result=resolveNseConceptMap('NON_FINANCIAL','CONSOLIDATED',current,prior);
  assert.equal(result.status,'PARTIAL');
  assert.equal(result.conceptMap?.revenue,'in-capmkt:RevenueFromOperations');
  assert.equal(result.conceptMap?.profit,'in-capmkt:ProfitOrLossAttributableToOwnersOfParent');
  assert.equal(result.conceptMap?.operatingCashFlow,null);
  assert.equal(result.metrics.OPERATING_CASH_FLOW.status,'MISSING_CONCEPT');
});

test('blocks ambiguous local names from multiple namespaces',()=>{
  const current=filing();
  current.facts.push({...current.facts[0],concept:'ifrs-full:RevenueFromOperations'});
  const result=resolveNseConceptMap('NON_FINANCIAL','CONSOLIDATED',current,filing());
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.metrics.REVENUE.status,'AMBIGUOUS_CONCEPT');
});

test('blocks when current and prior QName namespaces differ',()=>{
  const result=resolveNseConceptMap('NON_FINANCIAL','CONSOLIDATED',filing('in-capmkt:'),filing('ifrs-full:'));
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.metrics.REVENUE.status,'CURRENT_PRIOR_CONCEPT_MISMATCH');
});

test('blocks industrial aliases for banks and other financial sectors',()=>{
  const result=resolveNseConceptMap('BANK','CONSOLIDATED',filing(),filing());
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.metrics.PROFIT.status,'SECTOR_SPECIFIC_MAPPING_REQUIRED');
  assert.equal(result.conceptMap,null);
});
