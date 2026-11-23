import { URL } from 'node:url';

export type FilingBasis = 'Standalone' | 'Consolidated';

export interface NseFilingRow {
  symbol?: string;
  smName?: string;
  seq_Id?: string | number;
  qe_Date?: string;
  type?: string;
  type_Sub?: string;
  audited?: string;
  consolidated?: string;
  broadcast_Date?: string;
  creation_Date?: string;
  revised_Date?: string | null;
  revision_Remark?: string | null;
  ixbrl?: string;
  xbrl?: string;
}

export interface FilingPairRequest {
  symbol: string;
  basis: FilingBasis;
  currentPeriod: string;
  priorPeriod: string;
}

export interface ResolvedNseFilingPair {
  current: NseFilingRow;
  prior: NseFilingRow;
}

function isOfficialNseArchiveUrl(value: unknown, folder: 'xbrl' | 'ixbrl'): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && ['nsearchives.nseindia.in', 'nsearchives.nseindia.com'].includes(url.hostname)
      && url.pathname.startsWith(`/corporate/${folder}/`);
  } catch {
    return false;
  }
}

/**
 * Resolve exactly one official NSE original filing for each of two periods.
 * Rejects ambiguous, wrong-basis, revised, or non-NSE URL candidates.
 */
export function resolveOriginalNseFilingPair(
  rows: NseFilingRow[],
  request: FilingPairRequest,
): ResolvedNseFilingPair {
  if (!Array.isArray(rows) || !request.symbol.trim() || !request.currentPeriod.trim()
      || !request.priorPeriod.trim() || request.currentPeriod === request.priorPeriod) {
    throw new Error('Invalid NSE filing-pair request');
  }

  const resolveOne = (period: string, label: 'current' | 'prior'): NseFilingRow => {
    const hits = rows.filter(row =>
      row.symbol === request.symbol
      && row.qe_Date === period
      && row.type === 'Integrated Filing- Financials'
      && row.type_Sub === 'Original'
      && row.consolidated === request.basis
      && isOfficialNseArchiveUrl(row.xbrl, 'xbrl')
      && isOfficialNseArchiveUrl(row.ixbrl, 'ixbrl')
      && row.seq_Id !== null && row.seq_Id !== undefined && String(row.seq_Id).trim() !== ''
      && typeof row.broadcast_Date === 'string' && row.broadcast_Date.trim() !== '',
    );
    if (hits.length !== 1) {
      throw new Error(`Expected exactly one ${label} original ${request.basis} NSE filing for ${request.symbol} ${period}; got ${hits.length}`);
    }
    return hits[0];
  };

  return {
    current: resolveOne(request.currentPeriod, 'current'),
    prior: resolveOne(request.priorPeriod, 'prior'),
  };
}

export interface SingleOriginalFilingRequest {
  symbol: string;
  basis: FilingBasis;
  period: string;
}

/** Returns null when no filing exists; throws if the source is ambiguous or malformed. */
export function findUniqueOriginalNseFiling(
  rows: NseFilingRow[],
  request: SingleOriginalFilingRequest,
): NseFilingRow | null {
  if (!Array.isArray(rows) || !request.symbol.trim() || !request.period.trim()) {
    throw new Error('Invalid NSE single-filing request');
  }
  const hits=rows.filter(row =>
    row.symbol===request.symbol
    && row.qe_Date===request.period
    && row.type==='Integrated Filing- Financials'
    && row.type_Sub==='Original'
    && row.consolidated===request.basis
    && isOfficialNseArchiveUrl(row.xbrl,'xbrl')
    && isOfficialNseArchiveUrl(row.ixbrl,'ixbrl')
    && row.seq_Id!==null && row.seq_Id!==undefined && String(row.seq_Id).trim()!==''
    && typeof row.broadcast_Date==='string' && row.broadcast_Date.trim()!=='',
  );
  const bySequence=new Map<string,NseFilingRow>();
  const fingerprint=(row:NseFilingRow)=>JSON.stringify([row.symbol,row.smName,row.seq_Id,row.qe_Date,row.type,row.type_Sub,row.audited,row.consolidated,row.broadcast_Date,row.revised_Date,row.revision_Remark,row.ixbrl,row.xbrl]);
  for(const row of hits){
    const id=String(row.seq_Id);
    const existing=bySequence.get(id);
    if(!existing) bySequence.set(id,row);
    else if(fingerprint(existing)!==fingerprint(row)) throw new Error(`Conflicting NSE original rows share sequence ID ${id}`);
  }
  const unique=[...bySequence.values()];
  if(unique.length>1) throw new Error(`Ambiguous original NSE filings for ${request.symbol} ${request.period} ${request.basis}; got ${unique.length}`);
  return unique[0] ?? null;
}
