import type { IssuerSector } from './sector_metric_policy.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

export type RatioMetric = 'ROE'|'ROCE'|'DEBT_EQUITY'|'INTEREST_COVERAGE';
export type RatioFactRole =
  | 'PROFIT_NUMERATOR'
  | 'OWNER_EQUITY'
  | 'PBT'
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

// These local names were observed in official NSE Integrated Filing Ind AS
// instances (KSHINTL standalone and ITC consolidated, 23-Nov-2026 audit).
// The mapper never fabricates namespace prefixes or accepts fuzzy aliases.
const ROLE_NAMES: Record<RatioFactRole,string[]> = {
  PROFIT_NUMERATOR: ['ProfitOrLossAttributableToOwnersOfParent','ProfitLossForPeriod'],
  OWNER_EQUITY: ['EquityAttributableToOwnersOfParent'],
  PBT: ['ProfitBeforeTax'],
  FINANCE_COSTS: ['FinanceCosts'],
  CURRENT_BORROWINGS: ['BorrowingsCurrent'],
  NONCURRENT_BORROWINGS: ['BorrowingsNoncurrent'],
  TOTAL_EQUITY: ['Equity','EquityAttributableToOwnersOfParent'],
};

const REQUIRED: Record<RatioMetric,RatioFactRole[]> = {
  ROE: ['PROFIT_NUMERATOR','OWNER_EQUITY'],
  ROCE: ['PBT','FINANCE_COSTS','OWNER_EQUITY','CURRENT_BORROWINGS','NONCURRENT_BORROWINGS'],
  DEBT_EQUITY: ['CURRENT_BORROWINGS','NONCURRENT_BORROWINGS','TOTAL_EQUITY'],
  INTEREST_COVERAGE: ['PBT','FINANCE_COSTS'],
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
    // Consolidated total equity must include non-controlling interests. Owner-attributable
    // equity is a distinct statement row and must never substitute for total equity.
    if(role==='TOTAL_EQUITY') wanted=basis==='CONSOLIDATED'
      ? ['Equity']
      : ['Equity','EquityAttributableToOwnersOfParent'];
    const found=[...new Set(extraction.facts.map(f=>f.concept.trim()).filter(q=>wanted.some(n=>localName(q)===n.toLowerCase())))].sort();
    if(found.length===0) missingRoles.push(role);
    else if(found.length>1) ambiguousRoles.push(role);
    else concepts[role]=found[0];
  }
  const status:RatioFactMapStatus=ambiguousRoles.length?'BLOCKED_AMBIGUOUS_CONCEPT':missingRoles.length?'BLOCKED_MISSING_CONCEPT':'CANDIDATE_FACT_MAP';
  return {
    metric,status,concepts,missingRoles,ambiguousRoles,productionApproved:false,
    explanation:status==='CANDIDATE_FACT_MAP'
      ? 'Observed exact NSE Ind AS concept QNames mapped to candidate input roles. No facts were selected and no ratio was calculated; statement reconciliation, exact context selection and formula policy remain mandatory.'
      : 'One or more required exact concept roles are missing or ambiguous. No alias or partial ratio input map is accepted.',
  };
}
