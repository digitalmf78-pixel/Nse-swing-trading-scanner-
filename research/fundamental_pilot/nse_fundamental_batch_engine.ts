import { fetchNseIntegratedFilingRows, selectNseIssuerPeriodHistory } from './nse_integrated_filing_client.ts';
import type { NseIntegratedFilingQuery } from './nse_integrated_filing_client.ts';
import type { NseRevisionRow } from './nse_revision_pair.ts';
import { extractXbrl, type XbrlExtraction } from './xbrl_extract.ts';
import { buildSevenMetricXbrlPipeline, type IssuerMetricConceptMap, type SevenMetricXbrlPipelineReport } from './seven_metric_xbrl_pipeline.ts';
import type { IssuerSector } from './sector_metric_policy.ts';

export interface NseFundamentalPeriodRequest {
  periodType: 'QUARTER' | 'YTD' | 'FY';
  periodStart: string;
  periodEnd: string;
  basis: 'STANDALONE' | 'CONSOLIDATED';
}

export interface NseFundamentalIssuerRequest {
  symbol: string;
  sector: IssuerSector;
  conceptMap: IssuerMetricConceptMap;
  current: NseFundamentalPeriodRequest;
  prior: NseFundamentalPeriodRequest;
}

export interface NseFundamentalBatchOptions {
  issuers: NseFundamentalIssuerRequest[];
  concurrency?: number;
  fetchImpl?: typeof fetch;
  filingQuery?: Omit<NseIntegratedFilingQuery, 'symbol' | 'fetchImpl'>;
}

export interface NseOriginalFilingEvidence {
  symbol: string;
  periodEnd: string;
  basis: 'STANDALONE' | 'CONSOLIDATED';
  filing: NseRevisionRow;
  revisionRows: NseRevisionRow[];
  extraction: XbrlExtraction;
  source: 'NSE_OFFICIAL_INTEGRATED_FILING_API' | 'NSE_OFFICIAL_XBRL_ARCHIVE';
}

export type NseFundamentalIssuerResult =
  | {
      symbol: string;
      status: 'CANDIDATE_READY' | 'REVISION_REVIEW_REQUIRED';
      current: NseOriginalFilingEvidence;
      prior: NseOriginalFilingEvidence;
      candidateReport: SevenMetricXbrlPipelineReport;
      scannerEligible: false;
      warnings: string[];
    }
  | {
      symbol: string;
      status: 'BLOCKED';
      scannerEligible: false;
      warnings: string[];
    };

export interface NseFundamentalBatchReport {
  source: 'NSE_OFFICIAL';
  requested: number;
  completed: number;
  blocked: number;
  revisionReviewRequired: number;
  results: NseFundamentalIssuerResult[];
  productionApproved: false;
}

