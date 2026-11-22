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

let cachedCookie = '';
let cachedCrumb = '';
let crumbExpiresAt = 0;

async function getYahooSession(): Promise<{ cookie: string; crumb: string }> {
  if (cachedCookie && cachedCrumb && Date.now() < crumbExpiresAt) {
    return { cookie: cachedCookie, crumb: cachedCrumb };
  }

  const r0 = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(8000),
  });
  const setCookies =
    typeof r0.headers.getSetCookie === 'function'
      ? r0.headers.getSetCookie()
      : [r0.headers.get('set-cookie')].filter((x): x is string => Boolean(x));

  const cookie = setCookies.map((c) => c.split(';')[0]).join('; ');
  const rCrumb = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, Cookie: cookie },
    signal: AbortSignal.timeout(8000),
  });
  if (!rCrumb.ok) {
    throw new Error(`Yahoo crumb fetch failed: HTTP ${rCrumb.status}`);
  }
  const crumb = (await rCrumb.text()).trim();
  if (!crumb) {
    throw new Error('Yahoo Finance returned empty crumb');
  }
  cachedCookie = cookie;
  cachedCrumb = crumb;
  crumbExpiresAt = Date.now() + 15 * 60 * 1000;
  return { cookie, crumb };
}

function rawVal(obj: unknown): number | null {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'number') return Number.isFinite(obj) ? obj : null;
  if (typeof obj === 'object' && 'raw' in (obj as Record<string, unknown>)) {
    const r = (obj as Record<string, unknown>).raw;
    return typeof r === 'number' && Number.isFinite(r) ? r : null;
  }
  return null;
}

function overridesPath(): string {
  return path.join(process.cwd(), 'data', 'research', 'live_fundamental_overrides.json');
}

