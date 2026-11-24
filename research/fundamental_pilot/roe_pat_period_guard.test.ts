import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRoePatPeriodCandidate } from './roe_pat_period_guard.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

function extraction(context:{id:string;start:string|null;end:string|null;instant:string|null},concept:string,value:number,issuer='INE000A01000'):XbrlExtraction {
  return {
    contexts:{[context.id]:{id:context.id,entityScheme:'https://www.nseindia.com',entityIdentifier:issuer,
      periodStart:context.start,periodEnd:context.end,instant:context.instant,dimensions:[]}},
    units:{INR:['iso4217:INR']},
    facts:[{concept,contextRef:context.id,unitRef:'INR',rawValue:String(value),numericValue:value,
      decimals:'-3',scale:null,sign:null,format:null,continuedAt:null,isNil:false,isInline:false}],
    contextCount:1,factCount:1,warnings:[],
  };
}
const ownerEquity='in-capmkt:EquityAttributableToOwnersOfParent';
const consolidatedPat='in-capmkt:ProfitOrLossAttributableToOwnersOfParent';
const equityPair=():Parameters<typeof selectRoePatPeriodCandidate>[0]['equityPair']=>({
  opening:{extraction:extraction({id:'open',start:null,end:null,instant:'2025-03-31'},ownerEquity,800),
    concept:ownerEquity,date:'2025-03-31',basis:'CONSOLIDATED',filingBasis:'CONSOLIDATED'},
  closing:{extraction:extraction({id:'close',start:null,end:null,instant:'2026-03-31'},ownerEquity,1000),
    concept:ownerEquity,date:'2026-03-31',basis:'CONSOLIDATED',filingBasis:'CONSOLIDATED'},
});
const request=():Parameters<typeof selectRoePatPeriodCandidate>[0]=>({
  equityPair:equityPair(),
  patExtraction:extraction({id:'pat',start:'2025-04-01',end:'2026-03-31',instant:null},consolidatedPat,120),
  periodStart:'2025-04-01',periodEnd:'2026-03-31',periodType:'FY',
  basis:'CONSOLIDATED',filingBasis:'CONSOLIDATED',concept:consolidatedPat,
});
test('selects same-issuer exact FY owner PAT with average owner equity as candidate only',()=>{
  const result=selectRoePatPeriodCandidate(request());
  assert.equal(result.status,'SELECTED_PAT_PERIOD_CANDIDATE');
  assert.equal(result.pat,120); assert.equal(result.averageEquity,900);
  assert.equal(result.currency,'iso4217:INR'); assert.equal(result.productionApproved,false);
});
test('blocks a PAT period that does not start immediately after opening equity',()=>{
  const input=request(); input.periodStart='2025-04-02';
  input.patExtraction=extraction({id:'pat',start:'2025-04-02',end:'2026-03-31',instant:null},consolidatedPat,120);
  assert.equal(selectRoePatPeriodCandidate(input).status,'BLOCKED_PERIOD_ALIGNMENT');
});
test('blocks a PAT period ending before closing equity date',()=>{
  const input=request(); input.periodEnd='2026-03-30';
  input.patExtraction=extraction({id:'pat',start:'2025-04-01',end:'2026-03-30',instant:null},consolidatedPat,120);
  assert.equal(selectRoePatPeriodCandidate(input).status,'BLOCKED_PERIOD_ALIGNMENT');
});
test('blocks issuer mismatch between PAT and equity',()=>{
  const input=request();
  input.patExtraction=extraction({id:'pat',start:'2025-04-01',end:'2026-03-31',instant:null},consolidatedPat,120,'INE999Z01000');
  assert.equal(selectRoePatPeriodCandidate(input).status,'BLOCKED_ISSUER_MISMATCH');
});
test('blocks missing filing-level basis',()=>{
  const input=request(); input.filingBasis=null;
  assert.equal(selectRoePatPeriodCandidate(input).status,'BLOCKED_BASIS_MISMATCH');
});
test('blocks consolidated PAT concepts that are not owner-attributable',()=>{
  const input=request(); input.concept='in-capmkt:ProfitLossForPeriod';
  assert.equal(selectRoePatPeriodCandidate(input).status,'BLOCKED_CONCEPT_MISMATCH');
});
test('blocks mixed PAT/equity currencies',()=>{
  const input=request(); input.patExtraction.units.INR=['iso4217:USD'];
  assert.equal(selectRoePatPeriodCandidate(input).status,'BLOCKED_CURRENCY_MISMATCH');
});
test('blocks missing PAT fact and never returns a partial candidate',()=>{
  const input=request(); input.patExtraction.facts=[];
  const result=selectRoePatPeriodCandidate(input);
  assert.equal(result.status,'BLOCKED_FACT_SELECTION');
  assert.equal(result.pat,null); assert.equal(result.averageEquity,null);
});
test('standalone filings require entity profit for period concept',()=>{
  const input=request(); const standalone='in-capmkt:ProfitLossForPeriod';
  input.equityPair.opening.basis='STANDALONE'; input.equityPair.opening.filingBasis='STANDALONE';
  input.equityPair.closing.basis='STANDALONE'; input.equityPair.closing.filingBasis='STANDALONE';
  input.patExtraction=extraction({id:'pat',start:'2025-04-01',end:'2026-03-31',instant:null},standalone,120);
  input.basis='STANDALONE'; input.filingBasis='STANDALONE'; input.concept=standalone;
  assert.equal(selectRoePatPeriodCandidate(input).status,'SELECTED_PAT_PERIOD_CANDIDATE');
});
