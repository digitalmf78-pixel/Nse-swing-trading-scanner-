import { parseCsvLine } from './delivery-quality.mjs';

const UA = 'Mozilla/5.0 (compatible; NSE-Delivery-Dashboard/1.0)';
const now = new Date(Date.now() + 330 * 60_000);
const today = now.toISOString().slice(0, 10);
const sessions = [];
const attempts = [];
function filename(iso) {
  const [year, month, day] = iso.split('-');
  return 'sec_bhavdata_full_' + day + month + year + '.csv';
}
function parseDate(raw) {
  const m = String(raw || '').trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months.indexOf(m[2]);
  return month < 0 ? '' : m[3] + '-' + String(month + 1).padStart(2, '0') + '-' + m[1].padStart(2, '0');
}
for (let offset = 14; offset >= 0; offset -= 1) {
  const d = new Date(now.getTime() - offset * 86_400_000);
  if ([0, 6].includes(d.getUTCDay())) continue;
  const iso = d.toISOString().slice(0, 10);
  const url = 'https://nsearchives.nseindia.com/products/content/' + filename(iso);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/csv,text/plain,*/*', Referer: 'https://www.nseindia.com/' },
      signal: AbortSignal.timeout(12_000)
    });
    if (!response.ok) { attempts.push({ date: iso, http: response.status }); continue; }
    const csv = await response.text();
    if (!csv || /^\s*</.test(csv)) continue;
    const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
    if (lines.length < 100) continue;
    const headers = parseCsvLine(lines[0]).map(v => v.trim().toUpperCase());
    const ix = Object.fromEntries(['SYMBOL','SERIES','DATE1','CLOSE_PRICE','TTL_TRD_QNTY','DELIV_QTY','DELIV_PER'].map(k => [k, headers.indexOf(k)]));
    if (Object.values(ix).some(v => v < 0)) continue;
    if (parseDate(parseCsvLine(lines[1])[ix.DATE1]) !== iso) continue;
    const eqRows = lines.slice(1).map(parseCsvLine).filter(row => row[ix.SERIES]?.trim() === 'EQ' && row[ix.SYMBOL]?.trim());
    if (eqRows.length < 100) continue;
    sessions.push({ date: iso, rows: eqRows.length, bytes: Buffer.byteLength(csv) });
  } catch (error) {
    attempts.push({ date: iso, error: error.message });
  }
}
sessions.sort((a, b) => a.date.localeCompare(b.date));
const latestFive = sessions.slice(-5);
console.log(JSON.stringify({ source: 'NSE official sec_bhavdata_full daily CSV', todayIst: today, validSessionsFound: sessions.length, latestFive, attempts }));
if (latestFive.length < 5) throw new Error('Could not validate five recent NSE EQ Bhavcopy sessions in the 15-day window');
