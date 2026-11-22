export type FundamentalMetric =
  | 'REVENUE_GROWTH'
  | 'PROFIT_GROWTH'
  | 'ROE'
  | 'ROCE'
  | 'DEBT_EQUITY'
  | 'INTEREST_COVERAGE'
  | 'OPERATING_CASH_FLOW';

export type FilingExchange = 'NSE' | 'BSE';
export type FilingBasis = 'STANDALONE' | 'CONSOLIDATED';
export type FilingSubmission = 'ORIGINAL' | 'REVISION';
export type AuditStatus = 'AUDITED' | 'UNAUDITED' | 'LIMITED_REVIEW' | 'UNKNOWN';
export type MetricPeriodType = 'QUARTER' | 'YTD' | 'FY' | 'TTM' | 'INSTANT';
export type MetricDataStatus = 'VALIDATED' | 'MISSING' | 'NOT_APPLICABLE' | 'BLOCKED' | 'CONFLICT';

export interface FilingProvenance {
  exchange: FilingExchange;
  symbol: string;
  isin: string;
  documentId: string;
  sequenceId: string;
  sourceUrl: string;
  publishedAt: string;
  submission: FilingSubmission;
  revisedAt: string | null;
  revisionRemark: string | null;
  auditStatus: AuditStatus;
  basis: FilingBasis;
  periodEnd: string;
}

export interface RawFactEvidence {
  documentId: string;
  concept: string;
  contextRef: string;
  unitMeasures: string[];
  dimensions: string[];
  rawValue: string | null;
  numericValue: number | null;
  isNil: boolean;
  scale: number | null;
  decimals: string | null;
}

export interface FundamentalMetricRecord {
  metric: FundamentalMetric;
  status: MetricDataStatus;
  value: number | null;
  currency: string | null;
  unit: string | null;
  periodType: MetricPeriodType;
  periodStart: string | null;
  periodEnd: string;
  filings: FilingProvenance[];
  rawFacts: RawFactEvidence[];
  formulaId: string | null;
  formulaVersion: string | null;
  validationNotes: string[];
}

export interface FundamentalProfile {
  symbol: string;
  isin: string;
  basis: FilingBasis;
  periodEnd: string;
  metrics: Record<FundamentalMetric, FundamentalMetricRecord>;
}

export interface FundamentalProfileIssue {
  path: string;
  code: string;
  message: string;
}

const METRICS: FundamentalMetric[] = [
  'REVENUE_GROWTH','PROFIT_GROWTH','ROE','ROCE','DEBT_EQUITY','INTEREST_COVERAGE','OPERATING_CASH_FLOW',
];

