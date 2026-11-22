import fs from 'node:fs';
import path from 'node:path';
import { fetchNseIntegratedFilingRows } from '../research/fundamental_pilot/nse_integrated_filing_client.ts';
import type { NseRevisionRow } from '../research/fundamental_pilot/nse_revision_pair.ts';

export interface CachedNseIssuerFilingHistory {
  symbol: string;
  rows: NseRevisionRow[];
  fetchedAtUtc: string;
  source: 'NSE_OFFICIAL_INTEGRATED_FILING_API';
  complete: true;
}

export interface NseFilingHistoryCache {
  schemaVersion: 1;
  updatedAtUtc: string;
  symbols: Record<string, CachedNseIssuerFilingHistory>;
}

export interface NseFilingHistoryCollectionReport {
  requested: number;
  succeeded: string[];
  failed: Array<{ symbol: string; error: string }>;
  cachedSymbols: number;
  cacheFile: string;
}

function cachePath(): string {
  return path.join(process.cwd(), 'data', 'research', 'nse_official_filing_history.json');
}

function rowKey(row: NseRevisionRow): string {
  if (row.seq_Id === null || row.seq_Id === undefined || String(row.seq_Id).trim() === '') {
    throw new Error('NSE filing row has no sequence ID');
  }
  return String(row.seq_Id);
}

function rowFingerprint(row: NseRevisionRow): string {
  return JSON.stringify([
    row.symbol, row.smName, row.seq_Id, row.qe_Date, row.type, row.type_Sub,
    row.audited, row.consolidated, row.broadcast_Date, row.creation_Date,
    row.revised_Date, row.revision_Remark, row.ixbrl, row.xbrl,
  ]);
}

/** Merge filing rows by immutable NSE sequence ID; conflicting IDs block the issuer update. */
export function mergeNseFilingHistory(
  previous: NseRevisionRow[],
  incoming: NseRevisionRow[],
): NseRevisionRow[] {
  const byId = new Map<string, NseRevisionRow>();
  for (const row of [...previous, ...incoming]) {
    const id = rowKey(row);
    const existing = byId.get(id);
    if (!existing) byId.set(id, row);
    else if (rowFingerprint(existing) !== rowFingerprint(row)) {
      throw new Error(`Conflicting NSE filing data for sequence ID ${id}; prior cache preserved`);
    }
  }
  return [...byId.values()].sort((a, b) => {
    const date = (a.qe_Date || '').localeCompare(b.qe_Date || '');
    return date || rowKey(a).localeCompare(rowKey(b), undefined, { numeric: true });
  });
}

export function loadNseFilingHistoryCache(): NseFilingHistoryCache {
  const file = cachePath();
  if (!fs.existsSync(file)) return { schemaVersion: 1, updatedAtUtc: '', symbols: {} };
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<NseFilingHistoryCache>;
  if (parsed.schemaVersion !== 1 || !parsed.symbols || typeof parsed.symbols !== 'object') {
    throw new Error('NSE filing history cache schema is invalid; refusing to overwrite it');
  }
  return {
    schemaVersion: 1,
    updatedAtUtc: typeof parsed.updatedAtUtc === 'string' ? parsed.updatedAtUtc : '',
    symbols: parsed.symbols,
  };
}

function saveNseFilingHistoryCache(cache: NseFilingHistoryCache): void {
  const file = cachePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(temp, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, file);
}

/**
 * Fetch filing metadata only for supplied Bhavcopy symbols. Each issuer is
 * committed independently; a failed or conflicting issuer never erases its
 * previously cached filing history. This cache is evidence staging, not
 * scanner-approved metric data.
 */
