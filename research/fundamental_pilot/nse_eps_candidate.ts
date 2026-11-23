import type { XbrlExtraction, XbrlFact } from './xbrl_extract.ts';

export interface EpsFilingInput {
  extraction: XbrlExtraction;
  periodStart: string;
  periodEnd: string;
  periodType: 'QUARTER' | 'YTD' | 'FY';
  basis: 'STANDALONE' | 'CONSOLIDATED';
}

export interface EpsFactSelection {
  status:
    | 'SELECTED_UNIQUE_PER_SHARE_FACT'
    | 'MISSING_CONCEPT'
    | 'AMBIGUOUS_CONCEPT'
    | 'NO_EXACT_PERIOD_FACT'
    | 'AMBIGUOUS_FACTS'
    | 'BLOCKED_INVALID_UNIT'
    | 'BLOCKED_NON_NUMERIC';
  concept: string | null;
  fact: XbrlFact | null;
  unitMeasures: string[];
  explanation: string;
}

export interface NseEpsCandidate {
  status: 'CANDIDATE_ONLY' | 'REVISION_REVIEW_REQUIRED' | 'BLOCKED';
  concept: string | null;
  basis: 'STANDALONE' | 'CONSOLIDATED';
  periodType: 'QUARTER' | 'YTD' | 'FY';
  periodStart: string;
  periodEnd: string;
  currentValue: number | null;
  priorValue: number | null;
  unit: 'INR_PER_SHARE' | null;
  currentUnitMeasures: string[];
  priorUnitMeasures: string[];
  revisionAudit: {
    stable: boolean;
    checkedRevisions: number;
    changedPeriods: string[];
    issues: string[];
  };
  warnings: string[];
  productionApproved: false;
}

function localName(value: string): string {
  return value.trim().split(':').pop()?.toLowerCase() ?? '';
}

function isPerShareUnit(measures: string[]): boolean {
  if (measures.length !== 2) return false;
  const normalized = measures.map(value => value.trim().toLowerCase()).sort();
  return normalized[0] === 'iso4217:inr' && normalized[1] === 'xbrli:shares';
}

export function selectNseBasicEpsFact(
  extraction: XbrlExtraction,
  periodStart: string,
  periodEnd: string,
): EpsFactSelection {
  const concepts = [...new Set(extraction.facts
    .map(fact => fact.concept.trim())
    .filter(concept => localName(concept) === 'basicearningslosspershare'))].sort();
  if (concepts.length === 0) {
    return { status: 'MISSING_CONCEPT', concept: null, fact: null, unitMeasures: [], explanation: 'BasicEarningsLossPerShare concept is missing.' };
  }
  if (concepts.length !== 1) {
    return { status: 'AMBIGUOUS_CONCEPT', concept: null, fact: null, unitMeasures: [], explanation: 'More than one QName matches BasicEarningsLossPerShare.' };
  }
  const concept = concepts[0];
  const eligible = extraction.facts.filter(fact => {
    if (fact.concept !== concept || !fact.contextRef) return false;
    const context = extraction.contexts[fact.contextRef];
    return Boolean(context
      && context.instant === null
      && context.periodStart === periodStart
      && context.periodEnd === periodEnd
      && context.dimensions.length === 0);
  });
  if (eligible.length === 0) {
    return { status: 'NO_EXACT_PERIOD_FACT', concept, fact: null, unitMeasures: [], explanation: 'No undimensioned BasicEarningsLossPerShare fact matches the exact duration period.' };
  }
  if (eligible.length !== 1) {
    return { status: 'AMBIGUOUS_FACTS', concept, fact: null, unitMeasures: [], explanation: 'More than one exact-period undimensioned BasicEarningsLossPerShare fact exists.' };
  }
  const fact = eligible[0];
  const unitMeasures = fact.unitRef ? extraction.units[fact.unitRef] ?? [] : [];
  if (!isPerShareUnit(unitMeasures)) {
    return { status: 'BLOCKED_INVALID_UNIT', concept, fact: null, unitMeasures, explanation: 'EPS unit is not explicitly INR per share.' };
  }
  if (fact.isNil || fact.numericValue === null || !Number.isFinite(fact.numericValue) || fact.rawValue === null) {
    return { status: 'BLOCKED_NON_NUMERIC', concept, fact: null, unitMeasures, explanation: 'EPS fact is nil, missing or non-numeric.' };
  }
  return {
    status: 'SELECTED_UNIQUE_PER_SHARE_FACT',
    concept,
    fact,
    unitMeasures,
    explanation: 'One exact-period, undimensioned basic EPS fact with INR-per-share unit was selected.',
  };
}

