# Official NSE filing pilot — KSH International (KSHINTL)

Date checked: 2026-11-23
Project: Google AI Studio NSE Swing Trading Scanner
Branch: research/free-fundamental-sources
Status: official NSE human-readable iXBRL rendering manually inspected; raw issuer XBRL/iXBRL parser validation remains pending.

## Filing identity

- Company: KSH International Limited
- NSE symbol: KSHINTL
- ISIN: INE987S01020
- Security: Main Board equity
- Filing: Integrated Filing — Ind AS
- NSE iXBRL page: https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_209920_04112026210644_iXBRL_WEB.html
- Board approval / filing date shown: 2026-11-04
- Financial year: 2026-27 (2026-04-01 to 2027-03-31)
- Reporting quarter: Q2, 2026-07-01 to 2026-09-30
- YTD period: 2026-04-01 to 2026-09-30
- Reporting basis: Standalone
- Audit status: Unaudited
- Presentation currency: INR
- Display scale: Lakhs
- Cash flow statement: applicable; indirect method

## Values manually read from the official NSE iXBRL rendering

| Item | Exact period | Reported value | Unit | Interpretation |
|---|---|---:|---|---|
| Revenue from operations | Quarter: 2026-07-01 to 2026-09-30 | 131,965.40 | INR Lakhs | Q2 standalone |
| Revenue from operations | YTD: 2026-04-01 to 2026-09-30 | 248,388.90 | INR Lakhs | Six-month cumulative standalone |
| Profit before tax | Quarter: 2026-07-01 to 2026-09-30 | 6,385.70 | INR Lakhs | Q2 standalone |
| Net profit for period | Quarter: 2026-07-01 to 2026-09-30 | 4,795.30 | INR Lakhs | Q2 standalone |
| Net profit for period | YTD: 2026-04-01 to 2026-09-30 | 9,017.30 | INR Lakhs | Six-month cumulative standalone |
| Net cash from operating activities | YTD: 2026-04-01 to 2026-09-30 | 4,257.10 | INR Lakhs | Six-month cumulative OCF |
| Debt/equity ratio | Filing field | Blank | — | Missing in this filing; not zero |
| Debt service coverage ratio | Filing field | Blank | — | Missing in this filing; not zero |
| Interest service coverage ratio | Filing field | Blank | — | Missing in this filing; not zero |

Balance-sheet cross-check from the same filing:
- Total assets: 175,541.10 INR Lakhs
- Total equity: 89,885.60 INR Lakhs
- Non-current borrowings: 2,284.30 INR Lakhs
- Current borrowings: 31,841.50 INR Lakhs
- Lease liabilities are disclosed separately and must not be silently included/excluded without a documented ratio definition.

## Findings and guardrails

1. Filing identity, financial year, quarter period, YTD period, standalone basis, unaudited status, INR currency and Lakhs display scale are explicitly visible in the official filing.
2. Quarter and YTD facts coexist in the same filing. They are distinct contexts: Q2 revenue is not the six-month revenue, and six-month OCF is not a single-quarter or FY OCF. Keep period start/end and period type with each fact.
3. Debt/equity, debt service coverage and interest service coverage fields are blank. Store as null + MISSING; do not infer zero.
4. Revenue growth and profit growth cannot be calculated from this filing alone. A comparable prior-year period on the same standalone basis and matching duration is required.
5. ROE and ROCE must not be calculated until numerator/denominator periods and definitions are aligned and documented. Balance-sheet values above are not sufficient by themselves to establish a compliant ratio.
6. The values in this report are manually read from NSE's human-readable iXBRL rendering. The raw issuer XBRL/iXBRL attachment bytes were not obtained in this check. Therefore the research TypeScript parser has NOT been validated against this issuer document.
7. This is one company, one basis and one reporting period. It is not the 20-company pilot and does not establish broad coverage.

## Research parser status (isolated; not production)

- TypeScript extractor: `research/fundamental_pilot/xbrl_extract.ts`.
- Synthetic tests: `research/fundamental_pilot/xbrl_extract.test.ts`; the latest file contains 9 tests, including an Inline XBRL fraction scale/sign regression case.
- Latest test commit: `072df3dbd37a9c60a3e47fd012e718e495f06f29`.
- CI result for that commit has not been confirmed. A missing/empty combined status is not proof that tests passed.
- The extractor handles basic contexts, entity identifiers, periods, dimensions, units, standard facts, Inline XBRL nonfraction/fraction/nonnumeric facts, nil, decimals, scale and sign.
- Known gaps: Inline XBRL `format` transformations are not implemented; `continuedAt` chains are not implemented; ZIP decompression is not implemented; there is no real issuer filing fixture.
- It does not yet map NSE taxonomy concepts to the seven metrics, calculate ratios, select consolidated/standalone or original/revised filings, align quarter/YTD/FY periods, or produce scanner-ready profiles.

## Next validation

1. Obtain the actual NSE issuer XBRL/iXBRL attachment bytes and the relevant taxonomy archive through an official supported route.
2. Add the real filing as a sanitized research fixture, run the TypeScript extractor, and reconcile extracted facts and contexts against the official rendering.
3. Resolve Inline XBRL transformations, continued facts and archive handling before claiming robust issuer coverage.
4. Validate a consolidated/standalone pair and an original/revised filing pair, preserving every raw version and its provenance.
5. Only then map the seven metrics and expand the 20-company sample.

## Change-safety statement

No scanner runtime, main branch, thresholds, cache, UI, ranking/scoring logic, live-price path or Google AI Studio app was changed by this pilot update.
