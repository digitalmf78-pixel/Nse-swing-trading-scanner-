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
