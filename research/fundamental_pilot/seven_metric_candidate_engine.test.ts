import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSevenMetricCandidateReport, type SevenMetricPeriodInput } from './seven_metric_candidate_engine.ts';
import type { ComparableMetricFact } from './metric_growth_candidate.ts';

const fact=(concept:string,value:number,start:string,end:string):ComparableMetricFact=>({
  concept,numericValue:value,rawValue:String(value),isNil:false,
  unitMeasures:['iso4217:INR'],dimensions:[],periodStart:start,periodEnd:end,
  periodType:'YTD',basis:'CONSOLIDATED',
});
const current:SevenMetricPeriodInput={
  periodType:'YTD',periodStart:'2026-04-01',periodEnd:'2026-09-30',basis:'CONSOLIDATED',
  revenue:fact('in-capmkt:RevenueFromOperations',1200,'2026-04-01','2026-09-30'),
  profit:fact('in-capmkt:ProfitLossForPeriod',120,'2026-04-01','2026-09-30'),
  operatingCashFlow:fact('in-capmkt:CashFlowsFromUsedInOperatingActivities',150,'2026-04-01','2026-09-30'),
};
const prior:SevenMetricPeriodInput={
  periodType:'YTD',periodStart:'2025-04-01',periodEnd:'2025-09-30',basis:'CONSOLIDATED',
  revenue:fact('in-capmkt:RevenueFromOperations',1000,'2025-04-01','2025-09-30'),
  profit:fact('in-capmkt:ProfitLossForPeriod',100,'2025-04-01','2025-09-30'),
  operatingCashFlow:fact('in-capmkt:CashFlowsFromUsedInOperatingActivities',100,'2025-04-01','2025-09-30'),
};

test('orchestrates revenue, profit and OCF candidates while blocking four unresolved ratios',()=>{
  const report=buildSevenMetricCandidateReport('NON_FINANCIAL',current,prior);
  assert.equal(report.candidates.revenueGrowth?.growthPercent,20);
  assert.equal(report.candidates.profitGrowth?.growthPercent,20);
  assert.equal(report.candidates.operatingCashFlow?.absoluteChange,50);
  assert.equal(report.auditMatrix.candidateCount,3);
  assert.equal(report.auditMatrix.metrics.ROE.decision,'DATA_BLOCKED');
  assert.equal(report.auditMatrix.metrics.ROCE.decision,'DATA_BLOCKED');
  assert.equal(report.auditMatrix.metrics.DEBT_EQUITY.decision,'DATA_BLOCKED');
  assert.equal(report.auditMatrix.metrics.INTEREST_COVERAGE.decision,'DATA_BLOCKED');
  assert.equal(report.productionApproved,false);
  assert.equal(report.auditMatrix.productionApproved,false);
});

test('missing raw facts remain missing rather than zero-filled',()=>{
  const report=buildSevenMetricCandidateReport('NON_FINANCIAL',{...current,revenue:null},prior);
  assert.equal(report.candidates.revenueGrowth,null);
  assert.equal(report.auditMatrix.metrics.REVENUE_GROWTH.decision,'DATA_MISSING');
  assert.equal(report.auditMatrix.metrics.REVENUE_GROWTH.sourceDataStatus,'MISSING');
});

test('concept conflicts remain explicit and block the candidate',()=>{
  const changed={...current,revenue:fact('in-capmkt:OtherRevenue',1200,'2026-04-01','2026-09-30')};
  const report=buildSevenMetricCandidateReport('NON_FINANCIAL',changed,prior);
  assert.equal(report.candidates.revenueGrowth?.status,'BLOCKED_CONCEPT_MISMATCH');
  assert.equal(report.auditMatrix.metrics.REVENUE_GROWTH.decision,'DATA_CONFLICT');
});

test('bank sector does not inherit industrial growth or ratio definitions',()=>{
  const report=buildSevenMetricCandidateReport('BANK',current,prior);
  assert.equal(report.auditMatrix.metrics.REVENUE_GROWTH.decision,'SECTOR_SPECIFIC_MAPPING_REQUIRED');
  assert.equal(report.auditMatrix.metrics.PROFIT_GROWTH.decision,'SECTOR_SPECIFIC_MAPPING_REQUIRED');
  assert.equal(report.auditMatrix.metrics.OPERATING_CASH_FLOW.decision,'SECTOR_SPECIFIC_MAPPING_REQUIRED');
  assert.equal(report.auditMatrix.productionApproved,false);
});

test('mixed basis is blocked by the candidate comparison guard',()=>{
  const wrongPrior={...prior,basis:'STANDALONE' as const,revenue:{...prior.revenue!,basis:'STANDALONE'}};
  const report=buildSevenMetricCandidateReport('NON_FINANCIAL',current,wrongPrior);
  assert.equal(report.candidates.revenueGrowth?.status,'BLOCKED_BASIS_MISMATCH');
  assert.equal(report.auditMatrix.metrics.REVENUE_GROWTH.decision,'DATA_BLOCKED');
});

test('filing envelope mismatch blocks facts even when current/prior facts agree with each other',()=>{
  const wrongEnvelope={...current,periodStart:'2026-04-02'};
  const report=buildSevenMetricCandidateReport('NON_FINANCIAL',wrongEnvelope,prior);
  assert.equal(report.candidates.revenueGrowth?.status,'BLOCKED_PERIOD_ALIGNMENT');
  assert.equal(report.candidates.profitGrowth?.status,'BLOCKED_PERIOD_ALIGNMENT');
  assert.equal(report.candidates.operatingCashFlow?.status,'BLOCKED_PERIOD_ALIGNMENT');
  assert.equal(report.auditMatrix.metrics.REVENUE_GROWTH.decision,'DATA_BLOCKED');
  assert.equal(report.productionApproved,false);
});
