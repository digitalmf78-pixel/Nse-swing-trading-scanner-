# Official NSE filing pilot — KSH International (KSHINTL)

Date checked: 2026-11-22
Project: Google AI Studio NSE Swing Trading Scanner
Branch: research/free-fundamental-sources
Status: one official human-readable iXBRL filing manually inspected; raw-file parser validation is still pending.

## Filing identity

- Company: KSH International Limited
- NSE symbol: KSHINTL
- ISIN: INE987S01020
- Security: Main Board equity
- Filing: Integrated Filing — IndAS
- NSE iXBRL page: https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_209920_04112026210644_iXBRL_WEB.html
- Board approval date: 2026-11-04
- Reporting period: quarter and half-year ended 2026-09-30
- Reporting basis: Standalone
- Audit status: Unaudited / limited review context
- Presentation currency: INR
- Display scale: Lakhs
- Cash flow statement: applicable; indirect method

## Values manually read from the official NSE iXBRL rendering

| Item | Period | Reported value | Unit | Interpretation |
|---|---|---:|---|---|
| Revenue from operations | Quarter ended 2026-09-30 | 131,965.40 | INR Lakhs | Quarter value |
| Revenue from operations | YTD 2026-04-01 to 2026-09-30 | 248,388.90 | INR Lakhs | Six-month cumulative value |
| Profit before tax | Quarter ended 2026-09-30 | 6,385.70 | INR Lakhs | Quarter value |
| Net profit for period | Quarter ended 2026-09-30 | 4,795.30 | INR Lakhs | Quarter value |
| Net cash from operating activities | YTD 2026-04-01 to 2026-09-30 | 4,257.10 | INR Lakhs | Six-month cumulative OCF |
| Debt/equity ratio | Filing field | Blank | — | Missing in this filing; not zero |
| Interest service coverage ratio | Filing field | Blank | — | Missing in this filing; not zero |

## Findings and guardrails

1. The filing explicitly reports the reporting basis, audit status, INR currency and Lakhs scale. These must be captured with every value.
2. Quarter values and YTD values coexist in the same filing. They must not be mixed. The OCF value above is six-month cumulative, not a single-quarter or FY value.
3. Debt/equity and interest service coverage fields are blank in this filing. Do not infer zero or manufacture a ratio from the blank field.
4. Revenue growth and profit growth cannot be calculated from this single filing alone; a comparable prior-year period on the same standalone basis is required.
5. This is a manual reading of NSE's human-readable iXBRL rendering. The raw downloaded XBRL/HTML bytes were not obtained in this check, so the new Python parser has NOT yet been run against this issuer document.
6. This is one company, one basis and one period. It is not the 20-company pilot and does not establish broad coverage.

## Code status

- Added isolated research-only parser at `research/fundamental_pilot/xbrl_extract.py`.
- Added synthetic unit tests; local run passed 7/7 tests (contexts, entity, values, nil handling, inline scale/sign, ZIP instance selection and DTD rejection).
- Parser extracts raw contexts, periods, dimensions, units, values, nil flags, decimals and inline scale/sign.
- Parser does not yet map the seven target metrics, calculate ratios, choose basis/revisions, or produce scanner-ready rows.
- No runtime code, main branch, thresholds, cache, UI or Google AI Studio app changed.

## Next validation

Obtain the actual NSE XBRL/HTML attachment bytes for KSHINTL and a consolidated/standalone pair, run the parser against those raw files, then compare extracted facts and context periods with the official rendering and BSE filing before expanding to the 20-company sample.
