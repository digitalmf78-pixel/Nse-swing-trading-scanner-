export type CashReconciliationStatus =
  | 'RECONCILED_CANDIDATE'
  | 'REVIEW_REQUIRED'
  | 'BLOCKED_MISSING_VALUE'
  | 'BLOCKED_INVALID_INPUT';

export type CashFlowFactContext =
  | { kind: 'INSTANT'; date: string }
  | { kind: 'DURATION'; startDate: string; endDate: string };

export interface CashFlowFactValue {
  value: number | null;
  context: CashFlowFactContext;
  basis: 'Standalone' | 'Consolidated';
  unit: string;
}

export interface CashReconciliationInput {
  periodStart: string;
  periodEnd: string;
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

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function previousCalendarDate(value: string): string {
  return new Date(new Date(`${value}T00:00:00.000Z`).getTime() - 86400000)
    .toISOString().slice(0, 10);
}
function isInstant(fact: CashFlowFactValue, date: string): boolean {
  return fact.context?.kind === 'INSTANT' && fact.context.date === date;
}
function isDuration(fact: CashFlowFactValue, startDate: string, endDate: string): boolean {
  return fact.context?.kind === 'DURATION'
    && fact.context.startDate === startDate && fact.context.endDate === endDate;
}

/**
 * Research-only cash-flow integrity guard. XBRL instant contexts (opening and
 * closing cash/balance-sheet cash) are kept distinct from duration contexts
 * (net cash movement and OCF). Every fact must match the filing basis and unit.
 * Tolerance is expressed in the declared common unit. Never production-approved.
 */
export function evaluateCashReconciliation(input: CashReconciliationInput): CashReconciliationDecision {
  if (!isIsoDate(input.periodStart) || !isIsoDate(input.periodEnd)
    || input.periodStart > input.periodEnd || !input.unit.trim()
    || !['Standalone', 'Consolidated'].includes(input.basis)
    || (input.tolerance !== undefined && (!Number.isFinite(input.tolerance) || input.tolerance < 0))) {
    return { status: 'BLOCKED_INVALID_INPUT', checks: EMPTY_CHECKS, differences: EMPTY_DIFFS,
      productionApproved: false, explanation: 'Expected ISO period dates, basis, unit and non-negative finite tolerance must be valid.' };
  }
  const facts = [input.openingCash, input.netCashMovement, input.closingCashFlowStatement, input.closingCashBalanceSheet];
  const optionalFacts = [input.operatingCashFlow, input.statementOperatingCashFlow];
  if (facts.some(f => !f || typeof f !== 'object')
    || optionalFacts.some(f => f !== undefined && f !== null && typeof f !== 'object')) {
    return { status: 'BLOCKED_MISSING_VALUE', checks: EMPTY_CHECKS, differences: EMPTY_DIFFS,
      productionApproved: false, explanation: 'A required fact object is missing.' };
  }
  const allFacts = [...facts, ...optionalFacts.filter((f): f is CashFlowFactValue => f !== undefined && f !== null)];
  if (allFacts.some(f => !f.unit?.trim() || !['Standalone', 'Consolidated'].includes(f.basis)
    || f.basis !== input.basis || f.unit !== input.unit)) {
    return { status: 'BLOCKED_INVALID_INPUT', checks: EMPTY_CHECKS, differences: EMPTY_DIFFS,
      productionApproved: false, explanation: 'Fact consolidation basis and unit must exactly match the expected filing metadata.' };
  }
  const openingDate = previousCalendarDate(input.periodStart);
  const contextsMatch = isInstant(input.openingCash, openingDate)
    && isDuration(input.netCashMovement, input.periodStart, input.periodEnd)
    && isInstant(input.closingCashFlowStatement, input.periodEnd)
    && isInstant(input.closingCashBalanceSheet, input.periodEnd)
    && (input.operatingCashFlow == null || isDuration(input.operatingCashFlow, input.periodStart, input.periodEnd))
    && (input.statementOperatingCashFlow == null || isDuration(input.statementOperatingCashFlow, input.periodStart, input.periodEnd));
  if (!contextsMatch) {
    return { status: 'BLOCKED_INVALID_INPUT', checks: EMPTY_CHECKS, differences: EMPTY_DIFFS,
      productionApproved: false, explanation: 'Opening cash must be an instant at the day before period start; closing cash facts must be instants at period end; movement and OCF facts must be durations for the exact reporting period.' };
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
