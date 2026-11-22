import { resolveOriginalRevisionHistory, type NseRevisionRow } from './nse_revision_pair.ts';

export interface NseIntegratedFilingQuery {
  symbol: string;
  pageSize?: number;
  maxPages?: number;
  maxRetries?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface NseIntegratedFilingResult {
  symbol: string;
  rows: NseRevisionRow[];
  pagesFetched: number;
  exactDuplicateRows: number;
  complete: boolean;
  source: 'NSE_OFFICIAL_INTEGRATED_FILING_API';
  warnings: string[];
}

export type NseIssuerPeriodSelection =
  | { status: 'ORIGINAL_ONLY'; original: NseRevisionRow; revisions: []; exactDuplicateRows: number }
  | { status: 'REVISION_HISTORY'; original: NseRevisionRow; revisions: NseRevisionRow[]; exactDuplicateRows: number }
  | { status: 'ORIGINAL_MISSING'; original: null; revisions: []; exactDuplicateRows: 0 }
  | { status: 'BLOCKED'; original: null; revisions: []; exactDuplicateRows: number; reason: string };

const API_URL = 'https://www.nseindia.in/api/integrated-filing-results';
const REFERER = 'https://www.nseindia.in/companies-listing/corporate-integrated-filing';
const USER_AGENT = 'Mozilla/5.0 (compatible; FundamentalResearchPilot/1.0)';
const ALLOWED_HOSTS = new Set(['www.nseindia.in', 'www.nseindia.com', 'nseindia.in', 'nseindia.com']);

function validateQuery(query: NseIntegratedFilingQuery): Required<Pick<NseIntegratedFilingQuery,
  'symbol' | 'pageSize' | 'maxPages' | 'maxRetries' | 'timeoutMs'>> {
  const symbol = query.symbol.trim().toUpperCase();
  if (!/^[A-Z0-9&.-]{1,24}$/.test(symbol)) throw new Error('Invalid NSE symbol');
  const pageSize = query.pageSize ?? 100;
  const maxPages = query.maxPages ?? 20;
  const maxRetries = query.maxRetries ?? 2;
  const timeoutMs = query.timeoutMs ?? 30000;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('pageSize must be an integer from 1 to 100');
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 50) throw new Error('maxPages must be an integer from 1 to 50');
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 5) throw new Error('maxRetries must be an integer from 0 to 5');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) throw new Error('timeoutMs must be from 1000 to 120000');
  return { symbol, pageSize, maxPages, maxRetries, timeoutMs };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function rowFingerprint(row: NseRevisionRow): string {
  return JSON.stringify([
    row.symbol,row.smName,row.seq_Id,row.qe_Date,row.type,row.type_Sub,row.audited,
    row.consolidated,row.broadcast_Date,row.creation_Date,row.revised_Date,
    row.revision_Remark,row.ixbrl,row.xbrl,
  ]);
}

function deduplicateRows(rows: NseRevisionRow[]): { rows: NseRevisionRow[]; duplicates: number } {
  const byId = new Map<string, NseRevisionRow>();
  let duplicates = 0;
  for (const row of rows) {
    if (row.seq_Id === null || row.seq_Id === undefined || String(row.seq_Id).trim() === '') {
      throw new Error('NSE filing row has no sequence ID');
    }
    const id = String(row.seq_Id);
    const previous = byId.get(id);
    if (!previous) byId.set(id, row);
    else if (rowFingerprint(previous) === rowFingerprint(row)) duplicates += 1;
    else throw new Error(`Conflicting NSE API rows share sequence ID ${id}`);
  }
  return { rows: [...byId.values()], duplicates };
}

/**
 * Fetches every available page for one symbol from the official NSE
 * Integrated Filing - Financials endpoint. Pagination is marked incomplete
 * if the configured page ceiling is reached without a short/empty page.
 * Exact API duplicates are counted; conflicting sequence IDs fail closed.
 */
