# Operating Cash Flow — official NSE filing evidence batch

Research date: 2026-11-25

## Scope and decision

This note records official NSE Integrated Filing examples for OCF source-row identity, reporting basis, YTD duration, currency scale, and cash roll-forward cross-checks. It is research evidence only. It does not approve a universal OCF formula, an XBRL QName mapping for all issuers, or production use.

For every issuer, retain the original source filing and exact context. Do not mix standalone and consolidated facts, quarter and YTD periods, or units. A YTD value is not a quarter value. Quarterly OCF may only be derived from a pair of exact matching Q1 and H1 YTD facts when the issuer's reporting periods and contexts are proven to align.

## 1. CLEAN MAX ENVIRO ENERGY SOLUTIONS LIMITED — standalone H1 FY 2026–27

- NSE symbol: CLEANMAX; Main Board equity.
- Filing approved: 3 November 2026.
- Reporting: 1 April 2026 to 30 September 2026; unaudited; standalone.
- Presentation currency: INR; scale: Lakhs.
- Official NSE filing: https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_209202_04112026000311_iXBRL_WEB.html
- Cash-flow statement reports:
  - Net cash flows from (used in) operating activities: INR 74,207.80 lakhs.
  - Net increase (decrease) in cash and cash equivalents: INR (32,773.10) lakhs.
  - Cash and cash equivalents at beginning: INR 1,06,821.80 lakhs.
  - Cash and cash equivalents at end: INR 74,048.70 lakhs.
- Arithmetic roll-forward: 1,06,821.80 + (−32,773.10) = 74,048.70 lakhs.
- The balance sheet reports cash and cash equivalents of INR 74,048.70 lakhs, matching the cash-flow closing balance.
- This is a strong standalone H1 YTD source example with a closing cash cross-check. OCF is still candidate evidence, not production approval.

## 2. EPL LIMITED — standalone H1 FY 2026–27

- NSE symbol: EPL; Main Board equity.
- Filing approved: 4 November 2026.
- Reporting: 1 April 2026 to 30 September 2026; unaudited; standalone.
- Presentation currency: INR; scale: Lakhs.
- Official NSE filing: https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_209611_04112026182622_iXBRL_WEB.html
- Cash-flow statement reports:
  - Net cash flows from (used in) operating activities: INR 1,340.00 lakhs.
  - Net increase (decrease) in cash and cash equivalents: INR 940.00 lakhs.
  - Cash and cash equivalents at beginning: INR 1,960.00 lakhs.
  - Cash and cash equivalents at end: INR 2,900.00 lakhs.
- Arithmetic roll-forward: 1,960.00 + 940.00 = 2,900.00 lakhs.
- The balance sheet reports cash and cash equivalents of INR 2,900.00 lakhs, matching the cash-flow closing balance.
- This provides a second standalone H1 example and corroborates that OCF is a distinct operating cash-flow row, not the net change in cash.

## 3. GAUDIUM IVF AND WOMEN HEALTH LIMITED — consolidated H1 FY 2026–27

- NSE symbol: GAUDIUMIVF; Main Board equity.
- Filing approved: 12 November 2026.
- Reporting: 1 April 2026 to 30 September 2026; unaudited; consolidated.
- Presentation currency: INR; scale: Lakhs.
- Official NSE filing: https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_213250_12112026230256_iXBRL_WEB.html
- Cash-flow statement reports:
  - Net cash flows from (used in) operating activities: INR 1,976.54 lakhs.
  - Net increase (decrease) in cash and cash equivalents: INR 1,169.99 lakhs.
  - Cash and cash equivalents at beginning: INR 878.57 lakhs.
  - Cash and cash equivalents at end: INR 2,048.56 lakhs.
- Arithmetic roll-forward: 878.57 + 1,169.99 = 2,048.56 lakhs.
- The balance sheet reports cash and cash equivalents of INR 2,048.56 lakhs, matching the cash-flow closing balance.
- This provides a consolidated example. It must remain a separate basis from the standalone CLEANMAX and EPL examples.

## Research implications

1. The official NSE filing schema can expose reporting basis, period dates, INR presentation currency, and scale separately from the OCF row. Persist all of them with the fact.
2. OCF must be selected from the explicit “Net cash flows from (used in) operating activities” cash-flow statement row; do not substitute profit before tax, net cash generated from operations before taxes, or net increase in cash.
3. The cash roll-forward and balance-sheet closing-cash tie-out are useful integrity checks, but they do not independently prove the OCF taxonomy QName, issuer filing identity, or quarter/YTD context of an extracted XBRL fact.
4. The examples show why basis-specific validation matters: CLEANMAX and EPL are standalone; GAUDIUMIVF is consolidated.
5. The examples are H1 YTD values. Do not treat them as Q2-only OCF. Q2 requires exact H1 YTD minus Q1 YTD facts from the same issuer, basis, concept, unit, and fiscal-year context, with exact calendar windows.

## Status

Official NSE evidence only. No production profile is approved or changed. No scanner runtime, metric thresholds, delivery rules, or trade signals are changed.
