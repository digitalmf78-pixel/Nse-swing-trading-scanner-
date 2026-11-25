# Vedanta Limited — Annual Report Interest Cover vs NSE Interest Service Coverage Ratio

## Scope and conclusion

This note distinguishes two issuer-published debt-coverage measures for Vedanta Limited. They must not be treated as one interchangeable metric, and neither definition should be generalized to other issuers.

**Research conclusion: distinct published definitions confirmed; exact cross-period numerical reconciliation not attempted; production approval false.**

## Source A — FY2025–26 Annual Report KPI: Interest Cover

- Source: Vedanta Limited FY2025–26 Integrated Report, Key Performance Indicators page.
- Official URL: https://www.vedantalimited.com/vedantaFY26/key-performance-indicators.html
- The KPI is labelled **Interest Cover (x)**.
- The page defines it as EBITDA divided by gross finance costs (including capitalised interest) less investment revenue.
- The page reports 8.6x for FY2025–26.
- The KPI page does not, in the ratio description itself, provide a full component schedule or an independently explicit standalone/consolidated basis label. Preserve the KPI's own label and source context; do not infer missing component scope.

## Source B — NSE Integrated Filing: Interest Service Coverage Ratio

- Issuer: Vedanta Limited (NSE symbol VEDL; ISIN INE205A01025).
- Source: official NSE Integrated Filing — IndAS, approved 28 October 2026.
- Reporting period: Q2 FY2026–27 (1 July 2026 to 30 September 2026) and H1 FY2026–27 (1 April 2026 to 30 September 2026).
- Basis: consolidated, unaudited.
- Currency/unit: INR, filing values rounded in lakhs.
- Official URL: https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_205611_28102026174238_iXBRL_WEB.html

The filing defines:

- Interest Service Coverage Ratio = Income available for debt service / Interest expense.
- Income available for debt service = Profit before exceptional items and tax + Depreciation, depletion and amortisation expense + Interest expense.

This is a distinct issuer-defined formula. Its numerator is not generic EBIT. The denominator is the issuer's stated interest expense; it must not automatically be replaced by gross finance costs net of investment revenue.

## Why the two disclosures must remain separate

1. The labels differ: Annual Report KPI **Interest Cover** versus NSE filing **Interest Service Coverage Ratio**.
2. The numerators differ: EBITDA versus profit before exceptional items and tax + D&A + interest expense.
3. The denominators differ: gross finance costs including capitalised interest less investment revenue versus interest expense.
4. The annual KPI and Q2/H1 filing refer to different reporting periods and disclosure contexts.
5. The Annual Report KPI page does not provide enough component-level detail here to prove a direct numerical bridge to the NSE ratio.

Do not compare 8.6x directly with the Q2/H1 filing ratio as if they were the same series. Do not use one formula to fill missing components of the other.

## Evidence requirements before any candidate calculation

For either metric, retain its own:
- issuer and source URL;
- exact label as published;
- reporting start/end dates and duration;
- standalone/consolidated basis where explicitly disclosed;
- formula text and numerator/denominator perimeter;
- units/currency and source-row/context evidence;
- filing/publication date and retrieval date.

A future candidate calculation must independently reconcile each formula's components on the exact same basis and duration. For the NSE Q2 ratio, H1 YTD values must not be substituted for Q2; use direct quarter facts or exact aligned YTD differences only after component-level duration and revision guards pass.

## Production and implementation status

- Annual KPI Interest Cover: issuer formula documented; component fact mapping and scope not proven by this page alone.
- NSE Interest Service Coverage Ratio: issuer formula documented; exact XBRL component QName mapping and equivalence of generic FinanceCosts to issuer-defined interest expense remain unproven.
- Production approval: **FALSE** for both candidate paths.
- No runtime, formula engine, QName allowlist, production cache, scanner behavior, thresholds, delivery filters, or trade signals are changed by this documentation-only note.
