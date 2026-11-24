export interface InterestCoverageFact {
  value:number;
  concept:string;
  periodStart:string;
  periodEnd:string;
  basis:'STANDALONE'|'CONSOLIDATED';
  currency:string;
  unit:string;
}
export interface InterestCoverageEvidence {
  periodStart:string;
  periodEnd:string;
  basis:'STANDALONE'|'CONSOLIDATED';
  currency:string;
  unit:string;
  ebit:InterestCoverageFact|null;
  ebitReconciliationStatus:'REPORTED_EBIT_CANDIDATE'|'BLOCKED';
  financeCosts:InterestCoverageFact|null;
}
export type InterestCoverageEvidenceStatus =
  | 'CANDIDATE_INPUTS_READY'
  | 'BLOCKED_EBIT_NOT_RECONCILED'
  | 'BLOCKED_FINANCE_COSTS_MISSING'
  | 'BLOCKED_FINANCE_COSTS_CONCEPT_MISMATCH'
  | 'BLOCKED_PERIOD_BASIS_OR_UNIT_MISMATCH'
  | 'BLOCKED_NONPOSITIVE_FINANCE_COSTS';
export interface InterestCoverageEvidenceResult {
  status:InterestCoverageEvidenceStatus;
  ebit:number|null;
  financeCosts:number|null;
  productionApproved:false;
  explanation:string;
}
function localName(concept:string):string {
  return concept.trim().split(':').pop()?.toLowerCase()??'';
}
function matches(fact:InterestCoverageFact,e:InterestCoverageEvidence):boolean {
  return fact.periodStart===e.periodStart && fact.periodEnd===e.periodEnd
    && fact.basis===e.basis && fact.currency===e.currency && fact.unit===e.unit
    && fact.concept.trim().length>0 && Number.isFinite(fact.value);
}
/**
 * Research-only Interest Coverage input gate. The denominator must be the
 * exact FinanceCosts concept for the same duration, basis, currency and unit.
 * EBIT must already have passed the separate reported-EBIT reconciliation
 * gate. This module does not calculate a ratio and never promotes production.
 */
export function assessInterestCoverageEvidence(e:InterestCoverageEvidence):InterestCoverageEvidenceResult {
  if(e.ebitReconciliationStatus!=='REPORTED_EBIT_CANDIDATE'||!e.ebit) return {
    status:'BLOCKED_EBIT_NOT_RECONCILED',ebit:null,financeCosts:null,
    productionApproved:false,
    explanation:'Interest Coverage is blocked until an explicitly reported EBIT fact passes the separate statement-reconciliation gate.',
  };
  if(!matches(e.ebit,e)) return {
    status:'BLOCKED_PERIOD_BASIS_OR_UNIT_MISMATCH',ebit:null,financeCosts:null,
    productionApproved:false,
    explanation:'EBIT does not match the exact filing period, basis, currency and unit envelope.',
  };
  if(!e.financeCosts) return {
    status:'BLOCKED_FINANCE_COSTS_MISSING',ebit:null,financeCosts:null,
    productionApproved:false,
    explanation:'No finance-cost fact is available for the exact filing period.',
  };
  if(localName(e.financeCosts.concept)!=='financecosts') return {
    status:'BLOCKED_FINANCE_COSTS_CONCEPT_MISMATCH',ebit:null,financeCosts:null,
    productionApproved:false,
    explanation:'Only the exact FinanceCosts taxonomy local name is accepted; interest paid, cash-flow adjustments and other aliases are not substitutes.',
  };
  if(!matches(e.financeCosts,e)) return {
    status:'BLOCKED_PERIOD_BASIS_OR_UNIT_MISMATCH',ebit:null,financeCosts:null,
    productionApproved:false,
    explanation:'FinanceCosts does not match the exact filing period, basis, currency and unit envelope.',
  };
  if(e.financeCosts.value<=0) return {
    status:'BLOCKED_NONPOSITIVE_FINANCE_COSTS',ebit:null,financeCosts:null,
    productionApproved:false,
    explanation:'Zero or negative FinanceCosts cannot produce a meaningful coverage candidate.',
  };
  return {
    status:'CANDIDATE_INPUTS_READY',ebit:e.ebit.value,financeCosts:e.financeCosts.value,
    productionApproved:false,
    explanation:'Exact-period EBIT and FinanceCosts inputs passed research evidence gates; no coverage ratio was calculated.',
  };
}
