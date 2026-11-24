import assert from 'node:assert/strict';
import test from 'node:test';
import { assessEbitBridgeEvidence, type EbitBridgeEvidence, type EbitBridgeFact } from './ebit_bridge_evidence_guard.ts';

const fact=(concept:string,value:number):EbitBridgeFact=>({
  concept,value,periodStart:'2026-04-01',periodEnd:'2026-06-30',
  basis:'STANDALONE',currency:'INR',unit:'INR',
});
const base=():EbitBridgeEvidence=>({
  basis:'STANDALONE',periodStart:'2026-04-01',periodEnd:'2026-06-30',
  currency:'INR',unit:'INR',reportedEbit:null,
  pbt:fact('ProfitBeforeTax',100),financeCosts:fact('FinanceCosts',10),
  statementRowReconciled:false,
});

test('PBT plus finance costs alone is not accepted as EBIT',()=>{
  const result=assessEbitBridgeEvidence(base());
  assert.equal(result.status,'BLOCKED_PBT_PLUS_FINANCE_COSTS_INSUFFICIENT');
  assert.equal(result.ebit,null);
  assert.equal(result.productionApproved,false);
});

test('reported EBIT needs official statement reconciliation',()=>{
  const evidence=base();
  evidence.reportedEbit=fact('ReportedOperatingProfit',120);
  const result=assessEbitBridgeEvidence(evidence);
  assert.equal(result.status,'BLOCKED_REPORTED_EBIT_NOT_RECONCILED');
  assert.equal(result.ebit,null);
});

test('exact-envelope reconciled EBIT is candidate only',()=>{
  const evidence=base();
  evidence.reportedEbit=fact('ReportedOperatingProfit',120);
  evidence.statementRowReconciled=true;
  const result=assessEbitBridgeEvidence(evidence);
  assert.equal(result.status,'REPORTED_EBIT_CANDIDATE');
  assert.equal(result.ebit,120);
  assert.equal(result.sourceConcept,'ReportedOperatingProfit');
  assert.equal(result.productionApproved,false);
});

test('period, basis, currency or unit mismatch blocks EBIT candidate',()=>{
  const evidence=base();
  const reported=fact('ReportedOperatingProfit',120);
  reported.basis='CONSOLIDATED';
  evidence.reportedEbit=reported;
  evidence.statementRowReconciled=true;
  assert.equal(assessEbitBridgeEvidence(evidence).status,'BLOCKED_PERIOD_BASIS_OR_UNIT_MISMATCH');
});

test('missing reported EBIT never falls back to a proxy',()=>{
  const evidence=base();
  evidence.pbt=null;
  evidence.financeCosts=null;
  assert.equal(assessEbitBridgeEvidence(evidence).status,'BLOCKED_EBIT_NOT_REPORTED');
});
