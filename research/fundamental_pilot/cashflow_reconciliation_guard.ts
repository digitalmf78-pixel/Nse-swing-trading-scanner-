export type CashReconciliationStatus =
  | 'RECONCILED_CANDIDATE'
  | 'REVIEW_REQUIRED'
  | 'BLOCKED_MISSING_VALUE'
  | 'BLOCKED_INVALID_INPUT';

export interface CashFlowFactValue {
  value: number | null;
  period: string;
  basis: 'Standalone' | 'Consolidated';
  unit: string;
}

export interface CashReconciliationInput {
  period: string;
  basis: 'Standalone' | 'Consolidated';
  unit: string;
  openingCash: CashFlowFactValue;
  netCashMovement: CashFlowFactValue;
  closingCashFlowStatement: CashFlowFactValue;
  closingCashBalanceSheet: CashFlowFactValue;
  operatingCashFlow?: CashFlowFactValue | null;
  statementOperatingCashFlow?: CashFlowFactValue | null;
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

const EMPTY_CHECKS = {
  openingPlusMovementEqualsClosing: null,
  cashFlowClosingMatchesBalanceSheet: null,
  operatingCashFlowMatchesStatement: null,
};
const EMPTY_DIFFS = { rollForward: null, closingCash: null, operatingCashFlow: null };

/**
 * Research-only cash-flow integrity guard. Every input fact carries its own
 * period, consolidation basis and unit; mixed facts are rejected before math.
 * Tolerance is expressed in the declared common unit. Never production-approved.
 */
export function evaluateCashReconciliation(input: CashReconciliationInput): CashReconciliationDecision {
  if (!input.period.trim() || !input.unit.trim()
    || !['Standalone', 'Consolidated'].includes(input.basis)
    || (input.tolerance !== undefined && (!Number.isFinite(input.tolerance) || input.tolerance < 0))) {
    return { status: 'BLOCKED_INVALID_INPUT', checks: EMPTY_CHECKS, differences: EMPTY_DIFFS,
      productionApproved: false, explanation: 'Expected period, basis, unit and non-negative finite tolerance must be valid.' };
  }
  const facts = [input.openingCash, input.netCashMovement, input.closingCashFlowStatement, input.closingCashBalanceSheet];
  const optionalFacts = [input.operatingCashFlow, input.statementOperatingCashFlow];
  if (facts.some(f => !f || typeof f !== 'object')
    || optionalFacts.some(f => f !== undefined && f !== null && typeof f !== 'object')) {
    return { status: 'BLOCKED_MISSING_VALUE', checks: EMPTY_CHECKS, differences: EMPTY_DIFFS,
      productionApproved: false, explanation: 'A required fact object is missing.' };
  }
  const allFacts = [...facts, ...optionalFacts.filter((f): f is CashFlowFactValue => f !== undefined && f !== null)];
  if (allFacts.some(f => !f.period?.trim() || !f.unit?.trim()
    || !['Standalone', 'Consolidated'].includes(f.basis)
    || f.period !== input.period || f.basis !== input.basis || f.unit !== input.unit)) {
    return { status: 'BLOCKED_INVALID_INPUT', checks: EMPTY_CHECKS, differences: EMPTY_DIFFS,
      productionApproved: false, explanation: 'Fact period, consolidation basis and unit must exactly match the expected filing metadata.' };
  }
  if (facts.some(f => f.value === null || !Number.isFinite(f.value))
    || ((input.operatingCashFlow == null) !== (input.statementOperatingCashFlow == null))
    || optionalFacts.some(f => f != null && (f.value === null || !Number.isFinite(f.value)))) {
    return { status: 'BLOCKED_MISSING_VALUE', checks: EMPTY_CHECKS, differences: EMPTY_DIFFS,
      productionApproved: false, explanation: 'Required cash facts or paired OCF cross-check are missing/non-finite; no substitution is allowed.' };
  }
  const tolerance = input.tolerance ?? 0;
  const opening = input.openingCash.value as number;
  const movement = input.netCashMovement.value as number;
  const closingFlow = input.closingCashFlowStatement.value as number;
  const closingBalance = input.closingCashBalanceSheet.value as number;
  const rollForward = opening + movement - closingFlow;
  const closingCash = closingFlow - closingBalance;
  const operatingCashFlow = input.operatingCashFlow == null ? null
    : (input.operatingCashFlow.value as number) - (input.statementOperatingCashFlow!.value as number);
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
