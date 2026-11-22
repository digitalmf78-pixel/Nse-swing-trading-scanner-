import type { ComparableMetricFact } from './metric_growth_candidate.ts';

export type QuarterlyOcfDerivationStatus = 'CANDIDATE_ONLY' | 'BLOCKED_INVALID_YTD_PAIR' | 'BLOCKED_MISSING_VALUE' | 'BLOCKED_SOURCE_MISMATCH' | 'BLOCKED_PERIOD_ALIGNMENT';

export interface QuarterlyOcfDerivationResult {
  status: QuarterlyOcfDerivationStatus;
  currentQuarterValue: number | null;
  priorQuarterValue: number | null;
  currentQuarterStart: string | null;
  currentQuarterEnd: string | null;
  priorQuarterStart: string | null;
  priorQuarterEnd: string | null;
  yoyPercent: number | null;
  productionApproved: false;
  explanation: string;
}

const blocked=(status:QuarterlyOcfDerivationStatus,explanation:string):QuarterlyOcfDerivationResult=>({
  status,currentQuarterValue:null,priorQuarterValue:null,currentQuarterStart:null,currentQuarterEnd:null,
  priorQuarterStart:null,priorQuarterEnd:null,yoyPercent:null,productionApproved:false,explanation,
});
const validDate=(s:string)=>{if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(s))return false;const d=new Date(`${s}T00:00:00Z`);return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;}
const shiftYear=(s:string):string|null=>{
  if(!validDate(s)) return null;
  const [y,m,d]=s.split('-').map(Number);
  const date=new Date(Date.UTC(y-1,m-1,d));
  if(date.getUTCFullYear()!==y-1||date.getUTCMonth()!==m-1||date.getUTCDate()!==d) return null;
  return date.toISOString().slice(0,10);
};
const nextDay=(s:string):string=>{
  const d=new Date(`${s}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);
};

/**
 * Derives a quarter only from four exact YTD cash-flow facts:
 * current H1 YTD - current Q1 YTD; prior H1 YTD - prior Q1 YTD.
 * This never subtracts mismatched periods or bases.
 */
export function deriveQuarterlyOcfFromYtd(
  currentH1:ComparableMetricFact,
  currentQ1:ComparableMetricFact,
  priorH1:ComparableMetricFact,
  priorQ1:ComparableMetricFact,
):QuarterlyOcfDerivationResult {
  const facts=[currentH1,currentQ1,priorH1,priorQ1];
  if(facts.some(f=>f.isNil||f.rawValue===null||f.numericValue===null||!Number.isFinite(f.numericValue))) {
    return blocked('BLOCKED_MISSING_VALUE','All four exact YTD OCF facts must be non-nil finite numeric values');
  }
  if(facts.some(f=>f.concept!=='in-capmkt:CashFlowsFromUsedInOperatingActivities')
    ||facts.some(f=>JSON.stringify([...f.unitMeasures].sort())!==JSON.stringify([...currentH1.unitMeasures].sort()))
    ||facts.some(f=>f.unitMeasures.length===0)||facts.some(f=>f.basis!==currentH1.basis)
    ||facts.some(f=>f.dimensions.length!==0)) {
    return blocked('BLOCKED_SOURCE_MISMATCH','All four facts must be the same OCF concept, unit, basis and undimensioned group context');
  }
  if(facts.some(f=>f.periodType!=='YTD')) {
    return blocked('BLOCKED_INVALID_YTD_PAIR','Quarter derivation requires YTD facts only; quarter and TTM inputs are not accepted');
  }
  if(!validDate(currentH1.periodStart)||!validDate(currentQ1.periodStart)||!validDate(priorH1.periodStart)||!validDate(priorQ1.periodStart)
    ||!validDate(currentH1.periodEnd)||!validDate(currentQ1.periodEnd)||!validDate(priorH1.periodEnd)||!validDate(priorQ1.periodEnd)) {
    return blocked('BLOCKED_PERIOD_ALIGNMENT','All YTD period dates must be valid calendar dates');
  }
  if(currentH1.periodStart!==currentQ1.periodStart||priorH1.periodStart!==priorQ1.periodStart
    ||shiftYear(currentH1.periodStart)!==priorH1.periodStart
    ||shiftYear(currentQ1.periodStart)!==priorQ1.periodStart
    ||shiftYear(currentH1.periodEnd)!==priorH1.periodEnd
    ||shiftYear(currentQ1.periodEnd)!==priorQ1.periodEnd
    ||currentQ1.periodEnd>=currentH1.periodEnd
    ||priorQ1.periodEnd>=priorH1.periodEnd) {
    return blocked('BLOCKED_PERIOD_ALIGNMENT','Current and prior Q1/H1 YTD dates must align exactly by calendar year and share the same fiscal-year start');
  }
  const currentQuarterStart=nextDay(currentQ1.periodEnd);
  const priorQuarterStart=nextDay(priorQ1.periodEnd);
  if(shiftYear(currentQuarterStart)!==priorQuarterStart) {
    return blocked('BLOCKED_PERIOD_ALIGNMENT','Derived current/prior quarter start dates do not align year over year');
  }
  const currentQuarterValue=(currentH1.numericValue as number)-(currentQ1.numericValue as number);
  const priorQuarterValue=(priorH1.numericValue as number)-(priorQ1.numericValue as number);
  return {
    status:'CANDIDATE_ONLY',
    currentQuarterValue,
    priorQuarterValue,
    currentQuarterStart,
    currentQuarterEnd:currentH1.periodEnd,
    priorQuarterStart,
    priorQuarterEnd:priorH1.periodEnd,
    yoyPercent:priorQuarterValue>0?Number(((currentQuarterValue/priorQuarterValue-1)*100).toFixed(2)):null,
    productionApproved:false,
    explanation:priorQuarterValue<=0
      ? 'Quarterly OCF derived from exact aligned H1 YTD minus Q1 YTD facts; percentage withheld because prior quarter OCF is zero or negative.'
      : 'Quarterly OCF derived from exact aligned H1 YTD minus Q1 YTD facts; candidate only, not production approval.',
  };
}
