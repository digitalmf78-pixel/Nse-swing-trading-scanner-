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

/** Resolves one official Original and one Revision for exactly the same issuer/period/basis. */
export function resolveOriginalRevisionPair(
  rows: NseRevisionRow[],
  request: OriginalRevisionRequest,
): { original: NseRevisionRow; revision: NseRevisionRow } {
  if (!Array.isArray(rows) || !request.symbol.trim() || !request.period.trim()) {
    throw new Error('Invalid NSE original/revision pair request');
  }
  const eligible = (kind: 'Original' | 'Revision') => rows.filter(row =>
    row.symbol === request.symbol
    && row.qe_Date === request.period
    && row.type === 'Integrated Filing- Financials'
    && row.type_Sub === kind
    && row.consolidated === request.basis
    && row.seq_Id !== null && row.seq_Id !== undefined && String(row.seq_Id).trim() !== ''
    && (typeof row.broadcast_Date === 'string' && row.broadcast_Date.trim() !== ''
      || typeof row.revised_Date === 'string' && row.revised_Date.trim() !== '')
    && officialUrl(row.xbrl, 'xbrl')
    && officialUrl(row.ixbrl, 'ixbrl'),
  );
  const originals = eligible('Original');
  const revisions = eligible('Revision');
  if (originals.length !== 1 || revisions.length !== 1) {
    throw new Error(`Expected one Original and one Revision for ${request.symbol} ${request.period} ${request.basis}; got original=${originals.length}, revision=${revisions.length}`);
  }
  if (String(originals[0].seq_Id) === String(revisions[0].seq_Id)) {
    throw new Error('Original and Revision must have distinct NSE sequence IDs');
  }
  return { original: originals[0], revision: revisions[0] };
}
