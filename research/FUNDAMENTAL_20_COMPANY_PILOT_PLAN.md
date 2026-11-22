# Fundamental cache correction plan and 20-company pilot protocol

Date: 2026-11-22
Branch: research/free-fundamental-sources
Status: design only — no runtime code changed

## Scope and safety boundary

This document proposes a narrow data-layer correction and a read-only validation pilot for the Google AI Studio NSE Swing Trading Scanner. It is not the ECMS project.

Do not change the main branch, scanner filters, scoring/ranking, UI, API contracts, refresh/reload behavior, or the running Google AI Studio app as part of this research. Do not merge or sync anything to the app without separate explicit approval.

## 1. Current issue confirmed by source inspection

In `server/nsePipeline.ts`, `mergeFreeSourceCache()` maps:
- RevenueGrowthPct
- ProfitGrowthPct
- ROEPercent
- ROCEPercent
- DebtToEquity
- InterestCoverage
- PromoterHoldingPct, FIIHoldingPct, DIIHoldingPct, PublicHoldingPct

It does not map an OCF metric to `operatingCashFlowInr`.

The current cache is row-per-metric, but the merge builds a profile-level source/period/retrieval label only when it first creates a profile. Subsequent rows for the same symbol do not preserve their own independent provenance. The inspected merge does not carry a per-row basis/revision/audited status into the profile either.

The committed `data/research/fundamental_free_source_cache.csv` and `data/inputs/fundamental_metrics.csv` inspected on main were empty. This means there is no committed sample to validate yet; it does not prove the upstream collection path is broken.

## 2. Proposed narrow row-level cache schema

Keep one row per company × metric × financial period × filing version. Do not compress all seven metrics into one profile-level source label.

Required columns:
- Symbol
- ISIN
- Metric
- Value
- Unit
- Currency
- PeriodStart
- PeriodEnd
- PeriodType (QUARTER / HALF_YEAR / FY / TTM / OTHER)
- FinancialYear
- FilingDateTime
- FilingVersion (ORIGINAL / REVISED / UNKNOWN)
- AuditStatus (AUDITED / UNAUDITED / LIMITED_REVIEW / UNKNOWN)
- Basis (CONSOLIDATED / STANDALONE / UNKNOWN)
- Provider
- SourceURL
- SourceDocumentId
- XbrlConcept
- ContextRef
- ScaleOrDecimals
- Formula
- FormulaVersion
- RetrievedAtUTC
- ValidationStatus (VERIFIED / PARTIAL / MISSING / STALE / NOT_APPLICABLE / MISMATCH)
- ValidationNote

Rules:
1. A revised filing must supersede the original only for the same issuer, period, basis and statement type; retain both source records and mark the selected version.
2. Never combine consolidated and standalone values in one calculation. Prefer consolidated where available; mark standalone fallback clearly.
3. Preserve raw XBRL facts and context references before calculating ratios.
4. Units and scale must be normalized explicitly (e.g. INR, INR lakhs, INR crores); do not infer from magnitude.
5. Missing is null/status MISSING, never zero. Sector-inapplicable is NOT_APPLICABLE.
6. A metric value without a source URL/document and period/basis metadata is not VERIFIED.

## 3. OCF mapping proposal

The eventual mapper should map the verified operating cash flow line item from the cash-flow statement to `operatingCashFlowInr`, using the exact issuer taxonomy concept and XBRL context from each filing. Do not assume one universal tag name across all issuers/taxonomies.

Validation:
- Confirm cash-flow statement classification and period duration.
- Prefer annual FY OCF for annual quality checks; quarterly/cumulative contexts must be handled without double counting.
- If only cumulative year-to-date OCF is reported, derive a discrete quarter only by subtracting the prior cumulative period with the same FY, basis, currency, unit and taxonomy context.
- Retain raw value, normalized INR value, source concept, context, and formula.
- Do not substitute free cash flow, net cash change, cash equivalents movement, or profit for OCF.
- If the official filing lacks a valid OCF fact, return MISSING (or NOT_APPLICABLE only where sector accounting makes the metric unsuitable).

