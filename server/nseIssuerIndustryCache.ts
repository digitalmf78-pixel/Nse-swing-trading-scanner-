import fs from 'node:fs';
import path from 'node:path';

export interface NseIssuerIndustryRecord {
  symbol: string;
  isin: string;
  macro: string;
  sector: string;
  industry: string;
  basicIndustry: string;
  source: 'NSE_OFFICIAL_QUOTE_EQUITY';
  sourceUrl: string;
  fetchedAtUtc: string;
}
export interface NseIssuerIndustryCache {
  schemaVersion: 1;
  updatedAtUtc: string;
  symbols: Record<string, NseIssuerIndustryRecord>;
}
export interface NseQuoteClientOptions {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

const CACHE_FILE = path.join(process.cwd(), 'data', 'research', 'nse_official_issuer_industry.json');
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const HOSTS = new Set(['www.nseindia.in', 'www.nseindia.com']);
const DEFAULT_BASE = 'https://www.nseindia.com';

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildNseIndustryText(record: Pick<NseIssuerIndustryRecord, 'macro' | 'sector' | 'industry' | 'basicIndustry'>): string {
  return [record.macro, record.sector, record.industry, record.basicIndustry]
    .map(value => value.trim())
    .filter(Boolean)
    .join(' | ');
}

export function loadNseIssuerIndustryCache(file = CACHE_FILE): NseIssuerIndustryCache {
  if (!fs.existsSync(file)) return { schemaVersion: 1, updatedAtUtc: '', symbols: {} };
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<NseIssuerIndustryCache>;
  if (parsed.schemaVersion !== 1 || !parsed.symbols || typeof parsed.symbols !== 'object' || Array.isArray(parsed.symbols)) {
    throw new Error('NSE issuer industry cache schema invalid; refusing to overwrite');
  }
  for (const [symbol, row] of Object.entries(parsed.symbols)) {
    if (symbol !== symbol.trim().toUpperCase() || !row || row.symbol !== symbol
        || row.source !== 'NSE_OFFICIAL_QUOTE_EQUITY'
        || (row.isin !== '' && !ISIN_RE.test(row.isin))
        || !buildNseIndustryText(row)) {
      throw new Error('NSE issuer industry cache identity validation failed: ' + symbol);
    }
  }
  return { schemaVersion: 1, updatedAtUtc: parsed.updatedAtUtc ?? '', symbols: parsed.symbols };
}

export function saveNseIssuerIndustryCache(
  cache: NseIssuerIndustryCache,
  file = CACHE_FILE,
): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.tmp.' + process.pid + '.' + Date.now();
  fs.writeFileSync(temp, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, file);
}

export class NseIssuerIndustryClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private initialized = false;
  private cookieHeader = '';

  constructor(options: NseQuoteClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE;
    const base = new URL(this.baseUrl);
    if (base.protocol !== 'https:' || !HOSTS.has(base.hostname) || base.port !== ''
        || base.username !== '' || base.password !== '') {
      throw new Error('NSE quote client base URL must be an official NSE HTTPS host');
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const landing = await this.fetchImpl(this.baseUrl + '/', {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; NseFundamentalResearch/1.0)',
      },
      signal: AbortSignal.timeout(20000),
    });
    const headers = landing.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [headers.get('set-cookie') ?? ''].filter(Boolean);
    this.cookieHeader = setCookies.map(cookie => cookie.split(';')[0].trim()).filter(Boolean).join('; ');
    // NSE sometimes serves a challenge page with a non-200 status but still issues cookies.
    if (!landing.ok && !this.cookieHeader) {
      throw new Error('NSE website session bootstrap failed with HTTP ' + landing.status);
    }
    this.initialized = true;
  }

  async fetchIssuerIndustry(rawSymbol: string): Promise<NseIssuerIndustryRecord> {
    await this.initialize();
    const symbol = rawSymbol.trim().toUpperCase();
    if (!/^[A-Z0-9&.-]{1,24}$/.test(symbol)) throw new Error('Invalid NSE symbol for industry lookup');
    const url = new URL('/api/quote-equity', this.baseUrl);
    url.searchParams.set('symbol', symbol);
    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, */*',
      Referer: this.baseUrl + '/get-quotes/equity?symbol=' + encodeURIComponent(symbol),
      Origin: this.baseUrl,
      'User-Agent': 'Mozilla/5.0 (compatible; NseFundamentalResearch/1.0)',
    };
    if (this.cookieHeader) headers.Cookie = this.cookieHeader;
    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error('NSE quote-equity returned HTTP ' + response.status);
    if (response.url) {
      const finalUrl = new URL(response.url);
      if (finalUrl.protocol !== 'https:' || !HOSTS.has(finalUrl.hostname)
          || finalUrl.port !== '' || finalUrl.username !== '' || finalUrl.password !== '') {
        throw new Error('NSE quote-equity redirected outside official NSE domains');
      }
    }
    const payload = await response.json() as Record<string, any>;
    const info = payload?.info && typeof payload.info === 'object' ? payload.info : {};
    const industryInfo = payload?.industryInfo && typeof payload.industryInfo === 'object'
      ? payload.industryInfo
      : {};
    const record: NseIssuerIndustryRecord = {
      symbol,
      isin: clean(info.isin).toUpperCase(),
      macro: clean(industryInfo.macro),
      sector: clean(industryInfo.sector),
      industry: clean(industryInfo.industry),
      basicIndustry: clean(industryInfo.basicIndustry),
      source: 'NSE_OFFICIAL_QUOTE_EQUITY',
      sourceUrl: url.toString(),
      fetchedAtUtc: new Date().toISOString(),
    };
    if (record.isin && !ISIN_RE.test(record.isin)) throw new Error('NSE quote-equity returned invalid ISIN for ' + symbol);
    if (!buildNseIndustryText(record)) throw new Error('NSE quote-equity returned no official industry classification for ' + symbol);
    return record;
  }
}

export async function fetchNseIssuerIndustry(
  rawSymbol: string,
  fetchImpl: typeof fetch = fetch,
): Promise<NseIssuerIndustryRecord> {
  const client = new NseIssuerIndustryClient({ fetchImpl });
  return client.fetchIssuerIndustry(rawSymbol);
}
