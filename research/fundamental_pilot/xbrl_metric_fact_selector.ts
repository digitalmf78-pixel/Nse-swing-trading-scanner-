import { selectUniqueGroupFact } from './group_fact_selection.ts';
import type { ContextExpectation } from './sector_metric_policy.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';
import type { ComparableMetricFact, ComparablePeriodType } from './metric_growth_candidate.ts';

export type XbrlMetricFactSelectionStatus =
  | 'SELECTED_UNIQUE_GROUP_FACT'
  | 'MISSING_CONCEPT'
  | 'NO_ELIGIBLE_GROUP_FACT'
  | 'AMBIGUOUS_GROUP_FACTS'
  | 'BLOCKED_BASIS_MISMATCH'
  | 'BLOCKED_MISSING_UNIT'
  | 'BLOCKED_NON_CURRENCY_UNIT'
  | 'BLOCKED_NON_NUMERIC_FACT';

export interface XbrlMetricFactSelection {
  status: XbrlMetricFactSelectionStatus;
  fact: ComparableMetricFact | null;
  eligibleCount: number;
  rejectedContextCount: number;
  explanation: string;
}

export interface XbrlMetricFactRequest {
  concept: string;
  periodStart: string;
  periodEnd: string;
  periodType: ComparablePeriodType;
  basis: 'STANDALONE' | 'CONSOLIDATED';
  filingBasis: 'STANDALONE' | 'CONSOLIDATED' | null;
}

/**
 * Selects exactly one undimensioned duration fact from a parsed XBRL filing.
 * It requires an explicit filing-level basis and exact period dates, and
 * rejects missing/non-currency units, nil values and ambiguous duplicate facts.
 */
export function selectXbrlMetricFact(
  extraction: XbrlExtraction,
  request: XbrlMetricFactRequest,
): XbrlMetricFactSelection {
  if (!request.concept.trim() || !request.periodStart.trim() || !request.periodEnd.trim()) {
    throw new Error('Concept and exact duration dates are required');
  }
  if (request.filingBasis !== request.basis) {
    return {
      status:'BLOCKED_BASIS_MISMATCH',fact:null,eligibleCount:0,rejectedContextCount:0,
      explanation:'Filing-level standalone/consolidated basis must be explicit and match the requested metric basis.',
    };
  }

  const candidates=extraction.facts
    .filter(fact=>fact.concept===request.concept)
    .map(fact=>({
      concept:fact.concept,contextRef:fact.contextRef,unitRef:fact.unitRef,
      rawValue:fact.rawValue,numericValue:fact.numericValue,isNil:fact.isNil,
    }));
  if(candidates.length===0) {
    return {
      status:'MISSING_CONCEPT',fact:null,eligibleCount:0,rejectedContextCount:0,
      explanation:'The exact requested XBRL concept is not present in this filing.',
    };
  }

  const expected:ContextExpectation={
    periodStart:request.periodStart,periodEnd:request.periodEnd,
    periodKind:'DURATION',basis:request.basis,filingBasis:request.filingBasis,
  };
  const selected=selectUniqueGroupFact(candidates,extraction.contexts,expected);
  if(selected.status==='NO_ELIGIBLE_GROUP_FACT') {
    return {
      status:'NO_ELIGIBLE_GROUP_FACT',fact:null,eligibleCount:0,
      rejectedContextCount:selected.rejectedDimensionalOrPeriodCount,
      explanation:'No exact-period, undimensioned group context matched the requested filing basis.',
    };
  }
  if(selected.status==='AMBIGUOUS_GROUP_FACTS') {
    return {
      status:'AMBIGUOUS_GROUP_FACTS',fact:null,eligibleCount:selected.eligibleCount,
      rejectedContextCount:selected.rejectedDimensionalOrPeriodCount,
      explanation:'More than one fact matches the same concept, exact period and group context; no fact was selected.',
    };
  }

  const raw=selected.selected!;
  if(!raw.unitRef || !extraction.units[raw.unitRef]?.length) {
    return {
      status:'BLOCKED_MISSING_UNIT',fact:null,eligibleCount:1,
      rejectedContextCount:selected.rejectedDimensionalOrPeriodCount,
      explanation:'Selected fact has no resolvable XBRL unit; numeric value withheld.',
    };
  }
  const unitMeasures=extraction.units[raw.unitRef];
  if(unitMeasures.length!==1 || !/^iso4217:[A-Z]{3}$/.test(unitMeasures[0])) {
    return {
      status:'BLOCKED_NON_CURRENCY_UNIT',fact:null,eligibleCount:1,
      rejectedContextCount:selected.rejectedDimensionalOrPeriodCount,
      explanation:'Revenue, profit and operating cash flow require one explicit ISO 4217 currency unit; shares, pure and compound units are withheld.',
    };
  }
  if(raw.isNil || raw.rawValue===null || raw.numericValue===null || !Number.isFinite(raw.numericValue)) {
    return {
      status:'BLOCKED_NON_NUMERIC_FACT',fact:null,eligibleCount:1,
      rejectedContextCount:selected.rejectedDimensionalOrPeriodCount,
      explanation:'Selected fact is nil, missing or non-numeric; it must not be converted to zero.',
    };
  }

  return {
    status:'SELECTED_UNIQUE_GROUP_FACT',
    fact:{
      concept:raw.concept,numericValue:raw.numericValue,rawValue:raw.rawValue,
      isNil:raw.isNil,unitMeasures:[...unitMeasures],
      dimensions:[],periodStart:request.periodStart,periodEnd:request.periodEnd,
      periodType:request.periodType,basis:request.basis,
    },
    eligibleCount:1,rejectedContextCount:selected.rejectedDimensionalOrPeriodCount,
    explanation:'One exact-period, undimensioned group fact with an explicit currency unit selected. This confirms context and unit type only, not accounting concept suitability.',
  };
}


