import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import {
  appendCandidateReport,
  getNseFundamentalCandidateReports,
  auditXbrlIssuerIdentity,
  loadCandidateCache,
  saveCandidateCache,
  classifyIssuerSector,
  classifyNsePeriodType,
  inferExactPeriodStart,
  parseNseFinancialPeriodEnd,
  resolveGrowthResearchStatus,
  selectLatestComparableFilingPair,
} from '../../server/nseFundamentalResearchService.ts';
import type { NseRevisionRow } from './nse_revision_pair.ts';
import type { XbrlExtraction } from './xbrl_extract.ts';

function row(
  seq: string,
  period: string,
  subtype: 'Original' | 'Revision',
  basis: 'Standalone' | 'Consolidated' = 'Consolidated',
): NseRevisionRow {
  return {
    symbol: 'ABC',
    seq_Id: seq,
    qe_Date: period,
    type: 'Integrated Filing- Financials',
    type_Sub: subtype,
    consolidated: basis,
    xbrl: 'https://nsearchives.nseindia.in/corporate/xbrl/' + seq + '.xml',
  };
}

test('NSE filing date parser validates dates strictly', () => {
  assert.equal(parseNseFinancialPeriodEnd('30-Sep-2026'), '2026-09-30');
  assert.equal(parseNseFinancialPeriodEnd('31-Mar-2026'), '2026-03-31');
  assert.equal(parseNseFinancialPeriodEnd('31-Feb-2026'), null);
  assert.equal(parseNseFinancialPeriodEnd('2026-09-30'), null);
});

test('latest comparable NSE filing pair prefers consolidated and retains revisions', () => {
  const rows = [
    row('100', '30-Sep-2026', 'Original', 'Consolidated'),
    row('101', '30-Sep-2026', 'Revision', 'Consolidated'),
    row('102', '30-Sep-2025', 'Original', 'Consolidated'),
    row('103', '30-Sep-2025', 'Revision', 'Consolidated'),
    row('200', '30-Sep-2026', 'Original', 'Standalone'),
    row('201', '30-Sep-2025', 'Original', 'Standalone'),
  ];
  const pair = selectLatestComparableFilingPair(rows, 'abc');
  assert.ok(pair);
  assert.equal(pair.basis, 'Consolidated');
  assert.equal(pair.currentPeriodEnd, '2026-09-30');
  assert.equal(pair.priorPeriodEnd, '2025-09-30');
  assert.equal(pair.currentRows.length, 2);
  assert.equal(pair.priorRows.length, 2);
});

test('latest comparable filing pair blocks when prior-year Original is missing', () => {
  const pair = selectLatestComparableFilingPair([
    row('100', '30-Sep-2026', 'Original'),
  ], 'ABC');
  assert.equal(pair, null);
});

test('latest period without prior-year pair does not silently fall back to stale older period', () => {
  const pair = selectLatestComparableFilingPair([
    row('100', '30-Sep-2026', 'Original', 'Consolidated'),
    row('90', '30-Jun-2026', 'Original', 'Consolidated'),
    row('80', '30-Jun-2025', 'Original', 'Consolidated'),
  ], 'ABC');
  assert.equal(pair, null);
});

test('latest period may use standalone only when consolidated pair is unavailable at that same period', () => {
  const pair = selectLatestComparableFilingPair([
    row('100', '30-Sep-2026', 'Original', 'Consolidated'),
    row('101', '30-Sep-2025', 'Original', 'Standalone'),
    row('102', '30-Sep-2026', 'Original', 'Standalone'),
  ], 'ABC');
  assert.equal(pair?.basis, 'Standalone');
});

test('sector classification keeps financial issuers out of generic industrial mapping', () => {
  assert.equal(classifyIssuerSector('Private Sector Bank'), 'BANK');
  assert.equal(classifyIssuerSector('Banking'), 'BANK');
  assert.equal(classifyIssuerSector('Public Sector Banks'), 'BANK');
  assert.equal(classifyIssuerSector('Housing Finance'), 'NBFC');
  assert.equal(classifyIssuerSector('Non-Banking Financial Company'), 'NBFC');
  assert.equal(classifyIssuerSector('Life Insurance'), 'INSURANCE');
  assert.equal(classifyIssuerSector('Financial Services'), 'UNKNOWN');
  assert.equal(classifyIssuerSector('Industrial Products'), 'NON_FINANCIAL');
  assert.equal(classifyIssuerSector(''), 'UNKNOWN');
});

