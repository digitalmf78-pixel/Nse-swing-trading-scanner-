import type { IssuerSector } from './sector_metric_policy.ts';
import { getMetricDefinitionPolicy, type FundamentalMetric } from './metric_definition_policy.ts';
import type { MetricDataStatus } from './fundamental_profile.ts';

export type MetricAuditDecision =
  | 'DATA_MISSING'
  | 'DATA_NOT_APPLICABLE'
  | 'DATA_BLOCKED'
  | 'DATA_CONFLICT'
  | 'DATA_VALIDATED_FORMULA_CANDIDATE_ONLY'
  | 'FORMULA_NOT_APPLICABLE_GENERIC'
  | 'FORMULA_BLOCKED_DEFINITION'
  | 'SECTOR_SPECIFIC_MAPPING_REQUIRED'
  | 'UNKNOWN_SECTOR_BLOCKED';

export interface MetricAuditRow {
  metric: FundamentalMetric;
  sourceDataStatus: MetricDataStatus | 'ABSENT';
  definitionReadiness: ReturnType<typeof getMetricDefinitionPolicy>['readiness'];
  decision: MetricAuditDecision;
  productionApproved: false;
  explanation: string;
}

export interface MetricAuditMatrix {
  sector: IssuerSector;
  metrics: Record<FundamentalMetric, MetricAuditRow>;
  productionApproved: false;
  readyForProduction: false;
  blockedCount: number;
  candidateCount: number;
}

/**
 * Combines the seven-metric data-status contract with the sector/formula
 * readiness catalog. It does not calculate values or promote any metric to
 * production. An absent metric is explicitly MISSING, never zero.
 */
export function buildMetricAuditMatrix(
  sector: IssuerSector,
  statuses: Partial<Record<FundamentalMetric, MetricDataStatus>>,
): MetricAuditMatrix {
  const names: FundamentalMetric[] = [
    'REVENUE_GROWTH', 'PROFIT_GROWTH', 'ROE', 'ROCE',
    'DEBT_EQUITY', 'INTEREST_COVERAGE', 'OPERATING_CASH_FLOW',
  ];

  const rows = {} as Record<FundamentalMetric, MetricAuditRow>;
  for (const metric of names) {
    const sourceDataStatus = statuses[metric] ?? 'ABSENT';
    const policy = getMetricDefinitionPolicy(metric, sector);
    let decision: MetricAuditDecision;
    let explanation: string;

    if (sourceDataStatus === 'ABSENT' || sourceDataStatus === 'MISSING') {
      decision = 'DATA_MISSING';
      explanation = 'No validated source value is available; preserve null and investigate the official filing.';
    } else if (sourceDataStatus === 'NOT_APPLICABLE') {
      decision = 'DATA_NOT_APPLICABLE';
      explanation = 'The source explicitly marks this metric not applicable; do not substitute zero.';
    } else if (sourceDataStatus === 'BLOCKED') {
      decision = 'DATA_BLOCKED';
      explanation = 'The metric is blocked by an unresolved data-quality or mapping gate.';
    } else if (sourceDataStatus === 'CONFLICT') {
      decision = 'DATA_CONFLICT';
      explanation = 'Conflicting source facts or filing versions require review; do not select a value automatically.';
    } else if (policy.readiness === 'NOT_APPLICABLE_GENERIC') {
      decision = 'FORMULA_NOT_APPLICABLE_GENERIC';
      explanation = 'The generic industrial formula is not applicable to this sector.';
    } else if (policy.readiness === 'BLOCKED_UNKNOWN_SECTOR') {
      decision = 'UNKNOWN_SECTOR_BLOCKED';
      explanation = 'Issuer sector is unknown; no generic formula may be inherited.';
    } else if (policy.readiness === 'REQUIRES_SECTOR_SPECIFIC_MAPPING') {
      decision = 'SECTOR_SPECIFIC_MAPPING_REQUIRED';
      explanation = 'Sector-specific taxonomy, formula and period mapping must be validated before use.';
    } else if (policy.readiness === 'BLOCKED_DEFINITION') {
      decision = 'FORMULA_BLOCKED_DEFINITION';
      explanation = 'The metric definition is unresolved; raw data status does not approve its formula.';
    } else {
      decision = 'DATA_VALIDATED_FORMULA_CANDIDATE_ONLY';
      explanation = 'Source-data checks may be complete, but the metric remains candidate-only and is not production-approved.';
    }

    rows[metric] = {
      metric, sourceDataStatus, definitionReadiness: policy.readiness,
      decision, productionApproved: false, explanation,
    };
  }

  const values = Object.values(rows);
  return {
    sector, metrics: rows, productionApproved: false, readyForProduction: false,
    blockedCount: values.filter(row => row.decision !== 'DATA_VALIDATED_FORMULA_CANDIDATE_ONLY').length,
    candidateCount: values.filter(row => row.decision === 'DATA_VALIDATED_FORMULA_CANDIDATE_ONLY').length,
  };
}
