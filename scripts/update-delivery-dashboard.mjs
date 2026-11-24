import fs from 'node:fs';
import path from 'node:path';
import { assessFreshness, liquidityFlag, parseCsvLine, parseMainboardSymbols } from './delivery-quality.mjs';

const ROOT = process.cwd();
const CACHE = path.join(ROOT, 'data', 'cache', 'delivery');
const OUTPUT = path.join(ROOT, 'docs', 'data', 'latest.json');
const UA = 'Mozilla/5.0 (compatible; NSE-Delivery-Dashboard/1.0)';
const MAINBOARD_URL = 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv';
const MAINBOARD_FILE = path.join(CACHE, 'EQUITY_L.csv');
const LIQUIDITY_REVIEW_THRESHOLD = 1000;
const MAX_FRESHNESS_AGE_DAYS = 7;
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
function istToday() { return new Date(Date.now() + 330 * 60_000); }
function isoDate(d) { return d.toISOString().slice(0, 10); }
function filenameFor(iso) {
  const parts = iso.split('-');
  return 'sec_bhavdata_full_' + parts[2] + parts[1] + parts[0] + '.csv';
}
function parseDate(raw) {
  const m = String(raw || '').trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months.indexOf(m[2]);
  return month < 0 ? '' : m[3] + '-' + String(month + 1).padStart(2,'0') + '-' + m[1].padStart(2,'0');
}
function readCsv(file, expectedDate) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 100) throw new Error('CSV too short: ' + path.basename(file));
  const headers = parseCsvLine(lines[0]).map(v => v.trim().toUpperCase());
  const ix = Object.fromEntries(['SYMBOL','SERIES','DATE1','CLOSE_PRICE','TTL_TRD_QNTY','DELIV_QTY','DELIV_PER'].map(k => [k, headers.indexOf(k)]));
  if (Object.values(ix).some(v => v < 0)) throw new Error('Required columns missing: ' + path.basename(file));
  const first = parseCsvLine(lines[1]);
  if (parseDate(first[ix.DATE1]) !== expectedDate) throw new Error('Date mismatch: ' + path.basename(file));
  const rows = [];
  for (const line of lines.slice(1)) {
    const c = parseCsvLine(line);
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
async function loadMainboardMaster() {
  try {
    const res = await fetch(MAINBOARD_URL, {
      headers: { 'User-Agent': UA, Accept: 'text/csv,text/plain,*/*', Referer: 'https://www.nseindia.com/' },
      signal: AbortSignal.timeout(15_000)
    });
    if (!res.ok) throw new Error('NSE equity master HTTP ' + res.status);
    const body = await res.text();
    const symbols = parseMainboardSymbols(body);
    fs.writeFileSync(MAINBOARD_FILE, body, 'utf8');
    return { symbols, verified: true, fetchedAtUtc: new Date().toISOString(), source: MAINBOARD_URL };
  } catch (error) {
    console.log('NSE Main Board master fetch unavailable: ' + error.message);
    try {
      if (fs.existsSync(MAINBOARD_FILE)) {
        const stat = fs.statSync(MAINBOARD_FILE);
        const ageMs = Date.now() - stat.mtimeMs;
        if (ageMs >= 0 && ageMs <= 7 * 86_400_000) {
          const symbols = parseMainboardSymbols(fs.readFileSync(MAINBOARD_FILE, 'utf8'));
          return { symbols, verified: true, fetchedAtUtc: stat.mtime.toISOString(), source: MAINBOARD_URL, cached: true };
        }
      }
    } catch (cacheError) {
      console.log('Cached NSE Main Board master rejected: ' + cacheError.message);
    }
    return { symbols: null, verified: false, fetchedAtUtc: null, source: MAINBOARD_URL };
  }
}

const attemptAtUtc = new Date().toISOString();
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
  const url = 'https://nsearchives.nseindia.com/products/content/' + filenameFor(iso);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/csv,text/plain,*/*', Referer: 'https://www.nseindia.com/' }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) continue;
    const body = await res.text();
    if (!body || /^\s*</.test(body)) continue;
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, body, 'utf8');
    try { readCsv(tmp, iso); fs.renameSync(tmp, file); downloaded.push(iso); }
    catch { fs.rmSync(tmp, { force: true }); }
  } catch (error) { console.log('NSE fetch skipped ' + iso + ': ' + error.message); }
}

const files = fs.readdirSync(CACHE).map(name => {
  const m = name.match(/^sec_bhavdata_full_(\d{2})(\d{2})(\d{4})\.csv$/);
  return m ? { name, iso: m[3] + '-' + m[2] + '-' + m[1] } : null;
}).filter(Boolean).filter(x => x.iso <= today).sort((a,b) => a.iso.localeCompare(b.iso));
const validFiles = [];
for (const file of files) {
  try { readCsv(path.join(CACHE, file.name), file.iso); validFiles.push(file); }
  catch (error) { console.log('Cached session rejected ' + file.iso + ': ' + error.message); }
}
const sessions = validFiles.slice(-5);
const freshness = assessFreshness(sessions.at(-1)?.iso || null, today, MAX_FRESHNESS_AGE_DAYS);
const mainboard = await loadMainboardMaster();
const payload = {
  generatedAtUtc: new Date().toISOString(),
  lastAttemptAtUtc: attemptAtUtc,
  todayIst: today,
  checkedDates: checked,
  downloadedDates: downloaded,
  latestSession: sessions.at(-1)?.iso || null,
  latestSessionAgeDays: freshness.ageDays,
  freshnessStatus: freshness.freshnessStatus,
  sessionDates: sessions.map(x => x.iso),
  mainBoardStatus: mainboard.verified ? 'VERIFIED' : 'UNVERIFIED',
  mainBoardMasterFetchedAtUtc: mainboard.fetchedAtUtc,
  mainBoardSource: mainboard.source,
  liquidityReviewThresholdVolume: LIQUIDITY_REVIEW_THRESHOLD,
  liquidityRule: 'Volume below ' + LIQUIDITY_REVIEW_THRESHOLD + ' shares is flagged for review only; no stock is removed by this flag.',
  status: sessions.length !== 5 ? 'INSUFFICIENT_SESSIONS' :
    freshness.status === 'STALE_DATA' ? 'STALE_DATA' :
    mainboard.verified ? 'READY' : 'READY_WITH_WARNINGS',
  rule: 'NSE Main Board listed securities; delivery percentage must be >=60 on each of the latest five available EQ-series sessions.',
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
      liquidityFlag: liquidityFlag(values[4].volume, LIQUIDITY_REVIEW_THRESHOLD),
      deliveryQty: values[4].deliveryQty,
      deliveryPct: values[4].deliveryPct,
      fiveSessionDeliveryPct: values.map(v => v.deliveryPct),
      allFiveAbove60: values.every(v => v.deliveryPct >= 60),
      mainBoardStatus: mainboard.verified ? (mainboard.symbols.has(symbol) ? 'VERIFIED' : 'NOT_IN_CURRENT_MAINBOARD_MASTER') : 'UNVERIFIED',
      dates: sessions.map(s => s.iso)
    };
  }).filter(Boolean).filter(s => s.allFiveAbove60)
    .filter(s => !mainboard.verified || s.mainBoardStatus === 'VERIFIED')
    .sort((a,b) => b.deliveryPct - a.deliveryPct);
}
payload.lowVolumeReviewCount = payload.stocks.filter(s => s.liquidityFlag === 'LOW_VOLUME_REVIEW').length;
payload.mainBoardUnverifiedCount = payload.stocks.filter(s => s.mainBoardStatus === 'UNVERIFIED').length;
fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2) + '\n');
console.log(JSON.stringify({
  status: payload.status,
  latestSession: payload.latestSession,
  latestSessionAgeDays: payload.latestSessionAgeDays,
  mainBoardStatus: payload.mainBoardStatus,
  sessions: payload.sessionDates,
  qualifiedStocks: payload.stocks.length,
  lowVolumeReviewCount: payload.lowVolumeReviewCount,
  downloaded
}));
