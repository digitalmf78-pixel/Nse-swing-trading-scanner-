# Profit Growth — official NSE filing evidence

## Purpose and safety boundary

This is a research evidence note for the Profit Growth data-selection gates. It records what an official NSE Integrated Filing — Financials statement actually reports and why consolidated Profit Growth must not silently substitute total group profit for profit attributable to owners of the parent.

This note does **not** approve a universal profit-growth formula, certify organic growth, calculate a production metric, or enable any production profile. All values below are source evidence only.

## Source

- Issuer: ITC Limited (NSE symbol: ITC; Main Board)
- Filing: Integrated Filing — IndAS, Q2 FY 2026–27
- Basis: Consolidated
- Quarter ended: 30 September 2026 (1 July 2026 to 30 September 2026)
- Year-to-date period: 1 April 2026 to 30 September 2026
- Status: Unaudited
- Board approval date: 2 November 2026
- Presentation currency / scale: INR / Lakhs
- Official NSE archive URL: https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_208371_02112026185559_iXBRL_WEB.html

## Reported profit rows (INR lakhs)

| Reported statement row | Quarter ended 30-Sep-2026 | YTD ended 30-Sep-2026 |
|---|---:|---:|
| Net profit/loss for period from continuing operations | 413,237 | 855,525 |
| Share of profit of associates and joint ventures accounted for using equity method | 9,696 | 18,287 |
| Total profit/loss for period | 422,933 | 873,812 |
| Profit/loss attributable to owners of parent | 416,840 | 856,253 |
| Profit/loss attributable to non-controlling interests | 6,093 | 17,559 |

The statement reconciles total profit to owners' profit plus non-controlling interests:
- Quarter: 416,840 + 6,093 = 422,933.
- YTD: 856,253 + 17,559 = 873,812.

The filing separately reports the share of associates/JVs before the total profit row. These distinctions matter: total profit for the period is not the same measure as profit attributable to owners of the parent.

## Comparability warnings recorded by the issuer

The filing notes that the Group acquired the Century Pulp and Paper business effective 1 August 2026 and that the current results include that business from that date; the issuer says the results are consequently not comparable with previous periods.

The filing also notes Sproutlife became a subsidiary effective 1 April 2026 and that current-period results include it from that date; the issuer says the quarter and six-month results are not comparable with previous periods.

Therefore, an exact same-calendar-period comparison alone does not establish organic or like-for-like growth. Material acquisition, disposal, restructuring, discontinued-operation and accounting-policy events need separate review and disclosure. The scanner must not invent an organic-growth adjustment.

## Implications for the research pipeline

1. For consolidated Profit Growth, retain the existing exact role requirement: `ProfitOrLossAttributableToOwnersOfParent` with `OWNERS_OF_PARENT` attribution. Do not substitute `ProfitLossForPeriod` (total group profit) or comprehensive income.
2. For standalone filings, retain the separate standalone entity-profit role and never mix it with consolidated owner-attributable profit.
3. Keep current and prior filings on the same issuer, reporting basis, exact calendar period type, unit/currency and exact concept QName. Missing or ambiguous facts remain blocked; do not guess a taxonomy extension.
4. Preserve acquisition/comparability disclosures as review flags. This note does not define a generic adjustment formula.
5. Keep all results research/candidate-only. `productionApproved` remains false; no scanner runtime, ranking, thresholds, delivery rules or trade signals change.

## Evidence scope limitation

This is one issuer's official filing and demonstrates statement-row distinctions and comparability disclosures. It does not prove that every issuer uses the same XBRL QName, profit attribution policy, or treatment of exceptional items and associates/JVs. Issuer-level original NSE filings and exact XBRL contexts must still be checked before accepting a candidate.
