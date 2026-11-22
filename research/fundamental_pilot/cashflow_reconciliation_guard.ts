export type CashReconciliationStatus =
  | 'RECONCILED_CANDIDATE'
  | 'REVIEW_REQUIRED'
  | 'BLOCKED_MISSING_VALUE'
  | 'BLOCKED_INVALID_INPUT';

export interface CashReconciliationInput {
  period: string;
  basis: 'Standalone' | 'Consolidated';
  unit: string;
  openingCash: number | null;
  netCashMovement: number | null;
  closingCashFlowStatement: number | null;
  closingCashBalanceSheet: number | null;
  operatingCashFlow?: number | null;
  statementOperatingCashFlow?: number | null;
  tolerance?: number;
}

export interface CashReconciliationDecision {
  status: CashReconciliationStatus;
  checks: {
    openingPlusMovementEqualsClosing: boolean | null;
    cashFlowClosingMatchesBalanceSheet: boolean | null;
    operatingCashFlowMatchesStatement: boolean | null;
  };
  differences: {
    rollForward: number | null;
    closingCash: number | null;
    operatingCashFlow: number | null;
  };
  productionApproved: false;
  explanation: string;
}

/**
 * Research-only cash-flow integrity guard. All amounts must already be
 * normalized to the same currency/unit, period and filing basis.
 * It does not infer missing values or approve a production metric mapping.
 */
export function evaluateCashReconciliation(input: CashReconciliationInput): CashReconciliationDecision {
  const empty = {
    openingPlusMovementEqualsClosing: null,
    cashFlowClosingMatchesBalanceSheet: null,
    operatingCashFlowMatchesStatement: null,
  };
  const noDiff = { rollForward: null, closingCash: null, operatingCashFlow: null };
  if (!input.period.trim() || !input.unit.trim()
    || !['Standalone', 'Consolidated'].includes(input.basis)
    || (input.tolerance !== undefined && (!Number.isFinite(input.tolerance) || input.tolerance < 0))) {
    return { status: 'BLOCKED_INVALID_INPUT', checks: empty, differences: noDiff,
      productionApproved: false, explanation: 'Period, basis, unit and non-negative finite tolerance must be valid.' };
  }
  const values = [input.openingCash, input.netCashMovement, input.closingCashFlowStatement, input.closingCashBalanceSheet];
  const hasOcf = input.operatingCashFlow !== undefined && input.operatingCashFlow !== null;
  const hasStatementOcf = input.statementOperatingCashFlow !== undefined && input.statementOperatingCashFlow !== null;
  if (values.some(v => v === null || !Number.isFinite(v))
    || (hasOcf !== hasStatementOcf)
    || (input.operatingCashFlow !== undefined && input.operatingCashFlow !== null && !Number.isFinite(input.operatingCashFlow))
    || (input.statementOperatingCashFlow !== undefined && input.statementOperatingCashFlow !== null && !Number.isFinite(input.statementOperatingCashFlow))) {
    return { status: 'BLOCKED_MISSING_VALUE', checks: empty, differences: noDiff,
      productionApproved: false, explanation: 'Required cash facts or paired OCF statement cross-check are missing/non-finite; no substitution is allowed.' };
  }
  const tolerance = input.tolerance ?? 0;
  const rollForward = (input.openingCash as number) + (input.netCashMovement as number) - (input.closingCashFlowStatement as number);
  const closingCash = (input.closingCashFlowStatement as number) - (input.closingCashBalanceSheet as number);
  const ocfProvided = input.operatingCashFlow !== undefined && input.operatingCashFlow !== null;
  const operatingCashFlow = ocfProvided
    ? (input.operatingCashFlow as number) - (input.statementOperatingCashFlow as number)
    : null;
  const checks = {
    openingPlusMovementEqualsClosing: Math.abs(rollForward) <= tolerance,
    cashFlowClosingMatchesBalanceSheet: Math.abs(closingCash) <= tolerance,
    operatingCashFlowMatchesStatement: operatingCashFlow === null ? null : Math.abs(operatingCashFlow) <= tolerance,
  };
  const failed = Object.values(checks).some(v => v === false);
  return {
    status: failed ? 'REVIEW_REQUIRED' : 'RECONCILED_CANDIDATE',
    checks,
    differences: { rollForward, closingCash, operatingCashFlow },
    productionApproved: false,
    explanation: failed
      ? 'One or more cash-flow reconciliation checks failed. Preserve source facts and block the affected metric pending review.'
      : 'Supplied cash facts reconcile within tolerance. This is candidate-only and does not approve taxonomy mapping or production use.',
  };
}
