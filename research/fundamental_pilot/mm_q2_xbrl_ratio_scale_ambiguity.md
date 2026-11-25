# M&M Q2 FY2026-27 NSE XBRL ratio percentage-to-times reconciliation

## Purpose
Documentation-only issuer evidence for the NSE Main Board fundamental-data pilot. This note corrects the preliminary interpretation that M&M's standalone Debt-Equity XBRL value conflicted with its financial-results PDF. The issuer explicitly states that the XBRL ratio fields are entered as percentages, while the financial-results ratios are presented in times.

## Official sources
1. NSE Integrated Filing – IndAS, approved 5 November 2026:
   https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_210288_05112026172253_iXBRL_WEB.html
2. M&M official unaudited standalone and consolidated financial results PDF, approved 5 November 2026:
   https://www.mahindra.com/sites/default/files/2026-11/1.%20Un-audited%20Standalone%20and%20Consolidated%20Financial%20Results%20of%20the%20Company%20for%20the%20Second%20Quarter%20and%20Half%20Year%20ended%2030%20September%202026.pdf

## Source scope
- Issuer: Mahindra & Mahindra Limited (NSE symbol M&M; scrip code 500520).
- Reporting period: quarter ended 30 September 2026 and year-to-date half year ended 30 September 2026.
- Basis: standalone.
- Status: unaudited.
- Board approval date: 5 November 2026.
- XBRL financial statement presentation unit: INR lakhs.
- PDF ratio disclosures: times, displayed to two decimal places.

## Issuer's explicit scale explanation
In the NSE filing's Remarks section, the issuer states for each of Debt-Equity, Debt Service Coverage, and Interest Service Coverage that the financial-results values are in times, but the XBRL fields require percentage entry and were therefore updated in percent. The same remarks separately state the actual ratio in times.

This is issuer-specific evidence for interpreting these fields in this filing. Do not generalize the scaling rule to other issuers, filing templates, or XBRL concepts without their own evidence.

## Reconciliation
Convert the XBRL percentage to times by dividing by 100, then compare with the issuer's two-decimal financial-results disclosure.

| Metric | XBRL quarter (%) | Converted quarter (times) | PDF/remarks quarter (times) | XBRL half-year (%) | Converted half-year (times) | PDF/remarks half-year (times) |
|---|---:|---:|---:|---:|---:|---:|
| Debt-Equity | 0.6700 | 0.0067 → 0.01 rounded | 0.01 | 0.6700 | 0.0067 → 0.01 rounded | 0.01 |
| Debt Service Coverage | 6866.4400 | 68.6644 → 68.66 rounded | 68.66 | 5860.8400 | 58.6084 → 58.61 rounded | 58.61 |
| Interest Service Coverage | 8955.4000 | 89.5540 → 89.55 rounded | 89.55 | 6609.2600 | 66.0926 → 66.09 rounded | 66.09 |

The apparent D/E discrepancy is explained by display precision: 0.0067 times rounds to 0.01 times at two decimal places. The DSCR and ISCR values also reconcile after the issuer-stated percentage-to-times conversion and two-decimal rounding. No issuer-source contradiction remains for these three reported ratios in this filing.

## Data-policy conclusion
- Preserve raw XBRL percentage values and issuer-reported times values separately, with source provenance and original precision.
- A normalized times value may be derived for this issuer/filing only after recording the issuer's explicit percentage-entry explanation and the divide-by-100 transformation.
- Preserve the unrounded converted value as well as the PDF's rounded display value; do not overwrite one with the other.
- Do not apply this mapping as a universal rule across issuers or XBRL fields.
- Do not mix standalone values with consolidated values.
- Production approval: false pending the normal broader validation and implementation review.
- Runtime activation: false.

## Scope
Documentation only. No runtime code, formula engine, QName allowlist, production cache, scanner behavior, delivery filter, threshold, or trade signal changed.
