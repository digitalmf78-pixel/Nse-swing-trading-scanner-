import assert from 'node:assert/strict';
import test from 'node:test';
import { assessStatementComparativeGuard, type StatementComparativeEvidence, type StatementReclassificationBridge } from './statement_comparative_guard.ts';

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


test('Asian Paints H1 FY27 Revenue reconciles across both official PDF periods',()=>{
  const result=assessStatementComparativeGuard({
    currentXbrl:20518.45,priorOriginalXbrl:17469.82,
    currentPdfCurrent:20518.45,currentPdfPriorComparative:17469.82,
    priorOriginalPdf:17469.82,
  });
  assert.equal(result.status,'MATCHED_ALL_PERIODS');
  assert.equal(result.comparablePriorValue,17469.82);
  assert.equal(result.productionApproved,false);
});

test('Asian Paints H1 FY27 owner-attributable Profit reconciles, not total group PAT',()=>{
  const result=assessStatementComparativeGuard({
    currentXbrl:2606.88,priorOriginalXbrl:2093.36,
    currentPdfCurrent:2606.88,currentPdfPriorComparative:2093.36,
    priorOriginalPdf:2093.36,
  });
  assert.equal(result.status,'MATCHED_ALL_PERIODS');
  assert.equal(result.comparablePriorValue,2093.36);
  assert.equal(result.productionApproved,false);
});

test('Asian Paints H1 FY27 OCF reconciles across both official PDF periods',()=>{
  const result=assessStatementComparativeGuard({
    currentXbrl:1899.83,priorOriginalXbrl:3482.26,
    currentPdfCurrent:1899.83,currentPdfPriorComparative:3482.26,
    priorOriginalPdf:3482.26,
  });
  assert.equal(result.status,'MATCHED_ALL_PERIODS');
  assert.equal(result.comparablePriorValue,3482.26);
  assert.equal(result.productionApproved,false);
});

test('GAIL H1 FY27 Revenue and owner-attributable Profit reconcile to current and prior Original PDFs',()=>{
  const revenue=assessStatementComparativeGuard({
    currentXbrl:88651.21,priorOriginalXbrl:71086.05,
    currentPdfCurrent:88651.21,currentPdfPriorComparative:71086.05,
    priorOriginalPdf:71086.05,
  });
  const ownerProfit=assessStatementComparativeGuard({
    currentXbrl:9385.02,priorOriginalXbrl:4341.61,
    currentPdfCurrent:9385.02,currentPdfPriorComparative:4341.61,
    priorOriginalPdf:4341.61,
  });
  assert.equal(revenue.status,'MATCHED_ALL_PERIODS');
  assert.equal(ownerProfit.status,'MATCHED_ALL_PERIODS');
  assert.equal(revenue.productionApproved,false);
  assert.equal(ownerProfit.productionApproved,false);
});

const gailH1ReclassificationBridge:StatementReclassificationBridge={
  adjustmentLines:[
    {label:'Provision for probable obligations',priorOriginalValue:15.35,currentComparativeValue:37.42},
    {label:'Excess provision written back',priorOriginalValue:0,currentComparativeValue:-90.07},
    {label:'Unrealised foreign exchange gain/loss',priorOriginalValue:0,currentComparativeValue:169.08},
  ],
  priorAdjustmentSubtotal:783.21,currentAdjustmentSubtotal:884.29,
  workingCapitalLines:[
    {label:'Trade and other receivables',priorOriginalValue:554.88,currentComparativeValue:575.68},
  ],
  priorWorkingCapitalSubtotal:512.80,currentWorkingCapitalSubtotal:533.60,
  priorOperatingProfitBeforeWorkingCapital:6377.45,
  currentOperatingProfitBeforeWorkingCapital:6478.53,
  priorCashGeneratedFromOperations:6890.25,
  currentCashGeneratedFromOperations:7012.13,
  priorDirectTaxesPaid:-1142.91,currentDirectTaxesPaid:-1142.91,
};

test('GAIL H1 FY27 OCF releases the current filing comparative only after every bridge subtotal ties',()=>{
  const result=assessStatementComparativeGuard({
    currentXbrl:10602.50,priorOriginalXbrl:5747.34,
    currentPdfCurrent:10602.50,currentPdfPriorComparative:5869.22,
    priorOriginalPdf:5747.34,
  },gailH1ReclassificationBridge);
  assert.equal(result.status,'RECLASSIFICATION_BRIDGE_RECONCILED');
  assert.equal(result.priorOriginalValue,5747.34);
  assert.equal(result.currentComparativeValue,5869.22);
  assert.ok(Math.abs((result.reclassificationDifference ?? 0)-121.88)<1e-9);
  assert.equal(result.comparablePriorValue,5869.22);
  assert.equal(result.productionApproved,false);
});

test('GAIL H1 FY27 OCF bridge fails closed if any changed cash-flow line is altered',()=>{
  const badBridge={
    ...gailH1ReclassificationBridge,
    adjustmentLines:gailH1ReclassificationBridge.adjustmentLines.map((line,index)=>
      index===0?{...line,currentComparativeValue:38.42}:line),
  };
  const result=assessStatementComparativeGuard({
    currentXbrl:10602.50,priorOriginalXbrl:5747.34,
    currentPdfCurrent:10602.50,currentPdfPriorComparative:5869.22,
    priorOriginalPdf:5747.34,
  },badBridge);
  assert.equal(result.status,'RECLASSIFIED_COMPARATIVE_REVIEW_REQUIRED');
  assert.equal(result.comparablePriorValue,null);
});

test('GAIL H1 FY27 OCF bridge fails closed if cash generated subtotal does not tie',()=>{
  const badBridge={...gailH1ReclassificationBridge,currentCashGeneratedFromOperations:7013.13};
  const result=assessStatementComparativeGuard({
    currentXbrl:10602.50,priorOriginalXbrl:5747.34,
    currentPdfCurrent:10602.50,currentPdfPriorComparative:5869.22,
    priorOriginalPdf:5747.34,
  },badBridge);
  assert.equal(result.status,'RECLASSIFIED_COMPARATIVE_REVIEW_REQUIRED');
  assert.equal(result.comparablePriorValue,null);
});
