import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCashReconciliation, type CashReconciliationInput, type CashFlowFactValue } from './cashflow_reconciliation_guard.ts';

const fact=(value:number|null,unit='INR',period='30-SEP-2025',basis:'Standalone'|'Consolidated'='Standalone'):CashFlowFactValue=>({value,unit,period,basis});
const base:CashReconciliationInput = {
  period:'30-SEP-2025', basis:'Standalone', unit:'INR',
  openingCash:fact(100), netCashMovement:fact(-20), closingCashFlowStatement:fact(80),
  closingCashBalanceSheet:fact(80), operatingCashFlow:fact(30), statementOperatingCashFlow:fact(30),
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
  const r=evaluateCashReconciliation({...base,closingCashFlowStatement:fact(-235.95),closingCashBalanceSheet:fact(85.89)});
  assert.equal(r.status,'REVIEW_REQUIRED');
  assert.equal(r.checks.cashFlowClosingMatchesBalanceSheet,false);
  assert.equal(r.differences.closingCash,-321.84);
  assert.equal(r.productionApproved,false);
});

test('KSHINTL revised iXBRL figures pass roll-forward but fail balance-sheet cash tie-out',()=>{
  const lakhs=(value:number):CashFlowFactValue=>fact(value,'INR Lakhs');
  const r=evaluateCashReconciliation({
    period:'30-SEP-2025',basis:'Standalone',unit:'INR Lakhs',
    openingCash:lakhs(1036.70),
    netCashMovement:lakhs(-3396.20),
    closingCashFlowStatement:lakhs(-2359.50),
    closingCashBalanceSheet:lakhs(858.90),
    operatingCashFlow:lakhs(-7786.90),
    statementOperatingCashFlow:lakhs(-7786.90),
  });
  assert.equal(r.status,'REVIEW_REQUIRED');
  assert.equal(r.checks.openingPlusMovementEqualsClosing,true);
  assert.equal(r.checks.cashFlowClosingMatchesBalanceSheet,false);
  assert.equal(r.checks.operatingCashFlowMatchesStatement,true);
  assert.equal(r.differences.closingCash,-3218.40);
});

test('opening plus net movement mismatch is REVIEW_REQUIRED',()=>{
  const r=evaluateCashReconciliation({...base,netCashMovement:fact(5)});
  assert.equal(r.status,'REVIEW_REQUIRED');
  assert.equal(r.checks.openingPlusMovementEqualsClosing,false);
});

test('cash-flow OCF differing from statement row is REVIEW_REQUIRED',()=>{
  const r=evaluateCashReconciliation({...base,operatingCashFlow:fact(-778.69),statementOperatingCashFlow:fact(-456.85)});
  assert.equal(r.status,'REVIEW_REQUIRED');
  assert.equal(r.checks.operatingCashFlowMatchesStatement,false);
});

test('missing values are blocked, not treated as zero',()=>{
  const r=evaluateCashReconciliation({...base,closingCashBalanceSheet:fact(null)});
  assert.equal(r.status,'BLOCKED_MISSING_VALUE');
  assert.equal(r.differences.closingCash,null);
});

test('unpaired OCF cross-check is blocked',()=>{
  const r=evaluateCashReconciliation({...base,statementOperatingCashFlow:null});
  assert.equal(r.status,'BLOCKED_MISSING_VALUE');
});

test('invalid tolerance is rejected',()=>{
  const r=evaluateCashReconciliation({...base,tolerance:-1});
  assert.equal(r.status,'BLOCKED_INVALID_INPUT');
});

test('explicit tolerance is applied consistently',()=>{
  const r=evaluateCashReconciliation({...base,closingCashBalanceSheet:fact(80.005),tolerance:0.01});
  assert.equal(r.status,'RECONCILED_CANDIDATE');
});

test('mixed unit is rejected before arithmetic',()=>{
  const r=evaluateCashReconciliation({...base,closingCashBalanceSheet:fact(8000000,'INR Lakhs')});
  assert.equal(r.status,'BLOCKED_INVALID_INPUT');
});

test('mixed reporting period is rejected before arithmetic',()=>{
  const r=evaluateCashReconciliation({...base,netCashMovement:fact(-20,'INR','31-DEC-2025')});
  assert.equal(r.status,'BLOCKED_INVALID_INPUT');
});

test('mixed standalone and consolidated facts are rejected',()=>{
  const r=evaluateCashReconciliation({...base,closingCashBalanceSheet:fact(80,'INR','30-SEP-2025','Consolidated')});
  assert.equal(r.status,'BLOCKED_INVALID_INPUT');
});