function isOfficialSource(exchange: FilingExchange, sourceUrl: string): boolean {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    if (exchange === 'NSE') {
      return ['nseindia.com','nseindia.in'].some(domain => host === domain || host.endsWith(`.${domain}`));
    }
    return host === 'bseindia.com' || host.endsWith('.bseindia.com');
  } catch {
    return false;
  }
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Research-only integrity validator. It does not calculate or approve any metric formula. */
export function validateFundamentalProfile(profile: FundamentalProfile): FundamentalProfileIssue[] {
  const issues: FundamentalProfileIssue[] = [];
  const add = (path: string, code: string, message: string) => issues.push({path,code,message});
  if (!profile.symbol.trim()) add('symbol','REQUIRED','Symbol is required');
  if (!profile.isin.trim()) add('isin','REQUIRED','Verified ISIN is required');
  if (!isIsoDate(profile.periodEnd)) add('periodEnd','INVALID_DATE','Profile period end must be an ISO date');

  const exchanges = new Set<FilingExchange>();
  for (const metric of METRICS) {
    const record = profile.metrics?.[metric];
    const path = `metrics.${metric}`;
    if (!record) {
      add(path,'MISSING_RECORD','Every target metric must have an explicit record/status');
      continue;
    }
    if (record.metric !== metric) add(`${path}.metric`,'KEY_MISMATCH','Metric key and record metric differ');
    if (record.periodEnd !== profile.periodEnd) add(`${path}.periodEnd`,'PERIOD_MISMATCH','Metric period end differs from profile period end');
    if (record.status !== 'VALIDATED') {
      if (record.value !== null) add(`${path}.value`,'UNVALIDATED_VALUE','Non-validated metrics must have null value');
      if (!record.validationNotes.length) add(`${path}.validationNotes`,'REASON_REQUIRED','Blocked, missing, N/A or conflict status requires an explanation');
      continue;
    }
    if (record.value === null || !Number.isFinite(record.value)) add(`${path}.value`,'INVALID_VALUE','Validated metric requires a finite numeric value');
    if (!record.unit) add(path,'UNIT_REQUIRED','Validated metric requires an explicit unit');
    if (record.currency !== null && !/^[A-Z]{3}$/.test(record.currency)) add(\`${path}.currency\`,'INVALID_CURRENCY','Currency must be an ISO 4217 code or null for non-currency units');
    if (record.unit === 'INR' && record.currency !== 'INR') add(\`${path}.currency\`,'CURRENCY_REQUIRED','INR-denominated metrics must declare INR currency');
    if (record.unit !== 'INR' && record.currency !== null) add(\`${path}.currency\`,'CURRENCY_UNIT_MISMATCH','Non-currency units such as PERCENT or RATIO must have null currency');
    if (!record.formulaId?.trim() || !record.formulaVersion?.trim()) add(path,'FORMULA_REQUIRED','Validated metric requires formula ID and version');
    if (!record.filings.length) add(`${path}.filings`,'FILING_REQUIRED','Validated metric requires filing provenance');
    if (!record.rawFacts.length) add(`${path}.rawFacts`,'FACT_REQUIRED','Validated metric requires raw fact evidence');
    if (record.periodType === 'INSTANT') {
      if (record.periodStart !== null) add(`${path}.periodStart`,'INSTANT_HAS_START','Instant metrics must not have a duration start date');
    } else if (!record.periodStart || !isIsoDate(record.periodStart) || !isIsoDate(record.periodEnd) || record.periodStart >= record.periodEnd) {
      add(`${path}.periodStart`,'INVALID_DURATION','Duration metrics require valid start and end dates');
    }

    const documentIds = new Set<string>();
    for (let i=0;i<record.filings.length;i++) {
      const filing=record.filings[i];
      const fp=`${path}.filings[${i}]`;
      if (filing.symbol!==profile.symbol || filing.isin!==profile.isin) add(fp,'ISSUER_MISMATCH','Filing issuer identity differs from profile');
      if (filing.basis!==profile.basis) add(fp,'BASIS_MISMATCH','Standalone/consolidated basis differs from profile');
      if (!isIsoDate(filing.periodEnd)) add(fp,'INVALID_FILING_DATE','Filing period end must be an ISO date');
      if (!filing.documentId.trim() || !filing.sequenceId.trim()) add(fp,'FILING_ID_REQUIRED','Document and sequence IDs are required');
      if (!isOfficialSource(filing.exchange,filing.sourceUrl)) add(fp,'UNTRUSTED_SOURCE','Source URL is not an official exchange archive/domain');
      if (!Number.isFinite(Date.parse(filing.publishedAt))) add(fp,'INVALID_PUBLICATION_DATE','Publication timestamp must be parseable');
      if (filing.auditStatus==='UNKNOWN') add(fp,'AUDIT_STATUS_UNKNOWN','Validated metrics cannot rely on unknown audit status');
      if (filing.submission==='REVISION' && (!filing.revisedAt?.trim() || !filing.revisionRemark?.trim())) add(fp,'REVISION_METADATA_REQUIRED','Revision filings must preserve revised timestamp and revision remark');
      if (filing.submission==='ORIGINAL' && filing.revisedAt!==null) add(fp,'ORIGINAL_HAS_REVISION_DATE','Original filing must not carry a revision timestamp');
      documentIds.add(filing.documentId);
      exchanges.add(filing.exchange);
    }
    for (let i=0;i<record.rawFacts.length;i++) {
      const fact=record.rawFacts[i];
      const rp=`${path}.rawFacts[${i}]`;
      if (!documentIds.has(fact.documentId)) add(rp,'FACT_DOCUMENT_MISMATCH','Raw fact must reference one of this metric record’s filings');
      if (!fact.concept.trim() || !fact.contextRef.trim()) add(rp,'FACT_ID_REQUIRED','Raw fact concept and context reference are required');
      if (!fact.unitMeasures.length) add(rp,'FACT_UNIT_REQUIRED','Raw fact must preserve its XBRL unit measures');
      if (fact.isNil || fact.numericValue===null || !Number.isFinite(fact.numericValue) || fact.rawValue===null) {
        add(rp,'FACT_NOT_NUMERIC','Validated metric cannot use nil, missing or non-numeric raw facts');
      }
    }
  }
  if (exchanges.size > 1) add('metrics','MIXED_EXCHANGE_SOURCES','One profile cannot silently mix NSE and BSE sources across metric records');
  return issues;
}