test('duration classifier accepts quarter, YTD and FY periods only', () => {
  assert.equal(classifyNsePeriodType('2026-04-01', '2026-06-30'), 'QUARTER');
  assert.equal(classifyNsePeriodType('2026-04-01', '2026-09-30'), 'YTD');
  assert.equal(classifyNsePeriodType('2026-04-01', '2027-03-31'), 'FY');
  assert.equal(classifyNsePeriodType('2026-01-01', '2026-01-31'), null);
});

test('period start inference requires revenue and profit shared undimensioned duration context', () => {
  const extraction: XbrlExtraction = {
    contexts: {
      ctx1: {
        id: 'ctx1', entityScheme: null, entityIdentifier: null,
        periodStart: '2026-04-01', periodEnd: '2026-09-30',
        instant: null, dimensions: [],
      },
      ctx2: {
        id: 'ctx2', entityScheme: null, entityIdentifier: null,
        periodStart: '2026-04-01', periodEnd: '2026-09-30',
        instant: null, dimensions: ['segment=Domestic'],
      },
    },
    units: {},
    facts: [
      { concept: 'ns:RevenueFromOperations', contextRef: 'ctx1', unitRef: null, rawValue: '10', numericValue: 10, decimals: null, scale: null, sign: null, format: null, continuedAt: null, isNil: false, isInline: false },
      { concept: 'ns:ProfitLossForPeriod', contextRef: 'ctx1', unitRef: null, rawValue: '2', numericValue: 2, decimals: null, scale: null, sign: null, format: null, continuedAt: null, isNil: false, isInline: false },
      { concept: 'ns:CashFlowsFromUsedInOperatingActivities', contextRef: 'ctx1', unitRef: null, rawValue: '3', numericValue: 3, decimals: null, scale: null, sign: null, format: null, continuedAt: null, isNil: false, isInline: false },
      { concept: 'ns:RevenueFromOperations', contextRef: 'ctx2', unitRef: null, rawValue: '99', numericValue: 99, decimals: null, scale: null, sign: null, format: null, continuedAt: null, isNil: false, isInline: false },
    ],
    contextCount: 2,
    factCount: 4,
    warnings: [],
  };
  const concepts = {
    revenue: 'ns:RevenueFromOperations',
    profit: 'ns:ProfitLossForPeriod',
    profitAttribution: 'STANDALONE_ENTITY' as const,
    operatingCashFlow: 'ns:CashFlowsFromUsedInOperatingActivities',
  };
  assert.equal(inferExactPeriodStart(extraction, '2026-09-30', concepts), '2026-04-01');
  const withoutOcf: XbrlExtraction = {
    ...extraction,
    facts: extraction.facts.filter(fact => fact.concept !== concepts.operatingCashFlow),
    factCount: 3,
  };
  assert.equal(inferExactPeriodStart(withoutOcf, '2026-09-30', concepts), '2026-04-01');
  assert.equal(inferExactPeriodStart(extraction, '2026-06-30', concepts), null);
});

test('missing OCF does not block independently validated Revenue and Profit Growth candidates', () => {
  assert.equal(
    resolveGrowthResearchStatus('CANDIDATE_ONLY', 'CANDIDATE_ONLY', [
      'REVENUE_GROWTH_INPUT', 'PROFIT_GROWTH_INPUT',
    ]),
    'CANDIDATE_READY',
  );
});

test('growth candidates require both growth revision inputs to be stable', () => {
  assert.equal(
    resolveGrowthResearchStatus('CANDIDATE_ONLY', 'CANDIDATE_ONLY', ['REVENUE_GROWTH_INPUT']),
    'REVISION_REVIEW_REQUIRED',
  );
  assert.equal(
    resolveGrowthResearchStatus('BLOCKED', 'CANDIDATE_ONLY', [
      'REVENUE_GROWTH_INPUT', 'PROFIT_GROWTH_INPUT',
    ]),
    'BLOCKED',
  );
});

function entityExtraction(identifier: string | null = 'INE0ABC01010'): XbrlExtraction {
  return {
    contexts: {
      ctx: {
        id: 'ctx', entityScheme: 'http://www.nseindia.com', entityIdentifier: identifier,
        periodStart: '2026-04-01', periodEnd: '2026-06-30',
        instant: null, dimensions: [],
      },
    },
    units: {},
    facts: [{
      concept: 'ns:RevenueFromOperations', contextRef: 'ctx', unitRef: null,
      rawValue: '10', numericValue: 10, decimals: null, scale: null, sign: null,
      format: null, continuedAt: null, isNil: false, isInline: false,
    }],
    contextCount: 1, factCount: 1, warnings: [],
  };
}

