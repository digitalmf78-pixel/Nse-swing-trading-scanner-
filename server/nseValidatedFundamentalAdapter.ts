import type { FundamentalProfile as ValidatedFundamentalProfile } from '../research/fundamental_pilot/fundamental_profile.ts';
import type { NseValidatedFundamentalCache } from './nseValidatedFundamentalCache.ts';

export interface NseScannerFundamentalPatch {
  symbol: string;
  financialPeriodEnd: string;
  publicationDate: string;
  officialFilingUrl: string;
  revenueGrowthPct: number | null;
  profitGrowthPct: number | null;
  roePct: number | null;
  rocePct: number | null;
  debtToEquity: number | null;
  interestCoverage: number | null;
  operatingCashFlowInr: number | null;
  fundamentalSources: string[];
  conflict: boolean;
}

const EXPECTED_UNITS = {
  REVENUE_GROWTH: 'PERCENT',
  PROFIT_GROWTH: 'PERCENT',
  ROE: 'PERCENT',
  ROCE: 'PERCENT',
  DEBT_EQUITY: 'RATIO',
  INTEREST_COVERAGE: 'RATIO',
  OPERATING_CASH_FLOW: 'INR',
} as const;

/**
 * Converts only a single unambiguous latest-period validated NSE profile.
 * Multiple distinct profiles for the same latest period are treated as a conflict:
 * no metric from that issuer is released to the scanner until revision resolution exists.
 */
export function selectNseScannerFundamentalPatches(
  cache: NseValidatedFundamentalCache,
): Map<string, NseScannerFundamentalPatch> {
  const output = new Map<string, NseScannerFundamentalPatch>();
  for (const [symbol, entry] of Object.entries(cache.symbols)) {
    const profiles = entry.profiles.map(item => item.profile as ValidatedFundamentalProfile);
    if (!profiles.length) continue;
    const latestPeriod = profiles.reduce((latest, profile) => profile.periodEnd > latest ? profile.periodEnd : latest, '');
    const latest = profiles.filter(profile => profile.periodEnd === latestPeriod);
    const conflict = latest.length !== 1;
    const profile = latest[0];
    const metricValue = (key: keyof typeof EXPECTED_UNITS): number | null => {
      if (conflict || !profile) return null;
      const metric = profile.metrics[key];
      if (metric.status !== 'VALIDATED' || metric.value === null || metric.unit !== EXPECTED_UNITS[key]) return null;
      return metric.value;
    };
    const validatedFilings = conflict || !profile ? [] : Object.values(profile.metrics)
      .filter(metric => metric.status === 'VALIDATED')
      .flatMap(metric => metric.filings);
    const latestFiling = validatedFilings.sort((a,b) => b.publishedAt.localeCompare(a.publishedAt))[0];
    output.set(symbol, {
      symbol,
      financialPeriodEnd: latestPeriod,
      publicationDate: latestFiling?.publishedAt ?? '',
      officialFilingUrl: latestFiling?.sourceUrl ?? '',
      revenueGrowthPct: metricValue('REVENUE_GROWTH'),
      profitGrowthPct: metricValue('PROFIT_GROWTH'),
      roePct: metricValue('ROE'),
      rocePct: metricValue('ROCE'),
      debtToEquity: metricValue('DEBT_EQUITY'),
      interestCoverage: metricValue('INTEREST_COVERAGE'),
      operatingCashFlowInr: metricValue('OPERATING_CASH_FLOW'),
      fundamentalSources: conflict ? [] : ['NSE Official XBRL (validated)'],
      conflict,
    });
  }
  return output;
}


import type { FundamentalProfile as ScannerFundamentalProfile } from '../src/types/trading.ts';

/**
 * Makes the seven scanner decision metrics NSE-validated-only.
 * Legacy CSV/free-source/Yahoo values are cleared before validated cache patches
 * are applied; non-core fields (EPS, valuation, holdings) are left untouched.
 */
export function applyNseValidatedFundamentalPatches(
  existing: Map<string, ScannerFundamentalProfile>,
  patches: Map<string, NseScannerFundamentalPatch>,
): Map<string, ScannerFundamentalProfile> {
  const output = new Map<string, ScannerFundamentalProfile>();
  for (const [rawSymbol, profile] of existing) {
    const symbol = rawSymbol.trim().toUpperCase();
    const sourceText = [profile.source, ...(profile.fundamentalSources || [])].filter(Boolean).join(' ');
    const hasLegacyYahooFundamentals = /yahoo|yfinance|\.ns|\.bo|bse/i.test(sourceText);
    output.set(symbol, {
      ...profile,
      revenueGrowthPct: null,
      profitGrowthPct: null,
      roePct: null,
      rocePct: null,
      debtToEquity: null,
      interestCoverage: null,
      operatingCashFlowInr: null,
      trailingPE: hasLegacyYahooFundamentals ? null : profile.trailingPE,
      epsPrev: hasLegacyYahooFundamentals ? null : profile.epsPrev,
      epsCurr: hasLegacyYahooFundamentals ? null : profile.epsCurr,
      epsTtmPrev: hasLegacyYahooFundamentals ? null : profile.epsTtmPrev,
      epsTtmCurr: hasLegacyYahooFundamentals ? null : profile.epsTtmCurr,
      epsPrevPeriod: hasLegacyYahooFundamentals ? '' : profile.epsPrevPeriod,
      epsCurrPeriod: hasLegacyYahooFundamentals ? '' : profile.epsCurrPeriod,
      fundamentalSources: (profile.fundamentalSources || []).filter(source =>
        !/yahoo|yfinance|\.ns|\.bo|bse|free source|csv baseline/i.test(source)
      ),
      fundamentalRemark: hasLegacyYahooFundamentals
        ? 'Legacy Yahoo/BSE EPS and P/E values withheld; NSE validated values required'
        : profile.fundamentalRemark,
    });
  }
  for (const [rawSymbol, patch] of patches) {
    const symbol = rawSymbol.trim().toUpperCase();
    const current = output.get(symbol);
    if (!current) continue;
    output.set(symbol, {
      ...current,
      financialPeriodEnd: patch.financialPeriodEnd,
      publicationDate: patch.publicationDate,
      officialFilingUrl: patch.officialFilingUrl,
      officialFilingSource: patch.officialFilingUrl ? 'NSE Official XBRL' : '',
      revenueGrowthPct: patch.revenueGrowthPct,
      profitGrowthPct: patch.profitGrowthPct,
      roePct: patch.roePct,
      rocePct: patch.rocePct,
      debtToEquity: patch.debtToEquity,
      interestCoverage: patch.interestCoverage,
      operatingCashFlowInr: patch.operatingCashFlowInr,
      fundamentalSources: patch.conflict ? [] : patch.fundamentalSources,
      fundamentalRemark: patch.conflict
        ? 'NSE validated profile conflict — metrics withheld'
        : 'NSE validated metrics only; unvalidated metrics withheld',
    });
  }
  return output;
}
