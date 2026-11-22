import { isEligibleGroupContext, type ContextExpectation, type ContextShape } from './sector_metric_policy.ts';

export interface CandidateRawFact {
  concept: string;
  contextRef: string | null;
  unitRef: string | null;
  rawValue: string | null;
  numericValue: number | null;
  isNil: boolean;
}

export type GroupFactSelectionStatus = 'SELECTED_UNIQUE_GROUP_FACT' | 'NO_ELIGIBLE_GROUP_FACT' | 'AMBIGUOUS_GROUP_FACTS';

export interface GroupFactSelection {
  status: GroupFactSelectionStatus;
  selected: CandidateRawFact | null;
  eligibleCount: number;
  rejectedDimensionalOrPeriodCount: number;
}

/**
 * Research-only fact selector. It only selects a unique undimensioned fact
 * after exact context/basis checks. It does not decide whether the concept
 * is economically suitable for a metric.
 */
export function selectUniqueGroupFact(
  candidates: CandidateRawFact[],
  contexts: Record<string, ContextShape>,
  expected: ContextExpectation,
): GroupFactSelection {
  const eligible: CandidateRawFact[] = [];
  let rejected = 0;
  for (const fact of candidates) {
    const context = fact.contextRef ? contexts[fact.contextRef] : undefined;
    if (!context || !isEligibleGroupContext(context, expected)) {
      rejected += 1;
      continue;
    }
    eligible.push(fact);
  }
  if (eligible.length === 0) {
    return {
      status: 'NO_ELIGIBLE_GROUP_FACT',
      selected: null,
      eligibleCount: 0,
      rejectedDimensionalOrPeriodCount: rejected,
    };
  }
  if (eligible.length !== 1) {
    return {
      status: 'AMBIGUOUS_GROUP_FACTS',
      selected: null,
      eligibleCount: eligible.length,
      rejectedDimensionalOrPeriodCount: rejected,
    };
  }
  return {
    status: 'SELECTED_UNIQUE_GROUP_FACT',
    selected: eligible[0],
    eligibleCount: 1,
    rejectedDimensionalOrPeriodCount: rejected,
  };
}
