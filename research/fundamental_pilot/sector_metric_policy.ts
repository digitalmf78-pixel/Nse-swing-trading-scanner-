/**
 * Research-only sector guard for the seven-metric fundamental pilot.
 * This is an applicability gate, not a metric calculator or production mapper.
 */
export type IssuerSector = 'NON_FINANCIAL' | 'BANK' | 'NBFC' | 'INSURANCE' | 'UNKNOWN';
export type TargetMetric =
  | 'REVENUE_GROWTH'
  | 'PROFIT_GROWTH'
  | 'ROE'
  | 'ROCE'
  | 'DEBT_EQUITY'
  | 'INTEREST_COVERAGE'
  | 'OPERATING_CASH_FLOW';

export type MetricDecision =
  | 'REQUIRES_FORMULA_VALIDATION'
  | 'REQUIRES_BANK_SPECIFIC_MAPPING'
  | 'NOT_APPLICABLE_GENERIC_FORMULA'
  | 'REQUIRES_NBFC_SPECIFIC_MAPPING'
  | 'REQUIRES_INSURANCE_SPECIFIC_MAPPING'
  | 'BLOCKED_UNKNOWN_SECTOR';

const METRICS: TargetMetric[] = [
  'REVENUE_GROWTH', 'PROFIT_GROWTH', 'ROE', 'ROCE',
  'DEBT_EQUITY', 'INTEREST_COVERAGE', 'OPERATING_CASH_FLOW',
];

/**
 * All seven generic metrics remain non-production until their source,
 * period, basis and formula policies are approved. The bank exclusions
 * specifically prevent industrial formulas/thresholds being applied to banks.
 */
export function assessMetricApplicability(
  sector: IssuerSector,
  metric: TargetMetric,
): MetricDecision {
  if (!METRICS.includes(metric)) return 'BLOCKED_UNKNOWN_SECTOR';

  if (sector === 'UNKNOWN') return 'BLOCKED_UNKNOWN_SECTOR';

  if (sector === 'BANK') {
    if (metric === 'ROCE' || metric === 'DEBT_EQUITY' || metric === 'INTEREST_COVERAGE') {
      return 'NOT_APPLICABLE_GENERIC_FORMULA';
    }
    return 'REQUIRES_BANK_SPECIFIC_MAPPING';
  }

  if (sector === 'NBFC') return 'REQUIRES_NBFC_SPECIFIC_MAPPING';
  if (sector === 'INSURANCE') return 'REQUIRES_INSURANCE_SPECIFIC_MAPPING';
  return 'REQUIRES_FORMULA_VALIDATION';
}

export interface ContextShape {
  periodStart: string | null;
  periodEnd: string | null;
  instant: string | null;
  dimensions: string[];
}

export interface ContextExpectation {
  periodStart: string;
  periodEnd: string;
  periodKind: 'DURATION' | 'INSTANT';
  basis: 'CONSOLIDATED' | 'STANDALONE';
  filingBasis: 'CONSOLIDATED' | 'STANDALONE' | null;
}

/**
 * Conservative group-context gate:
 * - exact period dates and duration/instant shape must match;
 * - any dimensional context is excluded from group-total selection;
 * - filing-level basis must be explicit and equal the requested basis.
 * This does not establish that a taxonomy concept is the correct metric.
 */
export function isEligibleGroupContext(
  context: ContextShape,
  expected: ContextExpectation,
): boolean {
  if (!expected.filingBasis || expected.filingBasis !== expected.basis) return false;
  if (context.dimensions.length !== 0) return false;

  if (expected.periodKind === 'INSTANT') {
    return context.instant === expected.periodEnd
      && context.periodStart === null
      && context.periodEnd === null;
  }

  return context.instant === null
    && context.periodStart === expected.periodStart
    && context.periodEnd === expected.periodEnd;
}