export interface XbrlMetricFactBundleSelection {
  status:'SELECTED_ALL_FACTS'|'BLOCKED_FACT_SELECTION'|'BLOCKED_MIXED_CURRENCY';
  facts:Record<string,ComparableMetricFact>|null;
  failedConcepts:string[];
  currency:string|null;
  explanation:string;
}

/** Selects a complete set of duration facts sharing exact dates, basis and currency. */
export function selectXbrlMetricFactBundle(
  extraction:XbrlExtraction,
  request:{concepts:Record<string,string>;periodStart:string;periodEnd:string;periodType:ComparablePeriodType;basis:'STANDALONE'|'CONSOLIDATED';filingBasis:'STANDALONE'|'CONSOLIDATED'|null},
):XbrlMetricFactBundleSelection {
  const entries=Object.entries(request.concepts);
  if(entries.length===0 || entries.some(([key,concept])=>!key.trim() || !concept.trim())) {
    throw new Error('At least one named duration input and exact XBRL concept are required');
  }
  const facts:Record<string,ComparableMetricFact>={};
  const failed:string[]=[];
  let currency:string|null=null;
  for(const [key,concept] of entries) {
    const result=selectXbrlMetricFact(extraction,{concept,periodStart:request.periodStart,periodEnd:request.periodEnd,
      periodType:request.periodType,basis:request.basis,filingBasis:request.filingBasis});
    if(result.status!=='SELECTED_UNIQUE_GROUP_FACT' || !result.fact) {
      failed.push(key+' ('+concept+'): '+result.status);
      continue;
    }
    const factCurrency=result.fact.unitMeasures[0];
    if(currency!==null && currency!==factCurrency) return {
      status:'BLOCKED_MIXED_CURRENCY',facts:null,failedConcepts:[key],currency:null,
      explanation:'Selected duration facts use different ISO 4217 currencies; no bundle was returned.',
    };
    currency=factCurrency;
    facts[key]=result.fact;
  }
  if(failed.length>0) return {
    status:'BLOCKED_FACT_SELECTION',facts:null,failedConcepts:failed,currency:null,
    explanation:'One or more exact duration concepts failed unique group-context, period, basis, numeric or unit checks. Partial bundles are withheld.',
  };
  return {status:'SELECTED_ALL_FACTS',facts,failedConcepts:[],currency,
    explanation:'All requested duration facts passed exact-date, undimensioned group, basis, numeric and common-currency checks. Accounting meaning and formula approval remain separate.'};
}