export function loadLiveFundamentalOverrides(): Record<string, LiveFundamentalRecord> {
  const file = overridesPath();
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLiveFundamentalOverrides(map: Record<string, LiveFundamentalRecord>): void {
  const file = overridesPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmpFile = `${file}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpFile, JSON.stringify(map, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpFile, file);
}

function mergeFundamentalRecords(
  prev: LiveFundamentalRecord | undefined,
  next: LiveFundamentalRecord
): LiveFundamentalRecord {
  if (!prev) return next;
  const mergedSources = Array.from(new Set([...(prev.sources || []), ...(next.sources || [])]));
  const nextPeriodIsNewer =
    Boolean(next.financialPeriodEnd) &&
    Boolean(prev.financialPeriodEnd) &&
    next.financialPeriodEnd > prev.financialPeriodEnd;
  const nextPeriodIsOlder =
    Boolean(next.financialPeriodEnd) &&
    Boolean(prev.financialPeriodEnd) &&
    next.financialPeriodEnd < prev.financialPeriodEnd;
  // Never carry missing metrics from an older reporting period into a newer period.
  // For an older incoming record, retain the newer stored metrics instead.
  const mergePeriodMetric = (nextValue: number | null, prevValue: number | null): number | null =>
    nextPeriodIsNewer ? nextValue : nextPeriodIsOlder ? prevValue : nextValue ?? prevValue;
  const bestPeriod =
    next.financialPeriodEnd && (!prev.financialPeriodEnd || next.financialPeriodEnd >= prev.financialPeriodEnd)
      ? next.financialPeriodEnd
      : prev.financialPeriodEnd;
  return {
    ...prev,
    ...next,
    asOfDate: next.asOfDate || prev.asOfDate,
    source: next.source || prev.source,
    sourceUrl: next.sourceUrl || prev.sourceUrl,
    financialPeriodEnd: bestPeriod,
    publicationDate: next.publicationDate || prev.publicationDate,
    officialFilingUrl: next.officialFilingUrl || prev.officialFilingUrl,
    officialFilingSource: next.officialFilingSource || prev.officialFilingSource,
    sources: mergedSources,
    providerSector: next.providerSector || prev.providerSector,
    companyName: next.companyName || prev.companyName,
    firstTradeDateIso: next.firstTradeDateIso || prev.firstTradeDateIso,
    nextEarningsDate: next.nextEarningsDate || prev.nextEarningsDate,
    revenueGrowthPct: mergePeriodMetric(next.revenueGrowthPct, prev.revenueGrowthPct),
    profitGrowthPct: mergePeriodMetric(next.profitGrowthPct, prev.profitGrowthPct),
    roePct: mergePeriodMetric(next.roePct, prev.roePct),
    rocePct: mergePeriodMetric(next.rocePct, prev.rocePct),
    debtToEquity: mergePeriodMetric(next.debtToEquity, prev.debtToEquity),
    interestCoverage: mergePeriodMetric(next.interestCoverage, prev.interestCoverage),
    operatingCashFlowInr: mergePeriodMetric(next.operatingCashFlowInr, prev.operatingCashFlowInr),
    freeCashFlowInr: mergePeriodMetric(next.freeCashFlowInr, prev.freeCashFlowInr),
    trailingPE: next.trailingPE ?? prev.trailingPE,
    priceToBook: next.priceToBook ?? prev.priceToBook,
    marketCapInr: next.marketCapInr ?? prev.marketCapInr,
    enterpriseValueInr: next.enterpriseValueInr ?? prev.enterpriseValueInr,
    dividendYieldPct: next.dividendYieldPct ?? prev.dividendYieldPct,
    promoterHoldingPct: next.promoterHoldingPct ?? prev.promoterHoldingPct,
    epsPrev: next.epsPrev ?? prev.epsPrev,
    epsCurr: next.epsCurr ?? prev.epsCurr,
    epsPrevPeriod: next.epsPrevPeriod || prev.epsPrevPeriod,
    epsCurrPeriod: next.epsCurrPeriod || prev.epsCurrPeriod,
    epsTtmPrev: next.epsTtmPrev ?? prev.epsTtmPrev,
    epsTtmCurr: next.epsTtmCurr ?? prev.epsTtmCurr,
    fetchedAtUtc: next.fetchedAtUtc || new Date().toISOString(),
  };
}

let writeQueue: Promise<void> = Promise.resolve();

export async function upsertAndSaveFundamentalOverrides(
  records: LiveFundamentalRecord[]
): Promise<number> {
  if (records.length === 0) return 0;
  let totalSaved = 0;
  const op = writeQueue.then(() => {
    const current = loadLiveFundamentalOverrides();
    for (const rec of records) {
      const sym = rec.symbol.trim().toUpperCase();
      if (!sym) continue;
      current[sym] = mergeFundamentalRecords(current[sym], { ...rec, symbol: sym });
    }
    saveLiveFundamentalOverrides(current);
    totalSaved = Object.keys(current).length;
  });
  writeQueue = op.catch(() => {});
  await op;
  return totalSaved;
}

interface TimeseriesPoint {
  asOfDate: string;
  value: number;
}

async function fetchYahooTimeseriesForTicker(
  tickerWithSuffix: string
): Promise<{ map: Record<string, TimeseriesPoint[]>; currencyCode: string }> {
  const types = [
    'annualTotalRevenue',
    'annualNetIncome',
    'annualEBIT',
    'annualOperatingIncome',
    'annualInterestExpense',
    'annualTotalAssets',
    'annualCurrentLiabilities',
    'annualStockholdersEquity',
    'annualTotalDebt',
    'annualOperatingCashFlow',
    'annualFreeCashFlow',
    'trailingTotalRevenue',
    'trailingNetIncome',
    'trailingEBIT',
    'trailingOperatingIncome',
    'trailingInterestExpense',
    'trailingOperatingCashFlow',
    'quarterlyTotalRevenue',
    'quarterlyNetIncome',
    'quarterlyDilutedEPS',
    'quarterlyBasicEPS',
    'trailingDilutedEPS',
    'trailingBasicEPS',
  ].join(',');

  const period1 = Math.floor(Date.now() / 1000) - 3 * 365 * 24 * 60 * 60;
  const period2 = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const url = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(
    tickerWithSuffix
  )}?type=${types}&period1=${period1}&period2=${period2}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return { map: {}, currencyCode: '' };

  const json = (await res.json()) as {
    timeseries?: {
      result?: Array<
        Record<string, unknown> & { meta?: { type?: string[]; currencyCode?: string } }
      >;
    };
  };

  const out: Record<string, TimeseriesPoint[]> = {};
  let detectedCurrency = '';
  for (const item of json?.timeseries?.result ?? []) {
    const key = item.meta?.type?.[0];
    if (!key) continue;
    const rawArr = item[key];
    if (!Array.isArray(rawArr)) continue;
    const pts: TimeseriesPoint[] = [];
    for (const p of rawArr) {
      if (!p || typeof p !== 'object') continue;
      const obj = p as {
        asOfDate?: string;
        currencyCode?: string;
        reportedValue?: { raw?: number };
      };
      if (!detectedCurrency && typeof obj.currencyCode === 'string' && obj.currencyCode.trim()) {
        detectedCurrency = obj.currencyCode.trim().toUpperCase();
      }
      const val = obj.reportedValue?.raw;
      if (typeof obj.asOfDate === 'string' && typeof val === 'number' && Number.isFinite(val)) {
        pts.push({ asOfDate: obj.asOfDate, value: val });
      }
    }
    if (!detectedCurrency && typeof item.meta?.currencyCode === 'string') {
      detectedCurrency = item.meta.currencyCode.trim().toUpperCase();
    }
    pts.sort((a, b) => a.asOfDate.localeCompare(b.asOfDate));
    if (pts.length > 0) out[key] = pts;
  }
  return { map: out, currencyCode: detectedCurrency };
}

function latestTs(map: Record<string, TimeseriesPoint[]>, key: string): TimeseriesPoint | null {
  const arr = map[key];
  return arr && arr.length > 0 ? arr[arr.length - 1] : null;
}

function yoyTsGrowthPct(
  map: Record<string, TimeseriesPoint[]>,
  key: string
): number | null {
  const arr = map[key];
  if (!arr || arr.length < 2) return null;
  const curr = arr[arr.length - 1].value;
  const prev = arr[arr.length - 2].value;
  if (Math.abs(prev) <= 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

async function fetchYahooSingleExchange(
  sym: string,
  suffix: 'NS' | 'BO'
): Promise<LiveFundamentalRecord> {
  const ticker = `${sym}.${suffix}`;
  const { cookie, crumb } = await getYahooSession();
  const modules = [
    'financialData',
    'defaultKeyStatistics',
    'summaryDetail',
    'assetProfile',
    'majorHoldersBreakdown',
    'calendarEvents',
    'quoteType',
  ].join(',');

  const quoteUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    ticker
  )}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;

  const [tsResult, quoteResult] = await Promise.allSettled([
    fetchYahooTimeseriesForTicker(ticker),
    (async () => {
      let res = await fetch(quoteUrl, {
        headers: { 'User-Agent': UA, Cookie: cookie },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 401) {
        crumbExpiresAt = 0;
        const fresh = await getYahooSession();
        res = await fetch(
          `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
            ticker
          )}?modules=${modules}&crumb=${encodeURIComponent(fresh.crumb)}`,
          { headers: { 'User-Agent': UA, Cookie: fresh.cookie }, signal: AbortSignal.timeout(8000) }
        );
      }
      if (!res.ok) {
        throw new Error(`Yahoo quoteSummary HTTP ${res.status} for ${ticker}`);
      }
      return (await res.json()) as {
        quoteSummary?: { result?: Array<Record<string, Record<string, unknown>>> };
      };
    })(),
  ]);

  const tsPayload = tsResult.status === 'fulfilled' ? tsResult.value : { map: {}, currencyCode: '' };
  const ts = tsPayload.map;
  const quoteJson = quoteResult.status === 'fulfilled' ? quoteResult.value : null;
  const entry = quoteJson?.quoteSummary?.result?.[0];

  if (!entry && Object.keys(ts).length === 0) {
    throw new Error(
      quoteResult.status === 'rejected'
        ? (quoteResult.reason as Error).message
        : `No Yahoo Finance data returned for ${ticker}`
    );
  }

  const fin = entry?.financialData || {};
  const stats = entry?.defaultKeyStatistics || {};
  const detail = entry?.summaryDetail || {};
  const profile = entry?.assetProfile || {};
  const holders = entry?.majorHoldersBreakdown || {};
  const calEvents = entry?.calendarEvents || {};
  const qType = entry?.quoteType || {};

  const financialCurrency = (
    (typeof fin.financialCurrency === 'string' ? fin.financialCurrency : '') ||
    tsPayload.currencyCode ||
    'INR'
  )
    .trim()
    .toUpperCase();
  const quoteCurrency = (typeof detail.currency === 'string' ? detail.currency : 'INR')
    .trim()
    .toUpperCase();
  const [fxFinToInr, fxQuoteToInr] = await Promise.all([
    financialCurrency && financialCurrency !== 'INR' ? getFxRateToInr(financialCurrency) : Promise.resolve(1),
    quoteCurrency && quoteCurrency !== 'INR' ? getFxRateToInr(quoteCurrency) : Promise.resolve(1),
  ]);

  // 1. Revenue Growth YoY (prefer annual timeseries YoY, fallback to financialData)
  let revGrowth = yoyTsGrowthPct(ts, 'annualTotalRevenue');
  if (revGrowth === null) {
    const fg = rawVal(fin.revenueGrowth);
    if (fg !== null) revGrowth = fg * 100;
  }

  // 2. Profit Growth YoY
  let profGrowth = yoyTsGrowthPct(ts, 'annualNetIncome');
  if (profGrowth === null) {
    const eg = rawVal(fin.earningsGrowth);
    if (eg !== null) profGrowth = eg * 100;
  }

  // 3. ROE %
  const netInc =
    latestTs(ts, 'trailingNetIncome')?.value ?? latestTs(ts, 'annualNetIncome')?.value ?? null;
  const equity = latestTs(ts, 'annualStockholdersEquity')?.value ?? null;
  let roePct = rawVal(fin.returnOnEquity);
  if (roePct !== null) {
    roePct = roePct * 100;
  } else if (netInc !== null && equity !== null && equity > 0) {
    roePct = (netInc / equity) * 100;
  }

  // 4. ROCE %
  const ebit =
    latestTs(ts, 'trailingEBIT')?.value ??
    latestTs(ts, 'annualEBIT')?.value ??
    latestTs(ts, 'trailingOperatingIncome')?.value ??
    latestTs(ts, 'annualOperatingIncome')?.value ??
    null;
  const totalAssets = latestTs(ts, 'annualTotalAssets')?.value ?? null;
  const currLiab = latestTs(ts, 'annualCurrentLiabilities')?.value ?? null;
  let rocePct: number | null = null;
  if (ebit !== null && totalAssets !== null && currLiab !== null) {
    const capEmployed = totalAssets - currLiab;
    if (capEmployed > 0) rocePct = (ebit / capEmployed) * 100;
  } else if (ebit !== null && equity !== null) {
    const debt = latestTs(ts, 'annualTotalDebt')?.value ?? rawVal(fin.totalDebt) ?? 0;
    const capEmployed = equity + debt;
    if (capEmployed > 0) rocePct = (ebit / capEmployed) * 100;
  }

  // 5. Debt / Equity (sanitize negative equity -> null)
  let debtToEquity = rawVal(fin.debtToEquity);
  if (debtToEquity !== null) {
    debtToEquity = debtToEquity / 100;
  } else {
    const debt = latestTs(ts, 'annualTotalDebt')?.value ?? rawVal(fin.totalDebt);
    if (debt !== null && equity !== null && equity > 0) {
      debtToEquity = debt / equity;
    }
  }
  if (debtToEquity !== null && debtToEquity < 0) {
    debtToEquity = null;
  }

  // 6. Interest Coverage
  const intExp =
    latestTs(ts, 'trailingInterestExpense')?.value ??
    latestTs(ts, 'annualInterestExpense')?.value ??
    null;
  let interestCoverage: number | null = null;
  if (ebit !== null && intExp !== null && Math.abs(intExp) > 0) {
    interestCoverage = ebit / Math.abs(intExp);
  }

  // 7. Operating & Free Cash Flow (convert statement reporting currency -> INR)
  const rawOcf =
    latestTs(ts, 'trailingOperatingCashFlow')?.value ??
    latestTs(ts, 'annualOperatingCashFlow')?.value ??
    rawVal(fin.operatingCashflow);
  const operatingCashFlowInr = rawOcf !== null ? rawOcf * fxFinToInr : null;
  const rawFcf = latestTs(ts, 'annualFreeCashFlow')?.value ?? rawVal(fin.freeCashflow);
  const freeCashFlowInr = rawFcf !== null ? rawFcf * fxFinToInr : null;

  const qRevDate = latestTs(ts, 'quarterlyTotalRevenue')?.asOfDate || '';
  const aRevDate = latestTs(ts, 'annualTotalRevenue')?.asOfDate || '';
  const aAssetDate = latestTs(ts, 'annualTotalAssets')?.asOfDate || '';
  const qEpsArr =
    (ts.quarterlyDilutedEPS?.length ?? 0) >= 2
      ? ts.quarterlyDilutedEPS
      : (ts.quarterlyBasicEPS?.length ?? 0) >= 2
        ? ts.quarterlyBasicEPS
        : ts.quarterlyDilutedEPS || ts.quarterlyBasicEPS || [];

  const epsCurrPt = qEpsArr.length >= 1 ? qEpsArr[qEpsArr.length - 1] : null;
  const epsPrevPt = qEpsArr.length >= 2 ? qEpsArr[qEpsArr.length - 2] : null;

  const ttmEpsArr =
    (ts.trailingDilutedEPS?.length ?? 0) >= 1
      ? ts.trailingDilutedEPS
      : ts.trailingBasicEPS || [];
  const epsTtmCurrPt = ttmEpsArr.length >= 1 ? ttmEpsArr[ttmEpsArr.length - 1] : null;
  const epsTtmPrevPt = ttmEpsArr.length >= 2 ? ttmEpsArr[ttmEpsArr.length - 2] : null;

  const periodCandidates = [qRevDate, aRevDate, aAssetDate, epsCurrPt?.asOfDate || ''].filter(
    (d) => /^\d{4}-\d{2}-\d{2}$/.test(d)
  );
  periodCandidates.sort((a, b) => b.localeCompare(a));
  const periodEnd = periodCandidates[0] || '';

  const insiderRaw = rawVal(holders.insidersPercentHeld);
  const promoterHoldingPct = insiderRaw !== null ? insiderRaw * 100 : null;
  const tagLabel = suffix === 'BO' ? 'BSE (.BO)' : 'YFinance (.NS)';

  const firstTradeEpoch = rawVal(qType.firstTradeDateEpochUtc);
  const firstTradeDateIso =
    firstTradeEpoch !== null && firstTradeEpoch > 631152000
      ? new Date(firstTradeEpoch * 1000).toISOString().slice(0, 10)
      : '';
  const companyName =
    (typeof qType.longName === 'string' && qType.longName.trim()) ||
    (typeof qType.shortName === 'string' && qType.shortName.trim()) ||
    '';

  let nextEarningsDate = '';
  const earningsNode = calEvents?.earnings as { earningsDate?: Array<{ raw?: number; fmt?: string }> } | undefined;
  const firstEarn = Array.isArray(earningsNode?.earningsDate) ? earningsNode.earningsDate[0] : undefined;
  if (firstEarn?.fmt && /^\d{4}-\d{2}-\d{2}$/.test(firstEarn.fmt)) {
    nextEarningsDate = firstEarn.fmt;
  } else {
    const earnEpoch = rawVal(firstEarn);
    if (earnEpoch !== null && earnEpoch > 1577836800) {
      nextEarningsDate = new Date(earnEpoch * 1000).toISOString().slice(0, 10);
    }
  }

  const rawMarketCap = rawVal(detail.marketCap);
  const rawEv = rawVal(stats.enterpriseValue);
  const marketCapInr = rawMarketCap !== null ? rawMarketCap * fxQuoteToInr : null;
  // stats.enterpriseValue can occasionally follow financialCurrency on ADR/USD reporters if ratio to mcap is ~1/fxFinToInr
  const evFx =
    rawEv !== null &&
    marketCapInr !== null &&
    fxFinToInr > 10 &&
    rawEv > 0 &&
    marketCapInr / rawEv > fxFinToInr * 0.4
      ? fxFinToInr
      : fxQuoteToInr;
  const enterpriseValueInr = rawEv !== null ? rawEv * evFx : null;

  const scaleEps = (val: number | null | undefined): number | null =>
    val !== null && val !== undefined && Number.isFinite(val)
      ? Number((val * fxFinToInr).toFixed(2))
      : null;

  return {
    symbol: sym,
    asOfDate: toIstDateIso(),
    source: suffix === 'BO' ? 'Yahoo Finance BSE (.BO)' : 'Yahoo Finance NSE (.NS)',
    sourceUrl: `https://finance.yahoo.com/quote/${ticker}/financials/`,
    financialPeriodEnd: periodEnd,
    sources: [tagLabel],
    providerSector: typeof profile.sector === 'string' ? profile.sector : '',
    companyName,
    firstTradeDateIso,
    nextEarningsDate,
    revenueGrowthPct: revGrowth,
    profitGrowthPct: profGrowth,
    roePct,
    rocePct,
    debtToEquity,
    interestCoverage,
    operatingCashFlowInr,
    freeCashFlowInr,
    trailingPE: rawVal(detail.trailingPE),
    priceToBook: rawVal(stats.priceToBook),
    marketCapInr,
    enterpriseValueInr,
    dividendYieldPct:
      rawVal(detail.dividendYield) !== null ? (rawVal(detail.dividendYield) as number) * 100 : null,
    promoterHoldingPct,
    epsPrev: scaleEps(epsPrevPt?.value),
    epsCurr: scaleEps(epsCurrPt?.value),
    epsPrevPeriod: epsPrevPt?.asOfDate ?? '',
    epsCurrPeriod: epsCurrPt?.asOfDate ?? '',
    epsTtmPrev: scaleEps(epsTtmPrevPt?.value),
    epsTtmCurr: scaleEps(epsTtmCurrPt?.value),
    fetchedAtUtc: new Date().toISOString(),
  };
}

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
  // ROE must use equity values from the same reporting date as the current quarter.
  // Do not take the first XML values: those may belong to an older or unrelated context.
  const matchingEquityContext = currQtr?.end
    ? Array.from(contexts.values()).find(
        (ctx) =>
          ctx.instant === currQtr.end &&
          equityCapMap.has(ctx.id) &&
          otherEqMap.has(ctx.id)
      )
    : undefined;
  const eqCap = matchingEquityContext
    ? equityCapMap.get(matchingEquityContext.id) ?? null
    : null;
  const othEq = matchingEquityContext
    ? otherEqMap.get(matchingEquityContext.id) ?? null
    : null;
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
  xbrlFilings?: XbrlFiling[],
  forceBseProbe = false
): Promise<LiveFundamentalRecord> {
  const sym = symbol.trim().toUpperCase();

  const [nsRes, xbrlRes] = await Promise.allSettled([
    fetchYahooSingleExchange(sym, 'NS'),
    xbrlFilings && xbrlFilings.length > 0
      ? fetchAndParseNseXbrl(
          xbrlFilings.find((f) => f.filingDescription.toLowerCase().includes('consolidated')) ||
            xbrlFilings[0]
        )
      : Promise.resolve(null),
  ]);

  let primary = nsRes.status === 'fulfilled' ? nsRes.value : null;

  // BSE (.BO) fallback if .NS failed or has missing core fields, or explicitly forced by Audit Verify
  const needsBse =
    forceBseProbe ||
    !primary ||
    primary.epsCurr === null ||
    primary.trailingPE === null ||
    primary.roePct === null ||
    primary.revenueGrowthPct === null;

  let bseRec: LiveFundamentalRecord | null = null;
  if (needsBse) {
    try {
      bseRec = await fetchYahooSingleExchange(sym, 'BO');
    } catch {
      bseRec = null;
    }
  }

  if (!primary && bseRec) {
    primary = bseRec;
  } else if (primary && bseRec) {
    // Supplement missing fields from BSE (.BO) without clobbering newer .NS fields
    const sources = new Set([...(primary.sources || []), 'BSE (.BO)']);
    primary = {
      ...primary,
      sources: Array.from(sources),
      source: `${primary.source} + BSE (.BO)`,
      financialPeriodEnd:
        bseRec.financialPeriodEnd > primary.financialPeriodEnd
          ? bseRec.financialPeriodEnd
          : primary.financialPeriodEnd,
      providerSector: primary.providerSector || bseRec.providerSector,
      companyName: primary.companyName || bseRec.companyName,
      firstTradeDateIso: primary.firstTradeDateIso || bseRec.firstTradeDateIso,
      nextEarningsDate: primary.nextEarningsDate || bseRec.nextEarningsDate,
      revenueGrowthPct: primary.revenueGrowthPct ?? bseRec.revenueGrowthPct,
      profitGrowthPct: primary.profitGrowthPct ?? bseRec.profitGrowthPct,
      roePct: primary.roePct ?? bseRec.roePct,
      rocePct: primary.rocePct ?? bseRec.rocePct,
      debtToEquity: primary.debtToEquity ?? bseRec.debtToEquity,
      interestCoverage: primary.interestCoverage ?? bseRec.interestCoverage,
      operatingCashFlowInr: primary.operatingCashFlowInr ?? bseRec.operatingCashFlowInr,
      freeCashFlowInr: primary.freeCashFlowInr ?? bseRec.freeCashFlowInr,
      trailingPE: primary.trailingPE ?? bseRec.trailingPE,
      priceToBook: primary.priceToBook ?? bseRec.priceToBook,
      marketCapInr: primary.marketCapInr ?? bseRec.marketCapInr,
      enterpriseValueInr: primary.enterpriseValueInr ?? bseRec.enterpriseValueInr,
      dividendYieldPct: primary.dividendYieldPct ?? bseRec.dividendYieldPct,
      promoterHoldingPct: primary.promoterHoldingPct ?? bseRec.promoterHoldingPct,
      epsPrev: primary.epsPrev ?? bseRec.epsPrev,
      epsCurr: primary.epsCurr ?? bseRec.epsCurr,
      epsPrevPeriod: primary.epsPrevPeriod || bseRec.epsPrevPeriod,
      epsCurrPeriod: primary.epsCurrPeriod || bseRec.epsCurrPeriod,
      epsTtmPrev: primary.epsTtmPrev ?? bseRec.epsTtmPrev,
      epsTtmCurr: primary.epsTtmCurr ?? bseRec.epsTtmCurr,
    };
  }

  const xbrl = xbrlRes.status === 'fulfilled' ? xbrlRes.value : null;
  const latestFiling =
    xbrlFilings && xbrlFilings.length > 0
      ? xbrlFilings.find((f) => f.filingDescription.toLowerCase().includes('consolidated')) ||
        xbrlFilings[0]
      : null;

  if (!primary && xbrl && latestFiling) {
    primary = {
      symbol: sym,
      asOfDate: toIstDateIso(),
      source: 'NSE Official Integrated XBRL',
      sourceUrl: latestFiling.officialFilingUrl,
      financialPeriodEnd: xbrl.periodEnd || latestFiling.financialPeriodEnd,
      publicationDate: latestFiling.publicationDate,
      officialFilingUrl: latestFiling.officialFilingUrl,
      officialFilingSource: latestFiling.officialSource,
      sources: ['NSE XBRL'],
      providerSector: '',
      revenueGrowthPct: xbrl.revenueGrowthPct,
      profitGrowthPct: xbrl.profitGrowthPct,
      roePct: xbrl.roePct,
      rocePct: null,
      debtToEquity: xbrl.debtToEquity,
      interestCoverage: xbrl.interestCoverage,
      operatingCashFlowInr: null,
      freeCashFlowInr: null,
      trailingPE: null,
      priceToBook: null,
      marketCapInr: null,
      enterpriseValueInr: null,
      dividendYieldPct: null,
      epsPrev: xbrl.epsPrev,
      epsCurr: xbrl.epsCurr,
      epsPrevPeriod: xbrl.epsPrevPeriod,
      epsCurrPeriod: xbrl.epsCurrPeriod,
      fetchedAtUtc: new Date().toISOString(),
    };
  } else if (primary && xbrl && latestFiling) {
    const sources = new Set(['NSE XBRL', ...(primary.sources || [])]);
    const xbrlNewerOrEqual =
      xbrl.periodEnd &&
      (!primary.financialPeriodEnd || xbrl.periodEnd >= primary.financialPeriodEnd);
    const usableXbrlDe =
      xbrlNewerOrEqual &&
      xbrl.debtToEquity !== null &&
      xbrl.debtToEquity >= 0 &&
      (xbrl.debtToEquity > 0.005 || primary.debtToEquity === null) &&
      !(primary.debtToEquity !== null && primary.debtToEquity > 0.2 && xbrl.debtToEquity < 0.03)
        ? xbrl.debtToEquity
        : null;
    const usableXbrlIc =
      xbrlNewerOrEqual &&
      xbrl.interestCoverage !== null &&
      (xbrl.interestCoverage > 0.1 || primary.interestCoverage === null)
        ? xbrl.interestCoverage
        : null;
    primary = {
      ...primary,
      sources: Array.from(sources),
      source: `NSE XBRL + ${primary.source}`,
      publicationDate: latestFiling.publicationDate || primary.publicationDate,
      officialFilingUrl: latestFiling.officialFilingUrl || primary.officialFilingUrl,
      officialFilingSource: latestFiling.officialSource || primary.officialFilingSource,
      financialPeriodEnd:
        xbrl.periodEnd > primary.financialPeriodEnd ? xbrl.periodEnd : primary.financialPeriodEnd,
      revenueGrowthPct:
        (xbrlNewerOrEqual && xbrl.revenueGrowthPct !== null
          ? xbrl.revenueGrowthPct
          : null) ?? primary.revenueGrowthPct,
      profitGrowthPct:
        (xbrlNewerOrEqual && xbrl.profitGrowthPct !== null
          ? xbrl.profitGrowthPct
          : null) ?? primary.profitGrowthPct,
      roePct: primary.roePct ?? xbrl.roePct,
      debtToEquity: usableXbrlDe ?? primary.debtToEquity,
      interestCoverage: usableXbrlIc ?? primary.interestCoverage,
      epsCurr:
        (xbrlNewerOrEqual && xbrl.epsCurr !== null ? xbrl.epsCurr : null) ?? primary.epsCurr,
      epsPrev:
        (xbrlNewerOrEqual && xbrl.epsPrev !== null ? xbrl.epsPrev : null) ?? primary.epsPrev,
      epsCurrPeriod:
        (xbrlNewerOrEqual && xbrl.epsCurrPeriod ? xbrl.epsCurrPeriod : '') || primary.epsCurrPeriod,
      epsPrevPeriod:
        (xbrlNewerOrEqual && xbrl.epsPrevPeriod ? xbrl.epsPrevPeriod : '') || primary.epsPrevPeriod,
    };
  }

  if (primary && primary.debtToEquity !== null && primary.debtToEquity < 0) {
    primary.debtToEquity = null;
  }

  if (!primary) {
    throw new Error(`Unavailable on NSE XBRL, BSE (.BO), and Yahoo Finance (.NS) for ${sym}`);
  }

  return primary;
}