export async function collectNseFilingHistoryForSymbols(
  rawSymbols: string[],
  options: { concurrency?: number; fetchImpl?: typeof fetch; onIssuerComplete?: (symbol: string, succeeded: boolean, error?: string) => void } = {},
): Promise<NseFilingHistoryCollectionReport> {
  const symbols = [...new Set(rawSymbols.map(s => s.trim().toUpperCase()).filter(Boolean))];
  const concurrency = options.concurrency ?? 1;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 5) {
    throw new Error('concurrency must be an integer from 1 to 5');
  }
  const cache = loadNseFilingHistoryCache();
  const succeeded: string[] = [];
  const failed: Array<{ symbol: string; error: string }> = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, symbols.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= symbols.length) return;
      const symbol = symbols[index];
      try {
        const fetched = await fetchNseIntegratedFilingRows({
          symbol,
          fetchImpl: options.fetchImpl,
        });
        if (!fetched.complete) throw new Error('NSE filing pagination incomplete; prior cache preserved');
        const previous = cache.symbols[symbol]?.rows ?? [];
        const rows = mergeNseFilingHistory(previous, fetched.rows);
        cache.symbols[symbol] = {
          symbol,
          rows,
          fetchedAtUtc: new Date().toISOString(),
          source: 'NSE_OFFICIAL_INTEGRATED_FILING_API',
          complete: true,
        };
        succeeded.push(symbol);
        options.onIssuerComplete?.(symbol, true);
        cache.updatedAtUtc = new Date().toISOString();
        saveNseFilingHistoryCache(cache);
      } catch (error) {
        const message = (error as Error).message;
        failed.push({ symbol, error: message });
        options.onIssuerComplete?.(symbol, false, message);
      }
    }
  });
  await Promise.all(workers);
  return {
    requested: symbols.length,
    succeeded: succeeded.sort(),
    failed: failed.sort((a, b) => a.symbol.localeCompare(b.symbol)),
    cachedSymbols: Object.keys(cache.symbols).length,
    cacheFile: 'data/research/nse_official_filing_history.json',
  };
}

export interface NseFilingHistoryJobStatus {
  running: boolean;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  currentSymbol: string;
  startedAtUtc: string;
  finishedAtUtc: string;
  lastError: string | null;
}

let filingHistoryJob: NseFilingHistoryJobStatus = {
  running: false, total: 0, processed: 0, succeeded: 0, failed: 0,
  currentSymbol: '', startedAtUtc: '', finishedAtUtc: '', lastError: null,
};

export function getNseFilingHistoryJobStatus(): NseFilingHistoryJobStatus {
  return { ...filingHistoryJob };
}

/** Start a background Bhavcopy-symbol filing sync; does not write scanner metric cache. */
export function startNseFilingHistoryCollection(rawSymbols: string[]): NseFilingHistoryJobStatus {
  if (filingHistoryJob.running) return getNseFilingHistoryJobStatus();
  const symbols = [...new Set(rawSymbols.map(s => s.trim().toUpperCase()).filter(Boolean))];
  filingHistoryJob = {
    running: true, total: symbols.length, processed: 0, succeeded: 0, failed: 0,
    currentSymbol: symbols[0] ?? '', startedAtUtc: new Date().toISOString(),
    finishedAtUtc: '', lastError: null,
  };
  void collectNseFilingHistoryForSymbols(symbols, {
    onIssuerComplete: (symbol, ok, error) => {
      filingHistoryJob.processed += 1;
      if (ok) filingHistoryJob.succeeded += 1;
      else {
        filingHistoryJob.failed += 1;
        filingHistoryJob.lastError = `${symbol}: ${error ?? 'Unknown error'}`;
      }
      filingHistoryJob.currentSymbol = symbols[filingHistoryJob.processed] ?? '';
    },
  }).catch(error => {
    filingHistoryJob.lastError = (error as Error).message;
  }).finally(() => {
    filingHistoryJob.running = false;
    filingHistoryJob.currentSymbol = '';
    filingHistoryJob.finishedAtUtc = new Date().toISOString();
  });
  return getNseFilingHistoryJobStatus();
}
