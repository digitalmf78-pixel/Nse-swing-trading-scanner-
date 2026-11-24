import type { OcfCandidateResult } from './operating_cashflow_candidate.ts';
import type { CashReconciliationDecision } from './cashflow_reconciliation_guard.ts';
export type OcfReconciliationGateStatus = 'RECONCILED_CANDIDATE' | 'BLOCKED_OCF_CANDIDATE' | 'BLOCKED_CURRENT_RECONCILIATION' | 'BLOCKED_PRIOR_RECONCILIATION' | 'BLOCKED_OCF_CROSSCHECK';
export interface OcfReconciliationGateResult {
  status: OcfReconciliationGateStatus;
  currentValue: number | null;
  priorValue: number | null;
  percentageChange: number | null;
  productionApproved: false;
  explanation: string;
}
const blocked = (status: OcfReconciliationGateStatus, explanation: string): OcfReconciliationGateResult => ({
  status, currentValue: null, priorValue: null, percentageChange: null,
  productionApproved: false, explanation,
});
function fullyReconciled(decision: CashReconciliationDecision): boolean {
  return decision.status === 'RECONCILED_CANDIDATE'
    && decision.checks.openingPlusMovementEqualsClosing === true
    && decision.checks.cashFlowClosingMatchesBalanceSheet === true
    && decision.checks.operatingCashFlowMatchesStatement === true
    && decision.differences.operatingCashFlow !== null
    && Number.isFinite(decision.differences.operatingCashFlow);
}
/** Both current and prior filings must pass cash roll-forward, balance-sheet tie-out and explicit OCF statement-row cross-check. Research-only. */
export function gateOcfCandidateOnReconciliation(candidate: OcfCandidateResult, currentReconciliation: CashReconciliationDecision, priorReconciliation: CashReconciliationDecision): OcfReconciliationGateResult {
  if (candidate.status !== 'CANDIDATE_ONLY' || candidate.currentValue === null || candidate.priorValue === null
    || !Number.isFinite(candidate.currentValue) || !Number.isFinite(candidate.priorValue)) {
    return blocked('BLOCKED_OCF_CANDIDATE', 'A finite same-period OCF candidate must pass its concept, unit, basis and period gates first.');
  }
  if (currentReconciliation.status !== 'RECONCILED_CANDIDATE') return blocked('BLOCKED_CURRENT_RECONCILIATION', 'Current-period cash-flow statement reconciliation did not pass.');
  if (priorReconciliation.status !== 'RECONCILED_CANDIDATE') return blocked('BLOCKED_PRIOR_RECONCILIATION', 'Prior-period cash-flow statement reconciliation did not pass.');
  if (!fullyReconciled(currentReconciliation) || !fullyReconciled(priorReconciliation)) {
    return blocked('BLOCKED_OCF_CROSSCHECK', 'Both periods must pass cash roll-forward, balance-sheet closing-cash tie-out and explicit OCF-to-statement-row cross-check; missing checks are not passes.');
  }
  return {
    status: 'RECONCILED_CANDIDATE', currentValue: candidate.currentValue, priorValue: candidate.priorValue,
    percentageChange: candidate.percentageChange, productionApproved: false,
    explanation: 'Same-period OCF candidate passed its source gates and both current/prior cash-flow reconciliations, including explicit OCF statement-row cross-check. Research candidate only; production approval remains false.',
  };
}