const NSE_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function toNsePeriodDate(isoDate: string): string {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(isoDate)) throw new Error(`Invalid ISO period end: ${isoDate}`);
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== isoDate) {
    throw new Error(`Invalid ISO period end: ${isoDate}`);
  }
  return `${String(date.getUTCDate()).padStart(2, '0')}-${NSE_MONTHS[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
}

function filingBasis(basis: 'STANDALONE' | 'CONSOLIDATED'): 'Standalone' | 'Consolidated' {
  return basis === 'STANDALONE' ? 'Standalone' : 'Consolidated';
}

function officialArchiveUrl(value: string | undefined): URL {
  if (!value) throw new Error('NSE filing row is missing its XBRL archive URL');
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['nsearchives.nseindia.in', 'nsearchives.nseindia.com'].includes(url.hostname)
      || !url.pathname.startsWith('/corporate/xbrl/')) {
    throw new Error('XBRL archive URL is outside the official NSE archive allowlist');
  }
  return url;
}

async function fetchOriginal(
  symbol: string,
  period: NseFundamentalPeriodRequest,
  fetchImpl: typeof fetch,
  filingQuery: NseFundamentalBatchOptions['filingQuery'],
): Promise<NseOriginalFilingEvidence> {
  const filingHistory = await fetchNseIntegratedFilingRows({
    symbol,
    fetchImpl,
    ...(filingQuery ?? {}),
  });
  if (!filingHistory.complete) throw new Error(`${symbol}: NSE filing pagination is incomplete`);
  const selection = selectNseIssuerPeriodHistory(filingHistory.rows, {
    symbol: symbol.toUpperCase(),
    period: toNsePeriodDate(period.periodEnd),
    basis: filingBasis(period.basis),
  });
  if (selection.status === 'ORIGINAL_MISSING') throw new Error(`${symbol}: exact-period Original filing not found for ${period.periodEnd} ${period.basis}`);
  if (selection.status === 'BLOCKED') throw new Error(`${symbol}: ${selection.reason}`);

  const filing = selection.original;
  const archiveUrl = officialArchiveUrl(filing.xbrl);
  const response = await fetchImpl(archiveUrl, {
    method: 'GET',
    headers: { Accept: 'application/xml,text/xml,*/*', Referer: 'https://www.nseindia.com/' },
    signal: AbortSignal.timeout(filingQuery?.timeoutMs ?? 30000),
  });
  if (!response.ok) throw new Error(`${symbol}: NSE XBRL archive returned HTTP ${response.status}`);
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > 25 * 1024 * 1024) throw new Error(`${symbol}: XBRL archive exceeds 25 MB limit`);
  const xml = await response.text();
  if (xml.length > 25 * 1024 * 1024) throw new Error(`${symbol}: XBRL archive exceeds 25 MB limit`);
  const extraction = extractXbrl(xml);
  if (extraction.warnings.length > 0) {
    throw new Error(`${symbol}: XBRL parser emitted ${extraction.warnings.length} warning(s); issuer blocked from candidate calculation`);
  }
  const revisionRows = selection.status === 'REVISION_HISTORY' ? selection.revisions : [];
  return {
    symbol: symbol.toUpperCase(),
    periodEnd: period.periodEnd,
    basis: period.basis,
    filing,
    revisionRows,
    extraction,
    source: 'NSE_OFFICIAL_XBRL_ARCHIVE',
  };
}

async function processIssuer(
  request: NseFundamentalIssuerRequest,
  fetchImpl: typeof fetch,
  filingQuery: NseFundamentalBatchOptions['filingQuery'],
): Promise<NseFundamentalIssuerResult> {
  const symbol = request.symbol.trim().toUpperCase();
  try {
    if (!/^[A-Z0-9&.-]{1,24}$/.test(symbol)) throw new Error('Invalid NSE symbol');
    if (request.current.basis !== request.prior.basis) throw new Error('Current and prior filing basis must match');
    if (request.current.periodType !== request.prior.periodType) throw new Error('Current and prior period types must match');
    const [current, prior] = await Promise.all([
      fetchOriginal(symbol, request.current, fetchImpl, filingQuery),
      fetchOriginal(symbol, request.prior, fetchImpl, filingQuery),
    ]);
    const candidateReport = buildSevenMetricXbrlPipeline(
      request.sector,
      {
        extraction: current.extraction,
        periodType: request.current.periodType,
        periodStart: request.current.periodStart,
        periodEnd: request.current.periodEnd,
        basis: request.current.basis,
        filingBasis: current.filing.consolidated === 'Standalone' ? 'STANDALONE' : 'CONSOLIDATED',
      },
      {
        extraction: prior.extraction,
        periodType: request.prior.periodType,
        periodStart: request.prior.periodStart,
        periodEnd: request.prior.periodEnd,
        basis: request.prior.basis,
        filingBasis: prior.filing.consolidated === 'Standalone' ? 'STANDALONE' : 'CONSOLIDATED',
      },
      request.conceptMap,
    );
    const hasRevisionHistory = current.revisionRows.length > 0 || prior.revisionRows.length > 0;
    const warnings = [
      ...current.extraction.warnings,
      ...prior.extraction.warnings,
      ...(hasRevisionHistory ? ['REVISION_HISTORY_PRESENT: Original filing retained; revision facts require automated reconciliation before scanner use'] : []),
    ];
    return {
      symbol,
      status: hasRevisionHistory ? 'REVISION_REVIEW_REQUIRED' : 'CANDIDATE_READY',
      current,
      prior,
      candidateReport,
      scannerEligible: false,
      warnings,
    };
  } catch (error) {
    return {
      symbol,
      status: 'BLOCKED',
      scannerEligible: false,
      warnings: [(error as Error).message],
    };
  }
}

/**
 * Bounded-concurrency batch ingestion for exact-period NSE official XBRL.
 * This research engine never changes live-price fetching or scanner ranking.
 * It intentionally keeps all outputs non-production until revision and
 * metric-formula approvals are complete.
 */
export async function runNseFundamentalBatch(
  options: NseFundamentalBatchOptions,
): Promise<NseFundamentalBatchReport> {
  if (!Array.isArray(options.issuers) || options.issuers.length === 0) {
    throw new Error('At least one issuer request is required');
  }
  const concurrency = options.concurrency ?? 2;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 5) {
    throw new Error('concurrency must be an integer from 1 to 5');
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const results = new Array<NseFundamentalIssuerResult>(options.issuers.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, options.issuers.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= options.issuers.length) return;
      results[index] = await processIssuer(options.issuers[index], fetchImpl, options.filingQuery);
    }
  });
  await Promise.all(workers);
  return {
    source: 'NSE_OFFICIAL',
    requested: options.issuers.length,
    completed: results.filter(result => result.status !== 'BLOCKED').length,
    blocked: results.filter(result => result.status === 'BLOCKED').length,
    revisionReviewRequired: results.filter(result => result.status === 'REVISION_REVIEW_REQUIRED').length,
    results,
    productionApproved: false,
  };
}
