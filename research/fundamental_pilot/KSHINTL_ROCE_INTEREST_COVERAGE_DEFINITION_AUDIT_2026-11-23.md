# KSH International ROCE and Interest Coverage definition audit

Date: 2026-11-23  
Issuer: KSH International Limited (`KSHINTL`)  
Basis: Standalone  
Period: Six months ended 30-Sep-2026  
Status: **Source facts reconciled; formula candidates shown for analysis only; both production mappings remain blocked**

## Matched official statement inputs (₹ million)

| Input | H1 / 30-Sep-2026 |
|---|---:|
| Profit before tax | 1,207.52 |
| Finance costs | 395.31 |
| Interest income | 20.80 |
| Equity at 31-Mar-2026 | 8,081.01 |
| Equity at 30-Sep-2026 | 8,988.56 |
| Borrowings at 31-Mar-2026 | 3,162.11 |
| Borrowings at 30-Sep-2026 | 3,412.58 |
| Lease liabilities at 31-Mar-2026 | 49.32 |
| Lease liabilities at 30-Sep-2026 | 304.84 |
| Total assets at 31-Mar-2026 | 13,225.66 |
| Total assets at 30-Sep-2026 | 17,554.11 |
| Current liabilities at 31-Mar-2026 | 4,769.37 |
| Current liabilities at 30-Sep-2026 | 7,910.92 |

## EBIT numerator is not yet a universal rule

Two mechanical candidates:
- PBT + finance costs = ₹1,602.83m.
- PBT + finance costs - interest income = ₹1,582.03m.

These are not automatically equivalent to a company-defined EBIT. The cash-flow statement notes finance costs include amounts towards lease liabilities. The correct EBIT/operating-profit bridge and treatment of interest income, lease finance cost and non-operating income must be defined consistently before either candidate can feed ROCE or Interest Coverage.

## Interest Coverage alternatives

Using finance costs as the denominator:
- Candidate A: (PBT + finance costs) / finance costs = **4.0546x**.
- Candidate B: (PBT + finance costs - interest income) / finance costs = **4.0020x**.

Both are mechanical candidates only. The statement does not provide a resolved EBIT formula or separate lease-interest split, and the Integrated Filing display leaves the company-reported Interest Service Coverage Ratio field blank. Do not select one as a trusted scanner metric based on name similarity.

## ROCE alternatives

Average capital employed variants:
- Equity + borrowings (lease liabilities excluded): average ₹11,822.13m.
- Equity + borrowings + lease liabilities: average ₹11,999.21m.
- Total assets - current liabilities: average ₹9,049.74m.

Using PBT + finance costs (₹1,602.83m) as an unannualized H1 EBIT candidate:
- Borrowings-only capital employed: **13.5579%** half-year candidate.
- Including lease liabilities: **13.3578%** half-year candidate.
- Total assets less current liabilities: **17.7113%** half-year candidate.

These are not annualized and not production ROCE. Different capital-employed definitions create materially different results. The XBRL taxonomy's presentation of lease liabilities under typed-member details also requires controlled parsing and statement reconciliation.

## Decision / blockers

1. ROCE remains `BLOCKED_DEFINITION`: EBIT bridge, capital-employed definition, lease treatment and annualization must be fixed.
2. Interest Coverage remains `BLOCKED_DEFINITION`: EBIT numerator, finance-cost denominator perimeter and period annualization must be fixed.
3. Do not infer EBIT as PBT + finance costs without validating the issuer's full statement and accounting presentation.
4. Do not mix H1 numerator with FY or TTM finance cost.
5. No value from these candidates may pass scanner thresholds until a versioned formula policy and source mapping are approved.

## Evidence

Official NSE-filed results PDF:
- Finance costs, PBT and PAT: lines 87-99.
- Equity and balance-sheet values: lines 128-181.
- Cash-flow statement says finance costs include lease-liability finance costs: line 208; interest income line 209; lease payments line 237.
- Limited review report and filing status: lines 31-33, 277-282.

Official Integrated Filing page (company, basis, period, and blank Debt Equity / Interest Service Coverage fields):
https://kshinternational.com/investor-relations/integrated-filing-financial-with-rpt/financial-results-with-rpt_september-30-2026/

Official NSE filing PDF:
https://nsearchives.nseindia.com/corporate/INTERNATIONAL_04112026191648_KSH_BM_Outcome_04112026Signed.pdf

No runtime integration, main-branch change, scanner filter/scoring/UI change, live-price path change, or Google AI Studio app sync was made.
