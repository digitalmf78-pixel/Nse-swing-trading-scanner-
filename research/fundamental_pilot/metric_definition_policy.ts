import type { IssuerSector } from './sector_metric_policy.ts';

export type FundamentalMetric =
  | 'REVENUE_GROWTH'
  | 'PROFIT_GROWTH'
  | 'ROE'
  | 'ROCE'
  | 'DEBT_EQUITY'
  | 'INTEREST_COVERAGE'
  | 'OPERATING_CASH_FLOW';

export type DefinitionReadiness =
  | 'CANDIDATE_ONLY'
  | 'BLOCKED_DEFINITION'
  | 'NOT_APPLICABLE_GENERIC'
  | 'REQUIRES_SECTOR_SPECIFIC_MAPPING'
  | 'BLOCKED_UNKNOWN_SECTOR';

export interface MetricDefinitionPolicy {
  metric: FundamentalMetric;
  sector: IssuerSector;
  readiness: DefinitionReadiness;
  candidateFormula: string | null;
  requiredFacts: string[];
  hardGates: string[];
  caveats: string[];
}

/**
 * This catalog makes unresolved accounting definitions explicit.
 * It is not a formula approval or production calculator.
 */
const INDUSTRIAL: Record<FundamentalMetric,Omit<MetricDefinitionPolicy,'metric'|'sector'>> = {
  REVENUE_GROWTH: {
    readiness:'CANDIDATE_ONLY',
    candidateFormula:'(current same-period RevenueFromOperations / prior-year same-period RevenueFromOperations - 1) * 100',
    requiredFacts:['RevenueFromOperations current','RevenueFromOperations prior year','same XBRL unit','same filing basis','undimensioned group context'],
    hardGates:['Exact quarter/YTD/FY calendar alignment','Original/revision history resolved','Official statement-row reconciliation','Prior-period base > 0'],
    caveats:['Mechanical growth is not organic growth','Acquisitions, disposals, excise/GST and accounting changes can impair comparability'],
  },
  PROFIT_GROWTH: {
    readiness:'CANDIDATE_ONLY',
    candidateFormula:'(current same-period profit attributable to owners of parent / prior-year same-period profit attributable to owners of parent - 1) * 100 for consolidated; standalone entity ProfitLossForPeriod for standalone',
    requiredFacts:['Consolidated: ProfitOrLossAttributableToOwnersOfParent current and prior year','Standalone: ProfitLossForPeriod current and prior year','same XBRL unit','same filing basis','undimensioned group/entity context'],
    hardGates:['Exact quarter/YTD/FY calendar alignment','Consolidated numerator must be allocated to owners of parent; reject unallocated total group profit','Standalone numerator must be entity profit for period','Official statement-row and attribution reconciliation','Prior-period base > 0'],
    caveats:['Do not substitute PBT for PAT','Do not mix continuing operations and total profit','Non-controlling interest can materially change total group profit versus owners PAT; retain both raw facts but use the declared attribution policy'],
  },
  ROE: {
    readiness:'BLOCKED_DEFINITION',
    candidateFormula:null,
    requiredFacts:['Profit attributable to owners for the matching period','Opening equity attributable to owners','Closing equity attributable to owners'],
    hardGates:['Select owner-attributable numerator and equity definition','Average opening/closing equity on same basis','Define annualization for quarter/YTD','Same issuer, basis, currency and aligned period'],
    caveats:['Total profit divided by total equity is not silently accepted as ROE'],
  },
  ROCE: {
    readiness:'BLOCKED_DEFINITION',
    candidateFormula:null,
    requiredFacts:['EBIT with explicit statement-row or reconciled formula','Opening capital employed','Closing capital employed'],
    hardGates:['Resolve EBIT definition including associate/JV presentation','Define capital employed and lease/debt treatment','Average capital employed','Same duration and filing basis'],
    caveats:['Do not infer EBIT as PBT plus finance costs until PBT concept is reconciled'],
  },
  DEBT_EQUITY: {
    readiness:'BLOCKED_DEFINITION',
    candidateFormula:null,
    requiredFacts:['Interest-bearing borrowings','Lease liabilities policy','Total equity on the same basis'],
    hardGates:['Define debt perimeter (current/non-current borrowings and leases)','Exclude trade payables unless explicitly justified','Match balance-sheet instant date and basis','Never replace missing debt with zero'],
    caveats:['Debt classification and equity attribution differ across sectors'],
  },
  INTEREST_COVERAGE: {
    readiness:'BLOCKED_DEFINITION',
    candidateFormula:null,
    requiredFacts:['EBIT for exact duration','FinanceCosts for exact duration'],
    hardGates:['Resolve EBIT/PBT concept and associate/JV treatment','Same duration, basis and currency','No mixing annual, TTM, quarter or YTD inputs'],
    caveats:['Finance costs alone do not validate the EBIT numerator'],
  },
  OPERATING_CASH_FLOW: {
    readiness:'CANDIDATE_ONLY',
    candidateFormula:'CashFlowsFromUsedInOperatingActivities for the exact period from the cash flow statement',
    requiredFacts:['CashFlowsFromUsedInOperatingActivities','cash-flow statement context','same period and filing basis'],
    hardGates:['Do not substitute profit, FCF or net cash movement','Do not infer quarterly OCF from YTD without both exact aligned YTD facts','Preserve negative/zero values'],
    caveats:['OCF is an absolute cash-flow value, not a growth percentage by default'],
  },
};

const BANK_NOT_APPLICABLE = new Set<FundamentalMetric>(['ROCE','DEBT_EQUITY','INTEREST_COVERAGE']);

export function getMetricDefinitionPolicy(metric:FundamentalMetric,sector:IssuerSector):MetricDefinitionPolicy {
  if(sector==='UNKNOWN') return {
    metric,sector,readiness:'BLOCKED_UNKNOWN_SECTOR',candidateFormula:null,requiredFacts:[],
    hardGates:['Verify issuer sector before applying any formula'],
    caveats:['Unknown-sector issuers must not inherit industrial formulas'],
  };
  if(sector==='BANK') {
    if(BANK_NOT_APPLICABLE.has(metric)) return {
      metric,sector,readiness:'NOT_APPLICABLE_GENERIC',candidateFormula:null,requiredFacts:[],
      hardGates:['Do not apply industrial generic formula'],
      caveats:['A separate bank-specific financial model may define a different metric'],
    };
    return {
      metric,sector,readiness:'REQUIRES_SECTOR_SPECIFIC_MAPPING',candidateFormula:null,requiredFacts:[],
      hardGates:['Bank-specific taxonomy mapping and period definitions required'],
      caveats:['Do not reuse industrial thresholds or formulas'],
    };
  }
  if(sector==='NBFC'||sector==='INSURANCE') return {
    metric,sector,readiness:'REQUIRES_SECTOR_SPECIFIC_MAPPING',candidateFormula:null,requiredFacts:[],
    hardGates:[`${sector} specific definitions, taxonomy concepts and accounting treatment required`],
    caveats:['Generic industrial formulas are blocked'],
  };
  return {metric,sector, ...INDUSTRIAL[metric]};
}
