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

function validateOfficialQuoteUrl(value: string, symbol: string): void {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !HOSTS.has(url.hostname) || url.port !== ''
      || url.username !== '' || url.password !== ''
      || url.pathname !== '/api/quote-equity'
      || url.searchParams.get('symbol')?.toUpperCase() !== symbol) {
    throw new Error('NSE issuer industry source URL is outside the official quote-equity endpoint');
  }
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
    validateOfficialQuoteUrl(row.sourceUrl, symbol);
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
  private readonly baseUrls: string[];
  private readonly cookies = new Map<string, string>();
  private readonly initializedBases = new Set<string>();

  constructor(options: NseQuoteClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    const primary = options.baseUrl ?? DEFAULT_BASE;
    const primaryUrl = new URL(primary);
    if (primaryUrl.protocol !== 'https:' || !HOSTS.has(primaryUrl.hostname) || primaryUrl.port !== ''
        || primaryUrl.username !== '' || primaryUrl.password !== '') {
      throw new Error('NSE quote client base URL must be an official NSE HTTPS host');
    }
    const fallback = primaryUrl.hostname === 'www.nseindia.com'
      ? 'https://www.nseindia.in'
      : 'https://www.nseindia.com';
    this.baseUrls = [...new Set([primary.replace(/\/$/, ''), fallback])];
  }

  private async initializeBase(baseUrl: string): Promise<void> {
    if (this.initializedBases.has(baseUrl)) return;
    const landing = await this.fetchImpl(baseUrl + '/', {
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
    const cookieHeader = setCookies.map(cookie => cookie.split(';')[0].trim()).filter(Boolean).join('; ');
    if (!landing.ok && !cookieHeader) {
      throw new Error('NSE website session bootstrap failed on ' + baseUrl + ' with HTTP ' + landing.status);
    }
    this.cookies.set(baseUrl, cookieHeader);
    this.initializedBases.add(baseUrl);
  }

  async initialize(): Promise<void> {
    await this.initializeBase(this.baseUrls[0]);
  }

  async fetchIssuerIndustry(rawSymbol: string): Promise<NseIssuerIndustryRecord> {
    const symbol = rawSymbol.trim().toUpperCase();
    if (!/^[A-Z0-9&.-]{1,24}$/.test(symbol)) throw new Error('Invalid NSE symbol for industry lookup');
    const failures: string[] = [];
    for (const baseUrl of this.baseUrls) {
      try {
        await this.initializeBase(baseUrl);
        const url = new URL('/api/quote-equity', baseUrl);
        url.searchParams.set('symbol', symbol);
        const headers: Record<string, string> = {
          Accept: 'application/json, text/plain, */*',
          Referer: baseUrl + '/get-quotes/equity?symbol=' + encodeURIComponent(symbol),
          Origin: baseUrl,
          'User-Agent': 'Mozilla/5.0 (compatible; NseFundamentalResearch/1.0)',
        };
        const cookie = this.cookies.get(baseUrl) ?? '';
        if (cookie) headers.Cookie = cookie;
        const response = await this.fetchImpl(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        if (response.url) {
          const finalUrl = new URL(response.url);
          if (finalUrl.protocol !== 'https:' || !HOSTS.has(finalUrl.hostname)
              || finalUrl.port !== '' || finalUrl.username !== '' || finalUrl.password !== ''
              || finalUrl.pathname !== '/api/quote-equity'
              || finalUrl.searchParams.get('symbol')?.toUpperCase() !== symbol) {
            throw new Error('quote-equity redirected outside the official NSE endpoint');
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
        if (record.isin && !ISIN_RE.test(record.isin)) throw new Error('NSE quote-equity returned invalid ISIN');
        if (!buildNseIndustryText(record)) throw new Error('NSE quote-equity returned no official industry classification');
        return record;
      } catch (error) {
        failures.push(baseUrl + ': ' + (error as Error).message);
      }
    }
    throw new Error('NSE official quote-equity lookup failed on all allowed domains: ' + failures.join(' | '));
  }
}

export async function fetchNseIssuerIndustry(
  rawSymbol: string,
  fetchImpl: typeof fetch = fetch,
): Promise<NseIssuerIndustryRecord> {
  const client = new NseIssuerIndustryClient({ fetchImpl });
  return client.fetchIssuerIndustry(rawSymbol);
}
