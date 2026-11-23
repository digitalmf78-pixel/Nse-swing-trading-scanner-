import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fetchNseEquityMaster, loadNseEquityMasterCache } from './nseEquityMasterCache.ts';
import { buildNseIndustryText, loadNseIssuerIndustryCache, NseIssuerIndustryClient, saveNseIssuerIndustryCache, type NseIssuerIndustryCache, type NseIssuerIndustryRecord } from './nseIssuerIndustryCache.ts';
import { collectNseFilingHistoryForSymbols, loadNseFilingHistoryCache } from './nseFilingHistoryCache.ts';
import { collectXbrlEvidenceForFilingRows, type NseXbrlEvidenceDocument } from './nseXbrlEvidenceCache.ts';
import { resolveNseConceptMap } from '../research/fundamental_pilot/nse_concept_map_resolver.ts';
import { buildSevenMetricXbrlPipeline } from '../research/fundamental_pilot/seven_metric_xbrl_pipeline.ts';
import { selectXbrlMetricFact } from '../research/fundamental_pilot/xbrl_metric_fact_selector.ts';
import { buildNseEpsCandidate, type NseEpsCandidate } from '../research/fundamental_pilot/nse_eps_candidate.ts';
import type { IssuerSector } from '../research/fundamental_pilot/sector_metric_policy.ts';
import type { IssuerMetricConceptMap } from '../research/fundamental_pilot/seven_metric_xbrl_pipeline.ts';
import type { NseRevisionRow } from '../research/fundamental_pilot/nse_revision_pair.ts';
import type { XbrlExtraction } from '../research/fundamental_pilot/xbrl_extract.ts';

export interface NseComparableFilingPair {
  symbol: string;
  basis: 'Standalone' | 'Consolidated';
  currentPeriodEnd: string;
  priorPeriodEnd: string;
  currentOriginal: NseRevisionRow;
  priorOriginal: NseRevisionRow;
  currentRows: NseRevisionRow[];
  priorRows: NseRevisionRow[];
}

export interface NseRevisionMetricAudit {
  stable: boolean;
  checkedRevisions: number;
  stableMetrics: string[];
  changedMetrics: string[];
  issues: string[];
}

export interface NseFilingEvidenceProvenance {
  sequenceId: string;
  submission: 'Original' | 'Revision';
  periodEnd: string;
  basis: 'Standalone' | 'Consolidated';
  audited: string | null;
  publishedAt: string | null;
  revisedAt: string | null;
  revisionRemark: string | null;
  xbrlUrl: string;
  ixbrlUrl: string;
}

export interface NseFundamentalResearchResult {
  symbol: string;
  status: 'CANDIDATE_READY' | 'REVISION_REVIEW_REQUIRED' | 'BLOCKED';
  sector: IssuerSector;
  basis?: 'STANDALONE' | 'CONSOLIDATED';
  currentPeriodEnd?: string;
  priorPeriodEnd?: string;
  candidateReport?: ReturnType<typeof buildSevenMetricXbrlPipeline>;
  epsCandidate?: NseEpsCandidate;
  revisionAudit?: NseRevisionMetricAudit;
  filingEvidence?: {
    currentOriginal: NseFilingEvidenceProvenance;
    currentRevisions: NseFilingEvidenceProvenance[];
    priorOriginal: NseFilingEvidenceProvenance;
    priorRevisions: NseFilingEvidenceProvenance[];
  };
  isin?: string;
  isinVerified?: boolean;
  industryClassification?: NseIssuerIndustryRecord | null;
  xbrlEntityIdentity?: {
    entityScheme: string;
    entityIdentifier: string;
    documentsChecked: number;
    matchesOfficialNseIsin: true;
  };
  scannerEligible: false;
  productionApproved: false;
  warnings: string[];
}

export interface NseFundamentalResearchStatus {
  running: boolean;
  scope: 'BHAVCOPY' | 'SINGLE';
  total: number;
  processed: number;
  filingHistoryProcessed: number;
  filingHistorySucceeded: number;
  xbrlDocumentsSaved: number;
  succeeded: number;
  candidateReady: number;
  revisionReviewRequired: number;
  failed: number;
  currentSymbol: string;
  startedAtUtc: string;
  finishedAtUtc: string;
  lastError: string | null;
  candidateCacheFile: string;
}

interface CandidateCacheEntry {
  reportHash: string;
  savedAtUtc: string;
  report: NseFundamentalResearchResult;
}
interface CandidateCache {
  schemaVersion: 1;
  updatedAtUtc: string;
  symbols: Record<string, { symbol: string; reports: CandidateCacheEntry[] }>;
}

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};
const CANDIDATE_CACHE_FILE = path.join(process.cwd(), 'data', 'research', 'nse_fundamental_candidate_cache.json');

let job: NseFundamentalResearchStatus = {
  running: false, scope: 'BHAVCOPY', total: 0, processed: 0,
  filingHistoryProcessed: 0, filingHistorySucceeded: 0, xbrlDocumentsSaved: 0,
  succeeded: 0, candidateReady: 0, revisionReviewRequired: 0, failed: 0,
  currentSymbol: '', startedAtUtc: '', finishedAtUtc: '', lastError: null,
  candidateCacheFile: CANDIDATE_CACHE_FILE,
};

