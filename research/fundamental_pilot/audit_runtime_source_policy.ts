import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const failures: string[] = [];
const passed: string[] = [];
function check(name: string, condition: boolean, detail: string): void {
  (condition ? passed : failures).push((condition ? 'PASS' : 'FAIL') + ' ' + name + (condition ? '' : ': ' + detail));
}
function section(source: string, start: string, end: string): string {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) return '';
  return source.slice(a, b);
}

const live = read('server/liveFetcher.ts');
const pipeline = read('server/nsePipeline.ts');
const service = read('server/nseFundamentalResearchService.ts');
const server = read('server.ts');
const adapter = read('server/nseValidatedFundamentalAdapter.ts');
const ui = read('src/components/FundamentalAuditTable.tsx');
const bot = read('server/swingBotEngine.ts');
const paper = read('server/paperTradeStore.ts');

check(
  'Legacy Yahoo fundamentals fail closed',
  live.includes('YAHOO_FUNDAMENTALS_DISABLED')
    && live.includes('NSE_FUNDAMENTAL_SERVICE_REQUIRED')
    && !/quoteSummary|fundamentals-timeseries|defaultKeyStatistics|incomeStatementHistory|balanceSheetHistory|cashflowStatementHistory/i.test(live),
  'Yahoo fundamental endpoints or a non-blocking legacy fetch path were found in server/liveFetcher.ts',
);

const ensureLoaded = section(pipeline, '  public ensureLoaded(): void {', '  private loadThresholds(root: string): void {');
check(
  'Scanner startup loads only validated NSE metric cache',
  ensureLoaded.includes('this.mergeNseValidatedFundamentals(root)')
    && !/loadFundamentals\(|mergeFreeSourceCache\(|mergeLiveOverrides\(/.test(ensureLoaded),
  'Startup still references a legacy fundamental cache or misses the validated NSE cache',
);

check(
  'Candidate research remains separate from production cache',
  service.includes('CANDIDATE_CACHE_FILE')
    && service.includes('productionApproved: false')
    && service.includes('scannerEligible: false')
    && !service.includes('appendValidatedNseFundamentalProfile')
    && !service.includes('nse_validated_fundamentals.json'),
  'Research service appears to write to or approve production scanner fundamentals',
);

check(
  'Fundamental fetch is limited to latest Bhavcopy symbols',
  server.includes("app.post('/api/refresh/fundamentals'")
    && server.includes("nsePipeline.getAuditCollectionTargets('BHAVCOPY')")
    && server.includes('startNseFundamentalResearchCollection(targets)'),
  'NSE fundamental fetch route is not using the latest Bhavcopy eligible symbol list',
);

check(
  'Candidate reports survive app reload from persistent cache',
  service.includes('function saveCandidateCache')
    && service.includes('fs.renameSync(temp, CANDIDATE_CACHE_FILE)')
    && service.includes('export function getNseFundamentalCandidateReports')
    && section(service, 'export function getNseFundamentalCandidateReports', 'function selectedValue')
      .includes('loadCandidateCache(filePath)')
    && section(service, 'export function getNseFundamentalCandidateReports', 'function selectedValue')
      .includes('filePath = CANDIDATE_CACHE_FILE'),
  'Candidate cache is not atomically persisted and re-read from disk by the candidate API',
);

check(
  'Candidate reports have a separate read-only API and UI',
  server.includes("app.get('/api/fundamentals/nse-candidates'")
    && ui.includes("fetch('/api/fundamentals/nse-candidates?limit=1000')")
    && ui.includes("fetch('/api/refresh/fundamentals'"),
  'Candidate report API or Fundamental Audit UI wiring is missing',
);

check(
  'Scanner adapter clears unapproved metrics before validated NSE patches',
  adapter.includes('revenueGrowthPct: null')
    && adapter.includes('profitGrowthPct: null')
    && adapter.includes('roePct: null')
    && adapter.includes('rocePct: null')
    && adapter.includes('debtToEquity: null')
    && adapter.includes('interestCoverage: null')
    && adapter.includes('operatingCashFlowInr: null'),
  'One or more of the seven core metrics are not cleared before approved NSE patches',
);

check(
  'Bot keeps Yahoo OHLCV only and withholds Yahoo financial statements',
  bot.includes('annualYears: []')
    && bot.includes('const fund = detail.fundamentals')
    && !/quoteSummary|fundamentals-timeseries|fetchYahooSummary|fetchYahooAnnualTimeseries/i.test(bot)
    && bot.includes('fetchYahoo3YChart'),
  'Yahoo financial statement endpoints or cached annual metrics remain in the bot; only Yahoo chart history is allowed',
);

check(
  'Yahoo price path remains quote/chart-only',
  paper.includes('/v8/finance/chart/')
    && paper.includes('fetchLiveYahooQuote')
    && !/quoteSummary|fundamentals-timeseries|defaultKeyStatistics|incomeStatementHistory|balanceSheetHistory|cashflowStatementHistory/i.test(paper),
  'Yahoo paper-trading quote module contains non-price fundamental endpoints',
);

const serverDir = path.join(root, 'server');
const serverFiles = fs.readdirSync(serverDir).filter(file => file.endsWith('.ts'));
const hiddenCalls: string[] = [];
for (const file of serverFiles) {
  const source = fs.readFileSync(path.join(serverDir, file), 'utf8');
  if (file !== 'liveFetcher.ts' && /fetchYahooFundamentalsForSymbol\s*\(/.test(source)) hiddenCalls.push(file + ': fetchYahooFundamentalsForSymbol');
  if (file !== 'liveFetcher.ts' && /refreshFundamentalsBatch\s*\(/.test(source)) hiddenCalls.push(file + ': refreshFundamentalsBatch');
}
check(
  'No hidden server-side Yahoo fundamental fetch callers',
  hiddenCalls.length === 0,
  hiddenCalls.join(', '),
);

console.log('NSE fundamental runtime source-policy audit');
for (const item of passed) console.log(item);
for (const item of failures) console.error(item);
console.log(`\n${passed.length} passed; ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
