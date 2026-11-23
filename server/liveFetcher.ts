import fs from 'node:fs';
import path from 'node:path';
import { parseBhavDateToIso } from './csvParser.ts';

import type {
  FundamentalCollectionStatus,
  MarketCapCategory,
  XbrlFiling,
} from '../src/types/trading.ts';

export function toIstDateIso(d: Date = new Date()): string {
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function classifyMarketCap(marketCapInr: number | null | undefined): {
  marketCapCr: number | null;
  marketCapCategory: MarketCapCategory;
} {
  if (marketCapInr === null || marketCapInr === undefined || !Number.isFinite(marketCapInr) || marketCapInr <= 0) {
    return { marketCapCr: null, marketCapCategory: 'UNKNOWN' };
  }
  const marketCapCr = Math.round(marketCapInr / 1e7);
  if (marketCapCr >= 20000) return { marketCapCr, marketCapCategory: 'LARGE_CAP' };
  if (marketCapCr >= 5000) return { marketCapCr, marketCapCategory: 'MID_CAP' };
  if (marketCapCr > 0) return { marketCapCr, marketCapCategory: 'SMALL_CAP' };
  return { marketCapCr: null, marketCapCategory: 'UNKNOWN' };
}

export interface LiveFundamentalRecord {
  symbol: string;
  asOfDate: string;
  source: string;
  sourceUrl: string;
  financialPeriodEnd: string;
  publicationDate?: string;
  officialFilingUrl?: string;
  officialFilingSource?: string;
  sources?: string[];
  providerSector: string;
  revenueGrowthPct: number | null;
  profitGrowthPct: number | null;
  roePct: number | null;
  rocePct: number | null;
  debtToEquity: number | null;
  interestCoverage: number | null;
  operatingCashFlowInr: number | null;
  freeCashFlowInr: number | null;
  trailingPE: number | null;
  priceToBook: number | null;
  marketCapInr: number | null;
  enterpriseValueInr: number | null;
  dividendYieldPct: number | null;
  promoterHoldingPct?: number | null;
  epsPrev?: number | null;
  epsCurr?: number | null;
  epsPrevPeriod?: string;
  epsCurrPeriod?: string;
  epsTtmPrev?: number | null;
  epsTtmCurr?: number | null;
  firstTradeDateIso?: string;
  nextEarningsDate?: string;
  companyName?: string;
  fetchedAtUtc: string;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function fetchYahooFundamentalsForSymbol(
  symbol: string,
  _xbrlFilings?: XbrlFiling[],
  _forceBseProbe = false
): Promise<LiveFundamentalRecord> {
  const sym = symbol.trim().toUpperCase();
  throw new Error(`YAHOO_FUNDAMENTALS_DISABLED: ${sym} — fundamentals must be fetched through the official NSE service only.`);
}

export async function saveSymbolFundamentalsToCache(
  symbol: string,
  _xbrlFilings?: XbrlFiling[],
  _forceBseProbe = false
): Promise<{
  record: LiveFundamentalRecord | null;
  totalSavedCount: number;
  error?: string;
}> {
  const sym = symbol.trim().toUpperCase();
  return {
    record: null,
    totalSavedCount: 0,
    error: `NSE_FUNDAMENTAL_SERVICE_REQUIRED: Yahoo/BSE fundamental collection is disabled for ${sym}.`,
  };
}

export async function ensureLiveFundamentalsForSymbol(
  _symbol: string,
  _xbrlFilings?: XbrlFiling[]
): Promise<LiveFundamentalRecord | null> {
  // Never return legacy Yahoo/BSE cache values as current NSE fundamentals.
  return null;
}

export async function refreshFundamentalsBatch(
  symbols: string[],
  _xbrlBySymbol?: Map<string, XbrlFiling[]>,
  _forceBseProbe = false
): Promise<{
  succeeded: string[];
  failed: Array<{ symbol: string; error: string }>;
}> {
  return {
    succeeded: [],
    failed: symbols.map((symbol) => ({
      symbol,
      error: 'NSE_FUNDAMENTAL_SERVICE_REQUIRED: legacy Yahoo/BSE batch collection is disabled.',
    })),
  };
}

let collectionStatus: FundamentalCollectionStatus = {
  running: false,
  scope: '',
  total: 0,
  processed: 0,
  succeeded: 0,
  failed: 0,
  nseXbrlHits: 0,
  yahooNsHits: 0,
  bseBoHits: 0,
  currentSymbol: '',
  startedAtUtc: '',
  finishedAtUtc: '',
  lastError: null,
};

export function getCollectionJobStatus(): FundamentalCollectionStatus {
  return { ...collectionStatus };
}

export function startFullFundamentalCollection(
  symbols: string[],
  _scope: string,
  _xbrlBySymbol: Map<string, XbrlFiling[]>,
  _onCheckpointReload: () => void
): FundamentalCollectionStatus {
  collectionStatus = {
    running: false,
    scope: 'BLOCKED_LEGACY_YAHOO',
    total: symbols.length,
    processed: 0,
    succeeded: 0,
    failed: symbols.length,
    nseXbrlHits: 0,
    yahooNsHits: 0,
    bseBoHits: 0,
    currentSymbol: '',
    startedAtUtc: new Date().toISOString(),
    finishedAtUtc: new Date().toISOString(),
    lastError: 'NSE_FUNDAMENTAL_SERVICE_REQUIRED: legacy Yahoo/BSE collection is disabled.',
  };
  return getCollectionJobStatus();
}

export async function fetchNseBhavcopyForDate(
  targetIsoDate?: string
): Promise<{
  status: 'DOWNLOADED' | 'ALREADY_CACHED' | 'UNAVAILABLE';
  date: string;
  filePath?: string;
  rowsCount?: number;
  message: string;
}> {
  const candidates: string[] = [];
  if (targetIsoDate && /^\d{4}-\d{2}-\d{2}$/.test(targetIsoDate)) {
    candidates.push(targetIsoDate);
  } else {
    // Check IST today and walk back up to 5 calendar days for latest trading session
    const nowIst = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    for (let offset = 0; offset < 6; offset++) {
      const d = new Date(nowIst.getTime() - offset * 24 * 60 * 60 * 1000);
      const dayOfWeek = d.getUTCDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      candidates.push(d.toISOString().slice(0, 10));
    }
  }

  const deliveryDir = path.join(process.cwd(), 'data', 'cache', 'delivery');
  fs.mkdirSync(deliveryDir, { recursive: true });

  const errors: string[] = [];

  for (const iso of candidates) {
    const [yyyy, mm, dd] = iso.split('-');
    const token = `${dd}${mm}${yyyy}`;
    const filename = `sec_bhavdata_full_${token}.csv`;
    const filePath = path.join(deliveryDir, filename);

    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
      return {
        status: 'ALREADY_CACHED',
        date: iso,
        filePath: filename,
        message: `Latest available NSE Bhavcopy (${iso}) is already cached locally.`,
      };
    }

    const url = `https://nsearchives.nseindia.com/products/content/${filename}`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: 'text/csv,text/plain,*/*',
          Referer: 'https://www.nseindia.com/',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        errors.push(`${iso}: HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      if (!text || text.trimStart().toLowerCase().startsWith('<html') || text.trimStart().startsWith('<!')) {
        errors.push(`${iso}: NSE returned HTML instead of CSV`);
        continue;
      }
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 100) {
        errors.push(`${iso}: CSV too short (${lines.length} lines)`);
        continue;
      }
      const headers = lines[0].split(',').map((h) => h.trim().toUpperCase());
      const dateIdx = headers.indexOf('DATE1');
      if (dateIdx < 0 || !headers.includes('SYMBOL') || !headers.includes('DELIV_PER')) {
        errors.push(`${iso}: Required Bhavcopy columns missing`);
        continue;
      }
      // Integrity check matching delivery_filter.py validate_delivery_report_date
      const sampleDateRaw = lines[1].split(',')[dateIdx] || '';
      const parsedDate = parseBhavDateToIso(sampleDateRaw);
      if (parsedDate !== iso) {
        errors.push(`${iso}: Internal DATE1 (${parsedDate}) mismatches filename date`);
        continue;
      }

      fs.writeFileSync(filePath, text, 'utf-8');
      return {
        status: 'DOWNLOADED',
        date: iso,
        filePath: filename,
        rowsCount: lines.length - 1,
        message: `Downloaded and validated NSE Bhavcopy for ${iso} (${lines.length - 1} rows).`,
      };
    } catch (err) {
      errors.push(`${iso}: ${(err as Error).message}`);
    }
  }

  return {
    status: 'UNAVAILABLE',
    date: candidates[0] || '',
    message: `No newer NSE Bhavcopy available yet (${errors.join(' | ') || 'no trading days matched'}).`,
  };
}

export async function syncLatestBhavcopiesCatchup(lookbackCalendarDays = 10): Promise<{
  downloadedDates: string[];
  latestCachedDate: string;
  todayIstIso: string;
  todayPublishedYet: boolean;
  checkedDates: string[];
  message: string;
}> {
  const deliveryDir = path.join(process.cwd(), 'data', 'cache', 'delivery');
  fs.mkdirSync(deliveryDir, { recursive: true });

  const nowIst = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const todayIstIso = nowIst.toISOString().slice(0, 10);

  // Build weekday candidates ordered oldest -> newest so multi-day catchup fills chronologically
  const candidates: string[] = [];
  for (let offset = lookbackCalendarDays; offset >= 0; offset--) {
    const d = new Date(nowIst.getTime() - offset * 24 * 60 * 60 * 1000);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    candidates.push(d.toISOString().slice(0, 10));
  }

  const downloadedDates: string[] = [];
  const checkedDates: string[] = [];
  let todayPublishedYet = false;

  for (const iso of candidates) {
    checkedDates.push(iso);
    const [yyyy, mm, dd] = iso.split('-');
    const token = `${dd}${mm}${yyyy}`;
    const filename = `sec_bhavdata_full_${token}.csv`;
    const filePath = path.join(deliveryDir, filename);

    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
      if (iso === todayIstIso) todayPublishedYet = true;
      continue;
    }

    const url = `https://nsearchives.nseindia.com/products/content/${filename}`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: 'text/csv,text/plain,*/*',
          Referer: 'https://www.nseindia.com/',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text || text.trimStart().toLowerCase().startsWith('<html') || text.trimStart().startsWith('<!')) {
        continue;
      }
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 100) continue;
      const headers = lines[0].split(',').map((h) => h.trim().toUpperCase());
      const dateIdx = headers.indexOf('DATE1');
      if (dateIdx < 0 || !headers.includes('SYMBOL') || !headers.includes('DELIV_PER')) {
        continue;
      }
      const sampleDateRaw = lines[1].split(',')[dateIdx] || '';
      const parsedDate = parseBhavDateToIso(sampleDateRaw);
      if (parsedDate !== iso) continue;

      fs.writeFileSync(filePath, text, 'utf-8');
      downloadedDates.push(iso);
      if (iso === todayIstIso) todayPublishedYet = true;
    } catch {
      // Ignore holidays / not-yet-published EOD files
    }
  }

  // Determine actual latest cached ISO date
  const cachedIsos = fs
    .readdirSync(deliveryDir)
    .map((f) => {
      const m = f.match(/^sec_bhavdata_full_(\d{2})(\d{2})(\d{4})\.csv$/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
    })
    .filter(Boolean)
    .sort();
  const latestCachedDate = cachedIsos[cachedIsos.length - 1] || '';

  const isWeekdayToday = [1, 2, 3, 4, 5].includes(nowIst.getUTCDay());
  const pendingNote =
    isWeekdayToday && !todayPublishedYet && latestCachedDate < todayIstIso
      ? ` (Note: Today's ${todayIstIso} Bhavcopy is published by NSE after market close ~18:00 IST)`
      : '';

  const message =
    downloadedDates.length > 0
      ? `Downloaded ${downloadedDates.length} new Bhavcopy session(s): ${downloadedDates.join(', ')}. Latest EOD: ${latestCachedDate}.${pendingNote}`
      : `Scanner synced to latest available NSE Bhavcopy (${latestCachedDate}).${pendingNote}`;

  return {
    downloadedDates,
    latestCachedDate,
    todayIstIso,
    todayPublishedYet,
    checkedDates,
    message,
  };
}
