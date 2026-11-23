import fs from 'node:fs';
import path from 'node:path';

export interface NseEquityMasterRecord {
  symbol: string;
  companyName: string;
  series: string;
  listingDate: string;
  isin: string;
}
export interface NseEquityMasterCache {
  schemaVersion: 1;
  source: 'NSE_OFFICIAL_EQUITY_L';
  sourceUrl: string;
  fetchedAtUtc: string;
  symbols: Record<string, NseEquityMasterRecord>;
}

const SOURCE_URL = 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv';
const CACHE_FILE = path.join(process.cwd(), 'data', 'research', 'nse_official_equity_master.json');

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else value += ch;
  }
  values.push(value.trim());
  return values;
}

function normalizeHeader(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function parseNseEquityMasterCsv(csv: string): Record<string, NseEquityMasterRecord> {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) throw new Error('NSE equity master CSV is empty');
  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const index = (names: string[]) => headers.findIndex(header => names.includes(header));
  const symbolIndex = index(['SYMBOL']);
  const companyIndex = index(['NAMEOFCOMPANY', 'COMPANYNAME']);
  const seriesIndex = index(['SERIES']);
  const listingIndex = index(['DATEOFLISTING', 'LISTINGDATE']);
  const isinIndex = index(['ISINNUMBER', 'ISIN']);
  if (symbolIndex < 0 || isinIndex < 0) throw new Error('NSE equity master CSV is missing Symbol or ISIN Number columns');

  const symbols: Record<string, NseEquityMasterRecord> = {};
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const symbol = (cells[symbolIndex] ?? '').trim().toUpperCase();
    const isin = (cells[isinIndex] ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9&.-]{1,24}$/.test(symbol) || !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) continue;
    const record: NseEquityMasterRecord = {
      symbol,
      companyName: companyIndex >= 0 ? (cells[companyIndex] ?? '').trim() : '',
      series: seriesIndex >= 0 ? (cells[seriesIndex] ?? '').trim().toUpperCase() : '',
      listingDate: listingIndex >= 0 ? (cells[listingIndex] ?? '').trim() : '',
      isin,
    };
    const previous = symbols[symbol];
    if (previous && previous.isin !== isin) {
      throw new Error('Conflicting ISIN values for NSE symbol ' + symbol);
    }
    symbols[symbol] = record;
  }
  if (Object.keys(symbols).length === 0) throw new Error('NSE equity master CSV contained no valid symbol/ISIN rows');
  return symbols;
}

export function loadNseEquityMasterCache(file = CACHE_FILE): NseEquityMasterCache {
  if (!fs.existsSync(file)) return {
    schemaVersion: 1, source: 'NSE_OFFICIAL_EQUITY_L', sourceUrl: SOURCE_URL,
    fetchedAtUtc: '', symbols: {},
  };
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<NseEquityMasterCache>;
  if (parsed.schemaVersion !== 1 || parsed.source !== 'NSE_OFFICIAL_EQUITY_L'
      || !parsed.symbols || typeof parsed.symbols !== 'object' || Array.isArray(parsed.symbols)) {
    throw new Error('NSE equity master cache schema invalid; refusing to overwrite');
  }
  for (const [symbol, row] of Object.entries(parsed.symbols)) {
    if (symbol !== symbol.toUpperCase() || row.symbol !== symbol
        || !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(row.isin)) {
      throw new Error('NSE equity master cache identity validation failed for ' + symbol);
    }
  }
  return {
    schemaVersion: 1, source: 'NSE_OFFICIAL_EQUITY_L', sourceUrl: SOURCE_URL,
    fetchedAtUtc: parsed.fetchedAtUtc ?? '', symbols: parsed.symbols,
  };
}

export async function fetchNseEquityMaster(
  fetchImpl: typeof fetch = fetch,
): Promise<NseEquityMasterCache> {
  const response = await fetchImpl(SOURCE_URL, {
    method: 'GET',
    headers: {
      Accept: 'text/csv,application/csv,*/*',
      Referer: 'https://www.nseindia.com/',
      'User-Agent': 'Mozilla/5.0 (compatible; NseFundamentalResearch/1.0)',
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('NSE equity master returned HTTP ' + response.status);
  if (response.url) {
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== 'https:' || finalUrl.hostname !== 'nsearchives.nseindia.com'
        || finalUrl.port !== '' || finalUrl.username !== '' || finalUrl.password !== '') {
      throw new Error('NSE equity master redirected outside the official NSE archive host');
    }
  }
  const csv = await response.text();
  if (csv.length === 0 || csv.length > 20 * 1024 * 1024) throw new Error('NSE equity master response size invalid');
  const cache: NseEquityMasterCache = {
    schemaVersion: 1,
    source: 'NSE_OFFICIAL_EQUITY_L',
    sourceUrl: SOURCE_URL,
    fetchedAtUtc: new Date().toISOString(),
    symbols: parseNseEquityMasterCsv(csv),
  };
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  const temp = CACHE_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, CACHE_FILE);
  return cache;
}
