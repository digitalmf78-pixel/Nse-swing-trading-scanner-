# ITC consolidated original NSE XBRL parser validation — 2026-11-23

## Scope and safety

Research-only validation on `research/free-fundamental-sources` for the separate Google AI Studio NSE Swing Trading Scanner.

No main-branch, scanner-runtime, Yahoo live-price, Yahoo fundamental, ranking, filters, UI, or deployed app changes were made.

## Official filing identity

Selected from the official NSE Integrated Filing-Financials API:

- Company: ITC Limited
- Symbol: ITC
- Scrip code: 500875
- ISIN: INE154A01025
- NSE sequence ID: 208371
- Quarter ended: 30-SEP-2026
- Submission: Original
- Audit status: Un-Audited
- Basis: Consolidated
- Broadcast: 02-Nov-2026 18:55:59
- NSE iXBRL display page: https://nsearchives.nseindia.in/corporate/ixbrl/INTEGRATED_FILING_INDAS_208371_02112026185559_iXBRL_WEB.html
- Original XBRL instance: https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1751357_02112026065559_WEB.xml

The official iXBRL display identifies the same symbol, ISIN, quarter, consolidated basis, unaudited status, and INR Lakhs presentation. The API metadata and display page agree on filing identity.

## Original XML and parser result

The original NSE XBRL XML was downloaded in GitHub Actions and parsed with the research-only TypeScript extractor.

- Original XML size: 99,054 bytes
- SHA-256: `23b97727608d7fa2cdb89ac5a898f01f6f5da75b8fbec07101b25553b3d62a8e`
- Contexts extracted: 65
- Facts extracted: 392
- Units extracted: 2 (INR and INR per share)
- Parser warnings: 0
- Candidate facts across the target metric concept set: 14
- Workflow: https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45058620081
- Artifact: `nse-itc-consolidated-real-xbrl-pilot`, ID `14768012793`, retention through 29-Nov-2026

The duration contexts include:
- `OneD`: 2026-07-01 to 2026-09-30 (quarter)
- `FourD`: 2026-04-01 to 2026-09-30 (six-month YTD)

The instance also contains an instant context `OneI` and many dimensional contexts for expense and reportable segments. Contexts with dimensions must not be mixed with consolidated group totals.

## Raw XBRL facts and independent display reconciliation

XBRL raw values are INR. NSE's rendered statement presents INR Lakhs. Divide raw INR by 100,000 to reconcile to the displayed Lakhs; divide by 10,000,000 to express Crores.

| Fact | Context | Raw INR | Normalized INR Crore | NSE display (INR Lakhs) |
|---|---|---:|---:|---:|
| RevenueFromOperations | OneD | 305,784,000,000 | 30,578.40 | 3,057,840.00 |
| RevenueFromOperations | FourD | 601,017,000,000 | 60,101.70 | 6,010,170.00 |
| ProfitLossForPeriod | OneD | 42,293,300,000 | 4,229.33 | 422,933.00 |
| ProfitLossForPeriod | FourD | 87,381,200,000 | 8,738.12 | 873,812.00 |
| ProfitBeforeTax | OneD | 55,976,600,000 | 5,597.66 | 559,766.00 |
| ProfitBeforeTax | FourD | 113,726,000,000 | 11,372.60 | 1,137,260.00 |
| FinanceCosts | OneD | 3,827,000,000 | 382.70 | 38,270.00 |
| FinanceCosts | FourD | 7,805,000,000 | 780.50 | 78,050.00 |
| Equity | OneI | 719,399,900,000 | 71,939.99 | 7,193,999.00 |
| BorrowingsNoncurrent | OneI | 600,000,000 | 60.00 | 6,000.00 |
| BorrowingsCurrent | OneI | 1,829,300,000 | 182.93 | 18,293.00 |
| CashFlowsFromUsedInOperatingActivities | FourD | 83,629,700,000 | 8,362.97 | 836,297.00 |

The raw XBRL facts reconcile exactly to the corresponding official NSE iXBRL statement rows for revenue, total profit, PBT, finance costs, equity, borrowings and operating cash flow. This is a same-filing display reconciliation, not an independent audit opinion.

## Seven-metric coverage for this filing

| Target metric | Evidence in this filing | Safe status |
|---|---|---|
| Revenue Growth | Current quarter and YTD revenue available; comparative prior-year facts not in this selected instance | `MISSING_COMPARATIVE_PERIOD` |
| Profit Growth | Current quarter and YTD total profit available; comparative prior-year facts not in this selected instance | `MISSING_COMPARATIVE_PERIOD` |
| ROE | Current profit and closing total equity available; average equity requires aligned opening equity and a defined profit attribution basis | `MISSING_REQUIRED_PERIOD` |
| ROCE | No approved complete average capital-employed and EBIT mapping established from this filing alone | `MISSING_REQUIRED_PERIOD` |
| Debt/Equity | Borrowings and equity facts available; lease liabilities separately disclosed and debt policy must be fixed before calculation | `RAW_INPUTS_ONLY` |
| Interest Coverage | Finance costs and PBT facts available; EBIT/interest definition and adjustments require approved policy | `RAW_INPUTS_ONLY` |
| Operating Cash Flow | Direct cash-flow statement fact for 01-Apr-2026 to 30-Sep-2026 | `AVAILABLE_YTD` |

NSE's rendered filing leaves Debt/Equity, DSCR and ISCR blank. Blank reported ratios remain missing, not zero. The extractor does not derive these ratios.

## Important comparability warning from issuer notes

The official filing notes that:
- Century Pulp and Paper is included in group results from 1-Aug-2026 and the relevant periods are not comparable with prior periods.
- Sproutlife is included from 1-Apr-2026 and the current quarter and six-month results are not comparable with previous periods.
- Changes in GST compensation cess and central excise duty affect reported gross revenue and mean revenue figures are not strictly comparable with prior periods.

Therefore a future growth engine must preserve these comparability flags and must not treat the current-period values as clean like-for-like growth evidence without adjustment or an explicit caution.

## What this proves — and what it does not

Proved:
- The same generic TypeScript extractor successfully parsed a second issuer's original NSE XBRL file.
- It handled a Consolidated filing with multiple dimensional contexts and extracted standard facts, units, periods and dimensions.
- Key raw INR facts reconciled to the official NSE iXBRL display after explicit INR-to-Lakhs conversion.
- The extractor produced no implemented parser warnings for this particular file.

Not proved:
- Full NSE taxonomy/XSD validation or support for every extension concept.
- Correct automated selection of consolidated group facts versus dimensional segment facts in all issuers.
- Seven-metric mapping, comparative-period matching, revision handling or ratio formula correctness.
- Universal parser correctness from two issuers only.

## Next safe step

Build a small, explicit taxonomy mapping and context-selection test set from these two real filings. Then add at least one issuer with a different reporting pattern and a revised filing. Keep the work research-only until metric values, comparative periods, dimensions, units and formulas are independently reconciled across multiple companies.
