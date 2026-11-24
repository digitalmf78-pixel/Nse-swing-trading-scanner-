import { parseMainboardSymbols } from './delivery-quality.mjs';

const url = 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv';
const response = await fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; NSE-Delivery-Dashboard/1.0)',
    Accept: 'text/csv,text/plain,*/*',
    Referer: 'https://www.nseindia.com/'
  },
  signal: AbortSignal.timeout(20_000)
});
if (!response.ok) throw new Error('NSE Equity master HTTP ' + response.status);
const csv = await response.text();
const symbols = parseMainboardSymbols(csv);
console.log(JSON.stringify({
  source: url,
  downloadedBytes: Buffer.byteLength(csv),
  validatedSymbols: symbols.size,
  schema: 'SYMBOL, SERIES, ISIN NUMBER',
  result: 'PASS'
}));
