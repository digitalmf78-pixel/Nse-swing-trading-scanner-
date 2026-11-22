# KSH International ROE numerator and equity-period audit

Date: 2026-11-23  
Issuer: KSH International Limited (`KSHINTL`)  
Basis: Standalone  
Period: Six months ended 30-Sep-2026  
Status: **Mechanical half-year return candidate reconciled; production ROE remains blocked pending annualization policy**

## Matched official statement inputs

| Input | Amount (₹ million) | Source period |
|---|---:|---|
| Profit for the period | 901.73 | 01-Apr-2026 to 30-Sep-2026 |
| Opening total equity | 8,081.01 | 31-Mar-2026 audited balance sheet |
| Closing total equity | 8,988.56 | 30-Sep-2026 unaudited balance sheet |

For this standalone filing, total equity and equity attributable to owners are equal in the statement. The current-period profit is the standalone total profit for the period. All amounts use the same INR currency and issuer basis.

## Mechanical candidate

Average equity:

`(8,081.01 + 8,988.56) / 2 = ₹8,534.785 million`

Unannualized six-month return on average equity:

`901.73 / 8,534.785 × 100 = 10.5654%`

This is labelled **HALF_YEAR_RETURN_CANDIDATE**, not a final annual ROE. A simple x2 annualization would produce approximately 21.13%, but this report does not approve that annualization method. The scanner must not silently compare a six-month unannualized return against an annual ROE threshold.

## Definition gates still open

- Confirm whether scanner ROE is annualized TTM, annual FY, or annualized interim profit divided by average equity.
- For consolidated issuers, numerator must be profit attributable to owners and denominator equity attributable to owners; do not silently use total group profit/equity where non-controlling interests exist.
- For standalone issuer, verify exact matching reporting basis and period duration.
- Opening and closing equity must be instant facts at the exact start/end boundaries for the matching duration; no mixing with year-end equity from a different fiscal year.
- Exceptional items and discontinued operations treatment must be defined consistently.

## Evidence

Official NSE-filed statement PDF:
- Profit for the half-year: lines 91-99.
- Opening/closing balance sheet equity: lines 128-160.
- IPO was completed in December 2025 and shares listed on 23-Dec-2025: lines 279-282. This is background for the equity base, not a reason to adjust the ROE calculation.

The official XBRL Q2 filing provides H1 `ProfitLossForPeriod` and 30-Sep instant equity facts. The 31-Mar opening equity is taken from the same official filed financial statement PDF and retained with its date/basis, not invented from a later period.

Source PDF: https://nsearchives.nseindia.com/corporate/INTERNATIONAL_04112026191648_KSH_BM_Outcome_04112026Signed.pdf

No runtime formula, main-branch change, scanner UI/filter/scoring change, live-price path change, or Google AI Studio app sync was made.
