import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFreshness, liquidityFlag, parseMainboardSymbols } from './delivery-quality.mjs';

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
