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
    ? calculateGrowthCandidate('REVENUE_GROWTH', current.revenue, prior.revenue)
    : null;
  const profitGrowth = current.profit && prior.profit
    ? calculateGrowthCandidate('PROFIT_GROWTH', current.profit, prior.profit)
    : null;
  const operatingCashFlow = current.operatingCashFlow && prior.operatingCashFlow
    ? calculateOcfCandidate(current.operatingCashFlow, prior.operatingCashFlow)
    : null;

  const statuses: Partial<Record<
    'REVENUE_GROWTH'|'PROFIT_GROWTH'|'ROE'|'ROCE'|'DEBT_EQUITY'|'INTEREST_COVERAGE'|'OPERATING_CASH_FLOW',
    MetricDataStatus
  >> = {
    REVENUE_GROWTH: revenueGrowth ? candidateStatus(revenueGrowth.status) : 'MISSING',
    PROFIT_GROWTH: profitGrowth ? candidateStatus(profitGrowth.status) : 'MISSING',
    ROE: 'BLOCKED',
    ROCE: 'BLOCKED',
    DEBT_EQUITY: 'BLOCKED',
    INTEREST_COVERAGE: 'BLOCKED',
    OPERATING_CASH_FLOW: operatingCashFlow ? candidateStatus(operatingCashFlow.status) : 'MISSING',
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
