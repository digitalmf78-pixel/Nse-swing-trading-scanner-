export function sessionAgeDays(latestSession, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(latestSession || '')) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(today || ''))) return null;
  const latest = Date.parse(latestSession + 'T00:00:00Z');
  const current = Date.parse(today + 'T00:00:00Z');
  if (!Number.isFinite(latest) || !Number.isFinite(current) ||
      new Date(latest).toISOString().slice(0, 10) !== latestSession ||
      new Date(current).toISOString().slice(0, 10) !== today) return null;
  return Math.floor((current - latest) / 86_400_000);
}
export function assessFreshness(latestSession, today, maxAgeDays = 7) {
  const ageDays = sessionAgeDays(latestSession, today);
  if (ageDays === null || ageDays < 0) return { ageDays, freshnessStatus: 'INVALID_DATE', status: 'STALE_DATA' };
  if (ageDays > maxAgeDays) return { ageDays, freshnessStatus: 'STALE', status: 'STALE_DATA' };
  return { ageDays, freshnessStatus: 'FRESH', status: 'READY' };
}
export function liquidityFlag(volume, threshold = 1000) {
  const value = Number(volume);
  if (!Number.isFinite(value) || value < 0) return 'VOLUME_UNVERIFIED';
  return value < threshold ? 'LOW_VOLUME_REVIEW' : 'OK';
}
export function parseCsvLine(line) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { cells.push(value.trim()); value = ''; }
    else value += ch;
  }
  cells.push(value.trim());
  return cells;
}
export function parseMainboardSymbols(csvText) {
  const lines = String(csvText || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('NSE equity master is empty');
  const headers = parseCsvLine(lines[0]).map(v => v.toUpperCase().replace(/\s+/g, ' ').trim());
  const symbolIndex = headers.indexOf('SYMBOL');
  const seriesIndex = headers.indexOf('SERIES');
  const isinIndex = headers.indexOf('ISIN NUMBER');
  if (symbolIndex < 0 || seriesIndex < 0 || isinIndex < 0) throw new Error('NSE equity master schema mismatch');
  const symbols = new Set();
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const symbol = cells[symbolIndex]?.toUpperCase();
    const series = cells[seriesIndex]?.toUpperCase();
    const isin = cells[isinIndex]?.toUpperCase();
    if (symbol && isin && /^[A-Z0-9&.-]+$/.test(symbol) && ['EQ', 'BE', 'BZ'].includes(series)) symbols.add(symbol);
  }
  if (symbols.size < 1000) throw new Error('NSE equity master failed minimum-size validation');
  return symbols;
}

export function calculateDeliveryCycles(deliveryBySession, threshold = 60, minimumPasses = 5) {
  const values = Array.isArray(deliveryBySession) ? deliveryBySession : [];
  let rolling5dPassCount = 0;
  for (let i = 4; i < values.length; i += 1) {
    const window = values.slice(i - 4, i + 1).map(raw => raw === null || raw === undefined || raw === '' ? Number.NaN : Number(raw));
    if (window.length === 5 && window.every(Number.isFinite)) {
      const average = window.reduce((sum, value) => sum + value, 0) / 5;
      if (average >= threshold) rolling5dPassCount += 1;
    }
  }
  const dailyPassCount = values.reduce((count, raw) => {
    const value = raw === null || raw === undefined || raw === '' ? Number.NaN : Number(raw);
    return count + (Number.isFinite(value) && value >= threshold ? 1 : 0);
  }, 0);
  const cycleA = rolling5dPassCount >= minimumPasses;
  const cycleB = dailyPassCount >= minimumPasses;
  return {
    rolling5dPassCount,
    dailyPassCount,
    cycleA,
    cycleB,
    deliveryCyclePass: cycleA || cycleB
  };
}


export function expectedNseTradingSessions(startDate, endDate, calendar) {
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) &&
    Number.isFinite(Date.parse(value + 'T00:00:00Z')) &&
    new Date(Date.parse(value + 'T00:00:00Z')).toISOString().slice(0, 10) === value;
  if (!valid(startDate) || !valid(endDate) || startDate > endDate) throw new Error('Invalid NSE session date range');
  if (!calendar?.years || typeof calendar.years !== 'object') throw new Error('Official NSE trading calendar unavailable');
  const sessions = [];
  for (let ms = Date.parse(startDate + 'T00:00:00Z'); ms <= Date.parse(endDate + 'T00:00:00Z'); ms += 86_400_000) {
    const date = new Date(ms).toISOString().slice(0, 10);
    const year = calendar.years[date.slice(0, 4)];
    if (!year) throw new Error('NSE trading calendar missing year ' + date.slice(0, 4));
    const holidays = new Set(Array.isArray(year.holidays) ? year.holidays : []);
    const special = new Set(Object.keys(year.special_sessions || {}));
    const weekday = new Date(ms).getUTCDay();
    if (special.has(date) || (weekday !== 0 && weekday !== 6 && !holidays.has(date))) sessions.push(date);
  }
  return sessions;
}

export function assessNseSessionCompleteness(expectedDates, availableDates) {
  const expected = [...new Set(Array.isArray(expectedDates) ? expectedDates : [])].sort();
  const available = new Set(Array.isArray(availableDates) ? availableDates : []);
  const missingDates = expected.filter(date => !available.has(date));
  return { complete: expected.length > 0 && missingDates.length === 0, expectedCount: expected.length, availableCount: expected.length - missingDates.length, missingDates };
}

export function lastNseTradingSessions(endDate, calendar, requiredCount = 200, lookbackCalendarDays = 500) {
  if (!Number.isInteger(requiredCount) || requiredCount < 1) throw new Error('Required session count must be a positive integer');
  if (!Number.isInteger(lookbackCalendarDays) || lookbackCalendarDays < requiredCount) throw new Error('Calendar lookback must be a positive integer at least as large as the session count');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(endDate || ''))) throw new Error('Invalid NSE session end date');
  const startDate = new Date(Date.parse(endDate + 'T00:00:00Z') - lookbackCalendarDays * 86_400_000).toISOString().slice(0, 10);
  const sessions = expectedNseTradingSessions(startDate, endDate, calendar);
  if (sessions.length < requiredCount) throw new Error('NSE calendar provides only ' + sessions.length + ' sessions; ' + requiredCount + ' required');
  return sessions.slice(-requiredCount);
}
