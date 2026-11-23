import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type { AuditFreshnessTier, FundamentalAuditEntry } from '../types/trading';

interface FundamentalAuditTableProps {
  activeSymbol: string;
  initialRows: FundamentalAuditEntry[];
  onSelectSymbol: (symbol: string) => void;
  onStockRefreshed: () => Promise<void>;
}

type AuditScope = 'PEERS' | 'UNIVERSE';
type AuditBasis = 'VERIFIED' | 'PERIOD';
type TierFilter =
  | 'ALL'
  | 'UNDER_1M'
  | 'ONE_TO_3M'
  | 'OVER_3M'
  | 'UNVERIFIED'
  | 'OVER_3M_OR_UNVERIFIED';
type ExchangeFilter = 'ALL' | 'BSE_VERIFIED' | 'NSE_XBRL';

interface AuditCounts {
  under1m: number;
  oneTo3m: number;
  over3m: number;
  unverified: number;
  nseMapped: number;
  bseMapped: number;
}

interface NseCandidateRow {
  reportHash: string;
  savedAtUtc: string;
  report: {
    symbol: string;
    status: string;
    sector: string;
    basis?: string;
    currentPeriodEnd?: string;
    priorPeriodEnd?: string;
    candidateReport?: {
      currentPeriod?: { periodType?: string };
      candidateReport?: {
        candidates?: {
          revenueGrowth?: { status: string; growthPercent: number | null } | null;
          profitGrowth?: { status: string; growthPercent: number | null } | null;
          operatingCashFlow?: { status: string; currentValue: number | null; percentageChange: number | null } | null;
        };
      };
    };
    epsCandidate?: { status: string; currentValue: number | null; unit: string | null; periodType?: string } | null;
    xbrlEntityIdentity?: { entityIdentifier: string | null; entityScheme: string | null; valid: boolean; matchesOfficialNseIsin: boolean };
    filingEvidence?: {
      currentOriginal: { sequenceId: string; audited: string | null; xbrlUrl: string; ixbrlUrl: string };
      currentRevisions: Array<{ sequenceId: string; audited: string | null; xbrlUrl: string; ixbrlUrl: string }>;
      priorOriginal: { sequenceId: string; audited: string | null; xbrlUrl: string; ixbrlUrl: string };
      priorRevisions: Array<{ sequenceId: string; audited: string | null; xbrlUrl: string; ixbrlUrl: string }>;
    };
    warnings?: string[];
  };
}


function classifyAge(ageDays: number | null): AuditFreshnessTier {
  if (ageDays === null) return 'UNVERIFIED';
  if (ageDays < 30) return 'UNDER_1M';
  if (ageDays <= 90) return 'ONE_TO_3M';
  return 'OVER_3M';
}