test('XBRL issuer identity must match official NSE ISIN across Original and Revision documents', () => {
  const valid = auditXbrlIssuerIdentity(
    [entityExtraction(), entityExtraction()],
    'INE0ABC01010',
  );
  assert.equal(valid.valid, true);
  assert.equal(valid.entityIdentifier, 'INE0ABC01010');
  assert.equal(valid.documentsChecked, 2);

  const mismatch = auditXbrlIssuerIdentity(
    [entityExtraction(), entityExtraction('INE0XYZ01010')],
    'INE0ABC01010',
  );
  assert.equal(mismatch.valid, false);
  assert.match(mismatch.issues.join(' '), /differs across Original\/Revision/);
  assert.equal(mismatch.documentsChecked, 2);
  const wrongIssuer = auditXbrlIssuerIdentity(
    [entityExtraction('INE0XYZ01010'), entityExtraction('INE0XYZ01010')],
    'INE0ABC01010',
  );
  assert.equal(wrongIssuer.valid, false);
  assert.match(wrongIssuer.issues.join(' '), /does not match the official NSE ISIN/);
});

test('XBRL issuer identity blocks missing entity identifiers and absent official ISIN', () => {
  const missingEntity = auditXbrlIssuerIdentity(
    [entityExtraction(null), entityExtraction(null)],
    'INE0ABC01010',
  );
  assert.equal(missingEntity.valid, false);
  assert.match(missingEntity.issues.join(' '), /missing entity scheme\/identifier/);

  const missingIsin = auditXbrlIssuerIdentity(
    [entityExtraction(), entityExtraction()],
    null,
  );
  assert.equal(missingIsin.valid, false);
  assert.match(missingIsin.issues.join(' '), /Official NSE ISIN is missing or invalid/);
});


