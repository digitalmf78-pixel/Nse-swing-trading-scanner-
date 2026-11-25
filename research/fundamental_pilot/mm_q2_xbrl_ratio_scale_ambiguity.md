# M&M Q2 FY2026-27 NSE XBRL ratio-scale and disclosure conflict

## Purpose
Documentation-only research evidence for the NSE Main Board fundamental-data pilot. This filing demonstrates why raw XBRL ratio fields must not be assumed to use the same scale or be trusted without reconciling issuer remarks and the attached financial-results PDF.

## Official source
- Issuer: Mahindra & Mahindra Limited (NSE symbol: M&M; scrip code 500520).
- NSE filing: Integrated Filing – IndAS, approved 5 November 2026.
- URL: https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_210288_05112026172253_iXBRL_WEB.html
- Reporting period: quarter ended 30 September 2026 and year-to-date half year ended 30 September 2026.
- Basis: explicitly standalone (filing general information and financial-results section).
- Status: unaudited.
- Financial statement presentation unit: INR lakhs.

## What the filing exposes
The XBRL ratio rows report:
- Debt-equity ratio: 0.6700 for quarter and half-year.
- Debt service coverage ratio: 6866.4400 for quarter and 5860.8400 for half-year.
- Interest service coverage ratio: 8955.4000 for quarter and 6609.2600 for half-year.

The issuer's remarks state that the financial-results ratios are in times, while the XBRL fields require percentage entry. The remarks give:
- Debt-equity ratio: 0.01 times for quarter and half-year.
- Debt service coverage ratio: 68.66 times for quarter and 58.61 times.
- Interest service coverage ratio: 89.55 times for quarter and 66.09 times.

## Critical reconciliation result
The DSCR and ISCR XBRL figures are exactly 100 times the corresponding times values in the issuer remarks, consistent with a percentage-vs-times scaling transformation. The debt-equity row does not reconcile: the XBRL value 0.6700 is not 100 times the remark's 0.01 times, nor is it equal to the stated 0.01 times. This is an issuer-source internal inconsistency requiring review of the official financial-results PDF and/or issuer clarification.

Do not silently normalize the D/E figure, infer which D/E figure is correct, or assume the DSCR/ISCR scale behavior applies universally to other issuers or other XBRL fields. Preserve the raw source values and the issuer remarks separately with provenance.

## Data-policy conclusion
- This single filing is evidence of a real XBRL scale hazard and a D/E contradiction; it is not a universal formula or scaling rule.
- Do not use any of these ratio values as validated production fundamentals until the original financial-results PDF is independently reconciled and the D/E discrepancy is resolved.
- Do not mix this standalone filing with consolidated values.
- Record period, basis, audit status, unit, source URL, approval date, raw XBRL value, issuer-remark value, and reconciliation status separately.
- Production approval: false.
- Runtime activation: false.

## Scope
Documentation only. No runtime code, formula engine, QName allowlist, production cache, scanner behavior, delivery filter, threshold, or trade signal changed.
