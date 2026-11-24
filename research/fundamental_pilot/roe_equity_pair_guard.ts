import { selectXbrlInstantFact } from './xbrl_instant_fact_selector.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

export type RoeEquityPairStatus =
  | 'SELECTED_EQUITY_PAIR_CANDIDATE'
  | 'BLOCKED_DATE_ORDER'
  | 'BLOCKED_ISSUER_MISMATCH'
  | 'BLOCKED_BASIS_MISMATCH'
  | 'BLOCKED_CONCEPT_MISMATCH'
  | 'BLOCKED_EQUITY_VALUE'
  | 'BLOCKED_FACT_SELECTION';

export interface RoeEquityPairResult {
  status: RoeEquityPairStatus;
  openingEquity: number | null;
  closingEquity: number | null;
  averageEquity: number | null;
  currency: string | null;
  openingDate: string;
  closingDate: string;
  productionApproved: false;
  explanation: string;
  failedFacts: string[];
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function issuerIdentity(extraction: XbrlExtraction, instantDate: string): string | null {
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
 * Research-only ROE denominator evidence guard. It selects owner-attributable
 * equity at two exact balance-sheet dates, proves the XBRL entity and basis
 * match, and returns an average-equity candidate. It does not select PAT,
 * annualize earnings, calculate ROE, or approve production.
 */
export function selectRoeEquityPairCandidate(request: {
  opening: { extraction: XbrlExtraction; concept: string; date: string; basis: 'STANDALONE'|'CONSOLIDATED'; filingBasis: 'STANDALONE'|'CONSOLIDATED'|null };
  closing: { extraction: XbrlExtraction; concept: string; date: string; basis: 'STANDALONE'|'CONSOLIDATED'; filingBasis: 'STANDALONE'|'CONSOLIDATED'|null };
}): RoeEquityPairResult {
  const { opening, closing } = request;
  const base = {
    openingDate: opening.date,
    closingDate: closing.date,
    productionApproved: false as const,
  };
  const blocked = (status: RoeEquityPairStatus, explanation: string, failedFacts: string[] = []): RoeEquityPairResult => ({
    ...base, status, openingEquity: null, closingEquity: null, averageEquity: null,
    currency: null, explanation, failedFacts,
  });

  if (!validDate(opening.date) || !validDate(closing.date) || opening.date >= closing.date) {
    return blocked('BLOCKED_DATE_ORDER', 'Opening and closing dates must be valid calendar dates in chronological order.');
  }
  if (opening.basis !== closing.basis || opening.filingBasis !== opening.basis || closing.filingBasis !== closing.basis) {
    return blocked('BLOCKED_BASIS_MISMATCH', 'Both filings must explicitly declare the same standalone/consolidated basis.');
  }
  if (!opening.concept.trim() || !closing.concept.trim()
    || opening.concept.trim().split(':').pop() !== closing.concept.trim().split(':').pop()) {
    return blocked('BLOCKED_CONCEPT_MISMATCH', 'Opening and closing facts must use the same exact local XBRL concept name.');
  }
  const openingIssuer = issuerIdentity(opening.extraction, opening.date);
  const closingIssuer = issuerIdentity(closing.extraction, closing.date);
  if (!openingIssuer || !closingIssuer || openingIssuer !== closingIssuer) {
    return blocked('BLOCKED_ISSUER_MISMATCH', 'Each filing must resolve to one unambiguous XBRL entity, and both entity scheme/identifiers must match.');
  }

  const openingFact = selectXbrlInstantFact(opening.extraction, {
    concept: opening.concept, instantDate: opening.date, basis: opening.basis, filingBasis: opening.filingBasis,
  });
  const closingFact = selectXbrlInstantFact(closing.extraction, {
    concept: closing.concept, instantDate: closing.date, basis: closing.basis, filingBasis: closing.filingBasis,
  });
  const failedFacts: string[] = [];
  if (openingFact.status !== 'SELECTED_UNIQUE_GROUP_FACT' || !openingFact.fact) {
    failedFacts.push('opening: ' + openingFact.status);
  }
  if (closingFact.status !== 'SELECTED_UNIQUE_GROUP_FACT' || !closingFact.fact) {
    failedFacts.push('closing: ' + closingFact.status);
  }
  if (failedFacts.length || !openingFact.fact || !closingFact.fact) {
    return blocked('BLOCKED_FACT_SELECTION', 'Both exact-date, undimensioned owner-equity facts must pass the XBRL selector; partial pairs are withheld.', failedFacts);
  }
  const openingCurrency = openingFact.fact.unitMeasures[0];
  const closingCurrency = closingFact.fact.unitMeasures[0];
  if (openingCurrency !== closingCurrency) {
    return blocked('BLOCKED_FACT_SELECTION', 'Opening and closing equity must use the same ISO 4217 currency.', ['opening currency: ' + openingCurrency, 'closing currency: ' + closingCurrency]);
  }
  const openingValue = openingFact.fact.numericValue;
  const closingValue = closingFact.fact.numericValue;
  const averageEquity = (openingValue + closingValue) / 2;
  if (!Number.isFinite(averageEquity) || openingValue <= 0 || closingValue <= 0 || averageEquity <= 0) {
    return blocked('BLOCKED_EQUITY_VALUE', 'Opening and closing owner equity must both be positive finite values; no zero or negative denominator is accepted.');
  }
  return {
    ...base, status: 'SELECTED_EQUITY_PAIR_CANDIDATE',
    openingEquity: openingValue, closingEquity: closingValue, averageEquity,
    currency: openingCurrency, failedFacts: [],
    productionApproved: false,
    explanation: 'Same-issuer, same-basis, exact-date owner-equity facts selected in one currency. Average equity is research-only; PAT period alignment, annualization and official statement reconciliation remain mandatory.',
  };
}
