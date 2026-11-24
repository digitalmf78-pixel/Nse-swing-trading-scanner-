import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCashReconciliation, type CashReconciliationInput, type CashFlowFactValue } from './cashflow_reconciliation_guard.ts';

const instant=(value:number|null,date='2025-09-30',unit='INR',basis:'Standalone'|'Consolidated'='Standalone'):CashFlowFactValue=>({value,unit,basis,context:{kind:'INSTANT',date}});
const duration=(value:number|null,startDate='2025-04-01',endDate='2025-09-30',unit='INR',basis:'Standalone'|'Consolidated'='Standalone'):CashFlowFactValue=>({value,unit,basis,context:{kind:'DURATION',startDate,endDate}});
const base:CashReconciliationInput = {
  periodStart:'2025-04-01',periodEnd:'2025-09-30',basis:'Standalone',unit:'INR',
  openingCash:instant(100,'2025-03-31'),netCashMovement:duration(-20),
  closingCashFlowStatement:instant(80),closingCashBalanceSheet:instant(80),
  operatingCashFlow:duration(30),statementOperatingCashFlow:duration(30),
};

test('fully reconciled cash flow distinguishes instant and duration contexts',()=>{
  const r=evaluateCashReconciliation(base);
  assert.equal(r.status,'RECONCILED_CANDIDATE');
  assert.equal(r.checks.openingPlusMovementEqualsClosing,true);
  assert.equal(r.checks.cashFlowClosingMatchesBalanceSheet,true);
  assert.equal(r.checks.operatingCashFlowMatchesStatement,true);
  assert.equal(r.productionApproved,false);
});

test('official NSE Chambal Fertilisers consolidated H1 FY2026-27 cash flow reconciles',()=>{
  // NSE filing: 01-Apr-2026 to 30-Sep-2026, consolidated, unaudited, INR Lakhs.
  // Opening cash 30,790 + net movement (10,002) = closing cash 20,788.
  // Closing cash agrees with balance-sheet cash; OCF (128,338) matches its statement row.
  const lakhs=(value:number,date:string):CashFlowFactValue=>instant(value,date,'INR Lakhs','Consolidated');
  const period=(value:number):CashFlowFactValue=>duration(value,'2026-04-01','2026-09-30','INR Lakhs','Consolidated');
  const r=evaluateCashReconciliation({
    periodStart:'2026-04-01',periodEnd:'2026-09-30',basis:'Consolidated',unit:'INR Lakhs',
    openingCash:lakhs(30790,'2026-03-31'),
    netCashMovement:period(-10002),
    closingCashFlowStatement:lakhs(20788,'2026-09-30'),
    closingCashBalanceSheet:lakhs(20788,'2026-09-30'),
    operatingCashFlow:period(-128338),
    statementOperatingCashFlow:period(-128338),
  });
  assert.equal(r.status,'RECONCILED_CANDIDATE');
  assert.equal(r.checks.openingPlusMovementEqualsClosing,true);
  assert.equal(r.checks.cashFlowClosingMatchesBalanceSheet,true);
  assert.equal(r.checks.operatingCashFlowMatchesStatement,true);
  assert.equal(r.differences.rollForward,0);
  assert.equal(r.differences.closingCash,0);
  assert.equal(r.differences.operatingCashFlow,0);
  assert.equal(r.productionApproved,false);
});

test('cash-flow closing cash mismatch is REVIEW_REQUIRED',()=>{
  const r=evaluateCashReconciliation({...base,closingCashFlowStatement:instant(-235.95),closingCashBalanceSheet:instant(85.89)});
  assert.equal(r.status,'REVIEW_REQUIRED');
  assert.equal(r.checks.cashFlowClosingMatchesBalanceSheet,false);
  assert.equal(r.differences.closingCash,-321.84);
});

test('opening plus net movement mismatch is REVIEW_REQUIRED',()=>{
  const r=evaluateCashReconciliation({...base,netCashMovement:duration(5)});
  assert.equal(r.status,'REVIEW_REQUIRED');
  assert.equal(r.checks.openingPlusMovementEqualsClosing,false);
});

test('cash-flow OCF differing from statement row is REVIEW_REQUIRED',()=>{
  const r=evaluateCashReconciliation({...base,operatingCashFlow:duration(-778.69),statementOperatingCashFlow:duration(-456.85)});
  assert.equal(r.status,'REVIEW_REQUIRED');
  assert.equal(r.checks.operatingCashFlowMatchesStatement,false);
});

test('missing values are blocked, not treated as zero',()=>{
  const r=evaluateCashReconciliation({...base,closingCashBalanceSheet:instant(null)});
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
  const r=evaluateCashReconciliation({...base,closingCashBalanceSheet:instant(80.005),tolerance:0.01});
  assert.equal(r.status,'RECONCILED_CANDIDATE');
});

test('mixed unit is rejected before arithmetic',()=>{
  const r=evaluateCashReconciliation({...base,closingCashBalanceSheet:instant(8000000,'2025-09-30','INR Lakhs')});
  assert.equal(r.status,'BLOCKED_INVALID_INPUT');
});

test('wrong opening instant date is rejected before arithmetic',()=>{
  const r=evaluateCashReconciliation({...base,openingCash:instant(100,'2025-04-01')});
  assert.equal(r.status,'BLOCKED_INVALID_INPUT');
});

test('wrong duration period is rejected before arithmetic',()=>{
  const r=evaluateCashReconciliation({...base,netCashMovement:duration(-20,'2025-07-01','2025-09-30')});
  assert.equal(r.status,'BLOCKED_INVALID_INPUT');
});

test('wrong closing instant date is rejected before arithmetic',()=>{
  const r=evaluateCashReconciliation({...base,closingCashBalanceSheet:instant(80,'2025-10-01')});
  assert.equal(r.status,'BLOCKED_INVALID_INPUT');
});

test('mixed standalone and consolidated facts are rejected',()=>{
  const r=evaluateCashReconciliation({...base,closingCashBalanceSheet:instant(80,'2025-09-30','INR','Consolidated')});
  assert.equal(r.status,'BLOCKED_INVALID_INPUT');
});

test('invalid calendar dates are rejected',()=>{
  const r=evaluateCashReconciliation({...base,periodEnd:'2025-02-30'});
  assert.equal(r.status,'BLOCKED_INVALID_INPUT');
});
