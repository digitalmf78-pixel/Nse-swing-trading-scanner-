import { buildSevenMetricCandidateReport, type SevenMetricCandidateReport, type SevenMetricPeriodInput } from './seven_metric_candidate_engine.ts';
import type { IssuerSector } from './sector_metric_policy.ts';
import type { MetricDataStatus } from './fundamental_profile.ts';
import { selectXbrlMetricFact, type XbrlMetricFactRequest, type XbrlMetricFactSelection } from './xbrl_metric_fact_selector.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

export interface XbrlFilingPeriodInput {
  extraction: XbrlExtraction;
  periodType: 'QUARTER'|'YTD'|'FY'|'TTM';
  periodStart: string;
  periodEnd: string;
  basis: 'STANDALONE'|'CONSOLIDATED';
  filingBasis: 'STANDALONE'|'CONSOLIDATED'|null;
}

export interface IssuerMetricConceptMap {
  revenue: string;
  profit: string;
  operatingCashFlow: string;
}

export interface SevenMetricXbrlPipelineReport {
  conceptMap: IssuerMetricConceptMap;
  currentSelections: {
    revenue: XbrlMetricFactSelection;
    profit: XbrlMetricFactSelection;
    operatingCashFlow: XbrlMetricFactSelection;
  };
  priorSelections: {
    revenue: XbrlMetricFactSelection;
    profit: XbrlMetricFactSelection;
    operatingCashFlow: XbrlMetricFactSelection;
  };
  candidateReport: SevenMetricCandidateReport;
  productionApproved: false;
}

function selectForPeriod(
  filing: XbrlFilingPeriodInput,
  concept: string,
): XbrlMetricFactSelection {
  const request:XbrlMetricFactRequest={
    concept,periodStart:filing.periodStart,periodEnd:filing.periodEnd,
    periodType:filing.periodType,basis:filing.basis,filingBasis:filing.filingBasis,
  };
  return selectXbrlMetricFact(filing.extraction,request);
}

function statusOf(selection:XbrlMetricFactSelection):MetricDataStatus {
  switch(selection.status) {
    case 'SELECTED_UNIQUE_GROUP_FACT': return 'VALIDATED';
    case 'MISSING_CONCEPT': return 'MISSING';
    case 'AMBIGUOUS_GROUP_FACTS': return 'CONFLICT';
    case 'NO_ELIGIBLE_GROUP_FACT':
    case 'BLOCKED_BASIS_MISMATCH':
    case 'BLOCKED_MISSING_UNIT':
    case 'BLOCKED_NON_NUMERIC_FACT':
      return 'BLOCKED';
  }
}

function periodInput(
  filing:XbrlFilingPeriodInput,
  selections:SevenMetricXbrlPipelineReport['currentSelections'],
):SevenMetricPeriodInput {
  return {
    periodType:filing.periodType,periodStart:filing.periodStart,
    periodEnd:filing.periodEnd,basis:filing.basis,
    revenue:selections.revenue.fact,profit:selections.profit.fact,
    operatingCashFlow:selections.operatingCashFlow.fact,
    revenueSelectionStatus:statusOf(selections.revenue),
    profitSelectionStatus:statusOf(selections.profit),
    operatingCashFlowSelectionStatus:statusOf(selections.operatingCashFlow),
  };
}

/**
 * End-to-end research orchestrator for the three candidate-eligible
 * non-financial metrics: exact XBRL concept -> unique group fact -> filing
 * period/basis gate -> candidate calculation -> seven-metric audit matrix.
 * The concept map must be explicitly supplied per issuer/taxonomy; this
 * function never guesses taxonomy extensions or approves production use.
 */
export function buildSevenMetricXbrlPipeline(
  sector:IssuerSector,
  current:XbrlFilingPeriodInput,
  prior:XbrlFilingPeriodInput,
  conceptMap:IssuerMetricConceptMap,
):SevenMetricXbrlPipelineReport {
  const currentSelections={
    revenue:selectForPeriod(current,conceptMap.revenue),
    profit:selectForPeriod(current,conceptMap.profit),
    operatingCashFlow:selectForPeriod(current,conceptMap.operatingCashFlow),
  };
  const priorSelections={
    revenue:selectForPeriod(prior,conceptMap.revenue),
    profit:selectForPeriod(prior,conceptMap.profit),
    operatingCashFlow:selectForPeriod(prior,conceptMap.operatingCashFlow),
  };
  const candidateReport=buildSevenMetricCandidateReport(
    sector,periodInput(current,currentSelections),periodInput(prior,priorSelections),
  );
  return {
    conceptMap,currentSelections,priorSelections,candidateReport,productionApproved:false,
  };
}