test('candidate cache survives a fresh read after process-style restart', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nse-candidate-cache-'));
  const file = path.join(dir, 'nse_fundamental_candidate_cache.json');
  try {
    const cache = { schemaVersion: 1 as const, updatedAtUtc: '', symbols: {} as Record<string, { symbol: string; reports: import('../../server/nseFundamentalResearchService.ts').CandidateCacheEntry[] }> };
    const report = {
      symbol: 'ABC', status: 'BLOCKED' as const, sector: 'UNKNOWN' as const,
      scannerEligible: false as const, productionApproved: false as const,
      warnings: ['Official NSE evidence unavailable; no value inferred.'],
    };
    appendCandidateReport(report, cache);
    saveCandidateCache(cache, file);

    // Read from a genuinely fresh Node process to model a server restart.
    const child = spawnSync(process.execPath, [
      '--experimental-strip-types', '--input-type=module', '-e',
      "import { loadCandidateCache, getNseFundamentalCandidateReports } from './server/nseFundamentalResearchService.ts'; const c = loadCandidateCache(process.argv[1]); const api = getNseFundamentalCandidateReports(undefined, 100, process.argv[1]); process.stdout.write(JSON.stringify({ cache: c, api }));",
      file,
    ], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
    const restarted = JSON.parse(child.stdout);
    const restartedCache = restarted.cache;
    assert.equal(Object.keys(restartedCache.symbols).length, 1);
    assert.equal(restartedCache.symbols.ABC.reports.length, 1);
    assert.equal(restartedCache.symbols.ABC.reports[0].report.symbol, 'ABC');
    assert.equal(restartedCache.symbols.ABC.reports[0].report.warnings[0],
      'Official NSE evidence unavailable; no value inferred.');
    assert.equal(restartedCache.symbols.ABC.reports[0].report.productionApproved, false);
    assert.equal(restarted.api.source, 'NSE_OFFICIAL');
    assert.equal(restarted.api.productionApproved, false);
    assert.equal(restarted.api.symbols, 1);
    assert.equal(restarted.api.reportCount, 1);
    assert.equal(restarted.api.reports[0].report.symbol, 'ABC');
    assert.deepEqual(fs.readdirSync(dir), ['nse_fundamental_candidate_cache.json']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('default candidate cache path persists under app working directory across fresh processes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nse-candidate-default-path-'));
  const serviceUrl = new URL('../../server/nseFundamentalResearchService.ts', import.meta.url).href;
  const report = {
    symbol: 'DEFAULTPATH', status: 'BLOCKED', sector: 'UNKNOWN',
    scannerEligible: false, productionApproved: false,
    warnings: ['Default app cache path persistence check.'],
  };
  try {
    const writerCode = `
      import { appendCandidateReport, saveCandidateCache } from ${JSON.stringify(serviceUrl)};
      const cache = { schemaVersion: 1, updatedAtUtc: '', symbols: {} };
      appendCandidateReport(${JSON.stringify(report)}, cache);
      saveCandidateCache(cache);
    `;
    const writer = spawnSync(process.execPath, [
      '--experimental-strip-types', '--input-type=module', '-e', writerCode,
    ], { cwd: dir, encoding: 'utf8' });
    assert.equal(writer.status, 0, writer.stderr);

    const cacheFile = path.join(dir, 'data', 'research', 'nse_fundamental_candidate_cache.json');
    assert.equal(fs.existsSync(cacheFile), true);

    const readerCode = `
      import { loadCandidateCache, getNseFundamentalCandidateReports } from ${JSON.stringify(serviceUrl)};
      const cache = loadCandidateCache();
      const api = getNseFundamentalCandidateReports(undefined, 100);
      process.stdout.write(JSON.stringify({ cache, api }));
    `;
    const reader = spawnSync(process.execPath, [
      '--experimental-strip-types', '--input-type=module', '-e', readerCode,
    ], { cwd: dir, encoding: 'utf8' });
    assert.equal(reader.status, 0, reader.stderr);
    const restored = JSON.parse(reader.stdout);
    assert.equal(restored.cache.symbols.DEFAULTPATH.reports.length, 1);
    assert.equal(restored.api.symbols, 1);
    assert.equal(restored.api.reportCount, 1);
    assert.equal(restored.api.reports[0].report.symbol, 'DEFAULTPATH');
    assert.equal(restored.api.productionApproved, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


test('candidate cache refuses tampered report hashes and invalid schema', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nse-candidate-cache-invalid-'));
  const file = path.join(dir, 'cache.json');
  try {
    const cache = { schemaVersion: 1 as const, updatedAtUtc: '', symbols: {} as Record<string, { symbol: string; reports: import('../../server/nseFundamentalResearchService.ts').CandidateCacheEntry[] }> };
    appendCandidateReport({
      symbol: 'ABC', status: 'BLOCKED', sector: 'UNKNOWN',
      scannerEligible: false, productionApproved: false, warnings: ['blocked'],
    }, cache);
    saveCandidateCache(cache, file);
    const tampered = JSON.parse(fs.readFileSync(file, 'utf8'));
    tampered.symbols.ABC.reports[0].report.warnings[0] = 'tampered';
    fs.writeFileSync(file, JSON.stringify(tampered));
    assert.throws(() => loadCandidateCache(file), /integrity failed/);

    fs.writeFileSync(file, JSON.stringify({ schemaVersion: 99, symbols: {} }));
    assert.throws(() => loadCandidateCache(file), /schema invalid/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});


test('candidate cache retains multiple distinct reports and deduplicates identical reports', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nse-candidate-cache-history-'));
  const file = path.join(dir, 'cache.json');
  try {
    const cache = { schemaVersion: 1 as const, updatedAtUtc: '', symbols: {} as Record<string, { symbol: string; reports: import('../../server/nseFundamentalResearchService.ts').CandidateCacheEntry[] }> };
    const first = {
      symbol: 'ABC', status: 'BLOCKED' as const, sector: 'UNKNOWN' as const,
      scannerEligible: false as const, productionApproved: false as const,
      warnings: ['First official filing unavailable.'],
    };
    const second = {
      ...first,
      warnings: ['Second filing reviewed; still research-only.'],
    };
    appendCandidateReport(first, cache);
    appendCandidateReport(first, cache);
    appendCandidateReport(second, cache);
    saveCandidateCache(cache, file);

    const restored = loadCandidateCache(file);
    assert.equal(restored.symbols.ABC.reports.length, 2);
    assert.deepEqual(
      restored.symbols.ABC.reports.map(item => item.report.warnings[0]),
      ['First official filing unavailable.', 'Second filing reviewed; still research-only.'],
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('corrupt candidate cache is preserved and never silently replaced with an empty cache', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nse-candidate-cache-preserve-'));
  const file = path.join(dir, 'cache.json');
  try {
    const corruptBytes = '{"schemaVersion":99,"symbols":{}}';
    fs.writeFileSync(file, corruptBytes, 'utf8');
    assert.throws(() => loadCandidateCache(file), /schema invalid/);
    assert.equal(fs.readFileSync(file, 'utf8'), corruptBytes);
    assert.deepEqual(fs.readdirSync(dir), ['cache.json']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
