import type { IssuerSector } from './sector_metric_policy.ts';

export type CoreAuditMetric = 'REVENUE_GROWTH' | 'PROFIT_GROWTH' | 'OPERATING_CASH_FLOW';
export type DeferredMetric = 'ROE' | 'ROCE' | 'DEBT_EQUITY' | 'INTEREST_COVERAGE';
export type IssuerAuditPlanStatus =
  | 'READY_CORE_METRICS'
  | 'BLOCKED_INCOMPLETE_METADATA'
  | 'BLOCKED_FILING_PAIR'
  | 'BLOCKED_PARSER_WARNINGS'
  | 'SECTOR_SPECIFIC_MAPPING_REQUIRED'
  | 'UNKNOWN_SECTOR_BLOCKED';

export interface IssuerAuditReadiness {
  sector: IssuerSector;
  metadataComplete: boolean;
  currentOriginalResolved: boolean;
  priorOriginalResolved: boolean;
  paginationComplete: boolean;
  currentParserWarnings: number;
  priorParserWarnings: number;
}

export interface IssuerAuditPlan {
  status: IssuerAuditPlanStatus;
  runMetrics: CoreAuditMetric[];
  deferMetrics: DeferredMetric[];
  productionApproved: false;
  reason: string;
}

/**
 * Smart triage for a multi-issuer research run. It avoids spending time
 * repeatedly attempting ratio definitions that are globally unresolved.
 * This only schedules validation work; it does not validate or calculate data.
 */
export function buildIssuerAuditPlan(input: IssuerAuditReadiness): IssuerAuditPlan {
  const blocked = (
    status: IssuerAuditPlanStatus,
    reason: string,
  ): IssuerAuditPlan => ({
    status,
    runMetrics: [],
    deferMetrics: ['ROE', 'ROCE', 'DEBT_EQUITY', 'INTEREST_COVERAGE'],
    productionApproved: false,
    reason,
  });

  if (input.sector === 'UNKNOWN') {
    return blocked('UNKNOWN_SECTOR_BLOCKED', 'Verify issuer sector before any formula or taxonomy mapping.');
  }
  if (input.sector === 'BANK' || input.sector === 'NBFC' || input.sector === 'INSURANCE') {
    return blocked('SECTOR_SPECIFIC_MAPPING_REQUIRED', 'Use a separately approved sector-specific metric model; do not inherit industrial formulas.');
  }
  if (!input.metadataComplete || !input.paginationComplete) {
    return blocked('BLOCKED_INCOMPLETE_METADATA', 'Complete issuer identity, filing metadata and all pagination before selecting filings.');
  }
  if (!input.currentOriginalResolved || !input.priorOriginalResolved) {
    return blocked('BLOCKED_FILING_PAIR', 'Resolve exact current and prior-year Original filings for the same issuer, period type and basis.');
  }
  if (!Number.isInteger(input.currentParserWarnings) || !Number.isInteger(input.priorParserWarnings)
    || input.currentParserWarnings < 0 || input.priorParserWarnings < 0
    || input.currentParserWarnings > 0 || input.priorParserWarnings > 0) {
    return blocked('BLOCKED_PARSER_WARNINGS', 'Resolve every parser warning before any metric comparison.');
  }

  return {
    status: 'READY_CORE_METRICS',
    runMetrics: ['REVENUE_GROWTH', 'PROFIT_GROWTH', 'OPERATING_CASH_FLOW'],
    deferMetrics: ['ROE', 'ROCE', 'DEBT_EQUITY', 'INTEREST_COVERAGE'],
    productionApproved: false,
    reason: 'Run only the three currently candidate-eligible non-financial metrics; still require revision, concept, period, basis and official-PDF reconciliation for each metric.',
  };
}
