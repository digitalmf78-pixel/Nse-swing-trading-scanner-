import test from 'node:test';
import assert from 'node:assert/strict';
import { runNseFundamentalBatch } from './nse_fundamental_batch_engine.ts';

test('NSE fundamental batch requires at least one issuer', async () => {
  await assert.rejects(
    runNseFundamentalBatch({ issuers: [] }),
    /At least one issuer request is required/,
  );
});

test('NSE fundamental batch bounds concurrency to five workers', async () => {
  await assert.rejects(
    runNseFundamentalBatch({
      issuers: [{
        symbol: 'TEST',
        sector: 'NON_FINANCIAL',
        conceptMap: {
          revenue: 'RevenueFromOperations',
          profit: 'ProfitLossForPeriod',
          profitAttribution: 'STANDALONE_ENTITY',
          operatingCashFlow: 'CashFlowsFromUsedInOperatingActivities',
        },
        current: {
          periodType: 'YTD',
          periodStart: '2026-04-01',
          periodEnd: '2026-09-30',
          basis: 'STANDALONE',
        },
        prior: {
          periodType: 'YTD',
          periodStart: '2025-04-01',
          periodEnd: '2025-09-30',
          basis: 'STANDALONE',
        },
      }],
      concurrency: 6,
    }),
    /concurrency must be an integer from 1 to 5/,
  );
});

test('NSE fundamental batch preserves input order for invalid issuer rows', async () => {
  const report = await runNseFundamentalBatch({
    issuers: [{
      symbol: 'INVALID SYMBOL',
      sector: 'NON_FINANCIAL',
      conceptMap: {
        revenue: 'RevenueFromOperations',
        profit: 'ProfitLossForPeriod',
        profitAttribution: 'STANDALONE_ENTITY',
        operatingCashFlow: 'CashFlowsFromUsedInOperatingActivities',
      },
      current: {
        periodType: 'YTD',
        periodStart: '2026-04-01',
        periodEnd: '2026-09-30',
        basis: 'STANDALONE',
      },
      prior: {
        periodType: 'YTD',
        periodStart: '2025-04-01',
        periodEnd: '2025-09-30',
        basis: 'STANDALONE',
      },
    }],
    fetchImpl: (async () => {
      throw new Error('Fetch must not be called for an invalid symbol');
    }) as typeof fetch,
  });
  assert.equal(report.requested, 1);
  assert.equal(report.blocked, 1);
  assert.equal(report.results[0].symbol, 'INVALID SYMBOL');
  assert.equal(report.results[0].status, 'BLOCKED');
});
