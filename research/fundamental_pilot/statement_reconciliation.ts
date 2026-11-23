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


export interface StatementFactEvidence {
  value: number | null;
  issuerSymbol: string;
  isin: string;
  filingSequenceId: string;
  filingGroupId: string;
  sourceDocumentType: 'XBRL' | 'RESULTS_PDF' | 'OTHER_OFFICIAL';
  sourceDocumentSha256: string;
  periodStart: string;
  periodEnd: string;
  periodType: 'QUARTER' | 'YTD' | 'FY' | 'TTM';
  basis: 'Standalone' | 'Consolidated';
  currency: string;
  unit: string;
}

export type EvidenceReconciliationStatus =
  | StatementReconciliationStatus
  | 'BLOCKED_METADATA_MISMATCH';

export interface EvidenceStatementReconciliation extends StatementReconciliation {
  status: EvidenceReconciliationStatus;
  metadataValid: boolean;
  metadataIssues: string[];
}

function evidenceMetadataIssues(facts: StatementFactEvidence[]): string[] {
  const issues: string[] = [];
  if (facts.length < 2 || facts.length > 3) return ['Two or three statement facts are required.'];
  for (const [index, fact] of facts.entries()) {
    if (!fact || typeof fact !== 'object') {
      issues.push('Statement fact ' + (index + 1) + ' is missing.');
      continue;
    }
    const validDate = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
      const parsed = new Date(value + 'T00:00:00Z');
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    };
    if (typeof fact.issuerSymbol !== 'string' || !fact.issuerSymbol.trim()
      || typeof fact.isin !== 'string' || !fact.isin.trim()
      || typeof fact.filingSequenceId !== 'string' || !fact.filingSequenceId.trim()
      || typeof fact.filingGroupId !== 'string' || !fact.filingGroupId.trim()
      || !['XBRL', 'RESULTS_PDF', 'OTHER_OFFICIAL'].includes(fact.sourceDocumentType)
      || typeof fact.sourceDocumentSha256 !== 'string'
      || !/^[a-f0-9]{64}$/i.test(fact.sourceDocumentSha256 ?? '')
      || !validDate(fact.periodStart)
      || !validDate(fact.periodEnd)
      || fact.periodStart >= fact.periodEnd
      || !fact.currency?.trim() || !fact.unit?.trim()
      || !['Standalone', 'Consolidated'].includes(fact.basis)
      || !['QUARTER', 'YTD', 'FY', 'TTM'].includes(fact.periodType)) {
      issues.push('Statement fact ' + (index + 1) + ' has incomplete or invalid issuer/filing/period/basis/unit metadata.');
    }
    if (fact.value === null || !Number.isFinite(fact.value)) {
      issues.push('Statement fact ' + (index + 1) + ' has a missing or non-finite value.');
    }
  }
  if (issues.length) return issues;
  const identity = (fact: StatementFactEvidence) => [
    fact.issuerSymbol.trim().toUpperCase(),
    fact.isin.trim().toUpperCase(),
    fact.filingGroupId.trim(),
    fact.periodStart,
    fact.periodEnd,
    fact.periodType,
    fact.basis,
    fact.currency.trim().toUpperCase(),
    fact.unit.trim().toUpperCase(),
  ].join('|');
  if (facts.some(fact => identity(fact) !== identity(facts[0]))) {
    issues.push('Statement facts do not share the same issuer, resolved official filing group, period, basis, currency and unit.');
  }
  return issues;
}

/**
 * Strict evidence-aware reconciliation. Unlike the numeric helper above,
 * this entry point enforces same-issuer and same-period official filing-group provenance before
 * comparing statement presentations. An arithmetic match still never
 * approves the economic metric mapping.
 */
export function reconcileStatementEvidence(
  candidate: StatementFactEvidence,
  primary: StatementFactEvidence,
  alternate: StatementFactEvidence | null = null,
  tolerance = 0,
): EvidenceStatementReconciliation {
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    return {
      status: 'MISSING_INPUT', matchesPrimary: false, matchesAlternate: null,
      differencePrimaryToAlternate: null, metricMappingApproved: false,
      metadataValid: false, metadataIssues: ['Tolerance must be finite and non-negative.'],
    };
  }
  const facts = alternate === null ? [candidate, primary] : [candidate, primary, alternate];
  const metadataIssues = evidenceMetadataIssues(facts);
  if (metadataIssues.length) {
    return {
      status: metadataIssues.some(issue => issue.includes('value')) ? 'MISSING_INPUT' : 'BLOCKED_METADATA_MISMATCH',
      matchesPrimary: false, matchesAlternate: alternate === null ? null : false,
      differencePrimaryToAlternate: null, metricMappingApproved: false,
      metadataValid: false, metadataIssues,
    };
  }
  const result = reconcileStatementPresentations(candidate.value, primary.value, alternate?.value ?? null, tolerance);
  return { ...result, metadataValid: true, metadataIssues: [] };
}