function formatUtcTimestamp(raw: string): string {
  if (!raw) return 'Never verified';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw} (Date only)`;
  }
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return raw;
  const iso = new Date(parsed).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatFreshnessLabel(tier: AuditFreshnessTier): string {
  if (tier === 'UNDER_1M') return '< 1 Month';
  if (tier === 'ONE_TO_3M') return '1-3 Months';
  if (tier === 'OVER_3M') return '> 3 Months';
  return 'Unverified';
}

export const FundamentalAuditTable: React.FC<FundamentalAuditTableProps> = ({
  activeSymbol,
  initialRows,
  onSelectSymbol,
  onStockRefreshed,
}) => {
  const [scope, setScope] = useState<AuditScope>('PEERS');
  const [basis, setBasis] = useState<AuditBasis>('VERIFIED');
  const [tierFilter, setTierFilter] = useState<TierFilter>('ALL');
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 25;

  const [universeRows, setUniverseRows] = useState<FundamentalAuditEntry[]>([]);
  const [universeTotal, setUniverseTotal] = useState(0);
  const [universeCounts, setUniverseCounts] = useState<AuditCounts | null>(null);
  const [universeLoading, setUniverseLoading] = useState(false);
  const [universeError, setUniverseError] = useState<string | null>(null);

  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [syncingNseFilingHistory, setSyncingNseFilingHistory] = useState(false);
  const [showNseCandidates, setShowNseCandidates] = useState(false);
  const [loadingNseCandidates, setLoadingNseCandidates] = useState(false);
  const [nseCandidateRows, setNseCandidateRows] = useState<NseCandidateRow[]>([]);
  const [nseCandidateError, setNseCandidateError] = useState<string | null>(null);

  const fetchUniverseAudit = useCallback(async () => {
    setUniverseLoading(true);
    setUniverseError(null);
    try {
      const qs = new URLSearchParams();
      if (searchQuery.trim()) qs.set('q', searchQuery.trim());
      if (tierFilter !== 'ALL') qs.set('tier', tierFilter);
      if (exchangeFilter !== 'ALL') qs.set('exchange', exchangeFilter);
      qs.set('basis', basis);
      qs.set('limit', String(limit));
      qs.set('offset', String(offset));

      const res = await fetch(`/api/fundamentals/audit?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setUniverseRows(json.rows || []);
      setUniverseTotal(json.total ?? 0);
      setUniverseCounts(json.counts || null);
    } catch (err) {
      setUniverseError((err as Error).message);
    } finally {
      setUniverseLoading(false);
    }
  }, [basis, exchangeFilter, offset, searchQuery, tierFilter]);

  useEffect(() => {
    setOffset(0);
  }, [activeSymbol, scope, basis, tierFilter, exchangeFilter, searchQuery]);

  useEffect(() => {
    if (scope === 'UNIVERSE') {
      void fetchUniverseAudit();
    }
  }, [scope, fetchUniverseAudit]);

  const getRowAgeAndTier = useCallback(
    (entry: FundamentalAuditEntry) => {
      const ageDays = basis === 'PERIOD' ? entry.periodAgeDays : entry.verifiedAgeDays;
      const tier = basis === 'PERIOD' ? classifyAge(ageDays) : entry.freshnessTier;
      return { ageDays, tier };
    },
    [basis]
  );

  const filteredPeers = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    return initialRows.filter((row) => {
      if (q) {
        const hit =
          row.symbol.includes(q) ||
          row.nseTicker.includes(q) ||
          row.bseTicker.includes(q) ||
          row.sector.toUpperCase().includes(q);
        if (!hit) return false;
      }
      if (exchangeFilter === 'BSE_VERIFIED' && !row.bseMapped) return false;
      if (exchangeFilter === 'NSE_XBRL' && row.nseXbrlCount === 0) return false;

      if (tierFilter !== 'ALL') {
        const { tier } = getRowAgeAndTier(row);
        if (tierFilter === 'OVER_3M_OR_UNVERIFIED') {
          if (tier !== 'OVER_3M' && tier !== 'UNVERIFIED') return false;
        } else if (tier !== tierFilter) {
          return false;
        }
      }
      return true;
    });
  }, [exchangeFilter, getRowAgeAndTier, initialRows, searchQuery, tierFilter]);

  const peerCounts = useMemo<AuditCounts>(() => {
    const c: AuditCounts = {
      under1m: 0,
      oneTo3m: 0,
      over3m: 0,
      unverified: 0,
      nseMapped: initialRows.length,
      bseMapped: 0,
    };
    for (const row of initialRows) {
      if (row.bseMapped) c.bseMapped += 1;
      const { tier } = getRowAgeAndTier(row);
      if (tier === 'UNDER_1M') c.under1m += 1;
      else if (tier === 'ONE_TO_3M') c.oneTo3m += 1;
      else if (tier === 'OVER_3M') c.over3m += 1;
      else c.unverified += 1;
    }
    return c;
  }, [getRowAgeAndTier, initialRows]);

  const displayedRows = scope === 'UNIVERSE' ? universeRows : filteredPeers;
  const activeCounts = scope === 'UNIVERSE' && universeCounts ? universeCounts : peerCounts;

  const loadNseCandidates = useCallback(async () => {
    setShowNseCandidates(true);
    setLoadingNseCandidates(true);
    setNseCandidateError(null);
    try {
      const res = await fetch('/api/fundamentals/nse-candidates?limit=1000');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      const latestBySymbol = new Map<string, NseCandidateRow>();
      for (const item of (json.reports || []) as NseCandidateRow[]) {
        if (!latestBySymbol.has(item.report.symbol)) latestBySymbol.set(item.report.symbol, item);
      }
      setNseCandidateRows([...latestBySymbol.values()]);
      setShowNseCandidates(true);
    } catch (err) {
      setNseCandidateError((err as Error).message);
    } finally {
      setLoadingNseCandidates(false);
    }
  }, []);

  const formatCandidateValue = (value: number | null | undefined, suffix = ''): string => {
    if (value === null || value === undefined || !Number.isFinite(value)) return 'MISSING';
    return `${value.toFixed(2)}${suffix}`;
  };

  const handleSyncBhavcopyNseFilingHistory = async () => {
    setSyncingNseFilingHistory(true);
    setActionNotice('Starting NSE fundamental fetch, XBRL revision comparison and candidate validation for latest Bhavcopy symbols...');
    try {
      const res = await fetch('/api/refresh/fundamentals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'BHAVCOPY' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (!json.running) {
        setSyncingNseFilingHistory(false);
        setActionNotice(json.note || 'NSE fundamental research did not start.');
        return;
      }
      setActionNotice(`NSE XBRL fundamental research started: ${json.total} Bhavcopy symbols. Current/prior filings and revisions will be checked; results are staged for research and do not change scanner metrics.`);
    } catch (err) {
      setSyncingNseFilingHistory(false);
      setActionNotice(`NSE fundamental fetch error: ${(err as Error).message}`);
    }
  };

  useEffect(() => {
    if (!syncingNseFilingHistory) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('/api/fundamentals/collect-status');
        if (!res.ok) return;
        const status = await res.json();
        if (cancelled) return;
        setActionNotice(
          status.running
            ? `NSE ${status.filingHistoryProcessed < status.total ? 'filings' : 'XBRL validation'}: ${status.filingHistoryProcessed < status.total ? status.filingHistoryProcessed : status.processed}/${status.total} · XBRL saved ${status.xbrlDocumentsSaved} · candidates ${status.candidateReady} · revision review ${status.revisionReviewRequired} · blocked ${status.failed} · current ${status.currentSymbol || 'finishing'}`
            : `NSE fundamental research finished: ${status.candidateReady} candidate-ready · ${status.revisionReviewRequired} revision-review · ${status.failed} blocked · ${status.xbrlDocumentsSaved} XBRL documents saved.${status.lastError ? ' Last error: ' + status.lastError : ''} Candidate values are stored separately for review; production scanner cache remains unchanged until formal validation is approved.`
        );
        if (!status.running) {
          setSyncingNseFilingHistory(false);
          await loadNseCandidates();
        }
      } catch {
        // A temporary status-poll failure must not interrupt the background sync.
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loadNseCandidates, syncingNseFilingHistory]);

  const handleDownloadCsv = () => {
    if (displayedRows.length === 0) return;
    const headers = [
      'Symbol',
      'Series',
      'Sector',
      'NSE Ticker',
      'NSE XBRL Verified',
      'NSE XBRL Filings',
      'NSE Latest Filing Date',
      'BSE Ticker',
      'BSE Verified',
      'Last Update Timestamp (UTC)',
      'Financial Period End',
      basis === 'PERIOD' ? 'Statement Period Age (Days)' : 'Verified Age (Days)',
      'Freshness',
      'Coverage',
      'Fundamental Pass Count',
      'Sources',
    ];

    const lines = [headers.map(escapeCsvCell).join(',')];
    for (const entry of displayedRows) {
      const { ageDays, tier } = getRowAgeAndTier(entry);
      const hasNseXbrl = entry.sources.some(source => /NSE Official XBRL/i.test(source));
      const rowValues = [
        entry.symbol,
        entry.series,
        entry.sector,
        entry.nseTicker,
        hasNseXbrl ? 'Yes' : 'No',
        entry.nseXbrlCount,
        entry.nseLatestFilingDate,
        entry.bseTicker,
        entry.bseMapped ? 'Yes' : 'No',
        entry.lastUpdatedUtc,
        entry.financialPeriodEnd,
        ageDays,
        formatFreshnessLabel(tier),
        entry.coverage,
        entry.passCount,
        entry.sources.join(' | '),
      ];
      lines.push(rowValues.map(escapeCsvCell).join(','));
    }

    const csvContent = `\uFEFF${lines.join('\r\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const todayIso = new Date().toISOString().slice(0, 10);
    const scopeTag =
      scope === 'UNIVERSE' ? 'universe' : `${activeSymbol.toLowerCase()}_peers`;
    const filename = `fundamental_audit_${scopeTag}_${basis.toLowerCase()}_${todayIso}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    setActionNotice(
      `Downloaded ${displayedRows.length} row(s) from the current Fundamental Audit view (${filename}).`
    );
  };

  const renderFreshnessBadge = (tier: AuditFreshnessTier, ageDays: number | null) => {
    if (tier === 'UNDER_1M') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border bg-emerald-50 text-emerald-800 border-emerald-200 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
          &lt; 1 Month{ageDays !== null ? ` · ${ageDays}d` : ''}
        </span>
      );
    }
    if (tier === 'ONE_TO_3M') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border bg-amber-50 text-amber-800 border-amber-200 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          1–3 Months{ageDays !== null ? ` · ${ageDays}d` : ''}
        </span>
      );
    }
    if (tier === 'OVER_3M') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border bg-rose-50 text-rose-800 border-rose-200 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
          &gt; 3 Months{ageDays !== null ? ` · ${ageDays}d` : ''}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border bg-rose-50 text-rose-800 border-rose-200 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
        Unverified
      </span>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-semibold text-slate-900">
              Fundamental Audit — Exchange Mapping &amp; Freshness
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Shows exchange mapping and filing freshness. Scanner fundamentals use official NSE filings only;
            Yahoo Finance is reserved for live prices, while legacy BSE/Yahoo mappings are informational only.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Switch */}
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setScope('PEERS')}
              className={`px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap ${
                scope === 'PEERS'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active &amp; Peers ({initialRows.length})
            </button>
            <button
              type="button"
              onClick={() => setScope('UNIVERSE')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap ${
                scope === 'UNIVERSE'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database className="w-3 h-3" />
              All NSE/BSE Universe
            </button>
          </div>

          {/* Age Basis Toggle */}
          <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setBasis('VERIFIED')}
              className={`px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap ${
                basis === 'VERIFIED'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Age measured since last fundamental verification timestamp"
            >
              By Verified Date
            </button>
            <button
              type="button"
              onClick={() => setBasis('PERIOD')}
              className={`px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap ${
                basis === 'PERIOD'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Age measured since financial statement period end date"
            >
              By Statement Period
            </button>
          </div>

          <button
            type="button"
            onClick={handleSyncBhavcopyNseFilingHistory}
            disabled={syncingNseFilingHistory}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-xs font-medium text-indigo-800 whitespace-nowrap transition-colors"
            title="Fetch NSE filing history, current/prior XBRL and revisions; calculate research candidates without changing the production scanner cache"
          >
            <Database className={`w-3.5 h-3.5 ${syncingNseFilingHistory ? 'animate-pulse' : ''}`} />
            {syncingNseFilingHistory ? 'Fetching NSE Fundamentals...' : 'Fetch NSE Fundamentals'}
          </button>

          <button
            type="button"
            onClick={() => void loadNseCandidates()}
            disabled={loadingNseCandidates}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-medium text-slate-700 whitespace-nowrap transition-colors"
            title="Load the latest stored NSE XBRL research candidates; these are not production-approved metrics"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {loadingNseCandidates ? 'Loading Candidates...' : 'View NSE Candidates'}
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={displayedRows.length === 0 || (scope === 'UNIVERSE' && universeLoading)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-medium text-slate-700 whitespace-nowrap transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            Download Audit Report
          </button>
        </div>
      </div>

      {/* Filters & Freshness Counters */}
      <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setTierFilter('ALL')}
            className={`px-2.5 py-1 rounded border font-medium transition-colors whitespace-nowrap ${
              tierFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
            }`}
          >
            All <span className="font-mono tabular-nums ml-1">{activeCounts.nseMapped}</span>
          </button>
          <button
            type="button"
            onClick={() => setTierFilter('UNDER_1M')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border font-medium transition-colors whitespace-nowrap ${
              tierFilter === 'UNDER_1M'
                ? 'bg-emerald-700 text-white border-emerald-700'
                : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                tierFilter === 'UNDER_1M' ? 'bg-white' : 'bg-emerald-600'
              }`}
            />
            &lt; 1M Green{' '}
            <span className="font-mono tabular-nums">{activeCounts.under1m}</span>
          </button>
          <button
            type="button"
            onClick={() => setTierFilter('ONE_TO_3M')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border font-medium transition-colors whitespace-nowrap ${
              tierFilter === 'ONE_TO_3M'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                tierFilter === 'ONE_TO_3M' ? 'bg-white' : 'bg-amber-500'
              }`}
            />
            1–3M Yellow{' '}
            <span className="font-mono tabular-nums">{activeCounts.oneTo3m}</span>
          </button>
          <button
            type="button"
            onClick={() => setTierFilter('OVER_3M')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border font-medium transition-colors whitespace-nowrap ${
              tierFilter === 'OVER_3M'
                ? 'bg-rose-700 text-white border-rose-700'
                : 'bg-white text-rose-800 border-rose-200 hover:bg-rose-50'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                tierFilter === 'OVER_3M' ? 'bg-white' : 'bg-rose-600'
              }`}
            />
            &gt; 3M Red{' '}
            <span className="font-mono tabular-nums">{activeCounts.over3m}</span>
          </button>
          <button
            type="button"
            onClick={() => setTierFilter('UNVERIFIED')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border font-medium transition-colors whitespace-nowrap ${
              tierFilter === 'UNVERIFIED'
                ? 'bg-rose-800 text-white border-rose-800'
                : 'bg-white text-rose-800 border-rose-200 hover:bg-rose-50'
            }`}
          >
            Unverified{' '}
            <span className="font-mono tabular-nums">{activeCounts.unverified}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Exchange Filter"
            value={exchangeFilter}
            onChange={(e) => setExchangeFilter(e.target.value as ExchangeFilter)}
            className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md text-slate-700"
          >
            <option value="ALL">All Exchanges ({activeCounts.nseMapped})</option>
            <option value="BSE_VERIFIED">
              BSE (.BO) Verified ({activeCounts.bseMapped})
            </option>
            <option value="NSE_XBRL">NSE XBRL Filed Only</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter symbol / sector..."
              className="pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md w-44 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="px-5 py-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-900 flex items-center justify-between gap-2">
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-blue-700 hover:text-blue-900 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {showNseCandidates && (
        <div className="border-b border-slate-200 bg-slate-50/60">
          <div className="px-5 py-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-900">NSE XBRL Research Candidates</div>
              <div className="text-[11px] text-slate-500">Research-only values from official NSE filings. Nothing in this table is written to scanner production metrics.</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 tabular-nums">{nseCandidateRows.length} latest symbols</span>
              <button type="button" onClick={() => void loadNseCandidates()} disabled={loadingNseCandidates} className="px-2.5 py-1 rounded border border-slate-200 bg-white text-[11px] font-medium text-slate-700 disabled:opacity-50">Refresh</button>
              <button type="button" onClick={() => setShowNseCandidates(false)} className="px-2.5 py-1 rounded border border-slate-200 bg-white text-[11px] text-slate-600">Hide</button>
            </div>
          </div>
          {nseCandidateError && <div className="px-5 pb-2 text-xs text-rose-700">Candidate load error: {nseCandidateError}</div>}
          {loadingNseCandidates ? (
            <div className="px-5 py-5 text-center text-xs text-slate-500">Loading NSE candidate cache...</div>
          ) : nseCandidateRows.length === 0 ? (
            <div className="px-5 py-5 text-center text-xs text-slate-500">No NSE candidate reports are stored yet. Run Fetch NSE Fundamentals first.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-white border-y border-slate-200 text-slate-600">
                    <th className="py-2 px-4">Symbol / Period</th>
                    <th className="py-2 px-2">Research Status</th>
                    <th className="py-2 px-2 text-right">Revenue Growth</th>
                    <th className="py-2 px-2 text-right">Profit Growth</th>
                    <th className="py-2 px-2 text-right">OCF (₹)</th>
                    <th className="py-2 px-2 text-right">Basic EPS (₹)</th>
                    <th className="py-2 px-4">Validation Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {nseCandidateRows.map((item) => {
                    const report = item.report;
                    const candidates = report.candidateReport?.candidateReport?.candidates;
                    const revenue = candidates?.revenueGrowth;
                    const profit = candidates?.profitGrowth;
                    const ocf = candidates?.operatingCashFlow;
                    const eps = report.epsCandidate;
                    return (
                      <tr key={item.reportHash} className="bg-white align-top">
                        <td className="py-2 px-4">
                          <button type="button" onClick={() => onSelectSymbol(report.symbol)} className="font-mono font-semibold text-blue-700 hover:underline">{report.symbol}</button>
                          <div className="text-slate-500">{report.basis || 'Basis missing'} · {report.candidateReport?.currentPeriod?.periodType || 'Period type missing'} · {report.currentPeriodEnd || 'Period missing'}</div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="font-medium text-slate-800">{report.status}</div>
                          <div className="text-slate-500">{report.sector}</div>
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums">
                          {formatCandidateValue(revenue?.growthPercent, '%')}
                          <div className="text-slate-500">{revenue?.status || 'MISSING'}</div>
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums">
                          {formatCandidateValue(profit?.growthPercent, '%')}
                          <div className="text-slate-500">{profit?.status || 'MISSING'}</div>
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums">
                          {formatCandidateValue(ocf?.currentValue)}
                          <div className="text-slate-500">{ocf?.status || 'MISSING'}</div>
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums">
                          {formatCandidateValue(eps?.currentValue)}
                          <div className="text-slate-500">{eps?.status || 'MISSING'}{eps?.periodType ? ' · ' + eps.periodType : ''}</div>
                        </td>
                        <td className="py-2 px-4 max-w-[360px] text-slate-600">
                          {(report.warnings || []).slice(0, 3).join(' · ') || 'No additional notes'}
                          {(report.filingEvidence || report.xbrlEntityIdentity) && (
                            <details className="mt-1 text-[10px]">
                              <summary className="cursor-pointer font-medium text-blue-700">View NSE filing evidence</summary>
                              <div className="mt-1 space-y-1">
                                <div>Entity: {report.xbrlEntityIdentity?.entityIdentifier || 'MISSING'} · {report.xbrlEntityIdentity?.valid ? 'ISIN verified' : 'identity blocked'}</div>
                                {report.filingEvidence && (
                                  <>
                                    <div>Current Original #{report.filingEvidence.currentOriginal.sequenceId} · {report.filingEvidence.currentOriginal.audited || 'Audit status unknown'} · <a className="text-blue-700 underline" href={report.filingEvidence.currentOriginal.xbrlUrl} target="_blank" rel="noreferrer">XBRL</a> · <a className="text-blue-700 underline" href={report.filingEvidence.currentOriginal.ixbrlUrl} target="_blank" rel="noreferrer">iXBRL</a></div>
                                    {report.filingEvidence.currentRevisions.map((filing) => (
                                      <div key={`current-${filing.sequenceId}`}>Current Revision #{filing.sequenceId} · {filing.audited || 'Audit status unknown'} · <a className="text-blue-700 underline" href={filing.xbrlUrl} target="_blank" rel="noreferrer">XBRL</a></div>
                                    ))}
                                    <div>Prior Original #{report.filingEvidence.priorOriginal.sequenceId} · {report.filingEvidence.priorOriginal.audited || 'Audit status unknown'} · <a className="text-blue-700 underline" href={report.filingEvidence.priorOriginal.xbrlUrl} target="_blank" rel="noreferrer">XBRL</a></div>
                                    {report.filingEvidence.priorRevisions.map((filing) => (
                                      <div key={`prior-${filing.sequenceId}`}>Prior Revision #{filing.sequenceId} · {filing.audited || 'Audit status unknown'} · <a className="text-blue-700 underline" href={filing.xbrlUrl} target="_blank" rel="noreferrer">XBRL</a></div>
                                    ))}
                                  </>
                                )}
                              </div>
                            </details>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {universeError && scope === 'UNIVERSE' && (
        <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-200 text-xs text-rose-800">
          Audit load error: {universeError}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <th className="py-2.5 px-4">Symbol</th>
              <th className="py-2.5 px-3">NSE Exchange Data</th>
              <th className="py-2.5 px-3">BSE Exchange Data</th>
              <th className="py-2.5 px-3">Last Update Timestamp</th>
              <th className="py-2.5 px-3">Freshness</th>
              <th className="py-2.5 px-4 text-right">NSE Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scope === 'UNIVERSE' && universeLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  Loading NSE/BSE audit records...
                </td>
              </tr>
            ) : displayedRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  No symbols match the selected Freshness or Exchange filter.
                </td>
              </tr>
            ) : (
              displayedRows.map((entry) => {
                const isActive = entry.symbol === activeSymbol;
                const { ageDays, tier } = getRowAgeAndTier(entry);
                const hasNseYahoo = entry.sources.includes('YFinance (.NS)');

                return (
                  <tr
                    key={entry.symbol}
                    className={
                      isActive ? 'bg-blue-50/40' : 'hover:bg-slate-50/80 transition-colors'
                    }
                  >
                    {/* Symbol */}
                    <td className="py-2.5 px-4 align-top">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectSymbol(entry.symbol)}
                          className="font-mono font-semibold text-blue-700 hover:underline text-left"
                        >
                          {entry.symbol}
                        </button>
                        {isActive && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-800 rounded">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                        {entry.series}
                        {entry.sector ? ` · ${entry.sector}` : ''}
                      </div>
                    </td>

                    {/* NSE Exchange Data */}
                    <td className="py-2.5 px-3 align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-medium text-slate-900">
                          {entry.nseTicker}
                        </span>
                        {hasNseYahoo && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono">
                            Legacy YF
                          </span>
                        )}
                        {entry.nseXbrlCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-mono tabular-nums">
                            {entry.nseXbrlCount} XBRL
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                        {entry.nseLatestFilingDate
                          ? `Filing ${entry.nseLatestFilingDate}`
                          : entry.coverage !== 'MISSING'
                            ? `${entry.passCount}/7 gates`
                            : 'No XBRL filing cached'}
                      </div>
                    </td>

                    {/* BSE Exchange Data */}
                    <td className="py-2.5 px-3 align-top">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-medium text-slate-900">
                          {entry.bseTicker}
                        </span>
                        {entry.bseMapped ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-medium whitespace-nowrap">
                            BSE Mapping
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">Standby</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[180px]">
                        {entry.bseMapped
                          ? 'Legacy BSE data · not refreshed'
                          : 'No legacy BSE cache'}
                      </div>
                    </td>

                    {/* Last Update Timestamp */}
                    <td className="py-2.5 px-3 align-top">
                      <div className="font-mono tabular-nums text-slate-900 whitespace-nowrap">
                        {formatUtcTimestamp(entry.lastUpdatedUtc)}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                        {entry.financialPeriodEnd
                          ? `Period ${entry.financialPeriodEnd}`
                          : 'Period date unrecorded'}
                      </div>
                    </td>

                    {/* Freshness Badge */}
                    <td className="py-2.5 px-3 align-top">
                      {renderFreshnessBadge(tier, ageDays)}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-4 text-right align-top">
                      <span
                        title="Automatic fundamental verification is disabled until the NSE-only service is production-ready"
                        className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500"
                      >
                        Pending
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer (All Mainboard Mode) */}
      {scope === 'UNIVERSE' && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="font-mono tabular-nums">
            Showing {universeTotal === 0 ? 0 : offset + 1}–
            {Math.min(offset + limit, universeTotal)} of {universeTotal} matching stocks
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffset((p) => Math.max(0, p - limit))}
              disabled={offset === 0 || universeLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 font-medium"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>
            <button
              type="button"
              onClick={() => setOffset((p) => p + limit)}
              disabled={offset + limit >= universeTotal || universeLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40 font-medium"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
