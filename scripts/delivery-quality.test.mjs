import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFreshness, calculateDeliveryCycles, liquidityFlag, parseCsvLine, parseMainboardSymbols } from './delivery-quality.mjs';

test('recent EOD session is READY', () => {
  assert.deepEqual(assessFreshness('2026-11-23', '2026-11-24'), { ageDays: 1, freshnessStatus: 'FRESH', status: 'READY' });
});
test('weekend gap remains fresh within the configured age window', () => {
  assert.equal(assessFreshness('2026-11-20', '2026-11-23').status, 'READY');
});
test('old session is never labelled READY', () => {
  assert.equal(assessFreshness('2026-11-10', '2026-11-24').status, 'STALE_DATA');
});
test('future or invalid session date fails closed', () => {
  assert.equal(assessFreshness('2026-11-25', '2026-11-24').status, 'STALE_DATA');
  assert.equal(assessFreshness('bad-date', '2026-11-24').status, 'STALE_DATA');
  assert.equal(assessFreshness('2026-02-31', '2026-11-24').status, 'STALE_DATA');
});
test('low volume is review-only and does not alter eligibility', () => {
  assert.equal(liquidityFlag(1), 'LOW_VOLUME_REVIEW');
  assert.equal(liquidityFlag(999), 'LOW_VOLUME_REVIEW');
  assert.equal(liquidityFlag(1000), 'OK');
});
test('official main-board CSV parser validates schema and EQ/BE/BZ rows', () => {
  const rows = ['SYMBOL,NAME OF COMPANY,SERIES,DATE OF LISTING,PAID UP VALUE,MARKET LOT,ISIN NUMBER,FACE VALUE'];
  for (let i = 0; i < 1001; i += 1) rows.push('SYM' + i + ',"Example, Limited",EQ,01-JAN-2020,10,1,INE000A01000,10');
  rows.push('BETA,Example Beta Limited,BE,01-JAN-2020,10,1,INE000B01000,10');
  const symbols = parseMainboardSymbols(rows.join('\n'));
  assert.equal(symbols.size, 1002);
  assert.ok(symbols.has('SYM0'));
  assert.ok(symbols.has('BETA'));
});

test('CSV parser preserves quoted commas and escaped quotes', () => {
  assert.deepEqual(parseCsvLine('ABC,"Example, Limited","A ""quoted"" name",EQ'), [
    'ABC', 'Example, Limited', 'A "quoted" name', 'EQ'
  ]);
});

test('30-day Cycle A counts qualifying rolling five-session averages', () => {
  const result = calculateDeliveryCycles([60, 62, 61, 59, 58, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69]);
  assert.equal(result.rolling5dPassCount, 11);
  assert.equal(result.cycleA, true);
});
test('30-day Cycle B counts qualifying individual sessions independently', () => {
  const result = calculateDeliveryCycles([60, 59, 61, 40, 62, 30, 63, 20, 64]);
  assert.equal(result.dailyPassCount, 5);
  assert.equal(result.cycleB, true);
  assert.equal(result.cycleA, false);
  assert.equal(result.deliveryCyclePass, true);
});
test('exactly 60 qualifies and missing values fail rolling windows', () => {
  const result = calculateDeliveryCycles([60, 60, null, 60, 60, 60, 60, 60, 60, 60]);
  assert.equal(result.dailyPassCount, 9);
  assert.equal(result.rolling5dPassCount, 3);
  assert.equal(result.cycleA, false);
  assert.equal(result.cycleB, true);
});
test('Cycle A and Cycle B both fail when neither threshold is met', () => {
  const result = calculateDeliveryCycles([59, 59, 59, 59, 59, 59, 59, 59, 59]);
  assert.equal(result.cycleA, false);
  assert.equal(result.cycleB, false);
  assert.equal(result.deliveryCyclePass, false);
});
