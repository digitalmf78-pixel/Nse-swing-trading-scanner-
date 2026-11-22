# Fundamental Data Source Research (Free/Open Source)

Scope: research-only for the Google AI Studio NSE Swing Trading Scanner. This is NOT the ECMS project.
No scanner filters, ranking, UI, APIs, or app runtime code are changed by this document.

## Goal
Improve trustworthiness and coverage for these metrics: Revenue Growth, Profit Growth, ROE, ROCE, Debt/Equity, Interest Coverage, Operating Cash Flow.

## Candidate sources / projects

### 1) Exchange filings (NSE / BSE) — authority / validation
- Use exchange-published financial results and filings as the authoritative verification route.
- Prefer source documents and filings with period and publication date, and store source URLs.
- Limitations: official exchange pages/files may have inconsistent formats, PDF/XBRL availability, and automated access limits; treat access as source-by-source, not as a guaranteed universal API.

### 2) Screener.in — useful research reference, not an automated production feed by default
- Community scraper: https://github.com/kustonaut/StockScreener (MIT; scraper/dashboard claims 50+ metrics and uses Screener.in + Yahoo Finance)
- Community scraper: https://github.com/2scraper/screener-scraper (MIT; parses public pages into JSON/CSV)
- Important: these are third-party community code, not official Screener APIs.
- Screener terms: https://www.screener.in/guides/terms/ restrict materials to personal, non-commercial transitory viewing and restrict copying, commercial use, and mirroring. Do not integrate unattended scraping or redistribute scraped data unless permission/licensing is confirmed. Screener does not provide a documented public developer API; its supported exports are user-driven and may be premium.

### 3) Indian Stock Data Hub — research / cross-check candidate
- Repository: https://github.com/tapariapurv/indian-stock-data-hub
- Claims: company financials, ratios, quarterly trends, filings and PDF parsing, with source context.
- Before adopting: inspect actual code, sources, dependencies, coverage, license, and sample output; repository claims are not evidence of correctness.

### 4) TejHQ tej-bazaar — useful for price/delivery context, not fundamentals
- Repository: https://github.com/tejhq/tej-bazaar
- Uses exchange bhavcopy for free open EOD price/delivery data and publishes Parquet. Not a fundamental statement source.
- Treat code license and exchange data rights separately.

## Proposed source hierarchy
1. Official NSE/BSE company results/filings with document period and publication date.
2. A free/open structured dataset or project only after its provenance, field mappings, license, and sample values are validated.
3. Cross-check Screener values manually or through permitted user-driven export only where its terms allow; avoid scraping private/undocumented endpoints.
4. Never silently substitute one source's standalone figures for another source's consolidated figures.

## Data-quality rules (planned, not implemented)
- Store each metric with value, unit, metric period-end, publication/filing date, fetched timestamp, source name, source URL, calculation formula/version, and basis (consolidated/standalone).
- Normalize units to INR / INR crore as appropriate; do not mix units without conversion evidence.
- Prefer consolidated values where available, but record fallback to standalone and mark it.
- Compute ratios from source statement line items only when formula, denominator, and matching period are valid; otherwise retain published ratio and its provenance.
- Treat banks/NBFC/insurance sector metrics as sector-specific or not applicable rather than forcing generic ratios.
- Null means missing/unverified; do not replace with 0 or sentinel values such as 999.
- Cross-source mismatches must be logged and not averaged.
- Freshness is per metric/period, not per company record.
- Pilot before universe-scale ingestion.

## 20-stock validation pilot (next)
- Pick 20 representative listed companies across sectors and market caps.
- Compare all 7 metrics across available official filings and the candidate structured source(s).
- Confirm consolidated/standalone basis, units, formulas, quarter/year alignment, filing dates, and missing-data behavior.
- Record coverage and errors per metric/source; do not change scanner thresholds or ranking.
- Only after the pilot passes, design a read-only adapter and test it on a separate branch.

## Decision
Do not implement Screener.in scraping as a production feed at this stage. First test official filing extraction and the Indian Stock Data Hub candidate against a sample. Tej-bazaar can be separately evaluated for EOD price/delivery data. No app code changed in this research step.


### 5) Additional candidates found in second search

- `rejinreeza/trading_tool`: https://github.com/rejinreeza/trading_tool — describes NSE quarterly XBRL filing collection with filing/publication dates and point-in-time handling. Strong candidate for learning the official filing ingestion pattern. Its reported historical XBRL availability (2019 onward) must be independently sampled; not assumed complete.
- `Jayadityas/Financial-results-extraction-using-NSE-BSE-APIs`: https://github.com/Jayadityas/Financial-results-extraction-using-NSE-BSE-APIs — describes an NSE+BSE filing pipeline, XBRL parsing, symbol/scrip/ISIN mapping and raw-file archive. Audit license, repository contents, and actual endpoint success before reuse.
- `ashu017/screener-mcp`: https://github.com/ashu017/screener-mcp — exposes Screener HTML/JSON data via MCP. It is another Screener-dependent scraper, not an independent licensed dataset; not preferred for production ingestion.
- `finstack`: https://pypi.org/project/finstack/ — aggregator of many sources, including India company statements and Screener/Moneycontrol/Tickertape. Source provenance and terms vary by adapter; package being open-source does not make upstream data reusable or independently verified.
- `finfetch`: https://pypi.org/project/finfetch/ — no-key scraper for statements/ratios; source and licensing/provenance require audit before adoption.
- NSE official Financial Results and Integrated Filing pages provide downloadable CSV/XBRL options and explicitly identify period end, original/revised submission, audited status, and consolidated/standalone basis. This is currently the strongest authoritative route to build the data layer from raw filings.

