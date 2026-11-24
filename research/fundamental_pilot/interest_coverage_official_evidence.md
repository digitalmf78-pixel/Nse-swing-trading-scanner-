# Interest Coverage — Official NSE issuer-formula evidence (research only)

Research date: 2026-11-25

## Decision

Do not apply one universal Interest Coverage formula to every Main Board issuer.

The official NSE filings below show that issuers disclose materially different definitions for the ratio and for the numerator called EBIT / income available for debt service. Therefore:

1. Keep Interest Coverage blocked unless the issuer's own filing provides a formula definition or a fully reconcilable calculation basis.
2. Store the issuer, filing URL, filing date, standalone/consolidated basis, exact reporting start/end dates, formula text, numerator definition, denominator definition, unit/currency, and source-row evidence together.
3. Do not infer EBIT generically from PBT + FinanceCosts. Such a bridge is acceptable only where the issuer explicitly defines that exact bridge and every component reconciles to the same official statement context.
4. Do not mix standalone and consolidated facts, quarter and YTD durations, or different currencies/units.
5. Do not assume that the filing's displayed ratio can be reconstructed from a generic taxonomy fact map. It may be company-defined, lease-sensitive, or use a distinct numerator.
6. This evidence is not a production approval. Formula selection, fact selection, duration handling (including quarter vs YTD), revisions, and reconciliation still require implementation and tests.

## Official NSE examples

### 1. Medi Assist Healthcare Services Limited — EBIT / interest cost

- Filing: FY 2025–26 audited, standalone, year ended 31 March 2026.
- Filing approved: 9 May 2026.
- Filing reports Interest Service Coverage Ratio 9.300.
- Remarks identify interest cost incurred during FY 2025–26 as INR 65.26 million and EBIT as INR 607.13 million.
- The disclosed definition is EBIT divided by interest cost.
- 607.13 / 65.26 is approximately 9.30, consistent with the reported ratio.
- Evidence: https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_156554_09052026191022_iXBRL_WEB.html

### 2. Colgate-Palmolive (India) Limited — EBIT / interest, lease interest included

- Filing: Q2 and half-year FY 2026–27, unaudited, standalone, period 1 April 2026 to 30 September 2026.
- Filing approved: 22 October 2026.
- Remarks define Interest Service Coverage Ratio as EBIT divided by Interest.
- The same remarks explicitly state that interest cost on leases under Ind AS 116 is disclosed as Finance Cost in the results.
- This is important evidence that a company's denominator policy can include lease-related finance costs even when the company says it has no borrowings.
- Evidence: https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_203166_22102026174238_iXBRL_WEB.html

### 3. Vedanta Limited — income available for debt service / interest expense

- Filing: FY 2025–26 audited, consolidated, year ended 31 March 2026.
- Filing approved: 29 April 2026.
- The filing's own formula note defines Interest Service Coverage Ratio as Income available for debt service / interest expense.
- It defines income available for debt service as profit before exceptional items and tax + depreciation, depletion and amortisation expense + interest expense.
- This is not the same as a generic EBIT / FinanceCosts formula.
- Evidence: https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_154302_29042026183606_iXBRL_WEB.html

### 4. Godrej Agrovet Limited — EBIT / finance costs, with issuer-specific EBIT bridge

- Filing: audited FY 2024–25, standalone and consolidated.
- Board outcome dated 30 April 2025.
- Formula note defines Interest Service Coverage Ratio as EBIT / Finance costs.
- The same note defines EBIT as profit before exceptional items, tax and share of profit of equity-accounted investees + finance costs.
- This definition is specific evidence for this issuer's calculation; it must not be generalized to every issuer.
- Evidence: https://nsearchives.nseindia.com/corporate/GODREJAGRO_30042025182701_BSENSEBMOUTCOME30042025.pdf

### 5. Mankind Pharma Limited — EBIT / finance costs, with a different EBIT bridge

- Filing: official NSE filing dated 19 May 2026.
- Formula note defines Interest Service Coverage Ratio as EBIT / Finance costs.
- EBIT is defined as profit before taxes + finance costs - other income.
- This differs from Godrej Agrovet's definition and reinforces the need for issuer-specific formula evidence.
- Evidence: https://nsearchives.nseindia.com/corporate/MANKIND1_19052026191440_Outcome_final_sd.pdf

## Implementation implications

- The existing exact FinanceCosts taxonomy gate is useful but does not establish the issuer's intended denominator by itself.
- The generic PBT role must not be treated as a proxy for reported EBIT.
- The current REPORTED_EBIT mapping remains intentionally empty until an exact issuer-level XBRL concept is proven and reconciled.
- A future formula registry should be issuer- and filing-basis-aware, with explicit source evidence and an UNVERIFIED / BLOCKED state when the issuer definition is absent or ambiguous.
- Never manufacture an EBIT fact by simply adding FinanceCosts to PBT unless the exact issuer filing's disclosed formula authorizes that bridge and the relevant components are aligned and reconciled.
- If the issuer discloses an alternative numerator (for example, income available for debt service), preserve that formula as a distinct named method; do not label it generic EBIT.

## Status

Research evidence only. No scanner runtime, production ratio, fundamental validation approval, thresholds, delivery filters, or trade signals are changed by this note.