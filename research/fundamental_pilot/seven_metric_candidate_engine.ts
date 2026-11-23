import { buildMetricAuditMatrix, type MetricAuditMatrix } from './metric_audit_matrix.ts';
import type { IssuerSector } from './sector_metric_policy.ts';
import { calculateGrowthCandidate, type ComparableMetricFact, type GrowthCandidateResult } from './metric_growth_candidate.ts';
import { calculateOcfCandidate, type OcfCandidateResult } from './operating_cashflow_candidate.ts';
import type { MetricDataStatus } from './fundamental_profile.ts';

export interface SevenMetricPeriodInput {
  periodType: 'QUARTER' | 'YTD' | 'FY' | 'TTM';
  periodStart: string;
  periodEnd: string;
  basis: 'STANDALONE' | 'CONSOLIDATED';
  revenue: ComparableMetricFact | null;
  profit: ComparableMetricFact | null;
  operatingCashFlow: ComparableMetricFact | null;
  revenueSelectionStatus?: MetricDataStatus;
  profitSelectionStatus?: MetricDataStatus;
  operatingCashFlowSelectionStatus?: MetricDataStatus;
}

export interface SevenMetricCandidateReport {
  sector: IssuerSector;
  currentPeriod: { periodType: string; periodStart: string; periodEnd: string; basis: string };
  priorPeriod: { periodType: string; periodStart: string; periodEnd: string; basis: string };
  candidates: {
    revenueGrowth: GrowthCandidateResult | null;
    profitGrowth: GrowthCandidateResult | null;
    operatingCashFlow: OcfCandidateResult | null;
  };
  auditMatrix: MetricAuditMatrix;
  productionApproved: false;
}

function factMatchesPeriod(
  fact: ComparableMetricFact,
  period: SevenMetricPeriodInput,
): boolean {
  return fact.periodType === period.periodType
    && fact.periodStart === period.periodStart
    && fact.periodEnd === period.periodEnd
    && fact.basis === period.basis;
}

function blockedGrowth(metric: 'REVENUE_GROWTH'|'PROFIT_GROWTH'): GrowthCandidateResult {
  return {
    metric,status:'BLOCKED_PERIOD_ALIGNMENT',growthPercent:null,
    formulaId:'same_period_yoy_growth',formulaVersion:'1.0.0',
    explanation:'Raw fact period or basis does not match the filing-period envelope; value withheld.',
    productionApproved:false,
  };
}

function blockedOcf(): OcfCandidateResult {
  return {
    status:'BLOCKED_PERIOD_ALIGNMENT',currentValue:null,priorValue:null,
    absoluteChange:null,percentageChange:null,currentDirection:null,priorDirection:null,
    productionApproved:false,
    explanation:'Raw OCF fact period or basis does not match the filing-period envelope; value withheld.',
  };
}

function missingFactStatus(
  current: MetricDataStatus | undefined,
  prior: MetricDataStatus | undefined,
): MetricDataStatus {
  const statuses=[current,prior].filter((value):value is MetricDataStatus=>value!==undefined);
  if(statuses.includes('CONFLICT')) return 'CONFLICT';
  if(statuses.includes('BLOCKED')) return 'BLOCKED';
  if(statuses.includes('NOT_APPLICABLE')) return 'NOT_APPLICABLE';
  return 'MISSING';
}

function candidateStatus(status: string): MetricDataStatus {
  if (status === 'CANDIDATE_ONLY') return 'VALIDATED';
  if (status === 'BLOCKED_MISSING_VALUE') return 'MISSING';
  if (status === 'BLOCKED_CONCEPT_MISMATCH') return 'CONFLICT';
  return 'BLOCKED';
}

/**
 * Orchestrates only the three currently candidate-eligible non-financial
 * metrics. Input facts must already have passed official filing, exact context,
 * group-dimension, unit and revision selection. ROE/ROCE/Debt-Equity/Interest
 * Coverage remain explicitly blocked by the metric-definition catalog.
 */
export function buildSevenMetricCandidateReport(
  sector: IssuerSector,
  current: SevenMetricPeriodInput,
  prior: SevenMetricPeriodInput,
): SevenMetricCandidateReport {
  const revenueGrowth = current.revenue && prior.revenue
    ? (factMatchesPeriod(current.revenue,current) && factMatchesPeriod(prior.revenue,prior)
      ? calculateGrowthCandidate('REVENUE_GROWTH', current.revenue, prior.revenue)
      : blockedGrowth('REVENUE_GROWTH'))
    : null;
  const profitGrowth = current.profit && prior.profit
    ? (factMatchesPeriod(current.profit,current) && factMatchesPeriod(prior.profit,prior)
      ? calculateGrowthCandidate('PROFIT_GROWTH', current.profit, prior.profit)
      : blockedGrowth('PROFIT_GROWTH'))
    : null;
  const operatingCashFlow = current.operatingCashFlow && prior.operatingCashFlow
    ? (factMatchesPeriod(current.operatingCashFlow,current) && factMatchesPeriod(prior.operatingCashFlow,prior)
      ? calculateOcfCandidate(current.operatingCashFlow, prior.operatingCashFlow)
      : blockedOcf())
    : null;

  const statuses: Partial<Record<
    'REVENUE_GROWTH'|'PROFIT_GROWTH'|'ROE'|'ROCE'|'DEBT_EQUITY'|'INTEREST_COVERAGE'|'OPERATING_CASH_FLOW',
    MetricDataStatus
  >> = {
    REVENUE_GROWTH: revenueGrowth ? candidateStatus(revenueGrowth.status) : missingFactStatus(current.revenueSelectionStatus,prior.revenueSelectionStatus),
    PROFIT_GROWTH: profitGrowth ? candidateStatus(profitGrowth.status) : missingFactStatus(current.profitSelectionStatus,prior.profitSelectionStatus),
    ROE: 'BLOCKED',
    ROCE: 'BLOCKED',
    DEBT_EQUITY: 'BLOCKED',
    INTEREST_COVERAGE: 'BLOCKED',
    OPERATING_CASH_FLOW: operatingCashFlow ? candidateStatus(operatingCashFlow.status) : missingFactStatus(current.operatingCashFlowSelectionStatus,prior.operatingCashFlowSelectionStatus),
  };

  return {
    sector,
    currentPeriod: {
      periodType: current.periodType, periodStart: current.periodStart,
      periodEnd: current.periodEnd, basis: current.basis,
    },
    priorPeriod: {
      periodType: prior.periodType, periodStart: prior.periodStart,
      periodEnd: prior.periodEnd, basis: prior.basis,
    },
    candidates: { revenueGrowth, profitGrowth, operatingCashFlow },
    auditMatrix: buildMetricAuditMatrix(sector, statuses),
    productionApproved: false,
  };
}
