# Seven-metric formula decision register — 2026-11-23

Scope: research-only policy decision record for the NSE-only fundamental pipeline on `research/free-fundamental-sources`. This file does not approve any formula for production and does not alter scanner runtime, Bhavcopy selection, UI, filters, scoring, live-price paths, or the AI Studio app.

## Current evidence base

The research branch has real official NSE filing pilots for ITC (consolidated Ind AS), Asian Paints (consolidated Ind AS), GAIL (consolidated Ind AS), TEMBO (standalone Ind AS), KSH International (standalone Ind AS), and HDFC Bank (consolidated banking XBRL). These establish parser and selected-filing behavior only; they do not establish universal taxonomy coverage.

## Formula decision register

| Metric | Research candidate definition | Evidence / unresolved decision | Safe status |
|---|---|---|---|
| Revenue Growth | Same-period current vs prior-year Revenue from Operations, same basis/unit and exact duration | Must tie to official statement row; handle zero/negative prior base, acquisitions, discontinued operations, GST/excise changes and regrouped comparatives | Candidate only |
| Profit Growth | Consolidated: profit attributable to owners of parent; standalone: entity profit for period; same-period YoY | Must reconcile PAT row and attribution; reject PBT and unallocated group profit; TEMBO showed an XBRL/PDF conflict, and ITC follow-up found total PAT had been mislabeled as owners' profit (₹8,738.12 Cr vs owners ₹8,562.53 Cr); issuer-level fact/value tie-out is mandatory | Candidate only |
| ROE | Matching-period attributable profit divided by average matching-basis equity | KSH H1 mechanical return was 10.5654% unannualized. Decide FY vs TTM vs interim annualization; consolidated numerator/equity must both be owners-attributable | Blocked |
| ROCE | EBIT divided by average capital employed | KSH H1 candidates varied materially by EBIT bridge and capital-employed perimeter. Decide treatment of interest income, associates/JVs, leases, and annualization | Blocked |
| Debt/Equity | Interest-bearing debt divided by matching-date equity | KSH borrowings-only result was 0.3797x; including lease liabilities was 0.4136x. Decide lease inclusion and how typed-member lease disclosures are extracted; never count trade payables as borrowings | Blocked |
| Interest Coverage | EBIT divided by finance costs for the exact same duration | KSH alternatives were 4.0546x and 4.0020x depending on EBIT bridge; finance costs included lease-liability finance costs. Decide EBIT and denominator perimeter | Blocked |
| Operating Cash Flow | Exact-period CashFlowsFromUsedInOperatingActivities from the cash-flow statement | Do not substitute profit/FCF/net cash movement; do not derive quarter from YTD unless both exact aligned periods exist; require cash-flow reconciliation and revision/comparative checks | Candidate only |

## Cross-sector guardrails

- Generic industrial formulas must not be inherited by banks, NBFCs, insurers, or unknown-sector issuers.
- HDFC Bank's actual NSE banking XBRL contains bank-specific concepts (interest earned/expended, deposits, advances, NPA and capital ratios). A separate bank scorecard is required; generic industrial ROCE, Debt/Equity and Interest Coverage are not applicable as-is.
- Unknown or ambiguous sector classification must fail closed.
- All seven values remain candidate/research data until source, period, basis, unit, concept mapping, formula version and revision history are independently validated.

## Required gates before any of the four blocked metrics can be implemented

1. Publish a versioned formula policy with exact numerator, denominator, period and annualization rules.
2. Define consolidated vs standalone treatment and owner/non-controlling-interest treatment.
3. Define lease-liability and lease-finance-cost treatment, including how embedded typed-member disclosures are reconciled to official PDF rows.
4. Validate at least three materially different non-financial issuers and more than one reporting period, including Original/Revision cases.
5. Add positive, negative, zero, missing, duplicate, regrouped-comparative and conflicting-PDF/XBRL tests.
6. Keep outputs explicitly candidate-only; do not write them into the production scanner cache or use them for ranking until a separate approval.

## Evidence files

- `KSHINTL_ROE_PERIOD_AND_EQUITY_AUDIT_2026-11-23.md`
- `KSHINTL_ROCE_INTEREST_COVERAGE_DEFINITION_AUDIT_2026-11-23.md`
- `KSHINTL_DEBT_EQUITY_PERIMETER_AUDIT_2026-11-23.md`
- `ITC_SEVEN_METRIC_XBRL_PIPELINE_PILOT_2026-11-23.md`
- `ASIANPAINT_SEVEN_METRIC_XBRL_PILOT_2026-11-23.md`
- `GAIL_SEVEN_METRIC_XBRL_PILOT_2026-11-23.md`
- `TEMBO_STANDALONE_REVISION_METRIC_AUDIT_2026-11-23.md`
- `HDFCBANK_BANKING_XBRL_VALIDATION_2026-11-23.md`

## Safety conclusion

This register records the choices that must be resolved; it deliberately does not select arbitrary formula variants. No Main branch, Bhavcopy scanner, live-price source, deployed app, or production fundamental cache was changed.
