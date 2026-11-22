# Fundamental source policy and safe implementation plan

Date: 2026-11-22
Project: Google AI Studio NSE Swing Trading Scanner (not ECMS)
Branch: research/free-fundamental-sources

## User-approved source boundary

- Live/current market price: retain the existing Yahoo Finance price path only.
- Fundamental statements and ratios: do not use Yahoo Finance, yfinance, Yahoo quoteSummary, or Yahoo fundamentals-timeseries as a source of truth.
- Primary fundamental evidence: official NSE and BSE company financial-result filings, including XBRL/iXBRL and linked statement documents.
- Free/open-source secondary datasets or libraries may be considered only after auditing data provenance, license, field definitions, coverage, freshness, and sample values against official filings.
- No paid API or paid data dependency is acceptable for the proposed core fundamental feed.
- No source is "verified" merely because it is free, open-source, popular, or returns a number.

## Important current-code finding (read-only audit)

The current `server/liveFetcher.ts` contains two distinct Yahoo uses:
1. Yahoo chart/quote path used for live price/market data.
2. Yahoo quoteSummary and fundamentals-timeseries requests for company financial metrics (revenue, net income, EBIT, interest expense, assets, equity, debt, operating cash flow, free cash flow, EPS, ratios and related fields).

The second path conflicts with the user-approved source policy. However, it must NOT be removed before an official replacement is built and validated: doing so now could leave fundamental profiles empty or change scanner behavior. Keep the current app/main branch unchanged until a replacement passes the pilot.

The existing data model stores much provenance at profile level. This is insufficient when metrics come from different filings, periods, bases, or providers. The research branch must first establish metric-level provenance and validation.

## Source assessment

### Primary: official exchange filings
- NSE Financial Results offers downloadable CSV and XBRL-to-Excel workflows.
- NSE Integrated Filing – Financial exposes symbol, company, period end, original/revised filing, audited/unaudited status, consolidated/standalone basis, filing/XBRL links, broadcast and revised timestamps.
- BSE Financial Results is a second official filing route and cross-check.
- SEBI's circular on free access to mandated public disclosures states that such data should be available free for viewing and download in the mandated format and for value-add usage. This supports using the official public disclosure itself; it does not automatically grant rights to third-party scraped datasets or exchange market-data products.

### Open-source / free candidates
1. `rejinreeza/trading_tool`: useful reference for NSE filing discovery, filing-date capture, XBRL quarter-vs-YTD context handling and bank taxonomy differences. Not a complete seven-metric feed; license was not identified in the inspected repository, so do not copy code unless clarified.
2. `Jayadityas/Financial-results-extraction-using-NSE-BSE-APIs`: useful design reference for exchange ingestion, ISIN mapping and raw filing archives. Inspected parser/tests were incomplete; not a ready fundamentals engine.
3. `PhdSatyam/Phddata`: open dataset with financial statements extracted from annual reports; data license CC BY 4.0 and code MIT per repository. Its own quality notes flag roughly 7% of company-year financial records and report weaker spot-check rates for banks. Treat as secondary cross-check only, not authoritative runtime source.
4. `sahiljani/screener-india` and other Screener scrapers: unofficial scraping of Screener pages. MIT licensing covers the client code, not a separate license to reuse Screener's underlying data. Do not use as unattended production feed unless upstream terms/permission clearly allow it.
5. `tejhq/tej-bazaar`: exchange-bhavcopy-derived EOD price/delivery data, not fundamental statements. Not needed for fundamentals and must not replace the chosen Yahoo live-price source without a separate user decision.
6. Free hosted aggregators: do not assume the free tier is suitable for app runtime or commercial/product display. Verify API limits, provenance and usage terms before considering.

## Required metric evidence

Target metrics:
- Revenue Growth
- Profit Growth
- ROE
- ROCE
- Debt / Equity
- Interest Coverage
- Operating Cash Flow

Each company × metric × period × filing version must retain:
- NSE symbol and verified ISIN
- metric key, raw fact and normalized value
- currency, unit and scale/decimals
- period start/end and period type (quarter, YTD, FY, TTM)
- publication/broadcast timestamp
- original/revised status and revision remarks
- audited/unaudited/limited-review status
- consolidated/standalone basis
- exchange, source URL, document identifier and retrieval timestamp
- XBRL concept, contextRef, dimensions and calculation formula/version
- validation status and explanation

Missing values remain null and are marked MISSING. Sector-inapplicable metrics are NOT_APPLICABLE. Never substitute zero, estimates, free cash flow for operating cash flow, or an unrelated line item.

Do not mix consolidated and standalone values, currencies, units, financial periods, or original/revised filing versions in one calculation. A revised filing supersedes an original only for the same issuer, period, basis and statement type; preserve both raw versions.

For banks, NBFCs and insurers, do not force generic industrial-company ROCE, debt/equity, or interest-coverage formulas. Use NOT_APPLICABLE until a defensible sector-specific definition is validated.

## Safe implementation sequence

1. Keep the current main branch and running AI Studio app untouched.
2. In this research branch, create an isolated official-filing ingestion/parser module; do not connect it to scanner runtime yet.
3. Preserve original downloaded filing bytes and metadata before parsing.
4. Build deterministic fixtures from official sample filings covering:
   - one non-financial issuer
   - one bank / financial issuer
   - consolidated and standalone versions
   - original and revised filing pair
   - quarterly versus cumulative/YTD contexts
   - unit/scale differences
   - cash-flow statement OCF
5. Add automated tests for concept mapping, contexts, period alignment, units, basis isolation, revision precedence and missing/N/A behavior.
6. Compare parsed values manually with the source document and BSE counterpart. Report coverage and discrepancies for the 20-company sample.
7. Only after the pilot passes, propose a narrow runtime integration that keeps Yahoo live price intact and removes Yahoo fundamental ingestion without changing filters, scores, ranking, APIs, UI, or reload behavior.
8. Do not merge, sync to AI Studio, or change main without separate explicit user approval.

## Current status

- Source policy accepted and documented.
- Read-only code inspection confirms Yahoo is currently used for both price and fundamental fields in `server/liveFetcher.ts`.
- Official NSE/BSE source hierarchy selected.
- No runtime code, cache data, thresholds, UI, main branch, or running Google AI Studio app changed.
- Official 20-company filing pilot remains NOT STARTED; no verified seven-metric coverage is claimed.
