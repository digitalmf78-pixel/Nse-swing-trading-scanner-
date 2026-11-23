import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeNseFilingHistory } from '../../server/nseFilingHistoryCache.ts';
import type { NseRevisionRow } from './nse_revision_pair.ts';

function row(seq_Id: string, patch: Partial<NseRevisionRow> = {}): NseRevisionRow {
  return {
    symbol: 'ABC',
    seq_Id,
    qe_Date: '31-Mar-2026',
    type: 'Integrated Filing- Financials',
    type_Sub: 'Original',
    consolidated: 'Standalone',
    xbrl: 'https://nsearchives.nseindia.com/corporate/xbrl/abc.xml',
    ixbrl: 'https://nsearchives.nseindia.com/corporate/ixbrl/abc.html',
    ...patch,
  };
}

test('NSE filing cache merge preserves previous filing rows and adds new sequence IDs', () => {
  const merged = mergeNseFilingHistory([row('10')], [row('11', { type_Sub: 'Revision' })]);
  assert.deepEqual(merged.map(item => item.seq_Id), ['10', '11']);
});

test('NSE filing cache merge is idempotent for exact duplicate sequence rows', () => {
  const merged = mergeNseFilingHistory([row('10')], [row('10')]);
  assert.equal(merged.length, 1);
});

test('NSE filing cache merge blocks conflicting sequence IDs', () => {
  assert.throws(
    () => mergeNseFilingHistory([row('10')], [row('10', { xbrl: 'https://nsearchives.nseindia.com/corporate/xbrl/changed.xml' })]),
    /Conflicting NSE filing data/,
  );
});

test('NSE filing cache rejects rows without immutable sequence IDs', () => {
  assert.throws(() => mergeNseFilingHistory([], [row('')]), /no sequence ID/);
});
