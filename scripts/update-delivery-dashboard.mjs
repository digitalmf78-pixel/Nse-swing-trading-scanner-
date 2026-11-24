import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CACHE = path.join(ROOT, 'data', 'cache', 'delivery');
const OUTPUT = path.join(ROOT, 'docs', 'data', 'latest.json');
const UA = 'Mozilla/5.0 (compatible; NSE-Delivery-Dashboard/1.0)';
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

function istToday() {
  return new Date(Date.now() + 330 * 60_000);
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function filenameFor(iso) {
  const [y, m, day] = iso.split('-');
  return `sec_bhavdata_full_${day}${m}${y}.csv`;
}
function parseDate(raw) {
  const m = String(raw || '').trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months.indexOf(m[2]);
  return month < 0 ? '' : `${m[3]}-${String(month + 1).padStart(2,'0')}-${m[1].padStart(2,'0')}`;
}
function readCsv(file, expectedDate) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 100) throw new Error(`CSV too short: ${path.basename(file)}`);
  const headers = lines[0].split(',').map(v => v.trim().toUpperCase());
  const ix = Object.fromEntries(['SYMBOL','SERIES','DATE1','CLOSE_PRICE','TTL_TRD_QNTY','DELIV_QTY','DELIV_PER'].map(k => [k, headers.indexOf(k)]));
  if (Object.values(ix).some(v => v < 0)) throw new Error(`Required columns missing: ${path.basename(file)}`);
  const first = lines[1].split(',');
  if (parseDate(first[ix.DATE1]) !== expectedDate) throw new Error(`Date mismatch: ${path.basename(file)}`);
  const rows = [];
  for (const line of lines.slice(1)) {
    const c = line.split(',');
    if (c.length < headers.length || c[ix.SERIES]?.trim() !== 'EQ') continue;
    const symbol = c[ix.SYMBOL]?.trim();
    const close = Number(c[ix.CLOSE_PRICE]);
    const volume = Number(c[ix.TTL_TRD_QNTY]);
    const deliveryQty = Number(String(c[ix.DELIV_QTY]).replace(/,/g, ''));
    const deliveryPct = Number(c[ix.DELIV_PER]);
    if (!symbol || !Number.isFinite(close) || !Number.isFinite(volume) || !Number.isFinite(deliveryQty) || !Number.isFinite(deliveryPct)) continue;
    rows.push({ symbol, close, volume, deliveryQty, deliveryPct });
  }
  return rows;
}

const now = istToday();
const today = isoDate(now);
const checked = [];
const downloaded = [];
for (let offset = 14; offset >= 0; offset--) {
  const d = new Date(now.getTime() - offset * 86_400_000);
  const day = d.getUTCDay();
  if (day === 0 || day === 6) continue;
  const iso = isoDate(d);
  checked.push(iso);
  const file = path.join(CACHE, filenameFor(iso));
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) {
    try { readCsv(file, iso); continue; } catch { fs.rmSync(file, { force: true }); }
  }
  const url = `https://nsearchives.nseindia.com/products/content/${filenameFor(iso)}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/csv,text/plain,*/*', Referer: 'https://www.nseindia.com/' }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) continue;
    const body = await res.text();
    if (!body || /^\s*</.test(body)) continue;
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, body, 'utf8');
    try { readCsv(tmp, iso); fs.renameSync(tmp, file); downloaded.push(iso); }
    catch { fs.rmSync(tmp, { force: true }); }
  } catch (error) { console.log(`NSE fetch skipped ${iso}: ${error.message}`); }
}

const files = fs.readdirSync(CACHE).map(name => {
  const m = name.match(/^sec_bhavdata_full_(\d{2})(\d{2})(\d{4})\.csv$/);
  return m ? { name, iso: `${m[3]}-${m[2]}-${m[1]}` } : null;
}).filter(Boolean).sort((a,b) => a.iso.localeCompare(b.iso));
const sessions = files.slice(-5);
const payload = {
  generatedAtUtc: new Date().toISOString(),
  todayIst: today,
  checkedDates: checked,
  downloadedDates: downloaded,
  latestSession: sessions.at(-1)?.iso || null,
  sessionDates: sessions.map(x => x.iso),
  status: sessions.length === 5 ? 'READY' : 'INSUFFICIENT_SESSIONS',
  rule: 'NSE Main Board EQ series; delivery percentage must be >=60 on each of the latest five available sessions.',
  requiredSessions: 5,
  stocks: []
};
if (sessions.length === 5) {
  const maps = sessions.map(s => new Map(readCsv(path.join(CACHE, s.name), s.iso).map(r => [r.symbol, r])));
  const symbols = [...maps[4].keys()].sort();
  payload.stocks = symbols.map(symbol => {
    const values = maps.map(m => m.get(symbol));
    if (values.some(v => !v)) return null;
    return {
      symbol,
      close: values[4].close,
      volume: values[4].volume,
      deliveryQty: values[4].deliveryQty,
      deliveryPct: values[4].deliveryPct,
      fiveSessionDeliveryPct: values.map(v => v.deliveryPct),
      allFiveAbove60: values.every(v => v.deliveryPct >= 60),
      dates: sessions.map(s => s.iso)
    };
  }).filter(Boolean).filter(s => s.allFiveAbove60).sort((a,b) => b.deliveryPct - a.deliveryPct);
}
fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2) + '\n');
console.log(JSON.stringify({ status: payload.status, latestSession: payload.latestSession, sessions: payload.sessionDates, qualifiedStocks: payload.stocks.length, downloaded }));
