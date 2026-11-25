# Vedanta Limited — Q2 FY2026–27 Interest Service Coverage formula evidence

## Scope and source identity

- Issuer: Vedanta Limited (NSE symbol VEDL; ISIN INE205A01025).
- Source: official NSE Integrated Filing — IndAS, approved 28 October 2026.
- Reporting period: Q2 FY2026–27 (1 July 2026 to 30 September 2026) and H1 FY2026–27 (1 April 2026 to 30 September 2026).
- Basis: consolidated, unaudited.
- Currency/unit: INR, filing values rounded in lakhs.
- Official NSE filing: https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_205611_28102026174238_iXBRL_WEB.html

## Issuer-disclosed formula

The filing's ratio-definition remarks state:

- Interest Service Coverage Ratio = Income available for debt service / Interest expense.
- Income available for debt service = Profit before exceptional items and tax + Depreciation, depletion and amortisation expense + Interest expense.

This is an issuer-defined numerator. It is not interchangeable with generic reported EBIT and must not be relabelled EBIT.

## Reported ratio disclosures

The same filing's additional ratio disclosure provides the reported Interest Service Coverage Ratio for the quarter and half-year. The exact values and presentation must be read from the filing's ratio remarks; they are not recomputed in this note.

The issuer's separate Q2 FY2026–27 standalone filing also illustrates why basis must be explicit: it reports different standalone ratio values and uses a separate standalone filing context. Do not mix standalone numerator/denominator facts with consolidated ratio values.

Standalone source for basis contrast:
https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_205614_28102026174422_iXBRL_WEB.html

## Evidence requirements before any calculation

A future candidate implementation for this issuer must independently retrieve and reconcile, on the same consolidated basis and exact duration:

1. Profit before exceptional items and tax.
2. Depreciation, depletion and amortisation expense.
3. Interest expense, using the issuer-defined expense perimeter.
4. The issuer's reported Interest Service Coverage Ratio for cross-check only.

The current research evidence does not yet prove exact XBRL concept QNames for each formula component or establish that the filing's reported ratio can be reconstructed from the generic FinanceCosts taxonomy role. FinanceCosts must not automatically be assumed identical to the issuer's stated interest expense without an explicit source-row and context reconciliation.

For H1, all components must use the exact six-month duration. For Q2, do not substitute H1 YTD facts; derive Q2 from exact aligned YTD differences only after each component has passed its own duration and revision guards, or use direct quarter facts where present.

## Research conclusion

**Issuer formula evidence: CONFIRMED. XBRL component mapping: NOT YET PROVEN. Production approval: FALSE.**

- Preserve this as a Vedanta-specific Interest Service Coverage method.
- Do not generalize the formula to other issuers.
- Do not map the numerator to REPORTED_EBIT.
- Do not calculate or publish a scanner metric from unverified component concepts.
- No runtime, taxonomy allowlist, production cache, scanner behavior, thresholds, delivery filters, or trade signals are changed by this documentation-only research note.
