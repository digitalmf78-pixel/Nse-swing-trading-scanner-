# KSH International Debt/Equity perimeter audit

Date: 2026-11-23  
Issuer: KSH International Limited (`KSHINTL`)  
Source: Official NSE-filed unaudited standalone financial results and original XBRL  
Period: Balance sheet as at 30-Sep-2026; comparison point 31-Mar-2026  
Status: **Two formula candidates reconciled; production Debt/Equity mapping remains blocked pending lease policy**

## Official statement facts (₹ million)

| Fact | 30-Sep-2026 | 31-Mar-2026 |
|---|---:|---:|
| Borrowings, non-current | 228.43 | 259.86 |
| Borrowings, current | 3,184.15 | 2,902.25 |
| Lease liabilities, non-current | 291.34 | 22.89 |
| Lease liabilities, current | 13.50 | 26.43 |
| Total equity | 8,988.56 | 8,081.01 |
| Right-of-use assets | 313.67 | 43.33 |

The XBRL concepts `BorrowingsNoncurrent`, `BorrowingsCurrent`, and `EquityAttributableToOwnersOfParent` are undimensioned instant facts at 2026-09-30, INR unit, standalone filing basis. Values reconcile to the official statement. The XBRL does not expose a single dedicated lease-liabilities concept in this instance: lease liabilities appear under the typed-member breakdown of `OtherNoncurrentFinancialLiabilities` and `OtherCurrentFinancialLiabilities`. The official PDF's note labels identify the relevant child rows.

## Two defensible calculation candidates

Formula A — borrowings only:

`(current borrowings + non-current borrowings) / total equity`

- 30-Sep-2026: ₹3,412.58m / ₹8,988.56m = **0.3797x**
- 31-Mar-2026: ₹3,162.11m / ₹8,081.01m = **0.3913x**

Formula B — borrowings plus lease liabilities:

`(current borrowings + non-current borrowings + current lease liabilities + non-current lease liabilities) / total equity`

- 30-Sep-2026: ₹3,717.42m / ₹8,988.56m = **0.4136x**
- 31-Mar-2026: ₹3,211.43m / ₹8,081.01m = **0.3974x**

These are alternatives, not two simultaneous scanner metrics. The difference demonstrates why the debt perimeter must be explicitly versioned. Do not silently add all `OtherCurrentFinancialLiabilities`: the parent includes both lease liabilities and other financial liabilities (₹357.85m at 30-Sep-2026). Trade payables must not be counted as borrowings in this candidate.

## Mapping decision

- The XBRL/statement values for borrowings and equity reconcile.
- Lease liabilities are separately disclosed in the official PDF but embedded in typed-member breakdowns of generic XBRL parent concepts, not a dedicated standard fact in this instance.
- The Integrated Filing display leaves the company-reported Debt Equity Ratio field blank.
- Therefore the project must not mark either formula as production-approved until a universal metric policy decides whether lease liabilities are included, how typed-member disclosures are parsed, and how missing/ambiguous lease components are handled.
- Current pilot status remains `BLOCKED_DEFINITION` for generic Debt/Equity; both ratios above are labelled research candidates only.

## Important source evidence

- Official NSE-filed results PDF, balance sheet: lines 128-181. Borrowings, lease liabilities and equity appear separately; right-of-use assets are also disclosed.
- Official NSE-filed results PDF, cash flow statement: lines 196-245. Finance cost is expressly described as including lease-liability finance costs at line 208; lease-liability payments appear at line 237.
- Official Integrated Filing page identifies the issuer, reporting basis, period, and blank Debt Equity Ratio field: https://kshinternational.com/investor-relations/integrated-filing-financial-with-rpt/financial-results-with-rpt_september-30-2026/
- Official NSE filing PDF: https://nsearchives.nseindia.com/corporate/INTERNATIONAL_04112026191648_KSH_BM_Outcome_04112026Signed.pdf

No runtime integration, main-branch change, scanner filter/scoring/UI modification, live-price path change, or Google AI Studio app sync was performed.