This is a mapping specification, not a code patch. No code has been changed.

## 4. Ratio calculation guardrails

- Revenue Growth: compare matching current/prior-year periods, same basis and duration; identify restatements and exceptional changes.
- Profit Growth: use the same profit line definition consistently (e.g. PAT), same period/basis; handle negative/zero prior-year denominator as a separately flagged case, not a misleading percentage.
- ROE: PAT attributable to owners divided by average attributable equity, with period alignment documented.
- ROCE: operating profit / EBIT divided by average capital employed, with a documented definition and source line items. Do not mix end-period capital with average capital silently.
- Debt/Equity: define debt components and equity denominator; do not use a generic vendor ratio unless its formula is disclosed and basis/period verified.
- Interest Coverage: EBIT / finance costs (or another explicitly documented standard); zero/negative finance cost requires a special status, not infinity.
- Operating Cash Flow: reported cash generated from/used in operating activities, period-aligned and normalized to INR.

Banks, NBFCs and insurers must not be forced through non-financial-company formulas. For the pilot, record sector-specific applicability and keep unsuitable generic ratios NOT_APPLICABLE until a defensible sector-specific formula is approved.

## 5. Proposed 20-company validation sample

This is a proposed representative sample, not a claim that filings have already been downloaded or parsed. Confirm each security's current NSE symbol/ISIN against the official NSE security master at pilot execution.

| Proposed company | Expected sector group | Pilot purpose |
|---|---|---|
| Reliance Industries | Diversified | Multi-segment consolidated filing |
| TCS | IT services | Clean annual/quarterly statements |
| Infosys | IT services | Peer and period consistency |
| HDFC Bank | Bank | Bank-specific applicability |
| ICICI Bank | Bank | Bank-specific applicability and filing comparison |
| State Bank of India | Bank | Public-sector bank reporting |
| ITC | FMCG/diversified | Multi-business reporting |
| Hindustan Unilever | FMCG | Consumer company statements |
| Larsen & Toubro | Engineering/projects | Complex group/consolidated reporting |
| Tata Motors | Auto | Consolidated reporting and exceptional items |
| Maruti Suzuki | Auto | Standalone/consolidated comparison |
| Sun Pharmaceutical | Pharma | Global subsidiaries/consolidation |
| Dr. Reddy's Laboratories | Pharma | Peer comparison |
| NTPC | Power utility | Capital-intensive utility |
| Power Grid Corporation | Power utility | Regulated utility and leverage |
| Tata Steel | Metals | Commodity cycle and group basis |
| JSW Steel | Metals | Peer and debt/capital metrics |
| Bharti Airtel | Telecom | High leverage and complex group |
| Bajaj Finance | NBFC | NBFC-specific applicability |
| HDFC Life | Insurance | Insurer-specific applicability |

Sample balance: 16 non-financial issuers plus 3 banks/NBFC and 1 insurer, to deliberately test that generic ratios are not falsely applied to financial companies.

## 6. Per-company pilot procedure

For each company:
1. Resolve current NSE symbol and ISIN using official security master.
2. Find the latest two comparable annual filings and latest two comparable quarterly filings on official NSE Integrated Filing – Financial.
3. Capture filing timestamp, original/revised flag, audited status, consolidated/standalone basis and XBRL document URL.
4. Where an original and revised filing exist for the same period/basis, compare facts and record which version is selected.
5. Parse source facts and contexts for all seven target metrics and underlying formula inputs.
6. Cross-check the selected filing against BSE official filing where available; record mismatches, do not silently overwrite.
7. Verify period, units, basis, taxonomy concept and formula manually for the sample.
8. Assign VERIFIED / PARTIAL / MISSING / STALE / NOT_APPLICABLE / MISMATCH per metric, not just one company-level status.

Pilot output should be a separate CSV plus concise exception report. Do not populate production cache until the pilot passes review.

## 7. Acceptance criteria before any runtime integration

