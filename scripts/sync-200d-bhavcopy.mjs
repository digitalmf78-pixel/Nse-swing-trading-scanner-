import fs from 'node:fs';
import path from 'node:path';
import { lastNseTradingSessions, parseCsvLine } from './delivery-quality.mjs';

const ROOT = process.cwd();
const DELIVERY_DIR = path.join(ROOT, 'data', 'cache', 'delivery');
const STATUS_DIR = path.join(ROOT, 'data', 'cache', 'bhavcopy-200d');
const STATUS_FILE = path.join(STATUS_DIR, 'status.json');
const CALENDAR_FILE = path.join(ROOT, 'data', 'inputs', 'nse_trading_calendar.json');
const REQUIRED_SESSIONS = 200;
const UA = 'Mozilla/5.0 (compatible; NSE-200D-Bhavcopy-Cache/1.0)';

function istNow() {
  return new Date(Date.now() + 330 * 60_000);
}
function isoDate(date) {
  return date.toISOString().slice(0, 10);
}
function filenameFor(iso) {
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
function validateBhavcopy(file, expectedDate) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 100) throw new Error('CSV too short');
  const headers = parseCsvLine(lines[0]).map(v => v.trim().toUpperCase());
  const ix = Object.fromEntries(['SYMBOL','SERIES','DATE1','CLOSE_PRICE','TTL_TRD_QNTY','DELIV_QTY','DELIV_PER'].map(k => [k, headers.indexOf(k)]));
  if (Object.values(ix).some(v => v < 0)) throw new Error('Required NSE Bhavcopy columns missing');
  if (parseDate(parseCsvLine(lines[1])[ix.DATE1]) !== expectedDate) throw new Error('Bhavcopy internal date does not match filename');
  const eqRows = lines.slice(1).map(parseCsvLine).filter(row => {
    if (row[ix.SERIES]?.trim() !== 'EQ' || !row[ix.SYMBOL]?.trim()) return false;
    const values = [row[ix.CLOSE_PRICE], row[ix.TTL_TRD_QNTY], String(row[ix.DELIV_QTY] || '').replace(/,/g, ''), row[ix.DELIV_PER]].map(Number);
    return values.every(Number.isFinite) && values.every(v => v >= 0);
  });
  if (eqRows.length < 1000) throw new Error('Insufficient valid EQ rows: ' + eqRows.length);
  return { date: expectedDate, rows: eqRows.length, bytes: Buffer.byteLength(text) };
}

fs.mkdirSync(DELIVERY_DIR, { recursive: true });
fs.mkdirSync(STATUS_DIR, { recursive: true });
const now = istNow();
const today = isoDate(now);
const asOfDate = now.getUTCHours() < 18 ? isoDate(new Date(now.getTime() - 86_400_000)) : today;
const calendar = JSON.parse(fs.readFileSync(CALENDAR_FILE, 'utf8'));
const expected = lastNseTradingSessions(asOfDate, calendar, REQUIRED_SESSIONS, 500);

const downloaded = [];
const errors = [];
const validated = [];
let cursor = 0;
async function syncWorker() {
  while (cursor < expected.length) {
    const date = expected[cursor++];
    const file = path.join(DELIVERY_DIR, filenameFor(date));
    if (fs.existsSync(file)) {
      try {
        const meta = validateBhavcopy(file, date);
        validated.push(meta);
        continue;
      } catch (error) {
        errors.push({ date, error: 'Cached file rejected: ' + error.message });
      }
    }

    const url = 'https://nsearchives.nseindia.com/products/content/' + filenameFor(date);
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'text/csv,text/plain,*/*', Referer: 'https://www.nseindia.com/' },
        signal: AbortSignal.timeout(15_000)
      });
      if (!response.ok) throw new Error('NSE HTTP ' + response.status);
      const body = await response.text();
      if (!body || /^\\s*</.test(body)) throw new Error('NSE did not return CSV data');
      const temp = file + '.tmp';
      fs.writeFileSync(temp, body, 'utf8');
      try {
        const meta = validateBhavcopy(temp, date);
        fs.renameSync(temp, file);
        validated.push(meta);
        downloaded.push(date);
      } catch (error) {
        fs.rmSync(temp, { force: true });
        throw error;
      }
    } catch (error) {
      errors.push({ date, error: error.message });
    }
  }
}
await Promise.all(Array.from({ length: 4 }, () => syncWorker()));

const validatedDates = [...new Set(validated.map(x => x.date))].sort();
const missingDates = expected.filter(date => !validatedDates.includes(date));
const status = {
  generatedAtUtc: new Date().toISOString(),
  source: 'NSE official sec_bhavdata_full daily Bhavcopy',
  retentionPolicy: 'Append-only; never overwrite a validated session; preserve at least the latest 200 expected NSE trading sessions.',
  requiredTradingSessions: REQUIRED_SESSIONS,
  asOfDate,
  startDate: expected[0],
  endDate: expected.at(-1),
  expectedSessions: expected.length,
  availableSessions: validatedDates.length,
  missingSessions: missingDates,
  downloadedDates: downloaded,
  latestCachedSession: validatedDates.at(-1) || null,
  status: missingDates.length === 0 ? 'READY' : 'BUILDING',
  errors
};
fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  status: status.status,
  requiredTradingSessions: REQUIRED_SESSIONS,
  availableSessions: status.availableSessions,
  missingSessions: missingDates.length,
  downloadedSessions: downloaded.length,
  startDate: status.startDate,
  endDate: status.endDate,
  statusFile: 'data/cache/bhavcopy-200d/status.json'
}));
