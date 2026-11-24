import { selectXbrlInstantFact } from './xbrl_instant_fact_selector.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

export type RoceCapitalEmployedPairStatus =
  | 'SELECTED_COMPONENT_PAIR_CANDIDATE'
  | 'BLOCKED_DATE_ORDER'
  | 'BLOCKED_ISSUER_MISMATCH'
  | 'BLOCKED_BASIS_MISMATCH'
  | 'BLOCKED_CONCEPT_MISMATCH'
  | 'BLOCKED_FACT_SELECTION'
  | 'BLOCKED_CURRENCY_MISMATCH'
  | 'BLOCKED_COMPONENT_VALUE';

export interface RoceCapitalComponents {
  totalEquity: number;
  currentBorrowings: number;
  noncurrentBorrowings: number;
  preLeaseCapitalEmployed: number;
}

export interface RoceCapitalEmployedPairResult {
  status: RoceCapitalEmployedPairStatus;
  opening: RoceCapitalComponents | null;
  closing: RoceCapitalComponents | null;
  currency: string | null;
  openingDate: string;
  closingDate: string;
  leaseTreatment: 'EXCLUDED_PENDING_POLICY';
  productionApproved: false;
  explanation: string;
  failedFacts: string[];
}

type Basis = 'STANDALONE' | 'CONSOLIDATED';
type ComponentRole = 'TOTAL_EQUITY' | 'CURRENT_BORROWINGS' | 'NONCURRENT_BORROWINGS';
const EXPECTED_LOCAL_NAMES: Record<ComponentRole, string> = {
  TOTAL_EQUITY: 'Equity',
  CURRENT_BORROWINGS: 'BorrowingsCurrent',
  NONCURRENT_BORROWINGS: 'BorrowingsNoncurrent',
};

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function localName(value: string): string {
  return value.trim().split(':').pop() ?? '';
}
function issuerIdentity(extraction: XbrlExtraction, date: string): string | null {
  const identities = new Set(Object.values(extraction.contexts)
    .filter(context => context.instant === date && context.dimensions.length === 0)
    .map(context => context.entityScheme?.trim() && context.entityIdentifier?.trim()
      ? context.entityScheme.trim() + '|' + context.entityIdentifier.trim() : null)
    .filter((value): value is string => value !== null));
  return identities.size === 1 ? [...identities][0] : null;
}

/**
 * Research-only ROCE capital-employed evidence guard. It selects total equity
 * and current/non-current borrowings at both exact balance-sheet dates.
 * Lease liabilities are deliberately excluded and explicitly left pending a
 * separately approved accounting policy. No ROCE ratio or production value
 * is calculated or approved.
 */