export async function fetchNseIntegratedFilingRows(
  query: NseIntegratedFilingQuery,
): Promise<NseIntegratedFilingResult> {
  const options = validateQuery(query);
  const fetchImpl = query.fetchImpl ?? fetch;
  const allRows: NseRevisionRow[] = [];
  const warnings: string[] = [];
  let pagesFetched = 0;
  let reachedEnd = false;

  for (let page = 1; page <= options.maxPages; page += 1) {
    const url = new URL(API_URL);
    url.search = new URLSearchParams({
      index: 'equities',
      symbol: options.symbol,
      type: 'Integrated Filing- Financials',
      page: String(page),
      size: String(options.pageSize),
    }).toString();

    let response: Response | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
      try {
        response = await fetchImpl(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json, text/plain, */*',
            Referer: REFERER,
            'User-Agent': USER_AGENT,
          },
          signal: AbortSignal.timeout(options.timeoutMs),
        });
        if (response.url) {
          const responseUrl = new URL(response.url);
          if (responseUrl.protocol !== 'https:' || !ALLOWED_HOSTS.has(responseUrl.hostname)) {
            throw new Error('NSE filing request redirected outside the official NSE domain allowlist');
          }
        }
        if (response.ok) break;
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === options.maxRetries) {
          throw new Error(`NSE Integrated Filing API returned HTTP ${response.status}`);
        }
        lastError = new Error(`Retryable NSE HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
        if (attempt === options.maxRetries) break;
        if (error instanceof Error && /redirected outside|Invalid NSE|returned HTTP 4/.test(error.message)) break;
      }
      await new Promise(resolve => setTimeout(resolve, Math.min(250 * (attempt + 1), 1000)));
    }
    if (!response?.ok) throw lastError instanceof Error ? lastError : new Error('NSE filing API request failed');

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`NSE filing API page ${page} did not return valid JSON`);
    }
    if (!isRecord(payload) || !Array.isArray(payload.data)) {
      throw new Error(`NSE filing API page ${page} is missing the expected data array`);
    }

    const pageRows: NseRevisionRow[] = [];
    for (const value of payload.data) {
      if (!isRecord(value)) throw new Error(`NSE filing API page ${page} contains a non-object row`);
      if (value.symbol !== options.symbol) {
        throw new Error(`NSE filing API returned unexpected symbol ${String(value.symbol)} for ${options.symbol}`);
      }
      if (value.type !== 'Integrated Filing- Financials') {
        throw new Error('NSE filing API returned an unexpected filing type');
      }
      pageRows.push(value as NseRevisionRow);
    }

    allRows.push(...pageRows);
    pagesFetched += 1;
    if (pageRows.length < options.pageSize) {
      reachedEnd = true;
      break;
    }
  }

  const deduplicated = deduplicateRows(allRows);
  if (!reachedEnd) warnings.push('PAGE_LIMIT_REACHED: filing history may be incomplete; do not use for final Original/Revision selection');
  return {
    symbol: options.symbol,
    rows: deduplicated.rows,
    pagesFetched,
    exactDuplicateRows: deduplicated.duplicates,
    complete: reachedEnd,
    source: 'NSE_OFFICIAL_INTEGRATED_FILING_API',
    warnings,
  };
}

function isOfficialNseArchiveUrl(value: unknown, folder: 'xbrl' | 'ixbrl'): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && (url.hostname === 'nsearchives.nseindia.in' || url.hostname === 'nsearchives.nseindia.com')
      && url.pathname.startsWith(`/corporate/${folder}/`);
  } catch {
    return false;
  }
}

/**
 * Selects one exact issuer/period/basis filing history. It never chooses a
 * revision as a substitute for a missing Original and never auto-selects a
 * changed revision value. Callers must inspect the returned history.
 */
export function selectNseIssuerPeriodHistory(
  rows: NseRevisionRow[],
  request: { symbol: string; period: string; basis: 'Standalone' | 'Consolidated' },
): NseIssuerPeriodSelection {
  const symbol = request.symbol.trim().toUpperCase();
  if (!symbol || !request.period.trim()) throw new Error('Issuer, period and basis are required');

  const periodRows = rows.filter(row =>
    row.symbol === symbol
    && row.qe_Date === request.period
    && row.type === 'Integrated Filing- Financials'
    && row.consolidated === request.basis
    && (row.type_Sub === 'Original' || row.type_Sub === 'Revision'),
  );
  if (periodRows.length === 0) {
    return { status: 'ORIGINAL_MISSING', original: null, revisions: [], exactDuplicateRows: 0 };
  }

  for (const row of periodRows) {
    if (!isOfficialNseArchiveUrl(row.xbrl, 'xbrl') || !isOfficialNseArchiveUrl(row.ixbrl, 'ixbrl')) {
      return {
        status: 'BLOCKED', original: null, revisions: [], exactDuplicateRows: 0,
        reason: `Filing sequence ${String(row.seq_Id)} has a missing or non-official XBRL/iXBRL archive URL`,
      };
    }
  }

  let deduplicated: ReturnType<typeof deduplicateRows>;
  try {
    deduplicated = deduplicateRows(periodRows);
  } catch (error) {
    return {
      status: 'BLOCKED', original: null, revisions: [], exactDuplicateRows: 0,
      reason: (error as Error).message,
    };
  }

  const originals = deduplicated.rows.filter(row => row.type_Sub === 'Original');
  const revisions = deduplicated.rows.filter(row => row.type_Sub === 'Revision');
  if (originals.length !== 1) {
    return {
      status: 'BLOCKED', original: null, revisions: [], exactDuplicateRows: deduplicated.duplicates,
      reason: `Expected exactly one Original for ${symbol} ${request.period} ${request.basis}; found ${originals.length}`,
    };
  }

  if (revisions.length === 0) {
    return {
      status: 'ORIGINAL_ONLY', original: originals[0], revisions: [],
      exactDuplicateRows: deduplicated.duplicates,
    };
  }

  try {
    const history = resolveOriginalRevisionHistory(deduplicated.rows, {
      symbol, period: request.period, basis: request.basis,
    });
    return {
      status: 'REVISION_HISTORY',
      original: history.original,
      revisions: history.revisions,
      exactDuplicateRows: deduplicated.duplicates + history.apiDuplicateRows,
    };
  } catch (error) {
    return {
      status: 'BLOCKED', original: null, revisions: [],
      exactDuplicateRows: deduplicated.duplicates,
      reason: (error as Error).message,
    };
  }
}