const EPS_ATTEMPT_CACHE = new Map<string, number>();

export async function saveSymbolFundamentalsToCache(
  symbol: string,
  xbrlFilings?: XbrlFiling[],
  forceBseProbe = true
): Promise<{
  record: LiveFundamentalRecord | null;
  totalSavedCount: number;
  error?: string;
}> {
  const sym = symbol.trim().toUpperCase();
  try {
    const fresh = await fetchYahooFundamentalsForSymbol(sym, xbrlFilings, forceBseProbe);
    const totalSavedCount = await upsertAndSaveFundamentalOverrides([fresh]);
    return { record: fresh, totalSavedCount };
  } catch (err) {
    const current = loadLiveFundamentalOverrides();
    return {
      record: current[sym] ?? null,
      totalSavedCount: Object.keys(current).length,
      error: (err as Error).message,
    };
  }
}

export async function ensureLiveFundamentalsForSymbol(
  symbol: string,
  xbrlFilings?: XbrlFiling[]
): Promise<LiveFundamentalRecord | null> {
  const sym = symbol.trim().toUpperCase();
  const overrides = loadLiveFundamentalOverrides();
  const cached = overrides[sym];
  if (
    cached &&
    cached.epsPrev !== undefined &&
    cached.epsCurr !== undefined &&
    cached.epsCurr !== null &&
    cached.epsTtmCurr !== undefined
  ) {
    return cached;
  }

  const lastTry = EPS_ATTEMPT_CACHE.get(sym) ?? 0;
  if (Date.now() - lastTry < 10 * 60 * 1000) {
    return cached ?? null;
  }
  EPS_ATTEMPT_CACHE.set(sym, Date.now());

  try {
    const fresh = await fetchYahooFundamentalsForSymbol(sym, xbrlFilings);
    await upsertAndSaveFundamentalOverrides([fresh]);
    return fresh;
  } catch {
    return cached ?? null;
  }
}

