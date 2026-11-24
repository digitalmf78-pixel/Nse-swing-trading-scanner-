import type { IssuerSector } from './sector_metric_policy.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

export type RatioMetric = 'ROE'|'ROCE'|'DEBT_EQUITY'|'INTEREST_COVERAGE';
export type RatioFactRole =
  | 'PROFIT_NUMERATOR'
  | 'OWNER_EQUITY'
  | 'PBT'
  | 'REPORTED_EBIT'
  | 'FINANCE_COSTS'
  | 'CURRENT_BORROWINGS'
  | 'NONCURRENT_BORROWINGS'
  | 'TOTAL_EQUITY';

export type RatioFactMapStatus = 'CANDIDATE_FACT_MAP'|'BLOCKED_MISSING_CONCEPT'|'BLOCKED_AMBIGUOUS_CONCEPT'|'BLOCKED_SECTOR';
export interface RatioFactMap {
  metric: RatioMetric;
  status: RatioFactMapStatus;
  concepts: Partial<Record<RatioFactRole,string>>;
  missingRoles: RatioFactRole[];
  ambiguousRoles: RatioFactRole[];
  productionApproved: false;
  explanation: string;
}

// Exact local names observed in official NSE Integrated Filing Ind AS instances.
// Reported EBIT deliberately has no QName mapping until an issuer-level EBIT
// concept is proven against official statements and reconciled. Never infer it
// from PBT + FinanceCosts.
const ROLE_NAMES: Record<RatioFactRole,string[]> = {
  PROFIT_NUMERATOR: ['ProfitOrLossAttributableToOwnersOfParent','ProfitLossForPeriod'],
  OWNER_EQUITY: ['EquityAttributableToOwnersOfParent'],
  PBT: ['ProfitBeforeTax'],
  REPORTED_EBIT: [],
  FINANCE_COSTS: ['FinanceCosts'],
  CURRENT_BORROWINGS: ['BorrowingsCurrent'],
  NONCURRENT_BORROWINGS: ['BorrowingsNoncurrent'],
  TOTAL_EQUITY: ['Equity'],
};

const REQUIRED: Record<RatioMetric,RatioFactRole[]> = {
  ROE: ['PROFIT_NUMERATOR','OWNER_EQUITY'],
  // ROCE capital employed includes total equity plus interest-bearing debt.
  // Consolidated total equity includes non-controlling interests; owner equity
  // is not an interchangeable substitute.
  ROCE: ['PBT','FINANCE_COSTS','TOTAL_EQUITY','CURRENT_BORROWINGS','NONCURRENT_BORROWINGS'],
  DEBT_EQUITY: ['CURRENT_BORROWINGS','NONCURRENT_BORROWINGS','TOTAL_EQUITY'],
  // PBT is not an EBIT substitute. Keep the mapping blocked until an exact,
  // statement-reconciled reported EBIT concept is established.
  INTEREST_COVERAGE: ['REPORTED_EBIT','FINANCE_COSTS'],
};

function localName(qname:string):string {
  return qname.trim().split(':').pop()?.toLowerCase() ?? '';
}

/**
 * Research-only role mapper for observed Ind AS concepts. This returns
 * candidate input QNames, not selected facts or calculated ratios. Statement
 * row tie-out, exact periods, opening/closing balances, lease policy, EBIT
 * bridge and revision checks remain mandatory downstream gates.
 */
export function resolveNseRatioFactMap(
  metric:RatioMetric,
  sector:IssuerSector,
  basis:'STANDALONE'|'CONSOLIDATED',
  extraction:XbrlExtraction,
):RatioFactMap {
  if(sector!=='NON_FINANCIAL') return {
    metric,status:'BLOCKED_SECTOR',concepts:{},missingRoles:[],ambiguousRoles:[],
    productionApproved:false,
    explanation:'Generic industrial ratio fact mapping is disabled for banks, NBFCs, insurers and unknown sectors.',
  };
  const concepts:Partial<Record<RatioFactRole,string>>={};
  const missingRoles:RatioFactRole[]=[];
  const ambiguousRoles:RatioFactRole[]=[];
  for(const role of REQUIRED[metric]) {
    let wanted=ROLE_NAMES[role];
    if(role==='PROFIT_NUMERATOR') wanted=[basis==='CONSOLIDATED'?'ProfitOrLossAttributableToOwnersOfParent':'ProfitLossForPeriod'];
    // Total equity is an exact separate statement row for both bases. In a
    // consolidated filing it includes NCI; owner-attributable equity is not
    // accepted as a fallback for ROCE or debt/equity.
    const found=[...new Set(extraction.facts.map(f=>f.concept.trim()).filter(q=>wanted.some(n=>localName(q)===n.toLowerCase())))].sort();
    if(found.length===0) missingRoles.push(role);
    else if(found.length>1) ambiguousRoles.push(role);
    else concepts[role]=found[0];
  }
  const status:RatioFactMapStatus=ambiguousRoles.length?'BLOCKED_AMBIGUOUS_CONCEPT':missingRoles.length?'BLOCKED_MISSING_CONCEPT':'CANDIDATE_FACT_MAP';
  const interestCoverageBlocked=metric==='INTEREST_COVERAGE'&&missingRoles.includes('REPORTED_EBIT');
  return {
    metric,status,concepts,missingRoles,ambiguousRoles,productionApproved:false,
    explanation:interestCoverageBlocked
      ? 'Interest Coverage is blocked: no verified issuer-level reported EBIT QName is mapped. PBT plus FinanceCosts is not accepted as EBIT; an exact reported EBIT fact must first pass the separate official-statement reconciliation gate.'
      : status==='CANDIDATE_FACT_MAP'
        ? 'Observed exact NSE Ind AS concept QNames mapped to candidate input roles. No facts were selected and no ratio was calculated; statement reconciliation, exact context selection and formula policy remain mandatory.'
        : 'One or more required exact concept roles are missing or ambiguous. No alias or partial ratio input map is accepted.',
  };
}
