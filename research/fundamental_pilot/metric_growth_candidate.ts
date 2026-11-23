export type GrowthMetric = 'REVENUE_GROWTH' | 'PROFIT_GROWTH';
export type ComparablePeriodType = 'QUARTER' | 'YTD' | 'FY' | 'TTM';

export interface ComparableMetricFact {
  concept: string;
  numericValue: number | null;
  rawValue: string | null;
  isNil: boolean;
  unitMeasures: string[];
  dimensions: string[];
  periodStart: string;
  periodEnd: string;
  periodType: ComparablePeriodType;
  basis: 'STANDALONE' | 'CONSOLIDATED';
}

export type GrowthCandidateStatus =
  | 'CANDIDATE_ONLY'
  | 'BLOCKED_MISSING_VALUE'
  | 'BLOCKED_CONCEPT_MISMATCH'
  | 'BLOCKED_UNIT_MISMATCH'
  | 'BLOCKED_DIMENSIONAL_FACT'
  | 'BLOCKED_BASIS_MISMATCH'
  | 'BLOCKED_PERIOD_TYPE_MISMATCH'
  | 'BLOCKED_PERIOD_ALIGNMENT'
  | 'BLOCKED_NON_POSITIVE_PRIOR_BASE';

export interface GrowthCandidateResult {
  metric: GrowthMetric;
  status: GrowthCandidateStatus;
  growthPercent: number | null;
  formulaId: 'same_period_yoy_growth';
  formulaVersion: '1.0.0';
  explanation: string;
  productionApproved: false;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d=new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===value;
}

function oneYearBefore(date: string): string | null {
  if (!validDate(date)) return null;
  const [year,month,day]=date.split('-').map(Number);
  const priorYear=year-1;
  const candidate=new Date(Date.UTC(priorYear,month-1,day));
  // Leap day has no exact prior-year counterpart: block rather than shift silently.
  if (candidate.getUTCFullYear()!==priorYear || candidate.getUTCMonth()!==month-1 || candidate.getUTCDate()!==day) return null;
  return candidate.toISOString().slice(0,10);
}

function result(metric: GrowthMetric,status: GrowthCandidateStatus,explanation: string,growthPercent: number|null=null): GrowthCandidateResult {
  return {metric,status,growthPercent,formulaId:'same_period_yoy_growth',formulaVersion:'1.0.0',explanation,productionApproved:false};
}

/**
 * Mechanical YoY growth candidate for exact same-period, same-concept, same-unit,
 * undimensioned group facts. This is not an organic-growth or production approval.
 */
export function calculateGrowthCandidate(
  metric: GrowthMetric,
  current: ComparableMetricFact,
  prior: ComparableMetricFact,
): GrowthCandidateResult {
  if (current.isNil || prior.isNil || current.rawValue===null || prior.rawValue===null
      || current.numericValue===null || prior.numericValue===null
      || !Number.isFinite(current.numericValue) || !Number.isFinite(prior.numericValue)) {
    return result(metric,'BLOCKED_MISSING_VALUE','Both current and prior raw facts must be non-nil finite numeric values');
  }
  if (current.concept!==prior.concept) return result(metric,'BLOCKED_CONCEPT_MISMATCH','Current and prior facts must use the same XBRL concept');
  if (JSON.stringify([...current.unitMeasures].sort())!==JSON.stringify([...prior.unitMeasures].sort())) {
    return result(metric,'BLOCKED_UNIT_MISMATCH','Current and prior facts must use exactly the same XBRL unit measures');
  }
  if (current.dimensions.length!==0 || prior.dimensions.length!==0) {
    return result(metric,'BLOCKED_DIMENSIONAL_FACT','Segment/dimensional facts are not accepted as group totals');
  }
  if (current.basis!==prior.basis) return result(metric,'BLOCKED_BASIS_MISMATCH','Standalone and consolidated facts must never be mixed');
  if (current.periodType!==prior.periodType || current.periodType==='TTM') {
    return result(metric,'BLOCKED_PERIOD_TYPE_MISMATCH','Period types must match; TTM is blocked until its construction is validated');
  }
  const expectedStart=oneYearBefore(current.periodStart);
  const expectedEnd=oneYearBefore(current.periodEnd);
  if (!expectedStart || !expectedEnd || prior.periodStart!==expectedStart || prior.periodEnd!==expectedEnd
      || !validDate(current.periodStart) || !validDate(current.periodEnd)
      || current.periodStart>=current.periodEnd || prior.periodStart>=prior.periodEnd) {
    return result(metric,'BLOCKED_PERIOD_ALIGNMENT','Prior period must have exactly matching calendar start/end dates one year earlier');
  }
  if (prior.numericValue<=0) return result(metric,'BLOCKED_NON_POSITIVE_PRIOR_BASE','Percentage growth is withheld when the prior-period base is zero or negative');
  const growthPercent=Number(((current.numericValue/prior.numericValue-1)*100).toFixed(2));
  return result(metric,'CANDIDATE_ONLY','Mechanical same-period YoY comparison only; not organic-growth certification or production approval',growthPercent);
}
