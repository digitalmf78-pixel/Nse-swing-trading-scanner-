import { selectRoeEquityPairCandidate, type RoeEquityPairResult } from './roe_equity_pair_guard.ts';
import { selectXbrlMetricFact } from './xbrl_metric_fact_selector.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';
import type { ComparablePeriodType } from './metric_growth_candidate.ts';

export type RoePatPeriodStatus =
  | 'SELECTED_PAT_PERIOD_CANDIDATE'
  | 'BLOCKED_EQUITY_PAIR'
  | 'BLOCKED_PERIOD_ALIGNMENT'
  | 'BLOCKED_ISSUER_MISMATCH'
  | 'BLOCKED_BASIS_MISMATCH'
  | 'BLOCKED_CONCEPT_MISMATCH'
  | 'BLOCKED_CURRENCY_MISMATCH'
  | 'BLOCKED_FACT_SELECTION';

export interface RoePatPeriodResult {
  status: RoePatPeriodStatus;
  pat: number | null;
  concept: string | null;
  periodStart: string;
  periodEnd: string;
  periodType: ComparablePeriodType;
  currency: string | null;
  averageEquity: number | null;
  equityPairStatus: RoeEquityPairResult['status'] | null;
  productionApproved: false;
  explanation: string;
  failedFacts: string[];
}

type EquityPairRequest = Parameters<typeof selectRoeEquityPairCandidate>[0];

function validDate(value: string): boolean {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function nextCalendarDate(value: string): string {
  const date = new Date(value + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function issuerIdentity(extraction: XbrlExtraction, periodStart: string, periodEnd: string): string | null {
  const identities = new Set(
    Object.values(extraction.contexts)
      .filter(context => context.periodStart === periodStart && context.periodEnd === periodEnd && context.dimensions.length === 0)
      .map(context => {
        if (!context.entityScheme?.trim() || !context.entityIdentifier?.trim()) return null;
        return context.entityScheme.trim() + '|' + context.entityIdentifier.trim();
      })
      .filter((value): value is string => value !== null),
  );
  return identities.size === 1 ? [...identities][0] : null;
}

function instantIssuerIdentity(extraction: XbrlExtraction, instantDate: string): string | null {
  const identities = new Set(
    Object.values(extraction.contexts)
      .filter(context => context.instant === instantDate && context.dimensions.length === 0)
      .map(context => {
        if (!context.entityScheme?.trim() || !context.entityIdentifier?.trim()) return null;
        return context.entityScheme.trim() + '|' + context.entityIdentifier.trim();
      })
      .filter((value): value is string => value !== null),
  );
  return identities.size === 1 ? [...identities][0] : null;
}

/**
 * Research-only ROE numerator/denominator evidence gate.
 * Requires one exact-duration PAT fact and a complete opening/closing
 * owner-equity pair for the same issuer, basis, contiguous period and currency.
 * It deliberately does not annualize, calculate ROE, or approve production.
 */
export function selectRoePatPeriodCandidate(request: {
  equityPair: EquityPairRequest;
  patExtraction: XbrlExtraction;
  periodStart: string;
  periodEnd: string;
  periodType: ComparablePeriodType;
  basis: 'STANDALONE' | 'CONSOLIDATED';
  filingBasis: 'STANDALONE' | 'CONSOLIDATED' | null;
  concept: string;
}): RoePatPeriodResult {
  const { equityPair, patExtraction, periodStart, periodEnd, periodType, basis, filingBasis, concept } = request;
  const base = { periodStart, periodEnd, periodType, productionApproved: false as const };
  const blocked = (
    status: RoePatPeriodStatus,
    explanation: string,
    failedFacts: string[] = [],
    equityPairStatus: RoeEquityPairResult['status'] | null = null,
  ): RoePatPeriodResult => ({
    ...base, status, pat: null, concept: null, currency: null, averageEquity: null,
    equityPairStatus, explanation, failedFacts,
  });

  const equity = selectRoeEquityPairCandidate(equityPair);
  if (equity.status !== 'SELECTED_EQUITY_PAIR_CANDIDATE' || !equity.averageEquity || !equity.currency) {
    return blocked('BLOCKED_EQUITY_PAIR', 'A complete validated research-only opening/closing owner-equity pair is required before selecting ROE PAT.', [], equity.status);
  }
  if (!validDate(periodStart) || !validDate(periodEnd) || periodStart >= periodEnd
    || periodStart !== nextCalendarDate(equityPair.opening.date)
    || periodEnd !== equityPair.closing.date) {
    return blocked('BLOCKED_PERIOD_ALIGNMENT', 'PAT duration must begin the calendar day after opening equity and end on the exact closing-equity date. Quarter/YTD/FY/TTM inputs are not annualized or inferred here.', [], equity.status);
  }
  if (basis !== equityPair.opening.basis || basis !== equityPair.closing.basis || filingBasis !== basis) {
    return blocked('BLOCKED_BASIS_MISMATCH', 'PAT filing basis and both equity snapshots must explicitly use the same standalone/consolidated basis.', [], equity.status);
  }
  const expectedConcept = basis === 'CONSOLIDATED'
    ? 'ProfitOrLossAttributableToOwnersOfParent'
    : 'ProfitLossForPeriod';
  if (!concept.trim() || concept.trim().split(':').pop() !== expectedConcept) {
    return blocked('BLOCKED_CONCEPT_MISMATCH', 'ROE PAT concept must be the exact owner-attributable profit concept for consolidated filings or entity profit-for-period for standalone filings.', [], equity.status);
  }
  const patIssuer = issuerIdentity(patExtraction, periodStart, periodEnd);
  const equityIssuer = instantIssuerIdentity(equityPair.closing.extraction, equityPair.closing.date);
  if (!patIssuer || !equityIssuer || patIssuer !== equityIssuer) {
    return blocked('BLOCKED_ISSUER_MISMATCH', 'PAT duration and closing equity must resolve to the same unambiguous XBRL entity scheme and identifier.', [], equity.status);
  }

  const selected = selectXbrlMetricFact(patExtraction, {
    concept, periodStart, periodEnd, periodType, basis, filingBasis,
  });
  if (selected.status !== 'SELECTED_UNIQUE_GROUP_FACT' || !selected.fact) {
    return blocked('BLOCKED_FACT_SELECTION', 'One exact-period, undimensioned, numeric owner-PAT fact with a single currency unit is required.', [selected.status], equity.status);
  }
  const currency = selected.fact.unitMeasures[0];
  if (currency !== equity.currency) {
    return blocked('BLOCKED_CURRENCY_MISMATCH', 'PAT and opening/closing owner equity must use the same ISO 4217 currency.', ['PAT currency: ' + currency, 'equity currency: ' + equity.currency], equity.status);
  }
  return {
    ...base, status: 'SELECTED_PAT_PERIOD_CANDIDATE', pat: selected.fact.numericValue,
    concept, currency, averageEquity: equity.averageEquity, equityPairStatus: equity.status,
    productionApproved: false,
    failedFacts: [],
    explanation: 'Exact-period owner-attributable PAT and average owner-equity evidence align by issuer, filing basis, contiguous dates and currency. This is not an ROE calculation; annualization, statement reconciliation, revision resolution and production validation remain blocked.',
  };
}
