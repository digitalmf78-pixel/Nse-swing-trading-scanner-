import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fetchNseEquityMaster, loadNseEquityMasterCache } from './nseEquityMasterCache.ts';
import { collectNseFilingHistoryForSymbols, loadNseFilingHistoryCache } from './nseFilingHistoryCache.ts';
import { collectXbrlEvidenceForFilingRows, loadNseXbrlEvidenceCache, type NseXbrlEvidenceDocument } from './nseXbrlEvidenceCache.ts';
import { resolveNseConceptMap } from '../research/fundamental_pilot/nse_concept_map_resolver.ts';
import { buildSevenMetricXbrlPipeline } from '../research/fundamental_pilot/seven_metric_xbrl_pipeline.ts';
import { selectXbrlMetricFact } from '../research/fundamental_pilot/xbrl_metric_fact_selector.ts';
import { buildNseEpsCandidate, type NseEpsCandidate } from '../research/fundamental_pilot/nse_eps_candidate.ts';
import type { IssuerSector } from '../research/fundamental_pilot/sector_metric_policy.ts';
import type { IssuerMetricConceptMap } from '../research/fundamental_pilot/seven_metric_xbrl_pipeline.ts';
import type { NseRevisionRow } from '../research/fundamental_pilot/nse_revision_pair.ts';

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
  isin?: string;
  isinVerified?: boolean;
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
  );
  const candidates: NseComparableFilingPair[] = [];
  for (const basis of ['Consolidated', 'Standalone'] as const) {
    const originals = rows.filter(row => isFinancialOriginal(row, symbol, basis));
    const byPeriod = new Map<string, NseRevisionRow[]>();
    for (const row of originals) {
      const end = parseNseFinancialPeriodEnd(row.qe_Date);
      if (!end) continue;
      const group = byPeriod.get(end) ?? [];
      group.push(row);
      byPeriod.set(end, group);
    }
    const periods = [...byPeriod.keys()].sort((a, b) => b.localeCompare(a));
    for (const currentEnd of periods) {
      const priorEnd = shiftIsoYear(currentEnd, -1);
      if (!priorEnd) continue;
      const currentOriginals = byPeriod.get(currentEnd) ?? [];
      const priorOriginals = byPeriod.get(priorEnd) ?? [];
      if (currentOriginals.length !== 1 || priorOriginals.length !== 1) continue;
      const rowsFor = (end: string) => rows.filter(row =>
        row.consolidated === basis
        && parseNseFinancialPeriodEnd(row.qe_Date) === end
      );
      candidates.push({
        symbol, basis, currentPeriodEnd: currentEnd, priorPeriodEnd: priorEnd,
        currentOriginal: currentOriginals[0], priorOriginal: priorOriginals[0],
        currentRows: rowsFor(currentEnd), priorRows: rowsFor(priorEnd),
      });
      break;
    }
  }
  candidates.sort((a, b) =>
    b.currentPeriodEnd.localeCompare(a.currentPeriodEnd)
    || (a.basis === 'Consolidated' ? -1 : 1)
  );
  return candidates[0] ?? null;
}

export function classifyIssuerSector(rawSector: string | null | undefined): IssuerSector {
  const value = String(rawSector ?? '').trim().toLowerCase();
  if (!value) return 'UNKNOWN';
  if (/\binsurance\b/.test(value)) return 'INSURANCE';
  if (/\bnbfc\b|non banking financial|housing finance|microfinance/.test(value)) return 'NBFC';
  if (/\bbanks?\b|banking/.test(value)) return 'BANK';
  if (/financial|finance|investment|capital market|asset management|brokerage/.test(value)) return 'UNKNOWN';
  return 'NON_FINANCIAL';
}

export function inferExactPeriodStart(
  extraction: NseXbrlEvidenceDocument['extraction'],
  periodEnd: string,
  concepts: IssuerMetricConceptMap,
): string | null {
  const conceptNames = [concepts.revenue, concepts.profit, concepts.operatingCashFlow];
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
  return { schemaVersion: 1, updatedAtUtc: parsed.updatedAtUtc ?? '', symbols: parsed.symbols };
}

