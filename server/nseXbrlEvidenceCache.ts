import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { extractXbrl, type XbrlExtraction } from '../research/fundamental_pilot/xbrl_extract.ts';
import type { NseRevisionRow } from '../research/fundamental_pilot/nse_revision_pair.ts';

export interface NseXbrlEvidenceDocument {
  symbol: string;
  seqId: string;
  periodEnd: string;
  filingType: string;
  filingSubType: string;
  basis: 'Standalone' | 'Consolidated' | string;
  filingUrl: string;
  fetchedAtUtc: string;
  sha256: string;
  /** Relative path to immutable original XML retained beside this evidence record. */
  rawArchivePath: string;
  extraction: XbrlExtraction;
}

export interface NseXbrlEvidenceCache {
  schemaVersion: 1;
  updatedAtUtc: string;
  symbols: Record<string, { symbol: string; documents: NseXbrlEvidenceDocument[] }>;
}

export function validateOfficialXbrlArchiveUrl(value: unknown): URL {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing NSE XBRL archive URL');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.port !== '' || url.username !== '' || url.password !== ''
      || !['nsearchives.nseindia.in', 'nsearchives.nseindia.com'].includes(url.hostname)
      || !url.pathname.startsWith('/corporate/xbrl/')) {
    throw new Error('Archive URL is outside the official NSE XBRL allowlist');
  }
  return url;
}

export function mergeXbrlEvidenceDocuments(previous: NseXbrlEvidenceDocument[], incoming: NseXbrlEvidenceDocument[]): NseXbrlEvidenceDocument[] {
  const map = new Map<string, NseXbrlEvidenceDocument>();
  for (const item of [...previous, ...incoming]) {
    if (!item.symbol || !item.seqId || !/^([a-f0-9]{64})$/.test(item.sha256)) throw new Error('Evidence document has invalid identity or SHA-256');
    const existing = map.get(item.seqId);
    if (!existing) map.set(item.seqId, item);
    else if (existing.sha256 !== item.sha256 || existing.filingUrl !== item.filingUrl || existing.symbol !== item.symbol) {
      throw new Error(`Conflicting XBRL evidence for NSE sequence ID ${item.seqId}; existing evidence preserved`);
    }
  }
  return [...map.values()].sort((a,b) => a.periodEnd.localeCompare(b.periodEnd) || a.seqId.localeCompare(b.seqId, undefined, {numeric:true}));
}

function evidenceCachePath(cacheFile?: string): string {
  return cacheFile ?? path.join(process.cwd(), 'data', 'research', 'nse_official_xbrl_evidence.json');
}

export function loadNseXbrlEvidenceCache(cacheFile?: string): NseXbrlEvidenceCache {
  const file = evidenceCachePath(cacheFile);
  if (!fs.existsSync(file)) return { schemaVersion: 1, updatedAtUtc: '', symbols: {} };
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<NseXbrlEvidenceCache>;
  if (parsed.schemaVersion !== 1 || !parsed.symbols || typeof parsed.symbols !== 'object') {
    throw new Error('NSE XBRL evidence cache schema invalid; refusing to overwrite');
  }
  return { schemaVersion: 1, updatedAtUtc: parsed.updatedAtUtc ?? '', symbols: parsed.symbols };
}

function saveCache(cache: NseXbrlEvidenceCache, cacheFile?: string): void {
  const file = evidenceCachePath(cacheFile);
  fs.mkdirSync(path.dirname(file), {recursive:true});
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

/** Downloads filing-linked XBRL evidence only. No metric values are approved or sent to the main scanner cache. */
export async function collectXbrlEvidenceForFilingRows(
  symbol: string,
  rows: NseRevisionRow[],
  options: {fetchImpl?: typeof fetch; timeoutMs?: number; cacheFile?: string; archiveDir?: string} = {},
): Promise<{saved: number; skipped: number; failed: Array<{seqId:string;error:string}>}> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const cache = loadNseXbrlEvidenceCache(options.cacheFile);
  const existing = cache.symbols[symbol]?.documents ?? [];
  const seenIds = new Set(existing.map(doc => doc.seqId));
  const newDocs: NseXbrlEvidenceDocument[] = [];
  const rawBytesBySeq = new Map<string, Uint8Array>();
  const failed: Array<{seqId:string;error:string}> = [];
  let skipped = 0;
  for (const row of rows) {
    const seqId = String(row.seq_Id ?? '').trim();
    if (!seqId || !row.xbrl) { failed.push({seqId, error:'Missing sequence ID or XBRL URL'}); continue; }
    if (seenIds.has(seqId)) { skipped += 1; continue; }
    try {
      const url = validateOfficialXbrlArchiveUrl(row.xbrl);
      const response = await fetchImpl(url, {headers:{Accept:'application/xml,text/xml,*/*',Referer:'https://www.nseindia.com/'},signal:AbortSignal.timeout(options.timeoutMs ?? 30000)});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (response.url) validateOfficialXbrlArchiveUrl(response.url);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > 25*1024*1024) throw new Error('Archive size invalid (empty or >25 MB)');
      const xml = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
      const extraction = extractXbrl(xml);
      if (extraction.warnings.length) throw new Error(`XBRL parser warnings: ${extraction.warnings.length}`);
      const doc: NseXbrlEvidenceDocument = {
        symbol: symbol.toUpperCase(), seqId, periodEnd: row.qe_Date ?? '', filingType: row.type ?? '',
        filingSubType: row.type_Sub ?? '', basis: row.consolidated ?? '',
        filingUrl: url.toString(), fetchedAtUtc: new Date().toISOString(),
        sha256: createHash('sha256').update(bytes).digest('hex'), rawArchivePath: '', extraction,
      };
      newDocs.push(doc); rawBytesBySeq.set(seqId, bytes); seenIds.add(seqId);
    } catch (error) { failed.push({seqId, error:(error as Error).message}); }
  }
  // Archive exact response bytes under immutable SHA-256 filenames; never overwrite different evidence.
  const archiveRoot = options.archiveDir ?? path.join(process.cwd(), 'data', 'research', 'nse_official_xbrl_raw');
  for (const doc of newDocs) {
    const safeSymbol = doc.symbol.replace(/[^A-Z0-9._-]/g, '_');
    const safeSeq = doc.seqId.replace(/[^A-Za-z0-9._-]/g, '_');
    const archiveFile = path.join(archiveRoot, safeSymbol, safeSeq + '_' + doc.sha256 + '.xml');
    fs.mkdirSync(path.dirname(archiveFile), {recursive:true});
    if (!fs.existsSync(archiveFile)) {
      const tmp = archiveFile + '.' + process.pid + '.tmp';
      fs.writeFileSync(tmp, rawBytesBySeq.get(doc.seqId)!);
      fs.renameSync(tmp, archiveFile);
    }
    doc.rawArchivePath = path.relative(process.cwd(), archiveFile);
  }
  const merged = mergeXbrlEvidenceDocuments(existing, newDocs);
  if (newDocs.length) {
    cache.symbols[symbol.toUpperCase()] = {symbol:symbol.toUpperCase(),documents:merged};
    cache.updatedAtUtc = new Date().toISOString();
    saveCache(cache, options.cacheFile);
  }
  return {saved:newDocs.length,skipped,failed};
}
