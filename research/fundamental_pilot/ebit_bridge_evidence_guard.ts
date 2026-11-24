export interface EbitBridgeFact {
  value: number;
  concept: string;
  periodStart: string;
  periodEnd: string;
  basis: 'STANDALONE'|'CONSOLIDATED';
  currency: string;
  unit: string;
}

export interface EbitBridgeEvidence {
  basis: 'STANDALONE'|'CONSOLIDATED';
  periodStart: string;
  periodEnd: string;
  currency: string;
  unit: string;
  reportedEbit: EbitBridgeFact|null;
  pbt: EbitBridgeFact|null;
  financeCosts: EbitBridgeFact|null;
  statementRowReconciled: boolean;
}

export type EbitBridgeStatus =
  | 'REPORTED_EBIT_CANDIDATE'
  | 'BLOCKED_REPORTED_EBIT_NOT_RECONCILED'
  | 'BLOCKED_EBIT_NOT_REPORTED'
  | 'BLOCKED_PBT_PLUS_FINANCE_COSTS_INSUFFICIENT'
  | 'BLOCKED_PERIOD_BASIS_OR_UNIT_MISMATCH';

export interface EbitBridgeResult {
  status: EbitBridgeStatus;
  ebit: number|null;
  sourceConcept: string|null;
  productionApproved: false;
  explanation: string;
}

function matchesEnvelope(fact:EbitBridgeFact, evidence:EbitBridgeEvidence):boolean {
  return fact.periodStart===evidence.periodStart
    && fact.periodEnd===evidence.periodEnd
    && fact.basis===evidence.basis
    && fact.currency===evidence.currency
    && fact.unit===evidence.unit
    && fact.concept.trim().length>0
    && Number.isFinite(fact.value);
}

/**
 * Research-only EBIT evidence gate. It deliberately does not derive EBIT
 * from PBT + finance costs: exceptional items, associate/JV presentation,
 * discontinued operations and other statement adjustments can make that
 * shortcut materially wrong. Only an explicitly reported, exact-envelope
 * EBIT row that has been reconciled to the official statement is returned
 * as a candidate. No ratio is calculated and production approval is false.
 */
export function assessEbitBridgeEvidence(evidence:EbitBridgeEvidence):EbitBridgeResult {
  const reported=evidence.reportedEbit;
  if(reported) {
    if(!matchesEnvelope(reported,evidence)) return {
      status:'BLOCKED_PERIOD_BASIS_OR_UNIT_MISMATCH',ebit:null,sourceConcept:null,
      productionApproved:false,
      explanation:'Reported EBIT does not match the exact filing period, basis, currency and unit envelope.',
    };
    if(!evidence.statementRowReconciled) return {
      status:'BLOCKED_REPORTED_EBIT_NOT_RECONCILED',ebit:null,sourceConcept:null,
      productionApproved:false,
      explanation:'An EBIT-like fact exists, but it has not been reconciled to the official statement row and related profit components.',
    };
    return {
      status:'REPORTED_EBIT_CANDIDATE',ebit:reported.value,sourceConcept:reported.concept,
      productionApproved:false,
      explanation:'Exact-period reported EBIT is reconciled as a research candidate only; ROCE and interest coverage remain non-production.',
    };
  }
  if(evidence.pbt && evidence.financeCosts) {
    const pbtMatches=matchesEnvelope(evidence.pbt,evidence);
    const financeMatches=matchesEnvelope(evidence.financeCosts,evidence);
    return {
      status:pbtMatches&&financeMatches
        ? 'BLOCKED_PBT_PLUS_FINANCE_COSTS_INSUFFICIENT'
        : 'BLOCKED_PERIOD_BASIS_OR_UNIT_MISMATCH',
      ebit:null,sourceConcept:null,productionApproved:false,
      explanation:pbtMatches&&financeMatches
        ? 'PBT plus finance costs is not accepted as EBIT without an explicit, reconciled bridge for exceptional items, associate/JV results, discontinued operations and other relevant statement adjustments.'
        : 'PBT and finance-cost facts do not share the exact filing period, basis, currency and unit envelope.',
    };
  }
  return {
    status:'BLOCKED_EBIT_NOT_REPORTED',ebit:null,sourceConcept:null,
    productionApproved:false,
    explanation:'No explicitly reported and reconciled EBIT row is available; no proxy or inferred EBIT is produced.',
  };
}