- All populated values trace to an official filing URL and exact period/basis.
- Revised filing precedence is tested and auditable.
- No standalone/consolidated mixing.
- Unit conversion tests cover INR, lakhs and crores where encountered.
- Quarterly versus cumulative contexts are distinguished and validated.
- OCF is independently verified from cash-flow statements.
- Each of the seven metrics has a formula/concept definition and validation status.
- Financial-sector N/A handling is tested.
- Missing values remain missing; no fabricated defaults.
- Automated fixture tests include at least one original/revised pair and one standalone/consolidated pair.
- The scanner's existing output and behavior remain unchanged in this research phase.

## Official primary source entry points

- NSE Integrated Filing – Financial: https://www.nseindia.in/companies-listing/corporate-integrated-filing
- NSE Financial Results: https://www.nseindia.com/companies-listing/corporate-filings-financial-results
- BSE Financial Results: https://www.bseindia.com/corporates/Comp_Resultsnew.aspx

## Final status

Design/protocol only. No company filing set has yet been fetched and parsed as a complete 20-company pilot. No production cache, scanner runtime code, main branch, or Google AI Studio app was changed.


## 8. Follow-up read-only code-path audit (2026-11-22)

Additional files inspected on the research branch: `server/liveFetcher.ts`, `server/geminiResearch.ts`, `server/nsePipeline.ts`, `src/types/trading.ts`, `package.json`, and the relevant data directories.

### What the code actually does today

- `FundamentalProfile.operatingCashFlowInr` exists in the shared type.
- The baseline input loader maps `OperatingCashFlowINR` into that field.
- The independent free-source CSV merge still has no OCF metric mapping.
- A separate runtime path exists in `server/liveFetcher.ts`: Yahoo Finance timeseries requests `annualOperatingCashFlow` and `trailingOperatingCashFlow`; the selected value is converted to INR using a detected reporting currency and an FX conversion helper, then saved in `live_fundamental_overrides.json`.
- This is a secondary vendor feed, not an official NSE XBRL OCF extraction. The Yahoo selection prefers trailing OCF before annual OCF, so the stored value can be trailing-period rather than a clearly labelled FY amount.
- The inspected NSE XBRL parser's `ParsedXbrlMetrics` type and XBRL-only fallback currently contain revenue growth, profit growth, ROE, debt/equity, interest coverage and EPS fields, but no OCF field. The XBRL-only fallback explicitly assigns `operatingCashFlowInr: null`.
- Therefore, OCF is not absent from the whole app: it can arrive through Yahoo/live overrides or baseline CSV. What is absent is OCF mapping in the free-source CSV merge and an official NSE XBRL OCF parser path.
- The profile model stores one profile-level `financialPeriodEnd`, source and official filing URL. The Yahoo/XBRL merge can supplement individual metrics while updating this shared period/source label. That makes it unsafe to assume every displayed metric has the same source or period.
- The committed `fundamental_free_source_cache.csv` is empty. The committed `live_fundamental_overrides.json` is also empty. Thus there is no committed live sample to test or infer current company coverage from.

### Test readiness

- `package.json` exposes `build` and `lint` scripts, but no test script.
- The repository root and inspected server/source directories contain no visible dedicated test suite for fundamental merge, OCF mapping, period/basis consistency or revision precedence.
- Before any runtime patch, add isolated fixture tests on the research branch or a separate test-only branch; do not run a production data collection as a substitute for deterministic tests.

### Updated technical decision

1. Do not simply add an `OperatingCashFlow` case to the free-source mapper and call the issue fixed. That would map a number without solving source, period, unit, basis and filing lineage.
2. Treat Yahoo OCF as a provisional secondary value only, clearly labelled with its period end, trailing/annual nature, source and currency conversion. It must not be relabelled as official NSE-verified.
3. Build official OCF parsing from the XBRL cash-flow statement only after identifying and validating issuer taxonomy concepts, context duration, units/scale and consolidated/standalone context. Taxonomy tags must not be guessed from a single filing.
4. Keep each metric's provenance independent. A profile-level source/period can remain a summary only; it must not be used as proof of every metric's lineage.
5. The 20-company pilot remains NOT STARTED: no official filing set has yet been retrieved and parsed. No claims of company-level coverage or accuracy are made.

No runtime code, cache, main branch, or Google AI Studio app was changed during this audit.
