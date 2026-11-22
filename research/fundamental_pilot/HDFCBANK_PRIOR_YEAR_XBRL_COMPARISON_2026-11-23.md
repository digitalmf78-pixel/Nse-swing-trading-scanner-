# HDFC Bank consolidated prior-year original XBRL pair audit

Date: 2026-11-23
Project: Google AI Studio NSE Swing Trading Scanner
Branch: `research/free-fundamental-sources`
Status: research-only; no production/runtime integration.

## Official NSE filing pair

| Attribute | Current | Prior year |
|---|---|---|
| Issuer / symbol | HDFC Bank Limited / HDFCBANK | HDFC Bank Limited / HDFCBANK |
| ISIN | INE040A01034 | INE040A01034 |
| Quarter end | 30-SEP-2026 | 30-SEP-2025 |
| Filing family | INTEGRATED_FILING_BANKING | INTEGRATED_FILING_BANKING |
| Submission | Original | Original |
| Audit status | Unaudited | Unaudited |
| Basis | Consolidated | Consolidated |
| NSE sequence ID | 202132 | 120973 |
| Broadcast | 17-Oct-2026 17:47:13 | 18-Oct-2025 20:23:22 |

Both filings were resolved from the official NSE Integrated Filing - Financials endpoint with exact issuer, period, original submission, consolidated basis and banking filing-family checks.

## Raw XBRL extraction and structural comparison

| Check | Current original | Prior-year original |
|---|---:|---:|
| XML contexts | 71 | 66 |
| Facts | 322 | 313 |
| Period facts selected | 321 | 312 |
| Parser warnings | 0 | 0 |

The comparison matched facts by concept, period shape (Q2, YTD or instant), dimensions and unit. It did not use Yahoo or a third-party fundamentals feed.

- Matched structural keys: 311
- Unmatched keys across the two filings: 11
- Conflicting duplicate keys: 0 current; 0 prior
- Workflow result: `PARSE_AND_STRUCTURAL_COMPARISON_PASS`

The 11 unmatched keys are deliberately left unresolved. They may reflect filing-year taxonomy/extension changes, context or fact coverage differences, but the summary count alone does not establish the cause. Do not silently fill them from the other year or another source. Inspect the retained JSON artifact's exact unmatched keys before using any field.

## Banking metric restrictions

This pair proves that the generic TypeScript parser can extract both official HDFC Bank banking filings and structurally match a large set of same-shape raw facts. It does **not** approve any bank metric mapping or formula.

- Do not apply industrial-company Revenue Growth, Profit Growth, ROCE, Debt/Equity or Interest Coverage formulas to a bank.
- Bank ROE, profit/revenue growth and OCF remain subject to bank-specific definition, basis, period and accounting validation.
- Deposits, advances, interest earned/expended, asset quality and capital adequacy must be separately mapped to the correct banking statement lines and reporting periods.
- A concept name match does not establish semantic equivalence or suitability for a scanner threshold.

## Workflow evidence

- Workflow: https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/workflows/nse-hdfcbank-prior-year-comparison.yml
- Successful run: https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45060097774
- Artifact (7-day retention): https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45060097774/artifacts/14769441026
- Workflow source: `.github/workflows/nse-hdfcbank-prior-year-comparison.yml`

## Readiness decision

**Pass:** exact official original filing pair selection, parser extraction, zero parser warnings, 311 structural matches, no conflicting duplicate keys.

**Not approved:** any production bank metric mapping, any bank threshold, any ratio formula, and any claim that the 11 unmatched keys are harmless.

Keep this isolated on the research branch. Main branch, scanner filters, live-price path, UI and Google AI Studio app remain unchanged.
