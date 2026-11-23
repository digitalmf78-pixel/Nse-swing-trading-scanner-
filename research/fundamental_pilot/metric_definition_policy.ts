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
 * Research candidate definitions only. A formula here is NOT a validated
 * NSE taxonomy mapping, a calculated value, or production approval.
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
    readiness:'CANDIDATE_ONLY',
    candidateFormula:'(PAT attributable to owners for the period / average opening and closing equity attributable to owners) * 100; annualize quarter/YTD numerator by 365 / exact period days, but not FY',
    requiredFacts:['PAT attributable to owners for the exact duration','Opening equity attributable to owners at prior FY-end/period start','Closing equity attributable to owners at current period end','Same-basis equity attributable to owners, not total equity including NCI'],
    hardGates:['Map PAT and owner-equity concepts to official NSE statement rows for both dates','Opening and closing equity must use same issuer, basis and currency','Exact duration and annualization policy must be applied consistently','Reject zero/negative average equity; retain raw facts and null result','Reconcile numerator and equity values to filed statements'],
    caveats:['Quarterly annualization is an estimate, not a reported annual return','For non-FY interim periods opening equity reference date must be explicitly established','Total profit divided by total equity is not silently accepted as ROE'],
  },
  ROCE: {
    readiness:'CANDIDATE_ONLY',
    candidateFormula:'EBIT for exact duration / average opening and closing capital employed * 100; annualize quarter/YTD EBIT by 365 / exact period days, but not FY',
    requiredFacts:['EBIT from an explicitly mapped statement row or reconciled PBT plus finance costs','Opening capital employed','Closing capital employed','Documented treatment of lease liabilities, cash and investments'],
    hardGates:['Resolve EBIT definition including associate/JV presentation and exceptional items','Define capital employed perimeter consistently (equity plus interest-bearing debt, with documented lease policy)','Opening and closing balances must be same-basis and same-currency','Exact duration and annualization policy must be applied consistently','Reject zero/negative average capital employed and reconcile to statements'],
    caveats:['PBT plus finance costs is only a candidate EBIT bridge after both rows and associate/JV treatment are reconciled','Different lease and excess-cash policies materially change ROCE'],
  },
  DEBT_EQUITY: {
    readiness:'CANDIDATE_ONLY',
    candidateFormula:'(current and non-current interest-bearing borrowings) / total equity at the same balance-sheet date; lease liabilities reported separately until an explicit policy is approved',
    requiredFacts:['Current borrowings','Non-current borrowings','Total equity on the same basis and instant date','Lease liabilities separately identified where present'],
    hardGates:['Map current/non-current borrowings to official balance-sheet rows; do not include trade payables','Do not silently include or exclude lease liabilities: report lease treatment and keep it outside candidate debt until policy is approved','Match balance-sheet instant date, issuer, basis and currency','Never replace missing debt or equity with zero','Reject zero/negative equity; reconcile totals to filed balance sheet'],
    caveats:['This narrow candidate definition excludes lease liabilities pending explicit accounting policy','For some sectors this generic ratio is not applicable or needs a sector-specific definition'],
  },
  INTEREST_COVERAGE: {
    readiness:'CANDIDATE_ONLY',
    candidateFormula:'EBIT for exact duration / finance costs for the same exact duration',
    requiredFacts:['EBIT from an explicitly mapped statement row or reconciled PBT plus finance costs','FinanceCosts for the identical duration','Same filing basis and currency'],
    hardGates:['Resolve EBIT/PBT concept and associate/JV treatment','Finance costs must be positive and from the same duration and basis','No mixing annual, TTM, quarter or YTD inputs','Reconcile both numerator and denominator to official statement rows'],
    caveats:['PBT plus finance costs is only a candidate EBIT bridge after reconciliation','A zero or negative finance-cost denominator is not converted to an infinite or zero ratio'],
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