export function selectRoceCapitalEmployedPairCandidate(request: {
  opening: {
    extraction: XbrlExtraction;
    concepts: Record<ComponentRole, string>;
    date: string;
    basis: Basis;
    filingBasis: Basis | null;
  };
  closing: {
    extraction: XbrlExtraction;
    concepts: Record<ComponentRole, string>;
    date: string;
    basis: Basis;
    filingBasis: Basis | null;
  };
}): RoceCapitalEmployedPairResult {
  const { opening, closing } = request;
  const base = {
    openingDate: opening.date,
    closingDate: closing.date,
    leaseTreatment: 'EXCLUDED_PENDING_POLICY' as const,
    productionApproved: false as const,
  };
  const blocked = (
    status: RoceCapitalEmployedPairStatus,
    explanation: string,
    failedFacts: string[] = [],
  ): RoceCapitalEmployedPairResult => ({
    ...base, status, opening: null, closing: null, currency: null, explanation, failedFacts,
  });

  if (!validDate(opening.date) || !validDate(closing.date) || opening.date >= closing.date) {
    return blocked('BLOCKED_DATE_ORDER', 'Opening and closing balance-sheet dates must be valid calendar dates in chronological order.');
  }
  if (opening.basis !== closing.basis
    || opening.filingBasis !== opening.basis || closing.filingBasis !== closing.basis) {
    return blocked('BLOCKED_BASIS_MISMATCH', 'Both filings must explicitly declare the same standalone/consolidated basis.');
  }
  for (const role of Object.keys(EXPECTED_LOCAL_NAMES) as ComponentRole[]) {
    const openConcept = opening.concepts[role]?.trim() ?? '';
    const closeConcept = closing.concepts[role]?.trim() ?? '';
    if (!openConcept || !closeConcept
      || localName(openConcept) !== EXPECTED_LOCAL_NAMES[role]
      || localName(closeConcept) !== EXPECTED_LOCAL_NAMES[role]) {
      return blocked('BLOCKED_CONCEPT_MISMATCH',
        'ROCE requires exact Equity, BorrowingsCurrent and BorrowingsNoncurrent concepts at both dates; owner-attributable equity and trade payables are not substitutes.',
        [role + ': opening=' + openConcept, role + ': closing=' + closeConcept]);
    }
  }
  const openingIssuer = issuerIdentity(opening.extraction, opening.date);
  const closingIssuer = issuerIdentity(closing.extraction, closing.date);
  if (!openingIssuer || !closingIssuer || openingIssuer !== closingIssuer) {
    return blocked('BLOCKED_ISSUER_MISMATCH', 'Opening and closing facts must resolve to the same unambiguous XBRL entity scheme and identifier.');
  }

  const selectSnapshot = (side: 'opening' | 'closing', snapshot: typeof opening) => {
    const selected = {} as Record<ComponentRole, { value: number; currency: string }>;
    const failures: string[] = [];
    for (const role of Object.keys(EXPECTED_LOCAL_NAMES) as ComponentRole[]) {
      const result = selectXbrlInstantFact(snapshot.extraction, {
        concept: snapshot.concepts[role],
        instantDate: snapshot.date,
        basis: snapshot.basis,
        filingBasis: snapshot.filingBasis,
      });
      if (result.status !== 'SELECTED_UNIQUE_GROUP_FACT' || !result.fact) {
        failures.push(side + ' ' + role + ': ' + result.status);
      } else {
        selected[role] = {
          value: result.fact.numericValue,
          currency: result.fact.unitMeasures[0],
        };
      }
    }
    return { selected, failures };
  };

  const open = selectSnapshot('opening', opening);
  const close = selectSnapshot('closing', closing);
  const failures = [...open.failures, ...close.failures];
  if (failures.length) {
    return blocked('BLOCKED_FACT_SELECTION',
      'All six exact-date, undimensioned balance-sheet facts must be uniquely selected; partial component pairs are withheld.', failures);
  }

  const selectedFacts = [
    ...Object.values(open.selected),
    ...Object.values(close.selected),
  ];
  const currencies = new Set(selectedFacts.map(fact => fact.currency));
  if (currencies.size !== 1 || !selectedFacts[0].currency) {
    return blocked('BLOCKED_CURRENCY_MISMATCH',
      'All opening and closing equity/borrowing components must use the same ISO 4217 currency.',
      [...currencies].map(currency => 'currency: ' + currency));
  }
  const validComponents = (facts: typeof open.selected) =>
    facts.TOTAL_EQUITY.value > 0
    && facts.CURRENT_BORROWINGS.value >= 0
    && facts.NONCURRENT_BORROWINGS.value >= 0
    && Object.values(facts).every(fact => Number.isFinite(fact.value));
  if (!validComponents(open.selected) || !validComponents(close.selected)) {
    return blocked('BLOCKED_COMPONENT_VALUE',
      'Total equity must be positive and current/non-current borrowings must be finite and non-negative at both dates.');
  }

  const components = (facts: typeof open.selected): RoceCapitalComponents => ({
    totalEquity: facts.TOTAL_EQUITY.value,
    currentBorrowings: facts.CURRENT_BORROWINGS.value,
    noncurrentBorrowings: facts.NONCURRENT_BORROWINGS.value,
    preLeaseCapitalEmployed: facts.TOTAL_EQUITY.value
      + facts.CURRENT_BORROWINGS.value + facts.NONCURRENT_BORROWINGS.value,
  });
  return {
    ...base,
    status: 'SELECTED_COMPONENT_PAIR_CANDIDATE',
    opening: components(open.selected),
    closing: components(close.selected),
    currency: selectedFacts[0].currency,
    failedFacts: [],
    explanation: 'Same-issuer, same-basis, exact-date total equity and borrowing components were selected in one currency. The subtotal excludes lease liabilities pending policy approval; it is not a finalized capital-employed denominator and cannot be used to calculate or approve ROCE.',
  };
}