export async function refreshFundamentalsBatch(
  symbols: string[],
  xbrlBySymbol?: Map<string, XbrlFiling[]>,
  forceBseProbe = false
): Promise<{
  succeeded: string[];
  failed: Array<{ symbol: string; error: string }>;
}> {
  const recordsToSave: LiveFundamentalRecord[] = [];
  const succeeded: string[] = [];
  const failed: Array<{ symbol: string; error: string }> = [];

  const CHUNK_SIZE = 5;
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    const chunk = symbols.slice(i, i + CHUNK_SIZE);
    const settled = await Promise.allSettled(
      chunk.map((sym) => fetchYahooFundamentalsForSymbol(sym, xbrlBySymbol?.get(sym), forceBseProbe))
    );
    settled.forEach((res, idx) => {
      const sym = chunk[idx];
      if (res.status === 'fulfilled') {
        recordsToSave.push(res.value);
        succeeded.push(res.value.symbol);
      } else {
        failed.push({ symbol: sym, error: (res.reason as Error).message });
      }
    });
    if (i + CHUNK_SIZE < symbols.length) {
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  if (recordsToSave.length > 0) {
    await upsertAndSaveFundamentalOverrides(recordsToSave);
  }

  return { succeeded, failed };
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
  scope: string,
  xbrlBySymbol: Map<string, XbrlFiling[]>,
  onCheckpointReload: () => void
): FundamentalCollectionStatus {
  if (collectionStatus.running) {
    return getCollectionJobStatus();
  }

  collectionStatus = {
    running: true,
    scope,
    total: symbols.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
    nseXbrlHits: 0,
    yahooNsHits: 0,
    bseBoHits: 0,
    currentSymbol: symbols[0] || '',
    startedAtUtc: new Date().toISOString(),
    finishedAtUtc: '',
    lastError: null,
  };

  void (async () => {
    let pendingBuffer: LiveFundamentalRecord[] = [];
    const CHUNK_SIZE = 5;

    try {
      for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
        const chunk = symbols.slice(i, i + CHUNK_SIZE);
        collectionStatus.currentSymbol = chunk[0] || '';
        const settled = await Promise.allSettled(
          chunk.map((sym) => fetchYahooFundamentalsForSymbol(sym, xbrlBySymbol.get(sym)))
        );

        settled.forEach((res, idx) => {
          collectionStatus.processed += 1;
          if (res.status === 'fulfilled') {
            const rec = res.value;
            pendingBuffer.push(rec);
            collectionStatus.succeeded += 1;
            const srcs = rec.sources || [];
            if (srcs.includes('NSE XBRL')) collectionStatus.nseXbrlHits += 1;
            if (srcs.includes('YFinance (.NS)')) collectionStatus.yahooNsHits += 1;
            if (srcs.includes('BSE (.BO)')) collectionStatus.bseBoHits += 1;
          } else {
            collectionStatus.failed += 1;
            collectionStatus.lastError = `${chunk[idx]}: ${(res.reason as Error).message}`;
          }
        });

        if (pendingBuffer.length >= 15) {
          const toFlush = pendingBuffer;
          pendingBuffer = [];
          await upsertAndSaveFundamentalOverrides(toFlush);
          onCheckpointReload();
        }

        if (i + CHUNK_SIZE < symbols.length) {
          await new Promise((r) => setTimeout(r, 140));
        }
      }

      if (pendingBuffer.length > 0) {
        await upsertAndSaveFundamentalOverrides(pendingBuffer);
        pendingBuffer = [];
      }
      onCheckpointReload();
    } catch (err) {
      collectionStatus.lastError = (err as Error).message;
    } finally {
      collectionStatus.running = false;
      collectionStatus.currentSymbol = '';
      collectionStatus.finishedAtUtc = new Date().toISOString();
    }
  })();

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
