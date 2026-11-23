import type { IssuerSector } from './sector_metric_policy.ts';
import type { IssuerMetricConceptMap } from './seven_metric_xbrl_pipeline.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

export type ConceptMapMetric = 'REVENUE' | 'PROFIT' | 'OPERATING_CASH_FLOW' | 'ROE' | 'ROCE' | 'DEBT_EQUITY' | 'INTEREST_COVERAGE';
export type ConceptMapIssue =
  | 'SECTOR_SPECIFIC_MAPPING_REQUIRED'
  | 'MISSING_CONCEPT'
  | 'AMBIGUOUS_CONCEPT'
  | 'CURRENT_PRIOR_CONCEPT_MISMATCH'
  | 'STATEMENT_ROW_RECONCILIATION_REQUIRED';

export interface ConceptMapMetricResult {
  metric: ConceptMapMetric;
  status: 'MAPPED' | ConceptMapIssue;
  concept: string | null;
  explanation: string;
}

export interface NseConceptMapResolution {
  status: 'MAPPED' | 'PARTIAL' | 'BLOCKED';
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
  if (metric !== 'PROFIT' && metric !== 'REVENUE' && metric !== 'OPERATING_CASH_FLOW') {
    return {
      metric, status: 'STATEMENT_ROW_RECONCILIATION_REQUIRED', concept: null,
      explanation: 'Ratio metrics require a statement-row bridge and cannot use the growth-metric QName resolver.',
    };
  }
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
 * Revenue and Profit are the minimum pair required for growth candidates.
 * OCF is mapped independently. ROE, ROCE, Debt/Equity and Interest Coverage
 * remain explicitly blocked until their statement-row bridges and instant/
 * duration facts are evidenced and reconciled; a missing OCF concept blocks only OCF and
 * never suppresses exact Revenue/Profit candidates. Every mapped concept
 * requires one QName in each filing and the same QName across periods.
 * Custom extensions are never guessed.
 */
export function resolveNseConceptMap(
  sector: IssuerSector,
  basis: 'STANDALONE' | 'CONSOLIDATED',
  current: XbrlExtraction,
  prior: XbrlExtraction,
): NseConceptMapResolution {
  const metrics: Record<ConceptMapMetric, ConceptMapMetricResult> = {
    REVENUE: resolveAcrossPeriods('REVENUE', current, prior, basis),
    PROFIT: resolveAcrossPeriods('PROFIT', current, prior, basis),
    OPERATING_CASH_FLOW: resolveAcrossPeriods('OPERATING_CASH_FLOW', current, prior, basis),
    ROE: {
      metric: 'ROE', status: 'STATEMENT_ROW_RECONCILIATION_REQUIRED', concept: null,
      explanation: 'Blocked: PAT attribution plus opening/closing owner-equity statement rows are not yet mapped and reconciled. A duration fact and two instant facts are required; no QName alias is guessed.',
    },
    ROCE: {
      metric: 'ROCE', status: 'STATEMENT_ROW_RECONCILIATION_REQUIRED', concept: null,
      explanation: 'Blocked: EBIT bridge and opening/closing capital-employed statement rows are not yet mapped and reconciled. A duration fact and two instant facts are required; associate/JV and lease policies remain unresolved.',
    },
    DEBT_EQUITY: {
      metric: 'DEBT_EQUITY', status: 'STATEMENT_ROW_RECONCILIATION_REQUIRED', concept: null,
      explanation: 'Blocked: current and non-current interest-bearing borrowings plus same-date total equity statement rows are not yet mapped and reconciled. Lease liabilities remain separately reported; no QName alias is guessed.',
    },
    INTEREST_COVERAGE: {
      metric: 'INTEREST_COVERAGE', status: 'STATEMENT_ROW_RECONCILIATION_REQUIRED', concept: null,
      explanation: 'Blocked: EBIT bridge and finance-cost statement row for the identical duration are not yet mapped and reconciled; no QName alias is guessed.',
    },
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
  const growthMapped = metrics.REVENUE.status === 'MAPPED' && metrics.PROFIT.status === 'MAPPED';
  if (!growthMapped) return { status: 'BLOCKED', conceptMap: null, metrics, productionApproved: false };
  const allMapped = metrics.OPERATING_CASH_FLOW.status === 'MAPPED';
  return {
    status: allMapped ? 'MAPPED' : 'PARTIAL',
    conceptMap: {
      revenue: metrics.REVENUE.concept!,
      profit: metrics.PROFIT.concept!,
      profitAttribution: basis === 'CONSOLIDATED' ? 'OWNERS_OF_PARENT' : 'STANDALONE_ENTITY',
      operatingCashFlow: metrics.OPERATING_CASH_FLOW.concept,
    },
    metrics,
    productionApproved: false,
  };
}
