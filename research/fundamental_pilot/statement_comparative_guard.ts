export type StatementComparativeGuardStatus =
  | 'MATCHED_ALL_PERIODS'
  | 'CURRENT_XBRL_PDF_CONFLICT'
  | 'PRIOR_ORIGINAL_XBRL_PDF_CONFLICT'
  | 'RECLASSIFIED_COMPARATIVE_REVIEW_REQUIRED'
  | 'RECLASSIFICATION_BRIDGE_RECONCILED'
  | 'BLOCKED_MISSING_VALUE';

export interface StatementComparativeEvidence {
  currentXbrl: number | null;
  priorOriginalXbrl: number | null;
  currentPdfCurrent: number | null;
  currentPdfPriorComparative: number | null;
  priorOriginalPdf: number | null;
}

export interface StatementReclassificationBridgeLine {
  label: string;
  priorOriginalValue: number;
  currentComparativeValue: number;
}

export interface StatementReclassificationBridge {
  adjustmentLines: StatementReclassificationBridgeLine[];
  priorAdjustmentSubtotal: number;
  currentAdjustmentSubtotal: number;
  workingCapitalLines: StatementReclassificationBridgeLine[];
  priorWorkingCapitalSubtotal: number;
  currentWorkingCapitalSubtotal: number;
  priorOperatingProfitBeforeWorkingCapital: number;
  currentOperatingProfitBeforeWorkingCapital: number;
  priorCashGeneratedFromOperations: number;
  currentCashGeneratedFromOperations: number;
  priorDirectTaxesPaid: number;
  currentDirectTaxesPaid: number;
}

export interface StatementComparativeGuardResult {
  status: StatementComparativeGuardStatus;
  currentValue: number | null;
  priorOriginalValue: number | null;
  comparablePriorValue: number | null;
  currentComparativeValue: number | null;
  originalPdfValue: number | null;
  reclassificationDifference: number | null;
  productionApproved: false;
  explanation: string;
}

/**
 * Checks one XBRL current-period fact and one prior Original fact against
 * both the current filing's comparative statement and the prior Original PDF.
 * If the comparative was regrouped/reclassified, no prior value is selected.
 */
export function assessStatementComparativeGuard(
  evidence: StatementComparativeEvidence,
  bridge?: StatementReclassificationBridge,
): StatementComparativeGuardResult {
  const values=Object.values(evidence);
  if(values.some(value=>value===null||!Number.isFinite(value))) {
    return {
      status:'BLOCKED_MISSING_VALUE',currentValue:evidence.currentXbrl,
      priorOriginalValue:evidence.priorOriginalXbrl,comparablePriorValue:null,
      currentComparativeValue:evidence.currentPdfPriorComparative,
      originalPdfValue:evidence.priorOriginalPdf,reclassificationDifference:null,
      productionApproved:false,
      explanation:'All five current/original XBRL and official PDF values are required; no missing value is replaced with zero.',
    };
  }
  if(evidence.currentXbrl!==evidence.currentPdfCurrent) {
    return {
      status:'CURRENT_XBRL_PDF_CONFLICT',currentValue:evidence.currentXbrl,
      priorOriginalValue:evidence.priorOriginalXbrl,comparablePriorValue:null,
      currentComparativeValue:evidence.currentPdfPriorComparative,
      originalPdfValue:evidence.priorOriginalPdf,reclassificationDifference:null,
      productionApproved:false,
      explanation:'Current XBRL does not match the current official results PDF statement value.',
    };
  }
  if(evidence.priorOriginalXbrl!==evidence.priorOriginalPdf) {
    return {
      status:'PRIOR_ORIGINAL_XBRL_PDF_CONFLICT',currentValue:evidence.currentXbrl,
      priorOriginalValue:evidence.priorOriginalXbrl,comparablePriorValue:null,
      currentComparativeValue:evidence.currentPdfPriorComparative,
      originalPdfValue:evidence.priorOriginalPdf,reclassificationDifference:null,
      productionApproved:false,
      explanation:'Prior Original XBRL does not match its own original official results PDF.',
    };
  }
  if(evidence.priorOriginalXbrl!==evidence.currentPdfPriorComparative) {
    const difference=evidence.currentPdfPriorComparative!-evidence.priorOriginalXbrl!;
    if(bridge && isVerifiedReclassificationBridge(evidence,bridge)) {
      return {
        status:'RECLASSIFICATION_BRIDGE_RECONCILED',currentValue:evidence.currentXbrl,
        priorOriginalValue:evidence.priorOriginalXbrl,
        comparablePriorValue:evidence.currentPdfPriorComparative,
        currentComparativeValue:evidence.currentPdfPriorComparative,
        originalPdfValue:evidence.priorOriginalPdf,reclassificationDifference:difference,
        productionApproved:false,
        explanation:'The current filing comparative differs from prior Original, but the changed adjustment, working-capital, subtotal, cash-generated and tax lines reconcile exactly. Use the current filing comparative as the comparable prior base; candidate-only, not production-approved.',
      };
    }
    return {
      status:'RECLASSIFIED_COMPARATIVE_REVIEW_REQUIRED',currentValue:evidence.currentXbrl,
      priorOriginalValue:evidence.priorOriginalXbrl,comparablePriorValue:null,
      currentComparativeValue:evidence.currentPdfPriorComparative,
      originalPdfValue:evidence.priorOriginalPdf,
      reclassificationDifference:difference,
      productionApproved:false,
      explanation:'Prior Original and current filing comparative differ. Preserve both values and withhold YoY until the detailed reclassification bridge is verified.',
    };
  }
  return {
    status:'MATCHED_ALL_PERIODS',currentValue:evidence.currentXbrl,
    priorOriginalValue:evidence.priorOriginalXbrl,
    comparablePriorValue:evidence.priorOriginalXbrl,
    currentComparativeValue:evidence.currentPdfPriorComparative,
    originalPdfValue:evidence.priorOriginalPdf,reclassificationDifference:0,
    productionApproved:false,
    explanation:'Current XBRL, current official PDF, prior Original XBRL and both official PDF periods reconcile. Candidate-only; not production-approved.',
  };
}

