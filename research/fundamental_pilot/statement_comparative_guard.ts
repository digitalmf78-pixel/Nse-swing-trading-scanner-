export type StatementComparativeGuardStatus =
  | 'MATCHED_ALL_PERIODS'
  | 'CURRENT_XBRL_PDF_CONFLICT'
  | 'PRIOR_ORIGINAL_XBRL_PDF_CONFLICT'
  | 'RECLASSIFIED_COMPARATIVE_REVIEW_REQUIRED'
  | 'BLOCKED_MISSING_VALUE';

export interface StatementComparativeEvidence {
  currentXbrl: number | null;
  priorOriginalXbrl: number | null;
  currentPdfCurrent: number | null;
  currentPdfPriorComparative: number | null;
  priorOriginalPdf: number | null;
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
    return {
      status:'RECLASSIFIED_COMPARATIVE_REVIEW_REQUIRED',currentValue:evidence.currentXbrl,
      priorOriginalValue:evidence.priorOriginalXbrl,comparablePriorValue:null,
      currentComparativeValue:evidence.currentPdfPriorComparative,
      originalPdfValue:evidence.priorOriginalPdf,
      reclassificationDifference:evidence.currentPdfPriorComparative!-evidence.priorOriginalXbrl!,
      productionApproved:false,
      explanation:'Prior Original and current filing comparative differ. Preserve both values and withhold YoY until the reclassification bridge is verified.',
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
