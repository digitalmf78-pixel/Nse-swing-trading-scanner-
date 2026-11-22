import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const warnings = [];
const errors = [];
const report = [];
const add = (label, value) => report.push(\`- \${label}: \${value}\`);
const warn = (message) => warnings.push(message);
const fail = (message) => errors.push(message);

function readText(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    fail(\`Missing required file: \${relativePath}\`);
    return '';
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function parseCsv(text) {
  const records = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some((v) => v.trim())) records.push(row);
      row = []; field = '';
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    if (row.some((v) => v.trim())) records.push(row);
  }
  if (!records.length) return [];
  const headers = records.shift().map((v) => v.trim().replace(/^\uFEFF/, ''));
  return records.map((values) => Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()])));
}

function maxDate(values) {
  return values.filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v)).sort().at(-1) || '';
}
function num(value) {
  if (value == null || value.trim() === '' || value.trim() === '-') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function bhavDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return '';
  const months = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
  return months[m[2].toLowerCase()] ? \`\${m[3]}-\${months[m[2].toLowerCase()]}-\${m[1].padStart(2,'0')}\` : '';
}
function istToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
}
function expectedSessions(calendar, count = 5) {
  const holidays = new Set(), special = new Set();
  for (const year of Object.values(calendar.years || {})) {
    for (const d of year.holidays || []) holidays.add(d);
    for (const d of Object.keys(year.special_sessions || {})) special.add(d);
  }
  const dates = [], cursor = new Date(\`\${istToday()}T00:00:00Z\`);
  for (let i = 0; i < 370 && dates.length < count; i++) {
    const d = cursor.toISOString().slice(0,10), day = cursor.getUTCDay(), isSpecial = special.has(d);
    if ((day !== 0 && day !== 6 || isSpecial) && (!holidays.has(d) || isSpecial)) dates.push(d);
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates;
}

const fundamental = parseCsv(readText('data/inputs/fundamental_metrics.csv'));
const fundamentalDateFields = [
  'RevenueGrowthPeriodEnd','ProfitGrowthPeriodEnd','ROEPeriodEnd','ROCEPeriodEnd',
  'DebtToEquityPeriodEnd','InterestCoveragePeriodEnd','OperatingCashFlowPeriodEnd','FreeCashFlowPeriodEnd'
];
if (!fundamental.length) fail('Fundamental metrics CSV is empty or unreadable.');
else {
  const headers = new Set(Object.keys(fundamental[0]));
  const required = ['TckrSymb','AsOfDate','FinancialPeriodEnd','RevenueGrowthPct','ProfitGrowthPct','ROEPercent','ROCEPercent','DebtToEquity','InterestCoverage','OperatingCashFlowINR','FreeCashFlowINR'];
  const missing = required.filter((h) => !headers.has(h));
  if (missing.length) fail(\`Fundamental CSV missing required columns: \${missing.join(', ')}\`);
  const symbols = fundamental.map((r) => r.TckrSymb).filter(Boolean);
  const dupes = symbols.length - new Set(symbols).size;
  if (dupes) warn(\`Fundamental CSV has \${dupes} duplicate ticker rows.\`);
  const missingDateColumns = fundamentalDateFields.filter((h) => !headers.has(h));
  const dateCoverage = Object.fromEntries(fundamentalDateFields.map((h) => [h, fundamental.filter((r) => Boolean(r[h])).length]));
  if (missingDateColumns.length) warn(\`Fundamental CSV lacks per-metric period-date columns: \${missingDateColumns.join(', ')}.\`);
  const unknownBasis = fundamental.filter((r) => r.MetricCalculationBasis === 'LEGACY_CACHE_BASIS_UNKNOWN').length;
  if (unknownBasis) warn(\`\${unknownBasis} rows have LEGACY_CACHE_BASIS_UNKNOWN calculation basis.\`);
  const ic999 = fundamental.filter((r) => num(r.InterestCoverage) === 999).length;
  if (ic999) warn(\`\${ic999} rows have InterestCoverage=999; verify whether this is a provider sentinel.\`);
  const yieldOver100 = fundamental.filter((r) => (num(r.DividendYieldPct) ?? 0) > 100).length;
  if (yieldOver100) warn(\`\${yieldOver100} rows have DividendYieldPct above 100; review provider scaling.\`);
  add('Fundamental rows / unique tickers', \`\${fundamental.length} / \${new Set(symbols).size}\`);
  add('Fundamental latest AsOfDate', maxDate(fundamental.map((r) => r.AsOfDate)));
  add('Fundamental latest FinancialPeriodEnd', maxDate(fundamental.map((r) => r.FinancialPeriodEnd)));
  add('Per-metric period-date population', JSON.stringify(dateCoverage));
}

const thresholdText = readText('data/inputs/fundamental_thresholds.json');
if (thresholdText) {
  try {
    const t = JSON.parse(thresholdText);
    for (const k of ['min_revenue_growth_pct','min_profit_growth_pct','min_roe_pct','min_roce_pct','max_debt_to_equity','min_interest_coverage','max_data_age_days']) {
      if (!Number.isFinite(Number(t[k]))) fail(\`Invalid numeric threshold: \${k}\`);
    }
    for (const k of ['require_positive_operating_cash_flow','require_positive_free_cash_flow']) {
      if (typeof t[k] !== 'boolean') fail(\`Threshold must be boolean: \${k}\`);
    }
    add('Fundamental thresholds', 'valid JSON and required field types');
  } catch (e) { fail(\`Invalid fundamental_thresholds.json: \${e.message}\`); }
}

const overrideText = readText('data/research/live_fundamental_overrides.json');
if (overrideText) {
  try {
    const overrides = JSON.parse(overrideText);
    const rows = Object.values(overrides).filter((r) => r && typeof r === 'object');
    const dateCoverage = Object.fromEntries(fundamentalDateFields.map((h) => [h, rows.filter((r) => Boolean(r[h[0].toLowerCase()+h.slice(1)])).length]));
    if (fundamentalDateFields.every((h) => dateCoverage[h] === 0)) warn('Live overrides contain no per-metric reporting dates; fresh provider fetches are needed to populate them.');
    add('Live override records', rows.length);
    add('Live overrides latest AsOfDate', maxDate(rows.map((r) => r.asOfDate || '')));
    add('Live override period-date population', JSON.stringify(dateCoverage));
  } catch (e) { fail(\`Invalid live_fundamental_overrides.json: \${e.message}\`); }
}

const deliveryDir = path.join(root,'data','cache','delivery');
const deliveryFiles = fs.existsSync(deliveryDir) ? fs.readdirSync(deliveryDir)
  .filter((f) => /^sec_bhavdata_full_\d{8}\.csv$/i.test(f))
  .map((filename) => {
    const m = filename.match(/_(\d{2})(\d{2})(\d{4})\.csv$/i);
    return { filename, date: m ? \`\${m[3]}-\${m[2]}-\${m[1]}\` : '' };
  }).filter((x) => x.date).sort((a,b) => a.date.localeCompare(b.date)) : [];
if (!deliveryFiles.length) fail('No delivery bhavcopy CSV files found.');
else {
  const allDates = deliveryFiles.map((x) => x.date);
  const calendarText = readText('data/inputs/nse_trading_calendar.json');
  let expected = [];
  if (calendarText) {
    try { expected = expectedSessions(JSON.parse(calendarText), 5); }
    catch (e) { fail(\`Invalid NSE trading calendar: \${e.message}\`); }
  }
  const missing = expected.filter((d) => !allDates.includes(d));
  if (missing.length) warn(\`Delivery bhavcopy missing recent expected sessions: \${missing.join(', ')}.\`);
  let totalRows = 0, invalidPct = 0, qtyExceeds = 0, duplicateKeys = 0, badDates = 0;
  for (const file of deliveryFiles) {
    const rows = parseCsv(fs.readFileSync(path.join(deliveryDir,file.filename),'utf8'));
    totalRows += rows.length;
    const seen = new Set();
    for (const r of rows) {
      const d = bhavDate(r.DATE1 || '');
      if (!d || d !== file.date) badDates++;
      const key = \`\${r.SYMBOL}|\${r.SERIES}|\${d}\`;
      if (seen.has(key)) duplicateKeys++;
      seen.add(key);
      const pct = num(r.DELIV_PER), dq = num(r.DELIV_QTY), tq = num(r.TTL_TRD_QNTY);
      if (pct !== null && (pct < 0 || pct > 100)) invalidPct++;
      if (dq !== null && tq !== null && dq > tq) qtyExceeds++;
    }
  }
  if (invalidPct) warn(\`\${invalidPct} delivery rows have DELIV_PER outside 0-100.\`);
  if (qtyExceeds) warn(\`\${qtyExceeds} rows have DELIV_QTY greater than TTL_TRD_QNTY.\`);
  if (duplicateKeys) warn(\`\${duplicateKeys} duplicate SYMBOL/SERIES/DATE1 rows found.\`);
  if (badDates) warn(\`\${badDates} delivery rows have missing or filename-mismatched DATE1.\`);
  add('Delivery files / total rows', \`\${deliveryFiles.length} / \${totalRows}\`);
  add('Latest delivery date', allDates.at(-1));
  add('Expected last 5 sessions', expected.join(', '));
  add('Missing recent sessions', missing.length ? missing.join(', ') : 'None');
  add('Delivery row checks', \`invalid %=\${invalidPct}; qty>traded=\${qtyExceeds}; duplicate keys=\${duplicateKeys}; bad dates=\${badDates}\`);
}

const streakRows = parseCsv(readText('data/cache/delivery/v8_delivery_scan_streak_state.csv'));
const streakDate = maxDate(streakRows.map((r) => r.LastScanDate));
const latestDelivery = deliveryFiles.map((x) => x.date).sort().at(-1) || '';
if (streakDate && latestDelivery && streakDate < latestDelivery) warn(\`Streak state is behind delivery files: \${streakDate} vs \${latestDelivery}.\`);
add('Streak-state rows / latest scan date', \`\${streakRows.length} / \${streakDate || 'missing'}\`);

report.push('', \`Warnings (\${warnings.length}):\`, ...(warnings.length ? warnings.map((x) => \`- WARNING: \${x}\`) : ['- None']));
report.push('', \`Errors (\${errors.length}):\`, ...(errors.length ? errors.map((x) => \`- ERROR: \${x}\`) : ['- None']));
report.push('', 'Read-only audit: no scanner filters, scoring, ranking, cache data, or market records are modified.');
const output = \`# NSE Scanner Data Audit\n\n- Audit time UTC: \${new Date().toISOString()}\n- Branch: \${process.env.GITHUB_REF_NAME || 'local'}\n- Commit: \${process.env.GITHUB_SHA || 'unknown'}\n\n\${report.join('\n')}\n\`;
const outDir = path.join(root,'validation-artifact');
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'data-audit-report.md'),output,'utf8');
console.log(output);
if (errors.length) process.exitCode = 1;
