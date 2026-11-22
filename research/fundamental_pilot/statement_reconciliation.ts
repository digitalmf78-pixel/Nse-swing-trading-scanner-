/** Research-only statement-presentation reconciliation. Never approves a metric mapping. */
export type StatementReconciliationStatus =
  | 'MATCHES_PRIMARY_ONLY'
  | 'MATCHES_ALTERNATE_ONLY'
  | 'MATCHES_BOTH'
  | 'MATCHES_NEITHER'
  | 'MISSING_INPUT';

export interface StatementReconciliation {
  status: StatementReconciliationStatus;
  matchesPrimary: boolean;
  matchesAlternate: boolean | null;
  differencePrimaryToAlternate: number | null;
  metricMappingApproved: false;
}

/**
 * Checks arithmetic against named statement presentations. The caller must
 * supply values from the same issuer, period, basis, currency and unit.
 * Even an exact match does not approve the economic definition for a metric.
 */
export function reconcileStatementPresentations(
  candidate: number | null,
  primary: number | null,
  alternate: number | null = null,
  tolerance = 0,
): StatementReconciliation {
  if (
    candidate === null || primary === null ||
    !Number.isFinite(candidate) || !Number.isFinite(primary) ||
    (alternate !== null && !Number.isFinite(alternate)) ||
    !Number.isFinite(tolerance) || tolerance < 0
  ) {
    return {
      status: 'MISSING_INPUT',
      matchesPrimary: false,
      matchesAlternate: null,
      differencePrimaryToAlternate: null,
      metricMappingApproved: false,
    };
  }
  const matchesPrimary = Math.abs(candidate - primary) <= tolerance;
  const matchesAlternate = alternate === null
    ? null
    : Math.abs(candidate - alternate) <= tolerance;
  const status: StatementReconciliationStatus = matchesPrimary && matchesAlternate === true
    ? 'MATCHES_BOTH'
    : matchesPrimary
      ? 'MATCHES_PRIMARY_ONLY'
      : matchesAlternate === true
        ? 'MATCHES_ALTERNATE_ONLY'
        : 'MATCHES_NEITHER';
  return {
    status,
    matchesPrimary,
    matchesAlternate,
    differencePrimaryToAlternate: alternate === null ? null : alternate - primary,
    metricMappingApproved: false,
  };
}
