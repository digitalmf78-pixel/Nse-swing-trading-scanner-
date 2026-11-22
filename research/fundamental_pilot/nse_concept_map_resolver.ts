import type { IssuerSector } from './sector_metric_policy.ts';
import type { IssuerMetricConceptMap } from './seven_metric_xbrl_pipeline.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

export type ConceptMapMetric = 'REVENUE' | 'PROFIT' | 'OPERATING_CASH_FLOW';
export type ConceptMapIssue =
  | 'SECTOR_SPECIFIC_MAPPING_REQUIRED'
  | 'MISSING_CONCEPT'
  | 'AMBIGUOUS_CONCEPT'
  | 'CURRENT_PRIOR_CONCEPT_MISMATCH';

export interface ConceptMapMetricResult {
  metric: ConceptMapMetric;
  status: 'MAPPED' | ConceptMapIssue;
  concept: string | null;
  explanation: string;
}

export interface NseConceptMapResolution {
  status: 'MAPPED' | 'BLOCKED';
  conceptMap: IssuerMetricConceptMap | null;
  metrics: Record<ConceptMapMetric, ConceptMapMetricResult>;
  productionApproved: false;
}

const LOCAL_NAMES: Record<'REVENUE' | 'OPERATING_CASH_FLOW', string> = {
  REVENUE: 'RevenueFromOperations',
  OPERATING_CASH_FLOW: 'CashFlowsFromUsedInOperatingActivities',
};

function localName(qname: string): string {
  return qname.trim().split(':').pop()?.toLowerCase() ?? '';
}

function findUniqueConcept(extraction: XbrlExtraction, wantedLocalName: string):
  { status: 'FOUND'; concept: string } | { status: 'MISSING' } | { status: 'AMBIGUOUS'; concepts: string[] } {
  const concepts = [...new Set(extraction.facts
    .map(fact => fact.concept.trim())
    .filter(concept => localName(concept) === wantedLocalName.toLowerCase()))].sort();
  if (concepts.length === 0) return { status: 'MISSING' };
  if (concepts.length > 1) return { status: 'AMBIGUOUS', concepts };
  return { status: 'FOUND', concept: concepts[0] };
}

function resolveAcrossPeriods(
  metric: ConceptMapMetric,
  current: XbrlExtraction,
  prior: XbrlExtraction,
  basis: 'STANDALONE' | 'CONSOLIDATED',
): ConceptMapMetricResult {
  const wanted = metric === 'PROFIT'
    ? (basis === 'CONSOLIDATED' ? 'ProfitOrLossAttributableToOwnersOfParent' : 'ProfitLossForPeriod')
    : LOCAL_NAMES[metric];
  const currentMatch = findUniqueConcept(current, wanted);
  const priorMatch = findUniqueConcept(prior, wanted);
  if (currentMatch.status === 'AMBIGUOUS' || priorMatch.status === 'AMBIGUOUS') {
    const details = [
      currentMatch.status === 'AMBIGUOUS' ? `current=[${currentMatch.concepts.join(', ')}]` : '',
      priorMatch.status === 'AMBIGUOUS' ? `prior=[${priorMatch.concepts.join(', ')}]` : '',
    ].filter(Boolean).join('; ');
    return { metric, status: 'AMBIGUOUS_CONCEPT', concept: null,
      explanation: `More than one namespace concept has local name ${wanted}; no automatic selection: ${details}` };
  }
  if (currentMatch.status === 'MISSING' || priorMatch.status === 'MISSING') {
    return { metric, status: 'MISSING_CONCEPT', concept: null,
      explanation: `Expected taxonomy local name ${wanted} is missing from the current or prior Original filing.` };
  }
  if (currentMatch.concept !== priorMatch.concept) {
    return { metric, status: 'CURRENT_PRIOR_CONCEPT_MISMATCH', concept: null,
      explanation: `Current concept ${currentMatch.concept} differs from prior concept ${priorMatch.concept}; no cross-namespace comparison is allowed.` };
  }
  return { metric, status: 'MAPPED', concept: currentMatch.concept,
    explanation: `One exact QName was found in both filing periods for ${wanted}; exact-period fact selection remains a separate gate.` };
}

/**
 * Conservative automatic mapping for non-financial issuers.
 * It maps only the three well-defined statement concepts by exact taxonomy
 * local name, requires one QName in each filing and requires the QName to be
 * identical across current/prior filings. It never guesses custom extensions.
 */
export function resolveNseConceptMap(
  sector: IssuerSector,
  basis: 'STANDALONE' | 'CONSOLIDATED',
  current: XbrlExtraction,
  prior: XbrlExtraction,
): NseConceptMapResolution {
  const metrics = {
    REVENUE: resolveAcrossPeriods('REVENUE', current, prior, basis),
    PROFIT: resolveAcrossPeriods('PROFIT', current, prior, basis),
    OPERATING_CASH_FLOW: resolveAcrossPeriods('OPERATING_CASH_FLOW', current, prior, basis),
  };
  if (sector !== 'NON_FINANCIAL') {
    for (const metric of Object.keys(metrics) as ConceptMapMetric[]) {
      metrics[metric] = {
        metric,
        status: 'SECTOR_SPECIFIC_MAPPING_REQUIRED',
        concept: null,
        explanation: `${sector} issuers require a separate sector-approved taxonomy map; industrial aliases are not applied.`,
      };
    }
    return { status: 'BLOCKED', conceptMap: null, metrics, productionApproved: false };
  }
  const allMapped = Object.values(metrics).every(result => result.status === 'MAPPED');
  if (!allMapped) return { status: 'BLOCKED', conceptMap: null, metrics, productionApproved: false };
  return {
    status: 'MAPPED',
    conceptMap: {
      revenue: metrics.REVENUE.concept!,
      profit: metrics.PROFIT.concept!,
      profitAttribution: basis === 'CONSOLIDATED' ? 'OWNERS_OF_PARENT' : 'STANDALONE_ENTITY',
      operatingCashFlow: metrics.OPERATING_CASH_FLOW.concept!,
    },
    metrics,
    productionApproved: false,
  };
}
