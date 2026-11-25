import { URL } from 'node:url';

export type RevisionPairBasis = 'Standalone' | 'Consolidated';

export interface NseRevisionRow {
  symbol?: string;
  smName?: string;
  seq_Id?: string | number;
  qe_Date?: string;
  type?: string;
  type_Sub?: string;
  audited?: string;
  consolidated?: string;
  broadcast_Date?: string | null;
  creation_Date?: string | null;
  revised_Date?: string | null;
  revision_Remark?: string | null;
  ixbrl?: string;
  xbrl?: string;
}

export interface OriginalRevisionRequest {
  symbol: string;
  period: string;
  basis: RevisionPairBasis;
}

function officialUrl(value: unknown, folder: 'xbrl' | 'ixbrl'): value is string {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:'
      && ['nsearchives.nseindia.in', 'nsearchives.nseindia.com'].includes(u.hostname)
      && u.pathname.startsWith(`/corporate/${folder}/`);
  } catch { return false; }
}

/** Resolve all revisions for one exact original filing; never silently pick the latest. */
export function resolveOriginalRevisionHistory(
  rows: NseRevisionRow[],
  request: OriginalRevisionRequest,
): { original: NseRevisionRow; revisions: NseRevisionRow[]; apiDuplicateRows: number } {
  if (!Array.isArray(rows) || !request.symbol.trim() || !request.period.trim()) {
    throw new Error('Invalid NSE original/revision history request');
  }
  const eligible = (kind: 'Original' | 'Revision') => rows.filter(row =>
    row.symbol === request.symbol
    && row.qe_Date === request.period
    && row.type === 'Integrated Filing- Financials'
    && row.type_Sub === kind
    && row.consolidated === request.basis
    && row.seq_Id !== null && row.seq_Id !== undefined && String(row.seq_Id).trim() !== ''
    && (typeof row.broadcast_Date === 'string' && row.broadcast_Date.trim() !== ''
      || typeof row.revised_Date === 'string' && row.revised_Date.trim() !== ''
      || typeof row.creation_Date === 'string' && row.creation_Date.trim() !== '')
    && officialUrl(row.xbrl, 'xbrl')
    && officialUrl(row.ixbrl, 'ixbrl'),
  );
  const deduplicateExactRows = (items: NseRevisionRow[]) => {
    const bySequence = new Map<string,NseRevisionRow>();
    let duplicateRows = 0;
    const fingerprint = (row: NseRevisionRow) => JSON.stringify([
      row.symbol,row.smName,row.seq_Id,row.qe_Date,row.type,row.type_Sub,row.audited,
      row.consolidated,row.broadcast_Date,row.creation_Date,row.revised_Date,
      row.revision_Remark,row.ixbrl,row.xbrl,
    ]);
    for (const row of items) {
      const id=String(row.seq_Id);
      const existing=bySequence.get(id);
      if (!existing) bySequence.set(id,row);
      else if (fingerprint(existing)===fingerprint(row)) duplicateRows += 1;
      else throw new Error(`Conflicting NSE API rows share sequence ID ${id}`);
    }
    return {rows:[...bySequence.values()],duplicateRows};
  };
  const originalResult=deduplicateExactRows(eligible('Original'));
  const revisionResult=deduplicateExactRows(eligible('Revision'));
  const originals = originalResult.rows;
  const revisions = revisionResult.rows;
  const apiDuplicateRows=originalResult.duplicateRows+revisionResult.duplicateRows;
  if (originals.length !== 1 || revisions.length < 1) {
    throw new Error(`Expected one Original and at least one Revision for ${request.symbol} ${request.period} ${request.basis}; got original=${originals.length}, revision=${revisions.length}`);
  }
  const ids = [String(originals[0].seq_Id), ...revisions.map(row => String(row.seq_Id))];
  if (new Set(ids).size !== ids.length) throw new Error('Original and each Revision must have distinct NSE sequence IDs');
  const monthIndex: Record<string, number> = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 };
  const timestamp = (row: NseRevisionRow): number => {
    const value = row.revised_Date || row.creation_Date || row.broadcast_Date || '';
    const m = /^(\\d{2})-([A-Z]{3})-(\\d{4}) (\\d{2}):(\\d{2}):(\\d{2})$/i.exec(value);
    const month = m ? monthIndex[m[2].toUpperCase()] : undefined;
    if (!m || month === undefined) throw new Error(`Unrecognized NSE revision timestamp: ${value}`);
    const day=Number(m[1]),year=Number(m[3]),hour=Number(m[4]),minute=Number(m[5]),second=Number(m[6]);
    if (hour>23 || minute>59 || second>59) throw new Error(`Invalid NSE revision clock time: ${value}`);
    const parsed=Date.UTC(year,month,day,hour,minute,second);
    const date=new Date(parsed);
    // Date.UTC normalizes impossible dates (e.g. 31-Feb) rather than rejecting
    // them, so compare every calendar component before accepting the timestamp.
    if (date.getUTCFullYear()!==year || date.getUTCMonth()!==month || date.getUTCDate()!==day
        || date.getUTCHours()!==hour || date.getUTCMinutes()!==minute || date.getUTCSeconds()!==second) {
      throw new Error(`Invalid NSE revision calendar date: ${value}`);
    }
    return parsed;
  };
  revisions.sort((a,b)=>timestamp(a)-timestamp(b));
  return { original: originals[0], revisions, apiDuplicateRows };
}

/** Strict single-revision convenience API; ambiguous histories are rejected. */
export function resolveOriginalRevisionPair(
  rows: NseRevisionRow[],
  request: OriginalRevisionRequest,
): { original: NseRevisionRow; revision: NseRevisionRow } {
  const history = resolveOriginalRevisionHistory(rows, request);
  if (history.revisions.length !== 1) {
    throw new Error(`Expected exactly one Revision for ${request.symbol} ${request.period}; got ${history.revisions.length}`);
  }
  return { original: history.original, revision: history.revisions[0] };
}
