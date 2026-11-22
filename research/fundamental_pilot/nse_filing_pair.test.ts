import assert from 'node:assert/strict';
import test from 'node:test';
import { findUniqueOriginalNseFiling, resolveOriginalNseFilingPair } from './nse_filing_pair.ts';

const row = (period: string, sequence: string, basis = 'Standalone') => ({
  symbol: 'KSHINTL',
  smName: 'KSH International Limited',
  seq_Id: sequence,
  qe_Date: period,
  type: 'Integrated Filing- Financials',
  type_Sub: 'Original',
  audited: 'Un-Audited',
  consolidated: basis,
  broadcast_Date: '04-Nov-2026 21:06:19',
  ixbrl: `https://nsearchives.nseindia.in/corporate/ixbrl/${sequence}.html`,
  xbrl: `https://nsearchives.nseindia.in/corporate/xbrl/${sequence}.xml`,
});

const request = {
  symbol: 'KSHINTL',
  basis: 'Standalone' as const,
  currentPeriod: '30-SEP-2026',
  priorPeriod: '30-SEP-2025',
};

test('resolves one exact original filing for each same-basis period', () => {
  const pair = resolveOriginalNseFilingPair([
    row('30-SEP-2026', '209920'),
    row('30-SEP-2025', '133769'),
  ], request);
  assert.equal(pair.current.seq_Id, '209920');
  assert.equal(pair.prior.seq_Id, '133769');
});

test('rejects duplicate original filing candidates rather than choosing one', () => {
  assert.throws(() => resolveOriginalNseFilingPair([
    row('30-SEP-2026', '209920'),
    row('30-SEP-2026', '209921'),
    row('30-SEP-2025', '133769'),
  ], request), /got 2/);
});

test('rejects wrong basis and revised filings', () => {
  const wrongBasis = row('30-SEP-2026', '209920', 'Consolidated');
  const revised = { ...row('30-SEP-2026', '209921'), type_Sub: 'Revision' };
  assert.throws(() => resolveOriginalNseFilingPair([
    wrongBasis, revised, row('30-SEP-2025', '133769'),
  ], request), /got 0/);
});

test('rejects non-official XBRL or iXBRL URLs', () => {
  const unsafe = { ...row('30-SEP-2026', '209920'), xbrl: 'https://example.com/fake.xml' };
  assert.throws(() => resolveOriginalNseFilingPair([
    unsafe, row('30-SEP-2025', '133769'),
  ], request), /got 0/);
});

test('rejects malformed request and missing prior period', () => {
  assert.throws(() => resolveOriginalNseFilingPair([], { ...request, priorPeriod: request.currentPeriod }), /Invalid/);
  assert.throws(() => resolveOriginalNseFilingPair([row('30-SEP-2026', '209920')], request), /prior/);
});

test('returns null for a genuinely missing original filing instead of inventing data',()=>{
  assert.equal(findUniqueOriginalNseFiling([],{
    symbol:'KSHINTL',basis:'Standalone',period:'30-JUN-2025',
  }),null);
});

test('finds one exact original filing by issuer, period and basis',()=>{
  const found=findUniqueOriginalNseFiling([row('30-JUN-2026','184852')],{
    symbol:'KSHINTL',basis:'Standalone',period:'30-JUN-2026',
  });
  assert.equal(found?.seq_Id,'184852');
});

test('rejects ambiguous single-period original filings',()=>{
  assert.throws(()=>findUniqueOriginalNseFiling([
    row('30-JUN-2026','184852'),row('30-JUN-2026','184853'),
  ],{symbol:'KSHINTL',basis:'Standalone',period:'30-JUN-2026'}),/Ambiguous original NSE filings/);
});