export function getNseFundamentalResearchStatus(): NseFundamentalResearchStatus {
  return { ...job };
}

export function parseNseFinancialPeriodEnd(value: string | null | undefined): string | null {
  const match = String(value ?? '').trim().match(/^(\d{1,2})-([A-Z]{3})-(\d{4})$/i);
  if (!match) return null;
  const month = MONTHS[match[2].toUpperCase()];
  if (month === undefined) return null;
  const day = Number(match[1]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function shiftIsoYear(value: string, delta: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const targetYear = year + delta;
  const date = new Date(Date.UTC(targetYear, month - 1, day));
  if (date.getUTCFullYear() !== targetYear || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function isFinancialOriginal(row: NseRevisionRow, symbol: string, basis: string): boolean {
  return String(row.symbol ?? '').trim().toUpperCase() === symbol
    && row.type === 'Integrated Filing- Financials'
    && row.type_Sub === 'Original'
    && row.consolidated === basis
    && Boolean(String(row.seq_Id ?? '').trim())
    && Boolean(row.xbrl);
}

export function selectLatestComparableFilingPair(
  rawRows: NseRevisionRow[],
  rawSymbol: string,
): NseComparableFilingPair | null {
  const symbol = rawSymbol.trim().toUpperCase();
  const rows = rawRows.filter(row =>
    String(row.symbol ?? '').trim().toUpperCase() === symbol
    && row.type === 'Integrated Filing- Financials'
    && (row.type_Sub === 'Original' || row.type_Sub === 'Revision')
    && (row.consolidated === 'Standalone' || row.consolidated === 'Consolidated')
  );
  const latestPeriods = [...new Set(rows
    .map(row => parseNseFinancialPeriodEnd(row.qe_Date))
    .filter((value): value is string => Boolean(value)))].sort((a, b) => b.localeCompare(a));
  const latestPeriod = latestPeriods[0];
  if (!latestPeriod) return null;
  const priorPeriod = shiftIsoYear(latestPeriod, -1);
  if (!priorPeriod) return null;

  const candidates: NseComparableFilingPair[] = [];
  for (const basis of ['Consolidated', 'Standalone'] as const) {
    const currentOriginals = rows.filter(row =>
      isFinancialOriginal(row, symbol, basis)
      && parseNseFinancialPeriodEnd(row.qe_Date) === latestPeriod
    );
    const priorOriginals = rows.filter(row =>
      isFinancialOriginal(row, symbol, basis)
      && parseNseFinancialPeriodEnd(row.qe_Date) === priorPeriod
    );
    if (currentOriginals.length !== 1 || priorOriginals.length !== 1) continue;
    const rowsFor = (end: string) => rows.filter(row =>
      row.consolidated === basis
      && parseNseFinancialPeriodEnd(row.qe_Date) === end
    );
    candidates.push({
      symbol, basis, currentPeriodEnd: latestPeriod, priorPeriodEnd: priorPeriod,
      currentOriginal: currentOriginals[0], priorOriginal: priorOriginals[0],
      currentRows: rowsFor(latestPeriod), priorRows: rowsFor(priorPeriod),
    });
  }
  candidates.sort((a, b) => a.basis === 'Consolidated' ? -1 : b.basis === 'Consolidated' ? 1 : 0);
  return candidates[0] ?? null;
}

export function classifyIssuerSector(rawSector: string | null | undefined): IssuerSector {
  const value = String(rawSector ?? '').trim().toLowerCase();
  if (!value) return 'UNKNOWN';
  if (/\binsurance\b/.test(value)) return 'INSURANCE';
  if (/\bnbfc\b|non[- ]?banking financial|housing finance|microfinance/.test(value)) return 'NBFC';
  if (/\bbanks?\b|banking/.test(value)) return 'BANK';
  if (/financial|finance|investment|capital market|asset management|brokerage/.test(value)) return 'UNKNOWN';
  return 'NON_FINANCIAL';
}

export interface XbrlIssuerIdentityAudit {
  valid: boolean;
  entityScheme: string | null;
  entityIdentifier: string | null;
  documentsChecked: number;
  issues: string[];
}

/**
 * A filing URL/symbol is not sufficient proof that its XBRL facts belong to
 * the intended issuer. Require every fact context across Original and Revision
 * documents to carry one consistent entity identity, and require that identity
 * to match the official NSE ISIN before calculating candidates.
 */
export function auditXbrlIssuerIdentity(
  documents: XbrlExtraction[],
  officialIsin: string | null,
): XbrlIssuerIdentityAudit {
  const issues: string[] = [];
  if (!officialIsin || !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(officialIsin)) {
    issues.push('Official NSE ISIN is missing or invalid.');
  }
  if (documents.length < 2) issues.push('Current and prior XBRL documents are both required for issuer identity comparison.');
  let sharedScheme: string | null = null;
  let sharedIdentifier: string | null = null;

  for (let index = 0; index < documents.length; index++) {
    const extraction = documents[index];
    const contextRefs = [...new Set(extraction.facts.map(fact => fact.contextRef).filter((value): value is string => Boolean(value)))];
    if (!contextRefs.length || extraction.facts.some(fact => !fact.contextRef)) {
      issues.push('XBRL document ' + (index + 1) + ' contains facts without complete context references.');
      continue;
    }
    const identities = new Set<string>();
    for (const contextRef of contextRefs) {
      const context = extraction.contexts[contextRef];
      if (!context || !context.entityScheme?.trim() || !context.entityIdentifier?.trim()) {
        issues.push('XBRL document ' + (index + 1) + ' has a context with missing entity scheme/identifier.');
        continue;
      }
      identities.add(context.entityScheme.trim() + '|' + context.entityIdentifier.trim().toUpperCase());
    }
    if (identities.size !== 1) {
      issues.push('XBRL document ' + (index + 1) + ' does not have exactly one consistent entity identity across fact contexts.');
      continue;
    }
    const identity = [...identities][0];
    const separator = identity.indexOf('|');
    const scheme = identity.slice(0, separator);
    const identifier = identity.slice(separator + 1);
    if (sharedScheme === null) {
      sharedScheme = scheme;
      sharedIdentifier = identifier;
    } else if (sharedScheme !== scheme || sharedIdentifier !== identifier) {
      issues.push('XBRL issuer entity identity differs across Original/Revision documents.');
    }
  }

  if (sharedIdentifier && officialIsin && sharedIdentifier !== officialIsin) {
    issues.push('XBRL entity identifier does not match the official NSE ISIN.');
  }
  return {
    valid: issues.length === 0,
    entityScheme: sharedScheme,
    entityIdentifier: sharedIdentifier,
    documentsChecked: documents.length,
    issues,
  };
}

export function inferExactPeriodStart(
  extraction: NseXbrlEvidenceDocument['extraction'],
  periodEnd: string,
  concepts: IssuerMetricConceptMap,
): string | null {
  const conceptNames = [concepts.revenue, concepts.profit];
  const startsByConcept = conceptNames.map(concept => {
    const starts = new Set<string>();
    for (const fact of extraction.facts) {
      if (fact.concept !== concept || !fact.contextRef) continue;
      const context = extraction.contexts[fact.contextRef];
      if (!context || context.periodEnd !== periodEnd || context.instant !== null
          || !context.periodStart || context.dimensions.length !== 0) continue;
      starts.add(context.periodStart);
    }
    return starts;
  });
  const common = [...startsByConcept[0]].filter(start =>
    startsByConcept.every(set => set.has(start))
  );
  return common.length === 1 ? common[0] : null;
}

export function resolveGrowthResearchStatus(
  revenueStatus: string | null | undefined,
  profitStatus: string | null | undefined,
  stableMetrics: string[],
): 'CANDIDATE_READY' | 'REVISION_REVIEW_REQUIRED' | 'BLOCKED' {
  if (revenueStatus !== 'CANDIDATE_ONLY' || profitStatus !== 'CANDIDATE_ONLY') return 'BLOCKED';
  const revenueStable = stableMetrics.includes('REVENUE_GROWTH_INPUT');
  const profitStable = stableMetrics.includes('PROFIT_GROWTH_INPUT');
  return revenueStable && profitStable ? 'CANDIDATE_READY' : 'REVISION_REVIEW_REQUIRED';
}

export function classifyNsePeriodType(periodStart: string, periodEnd: string): 'QUARTER' | 'YTD' | 'FY' | null {
  const startMs = Date.parse(periodStart + 'T00:00:00Z');
  const endMs = Date.parse(periodEnd + 'T00:00:00Z');
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) return null;
  const days = Math.round((endMs - startMs) / 86400000) + 1;
  if (days >= 75 && days <= 105) return 'QUARTER';
  if (days >= 165 && days <= 195) return 'YTD';
  if (days >= 250 && days <= 285) return 'YTD';
  if (days >= 340 && days <= 380) return 'FY';
  return null;
}

function loadCandidateCache(): CandidateCache {
  if (!fs.existsSync(CANDIDATE_CACHE_FILE)) return { schemaVersion: 1, updatedAtUtc: '', symbols: {} };
  const parsed = JSON.parse(fs.readFileSync(CANDIDATE_CACHE_FILE, 'utf8')) as Partial<CandidateCache>;
  if (parsed.schemaVersion !== 1 || !parsed.symbols || typeof parsed.symbols !== 'object' || Array.isArray(parsed.symbols)) {
    throw new Error('NSE candidate cache schema invalid; refusing to overwrite');
  }
  for (const [symbol, entry] of Object.entries(parsed.symbols)) {
    if (symbol !== symbol.trim().toUpperCase() || !entry || entry.symbol !== symbol || !Array.isArray(entry.reports)) {
      throw new Error('NSE candidate cache issuer entry invalid: ' + symbol);
    }
    for (const item of entry.reports) {
      if (!item || !item.report || item.report.symbol !== symbol || !/^[a-f0-9]{64}$/.test(item.reportHash)
          || createHash('sha256').update(JSON.stringify(item.report)).digest('hex') !== item.reportHash) {
        throw new Error('NSE candidate cache report integrity failed: ' + symbol);
      }
    }
  }
  return { schemaVersion: 1, updatedAtUtc: parsed.updatedAtUtc ?? '', symbols: parsed.symbols };
}

function appendCandidateReport(report: NseFundamentalResearchResult, cache: CandidateCache): void {
  const symbol = report.symbol.trim().toUpperCase();
  const hash = createHash('sha256').update(JSON.stringify(report)).digest('hex');
  const entry = cache.symbols[symbol] ?? { symbol, reports: [] };
  if (!entry.reports.some(item => item.reportHash === hash)) {
    entry.reports.push({ reportHash: hash, savedAtUtc: new Date().toISOString(), report });
  }
  cache.symbols[symbol] = entry;
  cache.updatedAtUtc = new Date().toISOString();
}

function saveCandidateCache(cache: CandidateCache): void {
  fs.mkdirSync(path.dirname(CANDIDATE_CACHE_FILE), { recursive: true });
  const temp = CANDIDATE_CACHE_FILE + '.tmp.' + process.pid + '.' + Date.now();
  fs.writeFileSync(temp, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, CANDIDATE_CACHE_FILE);
}

export function getNseFundamentalCandidateReports(symbol?: string, limit = 100): {
  source: 'NSE_OFFICIAL';
  productionApproved: false;
  symbols: number;
  reportCount: number;
  reports: Array<{ reportHash: string; savedAtUtc: string; report: NseFundamentalResearchResult }>;
} {
  const cache = loadCandidateCache();
  const normalized = symbol?.trim().toUpperCase();
  const entries = normalized
    ? (cache.symbols[normalized]?.reports ?? [])
    : Object.values(cache.symbols).flatMap(entry => entry.reports);
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(1000, Math.floor(limit))) : 100;
  const reports = [...entries].sort((a, b) => b.savedAtUtc.localeCompare(a.savedAtUtc))
    .slice(0, safeLimit);
  return {
    source: 'NSE_OFFICIAL',
    productionApproved: false,
    symbols: normalized ? (cache.symbols[normalized] ? 1 : 0) : Object.keys(cache.symbols).length,
    reportCount: reports.length,
    reports,
  };
}

function selectedValue(
  document: NseXbrlEvidenceDocument,
  concept: string,
  periodStart: string,
  periodEnd: string,
  periodType: 'QUARTER' | 'YTD' | 'FY',
  basis: 'STANDALONE' | 'CONSOLIDATED',
): number | null {
  const selection = selectXbrlMetricFact(document.extraction, {
    concept, periodStart, periodEnd, periodType, basis, filingBasis: basis,
  });
  return selection.status === 'SELECTED_UNIQUE_GROUP_FACT' ? selection.fact?.numericValue ?? null : null;
}

function auditRevisions(
  original: NseXbrlEvidenceDocument,
  revisions: NseXbrlEvidenceDocument[],
  concepts: IssuerMetricConceptMap,
  periodStart: string,
  periodEnd: string,
  periodType: 'QUARTER' | 'YTD' | 'FY',
  basis: 'STANDALONE' | 'CONSOLIDATED',
): NseRevisionMetricAudit {
  const metrics: Array<[string, string]> = [
    ['REVENUE_GROWTH_INPUT', concepts.revenue],
    ['PROFIT_GROWTH_INPUT', concepts.profit],
  ];
  if (concepts.operatingCashFlow) metrics.push(['OPERATING_CASH_FLOW_INPUT', concepts.operatingCashFlow]);
  const changedMetrics: string[] = [];
  const issues: string[] = [];
  const stableMetrics: string[] = [];
  for (const [label, concept] of metrics) {
    let stable = true;
    const originalValue = selectedValue(original, concept, periodStart, periodEnd, periodType, basis);
    if (originalValue === null) {
      issues.push(label + ': original exact-period fact is not uniquely selectable');
      stable = false;
    }
    if (originalValue !== null) {
      for (const revision of revisions) {
        const revisionValue = selectedValue(revision, concept, periodStart, periodEnd, periodType, basis);
        if (revisionValue === null) {
          issues.push(label + ': revision ' + revision.seqId + ' has no unique exact-period fact');
          stable = false;
        } else if (Math.abs(revisionValue - originalValue) > Math.max(0.000001, Math.abs(originalValue) * 1e-10)) {
          if (!changedMetrics.includes(label)) changedMetrics.push(label);
          stable = false;
        }
      }
    }
    if (stable) stableMetrics.push(label);
  }
  return {
    stable: changedMetrics.length === 0 && issues.length === 0,
    checkedRevisions: revisions.length,
    stableMetrics,
    changedMetrics,
    issues,
  };
}

function filingEvidenceProvenance(
  row: NseRevisionRow,
  basis: 'Standalone' | 'Consolidated',
  periodEnd: string,
): NseFilingEvidenceProvenance {
  return {
    sequenceId: String(row.seq_Id ?? ''),
    submission: row.type_Sub === 'Revision' ? 'Revision' : 'Original',
    periodEnd,
    basis,
    audited: row.audited?.trim() || null,
    publishedAt: row.broadcast_Date || row.creation_Date || null,
    revisedAt: row.revised_Date || null,
    revisionRemark: row.revision_Remark || null,
    xbrlUrl: row.xbrl || '',
    ixbrlUrl: row.ixbrl || '',
  };
}

function buildFilingEvidence(pair: NseComparableFilingPair): NseFundamentalResearchResult['filingEvidence'] {
  return {
    currentOriginal: filingEvidenceProvenance(pair.currentOriginal, pair.basis, pair.currentPeriodEnd),
    currentRevisions: pair.currentRows
      .filter(row => row.type_Sub === 'Revision')
      .map(row => filingEvidenceProvenance(row, pair.basis, pair.currentPeriodEnd)),
    priorOriginal: filingEvidenceProvenance(pair.priorOriginal, pair.basis, pair.priorPeriodEnd),
    priorRevisions: pair.priorRows
      .filter(row => row.type_Sub === 'Revision')
      .map(row => filingEvidenceProvenance(row, pair.basis, pair.priorPeriodEnd)),
  };
}

function blocked(symbol: string, sector: IssuerSector, reason: string): NseFundamentalResearchResult {
  return {
    symbol, status: 'BLOCKED', sector, scannerEligible: false, productionApproved: false,
    warnings: [reason],
  };
}

async function processIssuer(
  symbol: string,
  sector: IssuerSector,
  rows: NseRevisionRow[],
  fetchImpl: typeof fetch,
  isin: string | null,
): Promise<{ report: NseFundamentalResearchResult; xbrlSaved: number }> {
  if (!isin) {
    return { report: blocked(symbol, sector, 'Official NSE issuer ISIN is unavailable; XBRL identity cannot be verified.'), xbrlSaved: 0 };
  }
  if (sector !== 'NON_FINANCIAL') {
    const reason = sector === 'UNKNOWN'
      ? 'Official NSE industry classification is missing or unrecognized; issuer is not assumed to be non-financial.'
      : 'Issuer belongs to ' + sector + '; industrial-company metric formulas are not applied to financial-sector issuers.';
    return { report: blocked(symbol, sector, reason), xbrlSaved: 0 };
  }
  const pair = selectLatestComparableFilingPair(rows, symbol);
  if (!pair) return { report: blocked(symbol, sector, 'No exact current and prior-year Original NSE financial filing pair with matching basis was found.'), xbrlSaved: 0 };

  const relevantRows = [...pair.currentRows, ...pair.priorRows];
  const download = await collectXbrlEvidenceForFilingRows(symbol, relevantRows, { fetchImpl });
  if (download.failed.length > 0) {
    return {
      report: blocked(symbol, sector, 'One or more current/prior Original or Revision XBRL documents failed: ' + download.failed.map(item => item.seqId + ' ' + item.error).join('; ')),
      xbrlSaved: download.saved,
    };
  }

  const docs = download.documents;
  const bySeq = new Map(docs.map(doc => [String(doc.seqId), doc]));
  const currentDoc = bySeq.get(String(pair.currentOriginal.seq_Id));
  const priorDoc = bySeq.get(String(pair.priorOriginal.seq_Id));
  if (!currentDoc || !priorDoc) {
    return { report: blocked(symbol, sector, 'Original XBRL evidence is missing from the immutable NSE evidence cache.'), xbrlSaved: download.saved };
  }
  if (currentDoc.extraction.warnings.length || priorDoc.extraction.warnings.length) {
    return { report: blocked(symbol, sector, 'XBRL parser warnings are present; candidate calculation is withheld.'), xbrlSaved: download.saved };
  }
  const identityAudit = auditXbrlIssuerIdentity(
    docs.map(doc => doc.extraction), isin,
  );
  if (!identityAudit.valid) {
    return {
      report: blocked(symbol, sector, 'XBRL issuer identity validation failed: ' + identityAudit.issues.join('; ')),
      xbrlSaved: download.saved,
    };
  }

  const basis = pair.basis === 'Standalone' ? 'STANDALONE' : 'CONSOLIDATED';
  const mapping = resolveNseConceptMap(sector, basis, currentDoc.extraction, priorDoc.extraction);
  if (mapping.status === 'BLOCKED' || !mapping.conceptMap) {
    const reasons = Object.values(mapping.metrics)
      .filter(item => item.status !== 'MAPPED')
      .map(item => item.metric + ': ' + item.status + ' — ' + item.explanation);
    return { report: blocked(symbol, sector, 'Automatic NSE concept mapping blocked: ' + reasons.join('; ')), xbrlSaved: download.saved };
  }

  const currentStart = inferExactPeriodStart(currentDoc.extraction, pair.currentPeriodEnd, mapping.conceptMap);
  const priorStart = inferExactPeriodStart(priorDoc.extraction, pair.priorPeriodEnd, mapping.conceptMap);
  if (!currentStart || !priorStart) {
    return { report: blocked(symbol, sector, 'Could not infer one unique common undimensioned period start for Revenue, Profit and OCF facts.'), xbrlSaved: download.saved };
  }
  const currentType = classifyNsePeriodType(currentStart, pair.currentPeriodEnd);
  const priorType = classifyNsePeriodType(priorStart, pair.priorPeriodEnd);
  if (!currentType || currentType !== priorType) {
    return { report: blocked(symbol, sector, 'Current/prior XBRL periods do not have the same supported duration type.'), xbrlSaved: download.saved };
  }
  if (shiftIsoYear(priorStart, 1) !== currentStart || shiftIsoYear(pair.priorPeriodEnd, 1) !== pair.currentPeriodEnd) {
    return { report: blocked(symbol, sector, 'Current/prior XBRL duration dates are not exact one-year aligned.'), xbrlSaved: download.saved };
  }

  const currentBasis = currentDoc.basis === 'Standalone' ? 'STANDALONE' : 'CONSOLIDATED';
  const priorBasis = priorDoc.basis === 'Standalone' ? 'STANDALONE' : 'CONSOLIDATED';
  const candidateReport = buildSevenMetricXbrlPipeline(
    sector,
    {
      extraction: currentDoc.extraction, periodType: currentType, periodStart: currentStart,
      periodEnd: pair.currentPeriodEnd, basis, filingBasis: currentBasis,
    },
    {
      extraction: priorDoc.extraction, periodType: priorType, periodStart: priorStart,
      periodEnd: pair.priorPeriodEnd, basis, filingBasis: priorBasis,
    },
    mapping.conceptMap,
  );

  const revisionDocsFor = (periodRows: NseRevisionRow[]) => periodRows
    .filter(row => row.type_Sub === 'Revision')
    .map(row => bySeq.get(String(row.seq_Id)))
    .filter((doc): doc is NseXbrlEvidenceDocument => Boolean(doc));
  const currentRevisionDocs = revisionDocsFor(pair.currentRows);
  const priorRevisionDocs = revisionDocsFor(pair.priorRows);
  if ([...currentRevisionDocs, ...priorRevisionDocs].some(doc => doc.extraction.warnings.length > 0)) {
    return { report: blocked(symbol, sector, 'A revision XBRL parser warning is present; revision comparison is incomplete.'), xbrlSaved: download.saved };
  }
  const epsCandidate = buildNseEpsCandidate(
    {
      extraction: currentDoc.extraction, periodStart: currentStart,
      periodEnd: pair.currentPeriodEnd, periodType: currentType, basis,
    },
    {
      extraction: priorDoc.extraction, periodStart: priorStart,
      periodEnd: pair.priorPeriodEnd, periodType: priorType, basis,
    },
    currentRevisionDocs.map(doc => doc.extraction),
    priorRevisionDocs.map(doc => doc.extraction),
  );
  const currentRevisionAudit = auditRevisions(
    currentDoc, currentRevisionDocs, mapping.conceptMap, currentStart,
    pair.currentPeriodEnd, currentType, basis,
  );
  const priorRevisionAudit = auditRevisions(
    priorDoc, priorRevisionDocs, mapping.conceptMap, priorStart,
    pair.priorPeriodEnd, priorType, basis,
  );
  const stableMetrics = currentRevisionAudit.stableMetrics.filter(metric =>
    priorRevisionAudit.stableMetrics.includes(metric)
  );
  const revisionAudit: NseRevisionMetricAudit = {
    stable: currentRevisionAudit.stable && priorRevisionAudit.stable,
    checkedRevisions: currentRevisionAudit.checkedRevisions + priorRevisionAudit.checkedRevisions,
    stableMetrics,
    changedMetrics: [...new Set([...currentRevisionAudit.changedMetrics, ...priorRevisionAudit.changedMetrics])],
    issues: [...currentRevisionAudit.issues, ...priorRevisionAudit.issues],
  };
  const hasRevisionHistory = pair.currentRows.some(row => row.type_Sub === 'Revision')
    || pair.priorRows.some(row => row.type_Sub === 'Revision');
  const revenueCandidate = candidateReport.candidateReport.candidates.revenueGrowth;
  const profitCandidate = candidateReport.candidateReport.candidates.profitGrowth;
  const candidateIssues = [
    ['Revenue Growth', revenueCandidate?.status],
    ['Profit Growth', profitCandidate?.status],
  ].filter(([, status]) => status !== 'CANDIDATE_ONLY')
    .map(([metric, status]) => metric + ': candidate calculation status ' + String(status ?? 'MISSING'));
  const ocfCandidate = candidateReport.candidateReport.candidates.operatingCashFlow;
  const ocfIssue = ocfCandidate?.status === 'CANDIDATE_ONLY'
    ? ''
    : 'Operating Cash Flow is independently ' + String(ocfCandidate?.status ?? 'MISSING') + '; it does not suppress Revenue/Profit Growth candidates.';

  const status = resolveGrowthResearchStatus(
    revenueCandidate?.status, profitCandidate?.status, stableMetrics,
  );
  const warnings = [
    ...(hasRevisionHistory ? ['Every available Original/Revision exact-period Revenue, Profit and OCF fact was compared independently.'] : []),
    ...revisionAudit.changedMetrics.map(metric => metric + ' changed in revision history.'),
    ...revisionAudit.issues,
    ...candidateIssues,
    ...(ocfIssue ? [ocfIssue] : []),
    'NSE Basic EPS candidate: ' + epsCandidate.status + '.',
    ...epsCandidate.warnings,
    isin ? 'Issuer ISIN matched the official NSE equity master.' : 'Official NSE equity master ISIN is unavailable; issuer identity is not complete.',
    'Research candidates only: no values are written to the production scanner cache.',
    'Production release remains blocked until formula approval and independent statement validation are complete.',
    'OCF statement reconciliation and signed statement PDF cross-check remain required.',
  ];
  const report: NseFundamentalResearchResult = {
    symbol, status, sector, isin: isin ?? undefined, isinVerified: Boolean(isin),
    basis, currentPeriodEnd: pair.currentPeriodEnd,
    priorPeriodEnd: pair.priorPeriodEnd, candidateReport, epsCandidate, revisionAudit,
    xbrlEntityIdentity: identityAudit.entityScheme && identityAudit.entityIdentifier
      ? {
          entityScheme: identityAudit.entityScheme,
          entityIdentifier: identityAudit.entityIdentifier,
          documentsChecked: identityAudit.documentsChecked,
          matchesOfficialNseIsin: true,
        }
      : undefined,
    scannerEligible: false, productionApproved: false, warnings,
  };
  return { report, xbrlSaved: download.saved };
}

async function runCollection(
  symbols: string[],
  fetchImpl: typeof fetch,
): Promise<void> {
  let candidateCache: CandidateCache | null = null;
  let candidateCacheDirty = false;
  let industryCache: NseIssuerIndustryCache | null = null;
  let industryCacheDirty = false;
  try {
    candidateCache = loadCandidateCache();
    industryCache = loadNseIssuerIndustryCache();

    const quoteClient = new NseIssuerIndustryClient({ fetchImpl });

    let isinBySymbol: Record<string, string> = {};
    try {
      const equityMaster = await fetchNseEquityMaster(fetchImpl);
      isinBySymbol = Object.fromEntries(Object.entries(equityMaster.symbols).map(([symbol, item]) => [symbol, item.isin]));
    } catch (error) {
      try {
        const cachedMaster = loadNseEquityMasterCache();
        const ageMs = Date.now() - Date.parse(cachedMaster.fetchedAtUtc);
        if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= 30 * 24 * 60 * 60 * 1000) {
          isinBySymbol = Object.fromEntries(Object.entries(cachedMaster.symbols).map(([symbol, item]) => [symbol, item.isin]));
          job.lastError = 'Using recent cached official NSE equity master after refresh failure: ' + (error as Error).message;
        } else {
          job.lastError = 'NSE equity master refresh failed and cached ISIN data is stale: ' + (error as Error).message;
        }
      } catch {
        job.lastError = 'NSE equity master unavailable; issuer identity will remain unverified: ' + (error as Error).message;
      }
    }

    const filingReport = await collectNseFilingHistoryForSymbols(symbols, {
      concurrency: 1,
      fetchImpl,
      onIssuerComplete: (symbol, ok, error) => {
        job.currentSymbol = symbol;
        job.filingHistoryProcessed += 1;
        if (ok) job.filingHistorySucceeded += 1;
        else job.lastError = symbol + ': ' + (error ?? 'NSE filing metadata fetch failed');
      },
    });
    const filingCache = loadNseFilingHistoryCache();
    const filingFailures = new Map(filingReport.failed.map(item => [item.symbol, item.error]));

    for (const symbol of symbols) {
      job.currentSymbol = symbol;
      const cachedRows = filingCache.symbols[symbol]?.rows ?? [];
      let industryRecord: NseIssuerIndustryRecord | undefined = industryCache.symbols[symbol];
      let sector: IssuerSector = 'UNKNOWN';

      try {
        const industryAge = industryRecord
          ? Date.now() - Date.parse(industryRecord.fetchedAtUtc)
          : Number.POSITIVE_INFINITY;
        const industryIsFresh = Boolean(industryRecord
          && Number.isFinite(industryAge)
          && industryAge >= 0
          && industryAge <= 30 * 24 * 60 * 60 * 1000);

        if (!industryIsFresh) {
          try {
            industryRecord = await quoteClient.fetchIssuerIndustry(symbol);
            industryCache.symbols[symbol] = industryRecord;
            industryCache.updatedAtUtc = new Date().toISOString();
            industryCacheDirty = true;
          } catch (error) {
            industryRecord = undefined;
            job.lastError = symbol + ': NSE official industry lookup failed: ' + (error as Error).message;
          }
        }

        sector = classifyIssuerSector(industryRecord ? buildNseIndustryText(industryRecord) : '');
        const quoteIsin = industryRecord?.isin || '';
        const masterIsin = isinBySymbol[symbol] || '';
        const isinConflict = Boolean(quoteIsin && masterIsin && quoteIsin !== masterIsin);
        const verifiedIsin = isinConflict ? undefined : quoteIsin || masterIsin || undefined;

        if (isinConflict) {
          const report = blocked(symbol, sector,
            'NSE quote-equity ISIN conflicts with NSE official equity master; issuer identity is blocked.');
          report.isinVerified = false;
          report.industryClassification = industryRecord;
          appendCandidateReport(report, candidateCache);
          candidateCacheDirty = true;
          job.processed += 1;
          job.failed += 1;
          job.lastError = report.warnings[0];
        } else if (filingFailures.has(symbol)) {
          const report = blocked(symbol, sector,
            'Fresh NSE filing metadata fetch failed; stale cached filing history was not used: ' + filingFailures.get(symbol));
          report.isin = verifiedIsin;
          report.isinVerified = Boolean(verifiedIsin);
          report.industryClassification = industryRecord;
          appendCandidateReport(report, candidateCache);
          candidateCacheDirty = true;
          job.processed += 1;
          job.failed += 1;
          job.lastError = report.warnings[0];
        } else {
          const result = await processIssuer(symbol, sector, cachedRows, fetchImpl, verifiedIsin ?? null);
          try {
            const evidencePair = selectLatestComparableFilingPair(cachedRows, symbol);
            if (evidencePair) result.report.filingEvidence = buildFilingEvidence(evidencePair);
          } catch (error) {
            result.report.warnings.push('Filing provenance summary could not be generated: ' + (error as Error).message);
          }
          result.report.industryClassification = industryRecord;
          job.xbrlDocumentsSaved += result.xbrlSaved;
          appendCandidateReport(result.report, candidateCache);
          candidateCacheDirty = true;
          job.processed += 1;
          if (result.report.status === 'BLOCKED') {
            job.failed += 1;
            job.lastError = result.report.warnings[0] ?? symbol + ': blocked';
          } else {
            job.succeeded += 1;
            if (result.report.status === 'CANDIDATE_READY') job.candidateReady += 1;
            else job.revisionReviewRequired += 1;
          }
        }
      } catch (error) {
        const report = blocked(symbol, sector, (error as Error).message);
        const verifiedIsin = industryRecord?.isin || isinBySymbol[symbol] || undefined;
        report.isin = verifiedIsin;
        report.isinVerified = Boolean(verifiedIsin);
        report.industryClassification = industryRecord;
        appendCandidateReport(report, candidateCache);
        candidateCacheDirty = true;
        job.processed += 1;
        job.failed += 1;
        job.lastError = report.warnings[0];
      }

      if (candidateCacheDirty && job.processed > 0 && job.processed % 25 === 0) {
        saveCandidateCache(candidateCache);
        candidateCacheDirty = false;
      }
      if (industryCacheDirty && job.processed > 0 && job.processed % 25 === 0) {
        saveNseIssuerIndustryCache(industryCache!);
        industryCacheDirty = false;
      }
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    if (filingReport.failed.length > 0 && !job.lastError) {
      job.lastError = filingReport.failed[0].symbol + ': ' + filingReport.failed[0].error;
    }
  } catch (error) {
    job.lastError = (error as Error).message;
    const remaining = Math.max(0, job.total - job.processed);
    job.failed += remaining;
    job.processed = job.total;
  } finally {
    if (candidateCache && candidateCacheDirty) {
      try { saveCandidateCache(candidateCache); }
      catch (error) { job.lastError = 'Candidate cache checkpoint failed: ' + (error as Error).message; }
    }
    if (industryCache && industryCacheDirty) {
      try { saveNseIssuerIndustryCache(industryCache); }
      catch (error) { job.lastError = 'NSE issuer industry cache checkpoint failed: ' + (error as Error).message; }
    }
    job.running = false;
    job.currentSymbol = '';
    job.finishedAtUtc = new Date().toISOString();
  }
}

export function startNseFundamentalResearchCollection(
  rawSymbols: string[],
  fetchImpl: typeof fetch = fetch,
): NseFundamentalResearchStatus {
  if (job.running) return getNseFundamentalResearchStatus();
  const symbols = [...new Set(rawSymbols.map(value => value.trim().toUpperCase()).filter(Boolean))];
  job = {
    running: true, scope: symbols.length === 1 ? 'SINGLE' : 'BHAVCOPY',
    total: symbols.length, processed: 0, filingHistoryProcessed: 0,
    filingHistorySucceeded: 0, xbrlDocumentsSaved: 0, succeeded: 0,
    candidateReady: 0, revisionReviewRequired: 0, failed: 0,
    currentSymbol: symbols[0] ?? '', startedAtUtc: new Date().toISOString(),
    finishedAtUtc: '', lastError: null, candidateCacheFile: CANDIDATE_CACHE_FILE,
  };
  void runCollection(symbols, fetchImpl);
  return getNseFundamentalResearchStatus();
}
