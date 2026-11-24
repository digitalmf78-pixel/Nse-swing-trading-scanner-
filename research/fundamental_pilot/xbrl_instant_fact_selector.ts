import { selectUniqueGroupFact } from './group_fact_selection.ts';
import type { ContextExpectation } from './sector_metric_policy.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

export type XbrlInstantFactSelectionStatus =
  | 'SELECTED_UNIQUE_GROUP_FACT'
  | 'MISSING_CONCEPT'
  | 'NO_ELIGIBLE_GROUP_FACT'
  | 'AMBIGUOUS_GROUP_FACTS'
  | 'BLOCKED_BASIS_MISMATCH'
  | 'BLOCKED_MISSING_UNIT'
  | 'BLOCKED_NON_CURRENCY_UNIT'
  | 'BLOCKED_NON_NUMERIC_FACT';

export interface XbrlInstantFactSelection {
  status: XbrlInstantFactSelectionStatus;
  fact: { concept: string; numericValue: number; rawValue: string; unitMeasures: string[]; instantDate: string; basis: 'STANDALONE'|'CONSOLIDATED' } | null;
  eligibleCount: number;
  rejectedContextCount: number;
  explanation: string;
}

/**
 * Selects one exact-date, undimensioned balance-sheet fact. This is a
 * context/unit gate only: it does not approve the accounting meaning of a
 * concept or a ratio formula.
 */
export function selectXbrlInstantFact(
  extraction: XbrlExtraction,
  request: { concept: string; instantDate: string; basis: 'STANDALONE'|'CONSOLIDATED'; filingBasis: 'STANDALONE'|'CONSOLIDATED'|null },
): XbrlInstantFactSelection {
  if (!request.concept.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(request.instantDate)) {
    throw new Error('Exact concept and instant date are required');
  }
  const parsedInstantDate = new Date(request.instantDate + 'T00:00:00Z');
  if (Number.isNaN(parsedInstantDate.getTime()) || parsedInstantDate.toISOString().slice(0, 10) !== request.instantDate) {
    throw new Error('Instant date is invalid');
  }
  if (request.filingBasis !== request.basis) {
    return { status:'BLOCKED_BASIS_MISMATCH',fact:null,eligibleCount:0,rejectedContextCount:0,
      explanation:'Filing-level standalone/consolidated basis must be explicit and match the requested instant fact basis.' };
  }
  const candidates=extraction.facts.filter(fact=>fact.concept===request.concept).map(fact=>({
    concept:fact.concept,contextRef:fact.contextRef,unitRef:fact.unitRef,
    rawValue:fact.rawValue,numericValue:fact.numericValue,isNil:fact.isNil,
  }));
  if(candidates.length===0) return {
    status:'MISSING_CONCEPT',fact:null,eligibleCount:0,rejectedContextCount:0,
    explanation:'The exact requested XBRL concept is not present in this filing.',
  };
  const expected:ContextExpectation={
    periodStart:'',periodEnd:request.instantDate,periodKind:'INSTANT',
    basis:request.basis,filingBasis:request.filingBasis,
  };
  const selected=selectUniqueGroupFact(candidates,extraction.contexts,expected);
  if(selected.status==='NO_ELIGIBLE_GROUP_FACT') return {
    status:'NO_ELIGIBLE_GROUP_FACT',fact:null,eligibleCount:0,
    rejectedContextCount:selected.rejectedDimensionalOrPeriodCount,
    explanation:'No exact-date, undimensioned instant context matched the requested filing basis.',
  };
  if(selected.status==='AMBIGUOUS_GROUP_FACTS') return {
    status:'AMBIGUOUS_GROUP_FACTS',fact:null,eligibleCount:selected.eligibleCount,
    rejectedContextCount:selected.rejectedDimensionalOrPeriodCount,
    explanation:'More than one fact matches the same concept, instant date and group context; no fact was selected.',
  };
  const raw=selected.selected!;
  const measures=raw.unitRef ? extraction.units[raw.unitRef] : undefined;
  if(!raw.unitRef || !measures?.length) return {
    status:'BLOCKED_MISSING_UNIT',fact:null,eligibleCount:1,
    rejectedContextCount:selected.rejectedDimensionalOrPeriodCount,
    explanation:'Selected instant fact has no resolvable XBRL unit; numeric value withheld.',
  };
  if(measures.length!==1 || !/^iso4217:[A-Z]{3}$/.test(measures[0])) return {
    status:'BLOCKED_NON_CURRENCY_UNIT',fact:null,eligibleCount:1,
    rejectedContextCount:selected.rejectedDimensionalOrPeriodCount,
    explanation:'This balance-sheet amount requires one explicit ISO 4217 currency unit.',
  };
  if(raw.isNil || raw.rawValue===null || raw.numericValue===null || !Number.isFinite(raw.numericValue)) return {
    status:'BLOCKED_NON_NUMERIC_FACT',fact:null,eligibleCount:1,
    rejectedContextCount:selected.rejectedDimensionalOrPeriodCount,
    explanation:'Selected fact is nil, missing or non-numeric; it must not be converted to zero.',
  };
  return {
    status:'SELECTED_UNIQUE_GROUP_FACT',
    fact:{concept:raw.concept,numericValue:raw.numericValue,rawValue:raw.rawValue,unitMeasures:[...measures],instantDate:request.instantDate,basis:request.basis},
    eligibleCount:1,rejectedContextCount:selected.rejectedDimensionalOrPeriodCount,
    explanation:'One exact-date, undimensioned instant fact with explicit currency unit selected. Accounting concept suitability remains a separate gate.',
  };
}


