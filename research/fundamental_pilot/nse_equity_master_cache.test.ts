import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNseEquityMasterCsv } from '../../server/nseEquityMasterCache.ts';

test('NSE official equity master parser maps symbol to verified ISIN', () => {
  const csv = [
    'SYMBOL,NAME OF COMPANY,SERIES,DATE OF LISTING,PAID UP VALUE,MARKET LOT,ISIN NUMBER,FACE VALUE',
    'ABC,"ABC Industries, Limited",EQ,01-Jan-2000,10,1,INE123A01016,10',
    'XYZ,XYZ Limited,BE,02-Feb-2001,10,1,INE456B01018,10',
  ].join('\n');
  const result = parseNseEquityMasterCsv(csv);
  assert.equal(result.ABC.isin, 'INE123A01016');
  assert.equal(result.ABC.companyName, 'ABC Industries, Limited');
  assert.equal(result.XYZ.series, 'BE');
});

test('NSE equity master parser rejects invalid ISIN and conflicting symbol identity', () => {
  const invalid = 'SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER\nABC,ABC Limited,EQ,NOT-AN-ISIN';
  assert.throws(() => parseNseEquityMasterCsv(invalid), /no valid symbol\/ISIN rows/);
  const conflict = [
    'SYMBOL,NAME OF COMPANY,SERIES,ISIN NUMBER',
    'ABC,ABC Limited,EQ,INE123A01016',
    'ABC,ABC Limited,EQ,INE456B01018',
  ].join('\n');
  assert.throws(() => parseNseEquityMasterCsv(conflict), /Conflicting ISIN values/);
});
