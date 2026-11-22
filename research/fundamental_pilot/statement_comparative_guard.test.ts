import assert from 'node:assert/strict';
import test from 'node:test';
import { assessStatementComparativeGuard, type StatementComparativeEvidence } from './statement_comparative_guard.ts';

const matched:StatementComparativeEvidence={
  currentXbrl:1000,priorOriginalXbrl:800,currentPdfCurrent:1000,
  currentPdfPriorComparative:800,priorOriginalPdf:800,
};

test('accepts a fully reconciled current and prior comparative as candidate-only',()=>{
  const result=assessStatementComparativeGuard(matched);
  assert.equal(result.status,'MATCHED_ALL_PERIODS');
  assert.equal(result.comparablePriorValue,800);
  assert.equal(result.productionApproved,false);
});

test('blocks a current XBRL versus current PDF mismatch',()=>{
  const result=assessStatementComparativeGuard({...matched,currentPdfCurrent:999});
  assert.equal(result.status,'CURRENT_XBRL_PDF_CONFLICT');
  assert.equal(result.comparablePriorValue,null);
});

test('blocks a prior Original XBRL versus its own PDF mismatch',()=>{
  const result=assessStatementComparativeGuard({...matched,priorOriginalPdf:799});
  assert.equal(result.status,'PRIOR_ORIGINAL_XBRL_PDF_CONFLICT');
  assert.equal(result.comparablePriorValue,null);
});

test('withholds prior base when current filing comparative was regrouped',()=>{
  const result=assessStatementComparativeGuard({...matched,currentPdfPriorComparative:850});
  assert.equal(result.status,'RECLASSIFIED_COMPARATIVE_REVIEW_REQUIRED');
  assert.equal(result.priorOriginalValue,800);
  assert.equal(result.currentComparativeValue,850);
  assert.equal(result.reclassificationDifference,50);
  assert.equal(result.comparablePriorValue,null);
});

test('does not zero-fill any missing statement evidence',()=>{
  const result=assessStatementComparativeGuard({...matched,priorOriginalPdf:null});
  assert.equal(result.status,'BLOCKED_MISSING_VALUE');
  assert.equal(result.comparablePriorValue,null);
});

test('preserves zero and negative facts as actual values, not missing',()=>{
  const result=assessStatementComparativeGuard({
    currentXbrl:-20,priorOriginalXbrl:0,currentPdfCurrent:-20,
    currentPdfPriorComparative:0,priorOriginalPdf:0,
  });
  assert.equal(result.status,'MATCHED_ALL_PERIODS');
  assert.equal(result.currentValue,-20);
  assert.equal(result.comparablePriorValue,0);
});


test('blocks TEMBO current standalone profit when exact-period XBRL conflicts with NSE PDF',()=>{
  const result=assessStatementComparativeGuard({
    currentXbrl:874786000,
    priorOriginalXbrl:313187000,
    currentPdfCurrent:465433000,
    currentPdfPriorComparative:313187000,
    priorOriginalPdf:313187000,
  });
  assert.equal(result.status,'CURRENT_XBRL_PDF_CONFLICT');
  assert.equal(result.currentValue,874786000);
  assert.equal(result.comparablePriorValue,null);
  assert.equal(result.productionApproved,false);
});

test('accepts TEMBO standalone revenue only after all four source values reconcile',()=>{
  const result=assessStatementComparativeGuard({
    currentXbrl:4342363000,
    priorOriginalXbrl:4544821000,
    currentPdfCurrent:4342363000,
    currentPdfPriorComparative:4544821000,
    priorOriginalPdf:4544821000,
  });
  assert.equal(result.status,'MATCHED_ALL_PERIODS');
  assert.equal(result.comparablePriorValue,4544821000);
  assert.equal(result.productionApproved,false);
});

test('accepts TEMBO standalone OCF statement values as candidate-only after reconciliation',()=>{
  const result=assessStatementComparativeGuard({
    currentXbrl:-636439000,
    priorOriginalXbrl:644929000,
    currentPdfCurrent:-636439000,
    currentPdfPriorComparative:644929000,
    priorOriginalPdf:644929000,
  });
  assert.equal(result.status,'MATCHED_ALL_PERIODS');
  assert.equal(result.currentValue,-636439000);
  assert.equal(result.comparablePriorValue,644929000);
  assert.equal(result.productionApproved,false);
});
