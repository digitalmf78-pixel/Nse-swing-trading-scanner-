# ITC consolidated prior-year XBRL comparison — 30-Sep-2026 vs 30-Sep-2025

Date: 2026-11-23
Project: Google AI Studio NSE Swing Trading Scanner
Branch: `research/free-fundamental-sources`
Status: research-only; no scanner runtime changes.

## Official NSE filing pair

| Attribute | Current period | Prior-year period |
|---|---|---|
| Issuer / symbol | ITC Limited / ITC | ITC Limited / ITC |
| ISIN | INE154A01025 | INE154A01025 |
| Quarter end | 30-SEP-2026 | 30-SEP-2025 |
| Submission | Original | Original |
| Audit status | Un-Audited | Un-Audited |
| Basis | Consolidated | Consolidated |
| NSE sequence ID | 208371 | 123570 |
| Broadcast | 02-Nov-2026 18:55:59 | 30-Oct-2025 18:07:04 |
| Filing family | INTEGRATED_FILING_INDAS | INTEGRATED_FILING_INDAS |

Both filing rows were independently resolved from the official NSE Integrated Filing-Financials API, and both original XML instances were downloaded from NSE.

## Parser and context matching

| Check | 2026 original | 2025 original |
|---|---:|---:|
| XML contexts | 65 | 52 |
| Facts | 392 | 367 |
| Parser warnings | 0 | 0 |
| Reporting basis | Consolidated | Consolidated |
| Filing status | Original / unaudited | Original / unaudited |

The initial comparison attempt incorrectly looked for 2025 comparative contexts inside the 2026 XBRL instance. It found none. The workflow was corrected to compare the 2026 current-period contexts against the independent 2025 original filing.

After correction:
- 9 current-period candidate facts were selected.
- 9 prior-year original candidate facts were selected.
- 9 exact matches were found by concept, matching calendar period shape (Q2 or H1 YTD), dimensions and unit.
- Unmatched keys: 0.
- Group-level contexts were undimensioned; no segment-dimensional facts were used in this pair comparison.

This is a successful extraction and structural matching result, not full taxonomy or accounting validation.

## Matched raw XBRL values and mechanical YoY changes

All source values below are raw INR from the XBRL instances. Crore conversion is INR / 10,000,000. Percentages are mechanically calculated as (current / prior - 1) × 100.

| Fact | Period | 2026 value (₹ Cr) | 2025 value (₹ Cr) | Mechanical YoY |
|---|---|---:|---:|---:|
| RevenueFromOperations | Q2 | 30,578.40 | 21,255.86 | +43.86% |
| RevenueFromOperations | H1 YTD | 60,101.70 | 44,385.21 | +35.41% |
| ProfitBeforeTax | Q2 | 5,597.66 | 6,912.32 | -19.02% |
| ProfitBeforeTax | H1 YTD | 11,372.60 | 13,971.57 | -18.60% |
| ProfitLossForPeriod | Q2 | 4,229.33 | 5,186.55 | -18.46% |
| ProfitLossForPeriod | H1 YTD | 8,738.12 | 10,529.96 | -17.02% |
| FinanceCosts | Q2 | 38.27 | 20.05 | +90.87% |
| FinanceCosts | H1 YTD | 78.05 | 36.52 | +113.72% |
| CashFlowsFromUsedInOperatingActivities | H1 YTD | 8,362.97 | 6,162.60 | +35.71% |

Note: OCF is H1 YTD only in this selected pair. Do not create Q2 OCF by subtracting or inferring unless the exact first-quarter cash-flow period and policy are verified.

## Important comparability warning

ITC's 2026 filing disclosures identify changes affecting year-over-year comparability, including:
- Century Pulp and Paper included from 1-Aug-2026.
- Sproutlife included from 1-Apr-2026.
- GST compensation cess and central excise duty changes affecting gross revenue comparability.

Therefore, the strong reported revenue increase is not directly equivalent to organic growth. The decline in PBT and profit despite higher reported revenue also needs segment, acquisition, tax and cost-driver analysis. The mechanical percentages must not be used as standalone investment signals or passed into a production score without a comparability policy.

## Readiness decision

Proved in this pair:
- Official NSE original filing discovery for both years.
- Matching issuer, ISIN, consolidation basis, filing family, quarter-end pattern and original status.
- Successful TypeScript extraction of both real XML files.
- Nine exact concept/period-shape/dimension/unit matches.
- Raw INR values and mechanical comparisons are reproducible from the preserved source facts.

Not proved:
- Organic or like-for-like growth.
- That ProfitLossForPeriod is the approved profit-growth basis for every issuer.
- A universal concept mapping across all issuers and sectors.
- Production-ready growth formulas or comparability adjustment.
- ROE, ROCE, Debt/Equity or Interest Coverage.

## Workflow evidence

- Workflow run: https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45059528746
- Workflow definition: `.github/workflows/nse-itc-prior-year-comparison.yml`
- Artifact ID: `14769161040` (retention is 7 days). The corrected run includes the exact 9/9 matching assertion and guarded mechanical YoY diagnostics.

Keep this work on the research branch. Do not connect it to scanner runtime until comparable-period, sector, revision, unit and accounting formula policies are validated across more issuers.
