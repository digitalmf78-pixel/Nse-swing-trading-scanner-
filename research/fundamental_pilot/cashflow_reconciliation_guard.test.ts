import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCashReconciliation, type CashReconciliationInput } from './cashflow_reconciliation_guard.ts';

const base:CashReconciliationInput = {
  period:'30-SEP-2025', basis:'Standalone', unit:'INR',
  openingCash:100, netCashMovement:-20, closingCashFlowStatement:80,
  closingCashBalanceSheet:80, operatingCashFlow:30, statementOperatingCashFlow:30,
};

test('fully reconciled cash flow is candidate-only',()=>{
  const r=evaluateCashReconciliation(base);
  assert.equal(r.status,'RECONCILED_CANDIDATE');
  assert.equal(r.checks.openingPlusMovementEqualsClosing,true);
  assert.equal(r.checks.cashFlowClosingMatchesBalanceSheet,true);
  assert.equal(r.checks.operatingCashFlowMatchesStatement,true);
  assert.equal(r.productionApproved,false);
});

test('KSHINTL-like revised closing cash mismatch is REVIEW_REQUIRED',()=>{
  const r=evaluateCashReconciliation({...base,closingCashFlowStatement:-235.95,closingCashBalanceSheet:85.89});
  assert.equal(r.status,'REVIEW_REQUIRED');
  assert.equal(r.checks.cashFlowClosingMatchesBalanceSheet,false);
  assert.equal(r.differences.closingCash,-321.84);
  assert.equal(r.productionApproved,false);
});

test('opening plus net movement mismatch is REVIEW_REQUIRED',()=>{
  const r=evaluateCashReconciliation({...base,netCashMovement:5});
  assert.equal(r.status,'REVIEW_REQUIRED');
  assert.equal(r.checks.openingPlusMovementEqualsClosing,false);
});

test('cash-flow OCF differing from statement row is REVIEW_REQUIRED',()=>{
  const r=evaluateCashReconciliation({...base,operatingCashFlow:-778.69,statementOperatingCashFlow:-456.85});
  assert.equal(r.status,'REVIEW_REQUIRED');
  assert.equal(r.checks.operatingCashFlowMatchesStatement,false);
});

test('missing values are blocked, not treated as zero',()=>{
  const r=evaluateCashReconciliation({...base,closingCashBalanceSheet:null});
  assert.equal(r.status,'BLOCKED_MISSING_VALUE');
  assert.equal(r.differences.closingCash,null);
});

test('unpaired OCF cross-check is blocked',()=>{
  const r=evaluateCashReconciliation({...base,statementOperatingCashFlow:null});
  assert.equal(r.status,'BLOCKED_MISSING_VALUE');
});

test('invalid period, unit or tolerance is rejected',()=>{
  const r=evaluateCashReconciliation({...base,tolerance:-1});
  assert.equal(r.status,'BLOCKED_INVALID_INPUT');
});

test('explicit tolerance is applied consistently',()=>{
  const r=evaluateCashReconciliation({...base,closingCashBalanceSheet:80.005,tolerance:0.01});
  assert.equal(r.status,'RECONCILED_CANDIDATE');
});
