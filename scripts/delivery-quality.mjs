export function sessionAgeDays(latestSession, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(latestSession || '')) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(today || ''))) return null;
  const latest = Date.parse(latestSession + 'T00:00:00Z');
  const current = Date.parse(today + 'T00:00:00Z');
  if (!Number.isFinite(latest) || !Number.isFinite(current)) return null;
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