function appendCandidateReport(report: NseFundamentalResearchResult): void {
  const cache = loadCandidateCache();
  const symbol = report.symbol.trim().toUpperCase();
  const hash = createHash('sha256').update(JSON.stringify(report)).digest('hex');
  const entry = cache.symbols[symbol] ?? { symbol, reports: [] };
  if (!entry.reports.some(item => item.reportHash === hash)) {
    entry.reports.push({ reportHash: hash, savedAtUtc: new Date().toISOString(), report });
  }
  cache.symbols[symbol] = entry;
  cache.updatedAtUtc = new Date().toISOString();
  fs.mkdirSync(path.dirname(CANDIDATE_CACHE_FILE), { recursive: true });
  const temp = CANDIDATE_CACHE_FILE + '.tmp';
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
  const reports = [...entries].sort((a, b) => b.savedAtUtc.localeCompare(a.savedAtUtc))
    .slice(0, Math.max(1, Math.min(1000, Math.floor(limit))));
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
  const metrics = [
    ['REVENUE_GROWTH_INPUT', concepts.revenue],
    ['PROFIT_GROWTH_INPUT', concepts.profit],
    ['OPERATING_CASH_FLOW_INPUT', concepts.operatingCashFlow],
  ] as const;
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

  const evidenceCache = loadNseXbrlEvidenceCache();
  const docs = evidenceCache.symbols[symbol]?.documents ?? [];
  const bySeq = new Map(docs.map(doc => [String(doc.seqId), doc]));
  const currentDoc = bySeq.get(String(pair.currentOriginal.seq_Id));
  const priorDoc = bySeq.get(String(pair.priorOriginal.seq_Id));
  if (!currentDoc || !priorDoc) {
    return { report: blocked(symbol, sector, 'Original XBRL evidence is missing from the immutable NSE evidence cache.'), xbrlSaved: download.saved };
  }
  if (currentDoc.extraction.warnings.length || priorDoc.extraction.warnings.length) {
    return { report: blocked(symbol, sector, 'XBRL parser warnings are present; candidate calculation is withheld.'), xbrlSaved: download.saved };
  }

  const basis = pair.basis === 'Standalone' ? 'STANDALONE' : 'CONSOLIDATED';
  const mapping = resolveNseConceptMap(sector, basis, currentDoc.extraction, priorDoc.extraction);
  if (mapping.status !== 'MAPPED' || !mapping.conceptMap) {
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
    ['Operating Cash Flow', candidateReport.candidateReport.candidates.operatingCashFlow?.status],
  ].filter(([, status]) => status !== 'CANDIDATE_ONLY')
    .map(([metric, status]) => metric + ': candidate calculation status ' + String(status ?? 'MISSING'));

  const status = candidateIssues.length > 0
    ? 'BLOCKED'
    : hasRevisionHistory && !revisionAudit.stable
      ? 'REVISION_REVIEW_REQUIRED'
      : 'CANDIDATE_READY';
  const warnings = [
    ...(hasRevisionHistory ? ['Every Original/Revision exact-period Revenue, Profit and OCF fact was compared.'] : []),
    ...revisionAudit.changedMetrics.map(metric => metric + ' changed in revision history.'),
    ...revisionAudit.issues,
    ...candidateIssues,
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
    scannerEligible: false, productionApproved: false, warnings,
  };
  return { report, xbrlSaved: download.saved };
}

async function runCollection(
  symbols: string[],
  sectorBySymbol: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<void> {
  try {
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
        job.lastError = 'NSE equity master unavailable; candidate research may run but no production metric profile can be written: ' + (error as Error).message;
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
      const cached = filingCache.symbols[symbol]?.rows ?? [];
      try {
        if (filingFailures.has(symbol)) {
          const report = blocked(symbol, classifyIssuerSector(sectorBySymbol[symbol] ?? ''),
            'Fresh NSE filing metadata fetch failed; stale cached filing history was not used: ' + filingFailures.get(symbol));
          appendCandidateReport(report);
          job.processed += 1;
          job.failed += 1;
          job.lastError = report.warnings[0];
          continue;
        }
        const sector = classifyIssuerSector(sectorBySymbol[symbol] ?? '');
        const result = await processIssuer(symbol, sector, cached, fetchImpl, isinBySymbol[symbol] ?? null);
        job.xbrlDocumentsSaved += result.xbrlSaved;
        appendCandidateReport(result.report);
        job.processed += 1;
        if (result.report.status === 'BLOCKED') {
          job.failed += 1;
          job.lastError = result.report.warnings[0] ?? symbol + ': blocked';
        } else {
          job.succeeded += 1;
          if (result.report.status === 'CANDIDATE_READY') job.candidateReady += 1;
          else job.revisionReviewRequired += 1;
        }
      } catch (error) {
        const report = blocked(symbol, classifyIssuerSector(sectorBySymbol[symbol] ?? ''), (error as Error).message);
        appendCandidateReport(report);
        job.processed += 1;
        job.failed += 1;
        job.lastError = report.warnings[0];
      }
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    if (filingReport.failed.length > 0 && !job.lastError) {
      job.lastError = filingReport.failed[0].symbol + ': ' + filingReport.failed[0].error;
    }
  } catch (error) {
    job.lastError = (error as Error).message;
  } finally {
    job.running = false;
    job.currentSymbol = '';
    job.finishedAtUtc = new Date().toISOString();
  }
}

export function startNseFundamentalResearchCollection(
  rawSymbols: string[],
  sectorBySymbol: Record<string, string> = {},
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
  void runCollection(symbols, sectorBySymbol, fetchImpl);
  return getNseFundamentalResearchStatus();
}