## Updated shortlist / priority
1. **Primary ingestion candidate:** official NSE XBRL/financial-results filings; BSE filing system as cross-check/fallback and for mapping gaps.
2. **Best open-source implementation to inspect next:** rejinreeza/trading_tool and Jayadityas NSE-BSE XBRL pipeline. Reuse patterns only after license and parsing validation.
3. **Secondary cross-check only:** Screener/Moneycontrol/Tickertape-derived packages, subject to upstream terms and provenance.
4. **Not a fundamentals source:** tej-bazaar; retain for EOD price/delivery data only.

No application runtime code or scanner logic has been changed. This report update is research documentation only.

## Actual code audit — two XBRL repositories (2026-11-22)

### A. rejinreeza/trading_tool
Repository: https://github.com/rejinreeza/trading_tool
Inspected: README.md, pyproject.toml, src/trading_tool/nse.py, and src/trading_tool/fundamentals.py.

**What is genuinely useful**
- nse.py calls NSE's /api/corporates-financial-results endpoint, captures filing date (fallback broadcast date), downloads linked XBRL, and stores filing metadata/XBRL in a local cache.
- Parser distinguishes quarter-only OneD/OneI contexts from cumulative Four* contexts, ignores dimensioned segment facts, and reads the document's own period start/end and standalone/consolidated declaration.
- It maps headline P&L facts including revenue (and bank interest earned), expenses, finance costs, PBT, tax, net profit and EPS. Quarterly revenue/profit growth could potentially be derived after period/basis validation.
- README reports practical XBRL-document history around 2019 onward (2018 partial; 2017 and earlier missing in its sample). Treat this as the author's sample finding, not a guarantee for all issuers.
- It has retry/backoff and distinguishes temporary request failures from 404 misses in cache behavior.

**Limitations / risks found in code**
- fundamentals.py current screen fetches Yahoo Finance .info fields. This is current-state data, not the NSE XBRL point-in-time feed; README warns not to backtest that screen.
- NSE XBRL parser does not provide the complete requested seven metrics. ROCE, Debt/Equity, Interest Coverage and Operating Cash Flow are not mapped in its current fact schema. ROE is not calculated from XBRL balance-sheet/equity facts here.
- Basis fallback is selected per symbol/period when requested basis is missing. This can create a time series with mixed consolidated and standalone quarters unless downstream code explicitly rejects/marks each fallback.
- Point-in-time frame sorts by filing date and deduplicates by symbol + period, but inspected selection logic does not explicitly prefer a revised filing flag; revised/original precedence requires separate audit before reuse.
- It records filing date but not a complete per-metric provenance contract (source URL, exact XBRL concept, unit/scale, parser version and revision lineage) in the returned table.
- Repository tree inspected did not show a LICENSE file or declared SPDX license. Do not copy/reuse code until license status is clarified. Public visibility is not a reuse license.
- README backtest results do not validate our scanner's data accuracy or strategy.

**Decision:** useful reference for NSE endpoint handling and XBRL context parsing; not a ready-to-integrate seven-metric source. No code copied.

### B. Jayadityas/Financial-results-extraction-using-NSE-BSE-APIs
Repository: https://github.com/Jayadityas/Financial-results-extraction-using-NSE-BSE-APIs
Inspected: README, INSTRUCTION, LICENSE, settings, NSE client, symbol/scrip master, pipeline, requirements and repository tree.

**What is genuinely useful**
- MIT license is present for repository code (license applies to code, not automatically to exchange documents/data).
- Contains separate NSE/BSE clients, shared HTTP/throttle/cookie layer, filing downloader, manifests, raw-document storage and a symbol↔BSE scrip↔ISIN master.
- Master fetches NSE equity list and BSE scrip list and outer-joins by ISIN; sensible identity pattern, subject to duplicate/changed ISIN validation.
- NSE filing mapper captures period end, financial year, consolidated/audited flags, filing date and revised/original indicator.
- Settings default history cutoff to 2021 and pipeline default company list is top five, despite README describing broader all-company backfill as a goal.
- Repository includes committed security master snapshot and some raw sample filing documents, but these do not prove universe-wide successful coverage.

**Critical gap**
- Repository tree has src/parse/__init__.py but no substantive parser module under src/parse/. Inspected pipeline is a downloader/archive pipeline; it does not implement the promised normalized financial-statement parser or seven metrics.
- README describes parsed structured fields as a target architecture, but actual code tree inspected does not substantiate a finished parser. No meaningful automated tests were present in inspected tests directory (only .gitkeep).
- Default configuration is top5 / 2021 onwards, not a validated all-NSE/BSE production dataset. Akamai/browser fallback adds operational complexity and should not be assumed reliable in a hosted AI Studio runtime.
- Downloaded PDF/XML documents in Git do not establish that underlying exchange data can be redistributed freely.

**Decision:** strong reference for exchange ingestion, raw archive, ISIN master and filing metadata; not a usable finished fundamentals engine. Do not import its full downloader/browser stack into the scanner.

## Revised recommendation after code inspection
1. Keep official NSE/BSE financial-result filings as authoritative data layer.
2. Use trading_tool NSE module only as design reference for quarter contexts and filing-date-aware data; resolve license and revision/basis handling gaps before any code reuse.
3. Use Jayadityas repository only as design reference for company master, manifests, raw archive and exchange discovery; its parser/metrics layer is not implemented in inspected tree.
4. Do not integrate either repository into app runtime now. Next step is a read-only 20-company filing pilot, with original/revised filings and consolidated/standalone pairs deliberately tested. Record actual coverage and discrepancies for each of seven metrics.
5. No application runtime code, scanner filters, ranking, UI, APIs, or reload behavior changed. Only this research document is updated.