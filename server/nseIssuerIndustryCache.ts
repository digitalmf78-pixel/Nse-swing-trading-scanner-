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

const CACHE_FILE = path.join(process.cwd(), 'data', 'research', 'nse_official_issuer_industry.json');
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const HOSTS = new Set(['www.nseindia.in', 'www.nseindia.com']);

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
        || (row.isin !== '' && !ISIN_RE.test(row.isin))) {
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

export async function fetchNseIssuerIndustry(
  rawSymbol: string,
  fetchImpl: typeof fetch = fetch,
): Promise<NseIssuerIndustryRecord> {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!/^[A-Z0-9&.-]{1,24}$/.test(symbol)) throw new Error('Invalid NSE symbol for industry lookup');
  const url = new URL('https://www.nseindia.in/api/quote-equity');
  url.searchParams.set('symbol', symbol);
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
      Referer: 'https://www.nseindia.in/get-quotes/equity?symbol=' + encodeURIComponent(symbol),
      'User-Agent': 'Mozilla/5.0 (compatible; NseFundamentalResearch/1.0)',
    },
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
