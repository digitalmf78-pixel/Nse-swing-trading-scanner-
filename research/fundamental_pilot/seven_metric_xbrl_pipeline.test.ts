import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSevenMetricXbrlPipeline, type XbrlFilingPeriodInput } from './seven_metric_xbrl_pipeline.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

const concepts={
  revenue:'in-capmkt:RevenueFromOperations',
  profit:'in-capmkt:ProfitOrLossAttributableToOwnersOfParent',
  profitAttribution:'OWNERS_OF_PARENT',
  operatingCashFlow:'in-capmkt:CashFlowsFromUsedInOperatingActivities',
};
function extraction(start:string,end:string,values:{revenue?:number;profit?:number;ocf?:number}={}):XbrlExtraction {
  const facts=[];
  for(const [key,concept] of Object.entries(concepts)) {
    const value=values[(key==='operatingCashFlow'?'ocf':key) as keyof typeof values];
    if(value===undefined) continue;
    facts.push({
      concept,contextRef:'duration',unitRef:'INR',rawValue:String(value),
      numericValue:value,decimals:'-3',scale:null,sign:null,format:null,
      continuedAt:null,isNil:false,isInline:false,
    });
  }
  return {
    contexts:{
      duration:{id:'duration',entityScheme:'https://www.nseindia.com',entityIdentifier:'INE000A01000',periodStart:start,periodEnd:end,instant:null,dimensions:[]},
    },
    units:{INR:['iso4217:INR']},facts,contextCount:1,factCount:facts.length,warnings:[],
  };
}
const current:XbrlFilingPeriodInput={
  extraction:extraction('2026-04-01','2026-09-30',{revenue:1200,profit:120,ocf:150}),
  periodType:'YTD',periodStart:'2026-04-01',periodEnd:'2026-09-30',
  basis:'CONSOLIDATED',filingBasis:'CONSOLIDATED',
};
const prior:XbrlFilingPeriodInput={
  extraction:extraction('2025-04-01','2025-09-30',{revenue:1000,profit:100,ocf:100}),
  periodType:'YTD',periodStart:'2025-04-01',periodEnd:'2025-09-30',
  basis:'CONSOLIDATED',filingBasis:'CONSOLIDATED',
};

test('runs concept selection through the candidate engine for all three eligible metrics',()=>{
  const report=buildSevenMetricXbrlPipeline('NON_FINANCIAL',current,prior,concepts);
  assert.equal(report.currentSelections.revenue.status,'SELECTED_UNIQUE_GROUP_FACT');
  assert.equal(report.candidateReport.candidates.revenueGrowth?.growthPercent,20);
  assert.equal(report.candidateReport.candidates.profitGrowth?.growthPercent,20);
  assert.equal(report.candidateReport.candidates.operatingCashFlow?.absoluteChange,50);
  assert.equal(report.candidateReport.auditMatrix.candidateCount,3);
  assert.equal(report.productionApproved,false);
});

test('preserves missing concept status instead of replacing it with zero',()=>{
  const noRevenue={...current,extraction:extraction('2026-04-01','2026-09-30',{profit:120,ocf:150})};
  const report=buildSevenMetricXbrlPipeline('NON_FINANCIAL',noRevenue,prior,concepts);
  assert.equal(report.currentSelections.revenue.status,'MISSING_CONCEPT');
  assert.equal(report.candidateReport.auditMatrix.metrics.REVENUE_GROWTH.sourceDataStatus,'MISSING');
  assert.equal(report.candidateReport.auditMatrix.metrics.REVENUE_GROWTH.decision,'DATA_MISSING');
  assert.equal(report.candidateReport.candidates.revenueGrowth,null);
});

test('preserves ambiguous concept facts as conflict',()=>{
  const duplicate=extraction('2026-04-01','2026-09-30',{revenue:1200,profit:120,ocf:150});
  duplicate.facts.push({...duplicate.facts[0],numericValue:1250,rawValue:'1250'});
  const report=buildSevenMetricXbrlPipeline('NON_FINANCIAL',{...current,extraction:duplicate},prior,concepts);
  assert.equal(report.currentSelections.revenue.status,'AMBIGUOUS_GROUP_FACTS');
  assert.equal(report.candidateReport.auditMatrix.metrics.REVENUE_GROWTH.sourceDataStatus,'CONFLICT');
  assert.equal(report.candidateReport.auditMatrix.metrics.REVENUE_GROWTH.decision,'DATA_CONFLICT');
});

test('blocks all candidate facts when filing-level basis is not explicit',()=>{
  const report=buildSevenMetricXbrlPipeline('NON_FINANCIAL',{...current,filingBasis:null},prior,concepts);
  assert.equal(report.currentSelections.revenue.status,'BLOCKED_BASIS_MISMATCH');
  assert.equal(report.candidateReport.auditMatrix.metrics.REVENUE_GROWTH.decision,'DATA_BLOCKED');
});

test('blocks consolidated total-group profit when owner-attributable profit is required',()=>{
  assert.throws(()=>buildSevenMetricXbrlPipeline('NON_FINANCIAL',current,prior,{...concepts,profit:'in-capmkt:ProfitLossForPeriod'}),/must use the profit attributable to owners of the parent/);
});

test('blocks standalone profit when attribution policy is not explicitly standalone',()=>{
  const standaloneCurrent={...current,basis:'STANDALONE' as const,filingBasis:'STANDALONE' as const};
  const standalonePrior={...prior,basis:'STANDALONE' as const,filingBasis:'STANDALONE' as const};
  assert.throws(()=>buildSevenMetricXbrlPipeline('NON_FINANCIAL',standaloneCurrent,standalonePrior,concepts),/must use the standalone entity profit result/);
});

test('does not guess a taxonomy concept when issuer mapping is absent',()=>{
  const report=buildSevenMetricXbrlPipeline('NON_FINANCIAL',current,prior,{
    ...concepts,revenue:'in-capmkt:UnmappedRevenueExtension',
  });
  assert.equal(report.currentSelections.revenue.status,'MISSING_CONCEPT');
  assert.equal(report.candidateReport.auditMatrix.metrics.REVENUE_GROWTH.decision,'DATA_MISSING');
});

test('keeps four ratio metrics blocked even when all three selected flows exist',()=>{
  const report=buildSevenMetricXbrlPipeline('NON_FINANCIAL',current,prior,concepts);
  for(const metric of ['ROE','ROCE','DEBT_EQUITY','INTEREST_COVERAGE'] as const) {
    assert.equal(report.candidateReport.auditMatrix.metrics[metric].sourceDataStatus,'BLOCKED');
    assert.equal(report.candidateReport.auditMatrix.metrics[metric].decision,'DATA_BLOCKED');
  }
});
