import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyIssuerSector,
  classifyNsePeriodType,
  inferExactPeriodStart,
  parseNseFinancialPeriodEnd,
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

test('sector classification keeps financial issuers out of generic industrial mapping', () => {
  assert.equal(classifyIssuerSector('Private Sector Bank'), 'BANK');
  assert.equal(classifyIssuerSector('Banking'), 'BANK');
  assert.equal(classifyIssuerSector('Public Sector Banks'), 'BANK');
  assert.equal(classifyIssuerSector('Housing Finance'), 'NBFC');
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

test('period start inference requires one shared undimensioned duration context across all mapped metrics', () => {
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
  assert.equal(inferExactPeriodStart(extraction, '2026-06-30', concepts), null);
});
