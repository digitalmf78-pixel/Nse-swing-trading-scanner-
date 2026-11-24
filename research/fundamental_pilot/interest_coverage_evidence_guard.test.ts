import assert from 'node:assert/strict';
import test from 'node:test';
import { assessInterestCoverageEvidence, type InterestCoverageEvidence, type InterestCoverageFact } from './interest_coverage_evidence_guard.ts';
const fact=(concept:string,value:number):InterestCoverageFact=>({
  concept,value,periodStart:'2026-07-01',periodEnd:'2026-09-30',
  basis:'CONSOLIDATED',currency:'INR',unit:'INR',
});
const base=():InterestCoverageEvidence=>({
  periodStart:'2026-07-01',periodEnd:'2026-09-30',basis:'CONSOLIDATED',
  currency:'INR',unit:'INR',ebit:fact('ExplicitReportedEbit',120),
  ebitReconciliationStatus:'REPORTED_EBIT_CANDIDATE',
  financeCosts:fact('FinanceCosts',10),
});
test('exact period FinanceCosts and reconciled EBIT pass as candidate inputs only',()=>{
  const r=assessInterestCoverageEvidence(base());
  assert.equal(r.status,'CANDIDATE_INPUTS_READY');
  assert.equal(r.ebit,120); assert.equal(r.financeCosts,10);
  assert.equal(r.productionApproved,false);
});
test('blocks if EBIT has not passed its independent reconciliation gate',()=>{
  const e=base(); e.ebitReconciliationStatus='BLOCKED';
  assert.equal(assessInterestCoverageEvidence(e).status,'BLOCKED_EBIT_NOT_RECONCILED');
});
test('blocks finance-cost aliases such as cash-flow adjustment',()=>{
  const e=base(); e.financeCosts=fact('AdjustmentsForFinanceCosts',10);
  assert.equal(assessInterestCoverageEvidence(e).status,'BLOCKED_FINANCE_COSTS_CONCEPT_MISMATCH');
});
test('blocks period, basis, currency or unit mismatch',()=>{
  const e=base(); e.financeCosts=fact('FinanceCosts',10); e.financeCosts.periodStart='2026-04-01';
  assert.equal(assessInterestCoverageEvidence(e).status,'BLOCKED_PERIOD_BASIS_OR_UNIT_MISMATCH');
});
test('blocks zero and negative FinanceCosts',()=>{
  for(const value of [0,-1]) { const e=base(); e.financeCosts=fact('FinanceCosts',value);
    assert.equal(assessInterestCoverageEvidence(e).status,'BLOCKED_NONPOSITIVE_FINANCE_COSTS'); }
});
test('missing FinanceCosts blocks',()=>{
  const e=base(); e.financeCosts=null;
  assert.equal(assessInterestCoverageEvidence(e).status,'BLOCKED_FINANCE_COSTS_MISSING');
});
