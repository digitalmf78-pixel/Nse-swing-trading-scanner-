import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOriginalRevisionPair } from './nse_revision_pair.ts';

const base = (kind: string, seq: string) => ({
  symbol: 'GAIL',
  smName: 'GAIL (India) Limited',
  seq_Id: seq,
  qe_Date: '30-JUN-2026',
  type: 'Integrated Filing- Financials',
  type_Sub: kind,
  audited: 'Un-Audited',
  consolidated: 'Consolidated',
  broadcast_Date: kind === 'Original' ? '31-Jul-2026 14:00:00' : null,
  revised_Date: kind === 'Revision' ? '31-Jul-2026 14:41:13' : null,
  revision_Remark: kind === 'Revision' ? 'Revised XBRL' : null,
  ixbrl: `https://nsearchives.nseindia.in/corporate/ixbrl/${seq}.html`,
  xbrl: `https://nsearchives.nseindia.in/corporate/xbrl/${seq}.xml`,
});

const request = { symbol: 'GAIL', period: '30-JUN-2026', basis: 'Consolidated' as const };

test('resolves a distinct original and revision for the same period and basis', () => {
  const pair = resolveOriginalRevisionPair([base('Original','1'),base('Revision','2')],request);
  assert.equal(pair.original.seq_Id,'1');
  assert.equal(pair.revision.seq_Id,'2');
});

test('rejects duplicate original or revision rows', () => {
  assert.throws(()=>resolveOriginalRevisionPair([
    base('Original','1'),base('Original','3'),base('Revision','2'),
  ],request),/original=2/);
});

test('rejects basis mismatch and non-official archive links', () => {
  const wrongBasis={...base('Revision','2'),consolidated:'Standalone'};
  assert.throws(()=>resolveOriginalRevisionPair([base('Original','1'),wrongBasis],request),/revision=0/);
  const unsafe={...base('Revision','2'),ixbrl:'https://example.com/file.html'};
  assert.throws(()=>resolveOriginalRevisionPair([base('Original','1'),unsafe],request),/revision=0/);
});

test('rejects same sequence ID for original and revision', () => {
  assert.throws(()=>resolveOriginalRevisionPair([
    base('Original','1'),base('Revision','1'),
  ],request),/distinct NSE sequence IDs/);
});
