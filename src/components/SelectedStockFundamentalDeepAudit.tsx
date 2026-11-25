import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert } from 'lucide-react';

interface ResearchStatus {
  running: boolean;
  total: number;
  processed: number;
  currentSymbol: string;
  finishedAtUtc: string;
  lastError: string | null;
}

interface MetricRow {
  sourceDataStatus?: string;
  definitionReadiness?: string;
  decision?: string;
  explanation?: string;
}

interface CandidateReport {
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
      candidateReport?: {
        candidates?: {
          revenueGrowth?: { growthPercent: number | null; status: string } | null;
          profitGrowth?: { growthPercent: number | null; status: string } | null;
          operatingCashFlow?: { currentValue: number | null; percentageChange: number | null; status: string } | null;
        };
        auditMatrix?: {
          metrics?: Record<string, MetricRow>;
          productionApproved?: boolean;
          readyForProduction?: boolean;
        };
      };
    };
    warnings?: string[];
    productionApproved: false;
    scannerEligible: false;
  };
}

const METRIC_LABELS: Record<string, string> = {
  REVENUE_GROWTH: 'Revenue Growth',
  PROFIT_GROWTH: 'Profit Growth',
  ROE: 'ROE',
  ROCE: 'ROCE',
  DEBT_EQUITY: 'Debt / Equity',
  INTEREST_COVERAGE: 'Interest Coverage',
  OPERATING_CASH_FLOW: 'Operating Cash Flow',
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export const SelectedStockFundamentalDeepAudit: React.FC<{ symbol: string }> = ({ symbol }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ResearchStatus | null>(null);
  const [report, setReport] = useState<CandidateReport | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAudit = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    setReport(null);
    setStatus(null);
    try {
      const start = await fetch('/api/fundamentals/nse-research-refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.trim().toUpperCase() }),
      });
      const startJson = await start.json();
      if (!start.ok) {
        if (start.status === 409) {
          throw new Error('Another NSE fundamental research job is already running. Wait for it to finish, then retry this selected stock.');
        }
        throw new Error(startJson.error || startJson.code || `HTTP ${start.status}`);
      }
      if (!startJson.started) {
        setNotice(startJson.message || 'No audit was started for this stock.');
        return;
      }

      setNotice(`Official NSE deep audit started for ${symbol.toUpperCase()} only.`);
      let finished = false;
      for (let attempt = 0; attempt < 180; attempt += 1) {
        await sleep(2000);
        const statusResponse = await fetch('/api/fundamentals/nse-research-status');
        const statusJson = await statusResponse.json();
        if (!statusResponse.ok) throw new Error(statusJson.error || `HTTP ${statusResponse.status}`);
        const current = statusJson.collection as ResearchStatus;
        setStatus(current);
        if (!current.running) {
          finished = true;
          break;
        }
      }
      if (!finished) {
        throw new Error('Audit is still running after six minutes. Check the NSE research status and retry later; no result is assumed.');
      }

      const resultResponse = await fetch(`/api/fundamentals/nse-candidates?symbol=${encodeURIComponent(symbol)}&limit=1`);
      const resultJson = await resultResponse.json();
      if (!resultResponse.ok) throw new Error(resultJson.error || `HTTP ${resultResponse.status}`);
      const latest = (resultJson.reports || [])[0] as CandidateReport | undefined;
      if (!latest) {
        setNotice('Research job finished, but no saved candidate report was returned for this stock.');
      } else {
        setReport(latest);
        setNotice(`NSE official filing audit completed for ${symbol.toUpperCase()}. Candidate-only results; not approved for production.`);
      }
    } catch (err) {
      setError((err as Error).message || 'NSE fundamental deep audit failed.');
    } finally {
      setLoading(false);
    }
  };

  const deep = report?.report.candidateReport?.candidateReport;
  const metrics = deep?.auditMatrix?.metrics;

  return (
    <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Selected Stock — Official NSE Fundamental Deep Audit</h3>
          <p className="text-xs text-slate-500 mt-1">
            Run after selecting {symbol.toUpperCase()} from your scanner filters and opening its Stock Deep View. Checks filing identity, exact periods, basis, original/revision history and all seven metric gates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runAudit()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Auditing selected stock…' : 'Run NSE Deep Audit'}
        </button>
      </div>

      {notice && <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 text-xs text-slate-700">{notice}</div>}
      {error && (
        <div className="px-5 py-3 border-b border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading && status && (
        <div className="px-5 py-3 border-b border-slate-200 text-xs text-slate-600 flex items-center gap-2">
          <Clock3 className="h-4 w-4" />
          Processing {status.processed}/{status.total}; current symbol: {status.currentSymbol || 'finalizing'}.
        </div>
      )}

      {report && (
        <div className="p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-900">{report.report.symbol}</span>
            <span className="rounded border border-slate-200 px-2 py-1 text-slate-600">{report.report.status}</span>
            <span className="text-slate-500">{report.report.sector} · {report.report.basis || 'Basis unavailable'}</span>
            <span className="ml-auto inline-flex items-center gap-1 text-amber-700"><ShieldAlert className="h-3.5 w-3.5" /> Candidate only</span>
          </div>
          {report.report.currentPeriodEnd && (
            <p className="text-[11px] text-slate-500">
              Current period: {report.report.currentPeriodEnd} · Prior period: {report.report.priorPeriodEnd || '—'}
            </p>
          )}
          {metrics && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2 pr-3">Metric</th><th className="py-2 pr-3">Source status</th><th className="py-2 pr-3">Definition</th><th className="py-2">Decision / reason</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(METRIC_LABELS).map(([key, label]) => {
                    const row = metrics[key] || {};
                    return (
                      <tr key={key} className="align-top">
                        <td className="py-2 pr-3 font-medium text-slate-800">{label}</td>
                        <td className="py-2 pr-3 font-mono text-slate-700">{row.sourceDataStatus || 'ABSENT'}</td>
                        <td className="py-2 pr-3 text-slate-600">{row.definitionReadiness || '—'}</td>
                        <td className="py-2 text-slate-600"><span className="font-mono text-slate-800">{row.decision || '—'}</span>{row.explanation ? <p className="mt-1 text-[11px]">{row.explanation}</p> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded border border-slate-200 p-3 text-xs"><div className="text-slate-500">Revenue Growth</div><div className="mt-1 font-semibold text-slate-900">{deep?.candidates?.revenueGrowth?.growthPercent == null ? 'DATA NOT AVAILABLE' : `${deep.candidates.revenueGrowth.growthPercent.toFixed(2)}%`}</div></div>
            <div className="rounded border border-slate-200 p-3 text-xs"><div className="text-slate-500">Profit Growth</div><div className="mt-1 font-semibold text-slate-900">{deep?.candidates?.profitGrowth?.growthPercent == null ? 'DATA NOT AVAILABLE' : `${deep.candidates.profitGrowth.growthPercent.toFixed(2)}%`}</div></div>
            <div className="rounded border border-slate-200 p-3 text-xs"><div className="text-slate-500">Operating Cash Flow</div><div className="mt-1 font-semibold text-slate-900">{deep?.candidates?.operatingCashFlow?.currentValue == null ? 'DATA NOT AVAILABLE' : deep.candidates.operatingCashFlow.currentValue.toLocaleString('en-IN')}</div></div>
          </div>
          {(report.report.warnings || []).length > 0 && (
            <div className="space-y-1 text-[11px] text-amber-800">
              {(report.report.warnings || []).slice(0, 8).map((warning, index) => <p key={index}>• {warning}</p>)}
            </div>
          )}
          <p className="text-[11px] text-slate-500 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Production approval: FALSE · Scanner eligibility: FALSE</p>
        </div>
      )}
    </section>
  );
};
