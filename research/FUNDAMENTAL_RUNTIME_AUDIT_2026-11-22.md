# Runtime Fundamental Audit — 2026-11-22

Scope: read-only audit of the separate Google AI Studio NSE Swing Scanner on branch `research/free-fundamental-sources`. No production runtime, main branch, app deployment, price path, filters, ranking, or UI was changed by this audit.

## Runtime shape

- `package.json` declares an ESM TypeScript/Node project with Express, Vite, tsx and TypeScript.
- There is no Python runtime dependency in the app package.
- Therefore the preferred implementation language is TypeScript. Python is not required for the production scanner.
- `screener-india` is an unofficial client that reads Screener.in pages; its README says it is non-commercial/personal-research oriented, requires Node.js >=22 and ESM, and some data needs a Screener login. It is not an official exchange feed and is not approved as the source of truth.
- NSE publishes Regulation 33 XBRL taxonomy archives and integrated filing records with original/revised, audited/unaudited, consolidated/standalone, filing timestamps and XBRL links. BSE also provides an Integrated Filing-Financial XBRL utility.

## Confirmed code issues

### 1. Yahoo fundamentals are still the active primary fetch path
File: `server/liveFetcher.ts`
- `fetchYahooSingleExchange()` retrieves quoteSummary and Yahoo fundamentals-timeseries.
- `fetchYahooFundamentalsForSymbol()` runs Yahoo NSE first, optionally Yahoo BSE second, and only supplements with one NSE XBRL filing.
- The XBRL-only record is used only when Yahoo primary data is unavailable.
- This does not satisfy the target policy of official NSE/BSE filings as fundamental source of truth.
- Do not remove the Yahoo path until a validated replacement is ready. Preserve live-price logic unchanged.

### 2. NSE XBRL runtime parser is incomplete
File: `server/liveFetcher.ts`, `fetchAndParseNseXbrl()`
- Uses regular expressions against a narrow set of prefixed concept names.
- Does not extract Operating Cash Flow.
- Does not comprehensively process inline XBRL facts, context dimensions, units, scale, nil values, continuation chains, or issuer extensions.
- Selects a filing by description containing “consolidated”, otherwise first filing; it does not verify the intended basis against the baseline record.
- Its quarterly/YTD context logic and first-value fallbacks require a deterministic taxonomy-aware replacement.

### 3. Cross-period / cross-source calculations are unsafe
File: `server/liveFetcher.ts`, `fetchYahooSingleExchange()`
- ROE can combine trailing net income with annual equity.
- ROCE can combine trailing/annual EBIT with annual assets/current liabilities; the fallback can silently substitute zero debt.
- Interest coverage can combine trailing EBIT and annual interest expense.
- OCF prefers trailing over annual data without preserving the selected period.
- Revenue/profit growth falls back to generic Yahoo growth ratios when the annual series is missing.
These may be useful indicative fields but are not sufficiently period-auditable for a trustable fundamental screen.

### 4. Field-by-field merging can create synthetic mixed profiles
Files: `server/liveFetcher.ts`, `server/nsePipeline.ts`
- BSE and NSE values are merged field-by-field when one source is missing a field.
- NSE XBRL values are selectively merged into Yahoo values.
- `mergeLiveOverrides()` merges each metric independently into an existing profile.
- The profile has one top-level period/source label, so it can conceal that individual metrics came from different sources, periods, or consolidation bases.

### 5. Free-source cache omits OCF
File: `server/nsePipeline.ts`, `mergeFreeSourceCache()`
- The CSV loader maps Revenue Growth, Profit Growth, ROE, ROCE, Debt/Equity and Interest Coverage.
- It does not map `OperatingCashFlowINR` / Operating Cash Flow from the free-source cache.
- The baseline loader does map `OperatingCashFlowINR`.

### 6. Filing index metadata is not enough to prove metric provenance
File: `server/nsePipeline.ts`, `loadXbrlFilings()`
- Filing metadata is loaded and sorted by publication date.
- It is not yet linked to each metric's own context, basis, period, unit, concept, and filing version.

## Required design before runtime integration

1. Official NSE Regulation 33 XBRL filing discovery, with BSE official cross-check.
2. Entity identity validation using symbol + ISIN (and company name as a secondary check).
3. Taxonomy-specific concept mapping for Ind AS, non-Ind AS, banking, NBFC, life/general insurance.
4. Context selection with explicit dimensions, period type, duration, and instant.
5. Deterministic quarter/YTD/FY/TTM normalization; no period mixing.
6. Filing precedence: preserve original/revised; revised supersedes only matching issuer + period + basis + statement type.
7. Per-metric provenance and validation status; no single profile-level source label for mixed metrics.
8. Metric definitions:
   - Revenue Growth: comparable same-basis quarter or FY revenue.
   - Profit Growth: comparable same-basis PAT attributable to owners / appropriate PAT definition.
   - ROE and ROCE: use same-period earnings and average balance-sheet denominator; formulas versioned and disclosed.
   - Debt/Equity: exact taxonomy reported ratio or documented debt/equity components; lease debt treatment explicit.
   - Interest Coverage: consistent EBIT/interest definition and same reporting period; do not infer from mismatched finance cost.
   - OCF: cash-flow statement net cash from operating activities, exact period and basis.
9. Sector-specific applicability for banks/NBFCs/insurers; N/A is distinct from missing.
10. Pilot on at least 20 issuers spanning sectors, filing types, and consolidated/standalone cases, then compare with issuer PDFs and BSE/NSE XBRL.

## Current status

- Research-only TypeScript raw XBRL extractor added using MIT-licensed `fast-xml-parser`.
- Synthetic TypeScript test suite and isolated research CI workflow added.
- Real filing raw bytes remain a blocker in the current tool environment; KSHINTL's official human-readable NSE iXBRL page was inspected separately.
- No seven-metric mapping, validated 20-company pilot, or production integration is complete.
