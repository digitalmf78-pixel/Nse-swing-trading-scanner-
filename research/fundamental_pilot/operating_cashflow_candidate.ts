import { calculateGrowthCandidate, type ComparableMetricFact } from './metric_growth_candidate.ts';

export type CashFlowDirection = 'POSITIVE' | 'NEGATIVE' | 'ZERO';
export type OcfCandidateStatus =
  | 'CANDIDATE_ONLY'
  | 'BLOCKED_MISSING_VALUE'
  | 'BLOCKED_CONCEPT_MISMATCH'
  | 'BLOCKED_UNIT_MISMATCH'
  | 'BLOCKED_DIMENSIONAL_FACT'
  | 'BLOCKED_BASIS_MISMATCH'
  | 'BLOCKED_PERIOD_TYPE_MISMATCH'
  | 'BLOCKED_PERIOD_ALIGNMENT';

export interface OcfCandidateResult {
  status: OcfCandidateStatus;
  currentValue: number | null;
  priorValue: number | null;
  absoluteChange: number | null;
  percentageChange: number | null;
  currentDirection: CashFlowDirection | null;
  priorDirection: CashFlowDirection | null;
  productionApproved: false;
  explanation: string;
}

const direction=(value:number):CashFlowDirection=>value>0?'POSITIVE':value<0?'NEGATIVE':'ZERO';

/**
 * Same-period OCF comparison. It never infers quarterly cash flow by subtracting
 * YTD values. A percentage is withheld if the prior-year OCF base is <= 0.
 */
export function calculateOcfCandidate(
  current: ComparableMetricFact,
  prior: ComparableMetricFact,
): OcfCandidateResult {
  const gate=calculateGrowthCandidate('REVENUE_GROWTH',current,prior);
  const allowed=new Set(['CANDIDATE_ONLY','BLOCKED_MISSING_VALUE','BLOCKED_UNIT_MISMATCH','BLOCKED_DIMENSIONAL_FACT','BLOCKED_BASIS_MISMATCH','BLOCKED_PERIOD_TYPE_MISMATCH','BLOCKED_PERIOD_ALIGNMENT','BLOCKED_NON_POSITIVE_PRIOR_BASE']);
  if (current.concept!=='in-capmkt:CashFlowsFromUsedInOperatingActivities' || prior.concept!=='in-capmkt:CashFlowsFromUsedInOperatingActivities') {
    return {status:'BLOCKED_CONCEPT_MISMATCH',currentValue:null,priorValue:null,absoluteChange:null,percentageChange:null,currentDirection:null,priorDirection:null,productionApproved:false,explanation:'OCF must come from CashFlowsFromUsedInOperatingActivities in the cash flow statement'};
  }
  if (!allowed.has(gate.status)) {
    return {status:'BLOCKED_CONCEPT_MISMATCH',currentValue:null,priorValue:null,absoluteChange:null,percentageChange:null,currentDirection:null,priorDirection:null,productionApproved:false,explanation:'OCF candidate period/unit/context gate failed'};
  }
  if (gate.status!=='CANDIDATE_ONLY' && gate.status!=='BLOCKED_NON_POSITIVE_PRIOR_BASE') {
    return {status:gate.status as OcfCandidateStatus,currentValue:null,priorValue:null,absoluteChange:null,percentageChange:null,currentDirection:null,priorDirection:null,productionApproved:false,explanation:gate.explanation};
  }
  const currentValue=current.numericValue as number;
  const priorValue=prior.numericValue as number;
  return {
    status:'CANDIDATE_ONLY',
    currentValue,
    priorValue,
    absoluteChange:Number((currentValue-priorValue).toFixed(2)),
    percentageChange:priorValue>0?Number(((currentValue/priorValue-1)*100).toFixed(2)):null,
    currentDirection:direction(currentValue),
    priorDirection:direction(priorValue),
    productionApproved:false,
    explanation:priorValue<=0
      ? 'Same-period OCF values compared; percentage change withheld because prior-year OCF is zero or negative. No quarter was inferred from YTD.'
      : 'Same-period OCF values compared mechanically. No quarter was inferred from YTD; not production approval.',
  };
}