export function buildNseEpsCandidate(
  current: EpsFilingInput,
  prior: EpsFilingInput,
  currentRevisions: XbrlExtraction[] = [],
  priorRevisions: XbrlExtraction[] = [],
): NseEpsCandidate {
  const currentSelection = selectNseBasicEpsFact(current.extraction, current.periodStart, current.periodEnd);
  const priorSelection = selectNseBasicEpsFact(prior.extraction, prior.periodStart, prior.periodEnd);
  const changedPeriods: string[] = [];
  const issues: string[] = [];
  if (current.basis !== prior.basis) issues.push('Current and prior EPS filing basis differs.');
  if (current.periodType !== prior.periodType) issues.push('Current and prior EPS period type differs.');
  if (currentSelection.status !== 'SELECTED_UNIQUE_PER_SHARE_FACT') issues.push('Current EPS: ' + currentSelection.explanation);
  if (priorSelection.status !== 'SELECTED_UNIQUE_PER_SHARE_FACT') issues.push('Prior EPS: ' + priorSelection.explanation);
  if (currentSelection.concept && priorSelection.concept && currentSelection.concept !== priorSelection.concept) {
    issues.push('Current and prior EPS taxonomy QName differs.');
  }

  const compareRevisions = (
    original: EpsFactSelection,
    revisions: XbrlExtraction[],
    periodStart: string,
    periodEnd: string,
    label: string,
  ) => {
    if (original.status !== 'SELECTED_UNIQUE_PER_SHARE_FACT' || !original.fact?.numericValue && original.fact?.numericValue !== 0) return;
    for (const revision of revisions) {
      const selected = selectNseBasicEpsFact(revision, periodStart, periodEnd);
      if (selected.status !== 'SELECTED_UNIQUE_PER_SHARE_FACT' || selected.concept !== original.concept) {
        issues.push(label + ' EPS revision is not uniquely selectable: ' + selected.explanation);
      } else if (Math.abs((selected.fact?.numericValue ?? 0) - (original.fact.numericValue ?? 0))
          > Math.max(0.000001, Math.abs(original.fact.numericValue ?? 0) * 1e-10)) {
        if (!changedPeriods.includes(label)) changedPeriods.push(label);
      }
    }
  };
  compareRevisions(currentSelection, currentRevisions, current.periodStart, current.periodEnd, 'current');
  compareRevisions(priorSelection, priorRevisions, prior.periodStart, prior.periodEnd, 'prior');

  const selected = currentSelection.status === 'SELECTED_UNIQUE_PER_SHARE_FACT'
    && priorSelection.status === 'SELECTED_UNIQUE_PER_SHARE_FACT'
    && currentSelection.concept === priorSelection.concept;
  const stable = selected && issues.length === 0 && changedPeriods.length === 0;
  const status = !selected ? 'BLOCKED' : stable ? 'CANDIDATE_ONLY' : 'REVISION_REVIEW_REQUIRED';
  const warnings = [
    currentSelection.explanation,
    priorSelection.explanation,
    ...(current.periodType === 'YTD' ? ['YTD EPS is cumulative and must not be displayed as standalone quarterly EPS.'] : []),
    ...(current.periodType === 'FY' ? ['EPS represents a full financial year, not a single quarter.'] : []),
    ...changedPeriods.map(period => period + ' EPS changed in revision history.'),
    ...issues,
    'EPS is a research candidate only; no scanner EPS field is updated.',
  ];
  return {
    status,
    concept: selected ? currentSelection.concept : null,
    basis: current.basis,
    periodType: current.periodType,
    periodStart: current.periodStart,
    periodEnd: current.periodEnd,
    currentValue: currentSelection.fact?.numericValue ?? null,
    priorValue: priorSelection.fact?.numericValue ?? null,
    unit: selected ? 'INR_PER_SHARE' : null,
    currentUnitMeasures: currentSelection.unitMeasures,
    priorUnitMeasures: priorSelection.unitMeasures,
    revisionAudit: {
      stable,
      checkedRevisions: currentRevisions.length + priorRevisions.length,
      changedPeriods,
      issues,
    },
    warnings,
    productionApproved: false,
  };
}
