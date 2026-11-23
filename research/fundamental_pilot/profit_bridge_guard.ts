/** Research-only PAT bridge guard. It never selects a metric or approves production. */
export interface ProfitBridgeFact {
  value: number | null;
  periodStart: string;
  periodEnd: string;
  basis: 'STANDALONE' | 'CONSOLIDATED';
  unit: string;
}

export type ProfitBridgeStatus =
  | 'RECONCILED_CANDIDATE_ONLY'
  | 'REVIEW_REQUIRED'
  | 'BLOCKED_MISSING_INPUT'
  | 'BLOCKED_PERIOD_MISMATCH'
  | 'BLOCKED_BASIS_MISMATCH'
  | 'BLOCKED_UNIT_MISMATCH';

export interface ProfitBridgeResult {
  status: ProfitBridgeStatus;
  expectedProfitAfterTax: number | null;
  difference: number | null;
  productionApproved: false;
  explanation: string;
}

/**
 * Reconciles PAT = PBT + signed tax expense.
 * Tax expense must retain its reported sign (normally negative for an expense).
 * All values must already be in the same currency/unit and exact period/basis.
 */
export function reconcileProfitAfterTaxBridge(
  reportedPat: ProfitBridgeFact,
  profitBeforeTax: ProfitBridgeFact,
  signedTaxExpense: ProfitBridgeFact,
  tolerance = 0,
): ProfitBridgeResult {
  const facts = [reportedPat, profitBeforeTax, signedTaxExpense];
  if (
    facts.some(f => f.value === null || !Number.isFinite(f.value)
      || !f.periodStart || !f.periodEnd || !f.unit)
    || !Number.isFinite(tolerance) || tolerance < 0
  ) {
    return { status: 'BLOCKED_MISSING_INPUT', expectedProfitAfterTax: null, difference: null,
      productionApproved: false, explanation: 'PAT, PBT and signed tax expense must be finite and complete' };
  }
  if (facts.some(f => f.periodStart !== reportedPat.periodStart || f.periodEnd !== reportedPat.periodEnd)) {
    return { status: 'BLOCKED_PERIOD_MISMATCH', expectedProfitAfterTax: null, difference: null,
      productionApproved: false, explanation: 'PAT, PBT and tax expense must use the exact same reporting period' };
  }
  if (facts.some(f => f.basis !== reportedPat.basis)) {
    return { status: 'BLOCKED_BASIS_MISMATCH', expectedProfitAfterTax: null, difference: null,
      productionApproved: false, explanation: 'Standalone and consolidated facts must never be mixed in a PAT bridge' };
  }
  if (facts.some(f => f.unit !== reportedPat.unit)) {
    return { status: 'BLOCKED_UNIT_MISMATCH', expectedProfitAfterTax: null, difference: null,
      productionApproved: false, explanation: 'PAT, PBT and tax expense must use the same currency and scale' };
  }
  const expected = profitBeforeTax.value! + signedTaxExpense.value!;
  const difference = reportedPat.value! - expected;
  const matches = Math.abs(difference) <= tolerance;
  return {
    status: matches ? 'RECONCILED_CANDIDATE_ONLY' : 'REVIEW_REQUIRED',
    expectedProfitAfterTax: expected,
    difference,
    productionApproved: false,
    explanation: matches
      ? 'PAT reconciles to PBT plus signed tax expense; candidate-only, not production approval'
      : 'PAT does not reconcile to PBT plus signed tax expense; preserve raw facts and require review',
  };
}
