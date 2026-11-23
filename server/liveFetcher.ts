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

const fxRateCache = new Map<string, { rate: number; expiresAt: number }>();

export async function getFxRateToInr(currency: string): Promise<number> {
  const curr = (currency || '').trim().toUpperCase();
  if (!curr || curr === 'INR') return 1;

  const cached = fxRateCache.get(curr);
  if (cached && Date.now() < cached.expiresAt && cached.rate > 0) {
    return cached.rate;
  }

  const pair = `${curr}INR=X`;
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(pair)}?range=5d&interval=1d`,
      { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(6000) }
    );
    if (res.ok) {
      const json = (await res.json()) as {
        chart?: {
          result?: Array<{
            meta?: { regularMarketPrice?: number };
            indicators?: { quote?: Array<{ close?: Array<number | null> }> };
          }>;
        };
      };
      const entry = json.chart?.result?.[0];
      const metaPx = entry?.meta?.regularMarketPrice;
      const closes = (entry?.indicators?.quote?.[0]?.close ?? []).filter(
        (v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
      );
      const rate =
        typeof metaPx === 'number' && Number.isFinite(metaPx) && metaPx > 0
          ? metaPx
          : closes[closes.length - 1] ?? null;
      if (rate && rate > 0) {
        fxRateCache.set(curr, { rate, expiresAt: Date.now() + 60 * 60 * 1000 });
        return rate;
      }
    }
  } catch {
    // fallback handled below
  }

  if (cached && cached.rate > 0) return cached.rate;
  // Reasonable last-resort static fallbacks only if Yahoo FX endpoint fails transiently
  if (curr === 'USD') return 84.5;
  if (curr === 'EUR') return 90;
  if (curr === 'GBP') return 107;
  return 1;
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

interface ParsedXbrlMetrics {
  periodEnd: string;
  revenueGrowthPct: number | null;
  profitGrowthPct: number | null;
  roePct: number | null;
  debtToEquity: number | null;
  interestCoverage: number | null;
  epsCurr: number | null;
  epsPrev: number | null;
  epsCurrPeriod: string;
  epsPrevPeriod: string;
}

async function fetchAndParseNseXbrl(filing: XbrlFiling): Promise<ParsedXbrlMetrics | null> {
  if (!filing.officialFilingUrl || !filing.officialFilingUrl.startsWith('http')) return null;

  const res = await fetch(filing.officialFilingUrl, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/xml,text/xml,*/*',
      Referer: 'https://www.nseindia.com/',
    },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) return null;
  const xml = await res.text();
  if (!xml || xml.length < 300 || !xml.includes('xbrli:')) return null;

  // Map context id -> { start, end, instant, months }
  interface CtxSpan {
    id: string;
    start?: string;
    end?: string;
    instant?: string;
    days: number;
  }
  const contexts = new Map<string, CtxSpan>();
  for (const m of xml.matchAll(/<xbrli:context[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/xbrli:context>/g)) {
    const id = m[1];
    const body = m[2];
    const start = body.match(/<xbrli:startDate>(\d{4}-\d{2}-\d{2})<\/xbrli:startDate>/)?.[1];
    const end = body.match(/<xbrli:endDate>(\d{4}-\d{2}-\d{2})<\/xbrli:endDate>/)?.[1];
    const instant = body.match(/<xbrli:instant>(\d{4}-\d{2}-\d{2})<\/xbrli:instant>/)?.[1];
    let days = 0;
    if (start && end) {
      days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
    }
    contexts.set(id, { id, start, end, instant, days });
  }

  const readTagByCtx = (tagRegex: RegExp): Map<string, number> => {
    const out = new Map<string, number>();
    for (const m of xml.matchAll(tagRegex)) {
      const ctx = m[1];
      const val = Number(m[2]);
      if (ctx && Number.isFinite(val) && !out.has(ctx)) {
        out.set(ctx, val);
      }
    }
    return out;
  };

  const epsMap = readTagByCtx(
    /<(?:in-capmkt|in-bse-fin):(?:DilutedEarningsLossPerShareFromContinuingAndDiscontinuedOperations|DilutedEarningsLossPerShareFromContinuingOperations|BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations|BasicEarningsLossPerShareFromContinuingOperations)[^>]*contextRef="([^"]+)"[^>]*>([-+]?[\d.]+)</gi
  );
  const revMap = readTagByCtx(
    /<(?:in-capmkt|in-bse-fin):RevenueFromOperations[^>]*contextRef="([^"]+)"[^>]*>([-+]?[\d.]+)</gi
  );
  const patMap = readTagByCtx(
    /<(?:in-capmkt|in-bse-fin):ProfitLossForPeriod[^>]*contextRef="([^"]+)"[^>]*>([-+]?[\d.]+)</gi
  );
  const pbtMap = readTagByCtx(
    /<(?:in-capmkt|in-bse-fin):ProfitBeforeTax[^>]*contextRef="([^"]+)"[^>]*>([-+]?[\d.]+)</gi
  );
  const finCostMap = readTagByCtx(
    /<(?:in-capmkt|in-bse-fin):FinanceCosts[^>]*contextRef="([^"]+)"[^>]*>([-+]?[\d.]+)</gi
  );
  const deMap = readTagByCtx(
    /<(?:in-capmkt|in-bse-fin):DebtEquityRatio[^>]*contextRef="([^"]+)"[^>]*>([-+]?[\d.]+)</gi
  );
  const icMap = readTagByCtx(
    /<(?:in-capmkt|in-bse-fin):InterestServiceCoverageRatio[^>]*contextRef="([^"]+)"[^>]*>([-+]?[\d.]+)</gi
  );
  const equityCapMap = readTagByCtx(
    /<(?:in-capmkt|in-bse-fin):PaidUpValueOfEquityShareCapital[^>]*contextRef="([^"]+)"[^>]*>([-+]?[\d.]+)</gi
  );
  const otherEqMap = readTagByCtx(
    /<(?:in-capmkt|in-bse-fin):OtherEquity[^>]*contextRef="([^"]+)"[^>]*>([-+]?[\d.]+)</gi
  );

  // Identify quarterly durations (80..105 days) sorted newest first
  const qtrCtxs = Array.from(contexts.values())
    .filter((c) => c.start && c.end && c.days >= 75 && c.days <= 105 && (revMap.has(c.id) || epsMap.has(c.id)))
    .sort((a, b) => (b.end || '').localeCompare(a.end || ''));

  const currQtr = qtrCtxs.find((c) => c.id === 'OneD') || qtrCtxs[0];
  const periodEnd = currQtr?.end || filing.financialPeriodEnd || '';

  // Half-year (FourD ~180 days) or 9M for deriving prior quarter when only current Q2 & H1 exist
  const halfYearCtx = Array.from(contexts.values()).find(
    (c) => c.end === periodEnd && c.days >= 170 && c.days <= 195 && (epsMap.has(c.id) || patMap.has(c.id))
  );

  // Prior quarter: look for ~90d context ending 80..110 days before currQtr.end, or derive from FourD - OneD
  let epsCurr: number | null = currQtr ? (epsMap.get(currQtr.id) ?? null) : null;
  let epsPrev: number | null = null;
  let epsPrevPeriod = '';

  if (currQtr?.end) {
    const currMs = Date.parse(`${currQtr.end}T00:00:00Z`);
    const prevQtr = qtrCtxs.find((c) => {
      if (!c.end || c.id === currQtr.id) return false;
      const diff = (currMs - Date.parse(`${c.end}T00:00:00Z`)) / 86400000;
      return diff >= 80 && diff <= 115 && epsMap.has(c.id);
    });
    if (prevQtr) {
      epsPrev = epsMap.get(prevQtr.id) ?? null;
      epsPrevPeriod = prevQtr.end || '';
    } else if (epsCurr !== null && halfYearCtx && epsMap.has(halfYearCtx.id)) {
      epsPrev = Number(((epsMap.get(halfYearCtx.id) as number) - epsCurr).toFixed(2));
      // H1 minus Q2 = Q1 (~3 months earlier)
      const q1Date = new Date(currMs - 92 * 86400000);
      epsPrevPeriod = q1Date.toISOString().slice(0, 10);
    }
  }

  // YoY comparative quarter (~350..380 days before currQtr.end) for revenue & profit growth
  let revenueGrowthPct: number | null = null;
  let profitGrowthPct: number | null = null;
  if (currQtr?.end) {
    const currMs = Date.parse(`${currQtr.end}T00:00:00Z`);
    const yoyCtx = qtrCtxs.find((c) => {
      if (!c.end) return false;
      const diff = (currMs - Date.parse(`${c.end}T00:00:00Z`)) / 86400000;
      return diff >= 340 && diff <= 390;
    });
    if (yoyCtx) {
      const revC = revMap.get(currQtr.id);
      const revP = revMap.get(yoyCtx.id);
      if (revC !== undefined && revP !== undefined && Math.abs(revP) > 0) {
        revenueGrowthPct = ((revC - revP) / Math.abs(revP)) * 100;
      }
      const patC = patMap.get(currQtr.id);
      const patP = patMap.get(yoyCtx.id);
      if (patC !== undefined && patP !== undefined && Math.abs(patP) > 0) {
        profitGrowthPct = ((patC - patP) / Math.abs(patP)) * 100;
      }
    }
  }

  const firstVal = (m: Map<string, number>): number | null => {
    for (const v of m.values()) return v;
    return null;
  };

  const rawDe = currQtr && deMap.has(currQtr.id) ? deMap.get(currQtr.id)! : firstVal(deMap);
  const debtToEquity = rawDe !== null && rawDe >= 0 ? rawDe : null;

  let interestCoverage =
    currQtr && icMap.has(currQtr.id) ? icMap.get(currQtr.id)! : firstVal(icMap);
  if (interestCoverage === null || interestCoverage <= 0.1) {
    let computedIc: number | null = null;
    if (currQtr) {
      const pbt = pbtMap.get(currQtr.id);
      const fc = finCostMap.get(currQtr.id);
      if (pbt !== undefined && fc !== undefined && fc > 0) {
        computedIc = (pbt + fc) / fc;
      }
    }
    interestCoverage = computedIc !== null && computedIc > 0.1 ? computedIc : null;
  }

  let roePct: number | null = null;
  const patCurr = currQtr ? patMap.get(currQtr.id) : undefined;
  const eqCap = firstVal(equityCapMap);
  const othEq = firstVal(otherEqMap);
  if (patCurr !== undefined && eqCap !== null && othEq !== null && eqCap + othEq > 0) {
    roePct = ((patCurr * 4) / (eqCap + othEq)) * 100;
  }

  if (
    epsCurr === null &&
    debtToEquity === null &&
    interestCoverage === null &&
    revenueGrowthPct === null &&
    roePct === null
  ) {
    return null;
  }

  return {
    periodEnd,
    revenueGrowthPct,
    profitGrowthPct,
    roePct,
    debtToEquity,
    interestCoverage,
    epsCurr,
    epsPrev,
    epsCurrPeriod: currQtr?.end || periodEnd,
    epsPrevPeriod,
  };
}

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