function roundCents(value:number):number {
  return Math.round((value+Number.EPSILON)*100)/100;
}

function isVerifiedReclassificationBridge(
  evidence:StatementComparativeEvidence,
  bridge:StatementReclassificationBridge,
):boolean {
  const allValues=[
    bridge.priorAdjustmentSubtotal,bridge.currentAdjustmentSubtotal,
    bridge.priorWorkingCapitalSubtotal,bridge.currentWorkingCapitalSubtotal,
    bridge.priorOperatingProfitBeforeWorkingCapital,bridge.currentOperatingProfitBeforeWorkingCapital,
    bridge.priorCashGeneratedFromOperations,bridge.currentCashGeneratedFromOperations,
    bridge.priorDirectTaxesPaid,bridge.currentDirectTaxesPaid,
    ...bridge.adjustmentLines.flatMap(line=>[line.priorOriginalValue,line.currentComparativeValue]),
    ...bridge.workingCapitalLines.flatMap(line=>[line.priorOriginalValue,line.currentComparativeValue]),
  ];
  if(!bridge.adjustmentLines.length||!bridge.workingCapitalLines.length
    ||allValues.some(value=>!Number.isFinite(value))) return false;
  if([...bridge.adjustmentLines,...bridge.workingCapitalLines].some(line=>!line.label.trim())) return false;

  const adjustmentLineDelta=roundCents(bridge.adjustmentLines.reduce(
    (sum,line)=>sum+line.currentComparativeValue-line.priorOriginalValue,0));
  const adjustmentSubtotalDelta=roundCents(bridge.currentAdjustmentSubtotal-bridge.priorAdjustmentSubtotal);
  const operatingProfitDelta=roundCents(
    bridge.currentOperatingProfitBeforeWorkingCapital-bridge.priorOperatingProfitBeforeWorkingCapital);
  if(adjustmentLineDelta!==adjustmentSubtotalDelta||adjustmentSubtotalDelta!==operatingProfitDelta) return false;

  const workingCapitalLineDelta=roundCents(bridge.workingCapitalLines.reduce(
    (sum,line)=>sum+line.currentComparativeValue-line.priorOriginalValue,0));
  const workingCapitalSubtotalDelta=roundCents(
    bridge.currentWorkingCapitalSubtotal-bridge.priorWorkingCapitalSubtotal);
  if(workingCapitalLineDelta!==workingCapitalSubtotalDelta) return false;

  const cashGeneratedDelta=roundCents(
    bridge.currentCashGeneratedFromOperations-bridge.priorCashGeneratedFromOperations);
  if(cashGeneratedDelta!==roundCents(operatingProfitDelta+workingCapitalSubtotalDelta)) return false;
  const taxDelta=roundCents(bridge.currentDirectTaxesPaid-bridge.priorDirectTaxesPaid);
  const ocfDelta=roundCents(evidence.currentPdfPriorComparative!-evidence.priorOriginalXbrl!);
  if(roundCents(cashGeneratedDelta+taxDelta)!==ocfDelta) return false;

  return roundCents(bridge.priorCashGeneratedFromOperations+bridge.priorDirectTaxesPaid)
      ===roundCents(evidence.priorOriginalXbrl!)
    && roundCents(bridge.currentCashGeneratedFromOperations+bridge.currentDirectTaxesPaid)
      ===roundCents(evidence.currentPdfPriorComparative!)
    && roundCents(bridge.currentDirectTaxesPaid)===roundCents(bridge.priorDirectTaxesPaid)
    && roundCents(evidence.currentXbrl!)===roundCents(evidence.currentPdfCurrent!)
    && roundCents(evidence.priorOriginalXbrl!)===roundCents(evidence.priorOriginalPdf!);
}