export interface XbrlInstantFactBundleSelection {
  status: 'SELECTED_ALL_FACTS'|'BLOCKED_FACT_SELECTION'|'BLOCKED_MIXED_CURRENCY';
  facts: Record<string, NonNullable<XbrlInstantFactSelection['fact']>> | null;
  failedConcepts: string[];
  currency: string | null;
  explanation: string;
}

/**
 * Selects an explicitly supplied set of instant facts for research calculations.
 * Every concept must independently pass the exact-date/group/basis/unit gates,
 * and all amounts must share one currency. It never guesses concepts or sums
 * balance-sheet rows; accounting meaning and formula policy remain separate.
 */
export function selectXbrlInstantFactBundle(
  extraction: XbrlExtraction,
  request: { concepts: Record<string,string>; instantDate: string; basis:'STANDALONE'|'CONSOLIDATED'; filingBasis:'STANDALONE'|'CONSOLIDATED'|null },
): XbrlInstantFactBundleSelection {
  const entries=Object.entries(request.concepts);
  if(entries.length===0 || entries.some(([key,concept])=>!key.trim() || !concept.trim())) {
    throw new Error('At least one named metric input and exact XBRL concept are required');
  }
  const selected:Record<string,NonNullable<XbrlInstantFactSelection['fact']>>={};
  const failed:string[]=[];
  let currency:string|null=null;
  for(const [key,concept] of entries) {
    const result=selectXbrlInstantFact(extraction,{
      concept,instantDate:request.instantDate,basis:request.basis,filingBasis:request.filingBasis,
    });
    if(result.status!=='SELECTED_UNIQUE_GROUP_FACT' || !result.fact) {
      failed.push(key+' ('+concept+'): '+result.status);
      continue;
    }
    const factCurrency=result.fact.unitMeasures[0];
    if(currency!==null && currency!==factCurrency) {
      return {status:'BLOCKED_MIXED_CURRENCY',facts:null,failedConcepts:[key],currency:null,
        explanation:'Selected instant facts use different ISO 4217 currencies; no bundle was returned.'};
    }
    currency=factCurrency;
    selected[key]=result.fact;
  }
  if(failed.length>0) return {
    status:'BLOCKED_FACT_SELECTION',facts:null,failedConcepts:failed,currency:null,
    explanation:'One or more required exact concepts did not pass unique group-context, period, basis, numeric and unit checks. Partial bundles are withheld.',
  };
  return {
    status:'SELECTED_ALL_FACTS',facts:selected,failedConcepts:[],currency,
    explanation:'All requested instant facts passed exact-date, undimensioned group, basis, numeric and common-currency checks. This does not approve any accounting formula.',
  };
}
