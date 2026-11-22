# Official NSE XBRL pilot access check

Date: 2026-11-22
Branch: research/free-fundamental-sources
Scope: research-only for Google AI Studio NSE Swing Trading Scanner (not ECMS).

## What was verified from the official NSE page

Official page: https://www.nseindia.in/companies-listing/corporate-integrated-filing

A current indexed view of the NSE page reports the Integrated Filing – Financials table with:
- company/symbol
- quarter end date
- original/revised submission type
- audited/unaudited status
- consolidated/standalone basis
- details document and XBRL links
- broadcast date/time
- revised date/time and revision remarks

The indexed view reports 31,173 financial filing records and shows September 30, 2026 filings among the latest records. Examples in the indexed snapshot include original, unaudited filings with distinct consolidated and standalone basis. This confirms the official portal exposes the metadata needed for a controlled pilot.

Official NSE XBRL information page:
https://www.nseindia.in/static/companies-listing/xbrl-information

It explains that listed entities submit compliance reports through NEAPS and that XBRL is generated through the exchange's filing utility or uploaded from issuer systems.

NSE FAQ on revised financial-results XBRL:
https://nsearchives.nseindia.com/web/mediaattachment/2025-11/FAQs_on_submission_of_financial_results_as_per_Regulation_33_of_SEBI_LODR_Regulations_2015_20251117171024.pdf

The FAQ states that revised XBRL is required for cases including PDF/XBRL mismatches, revision of financial results, restatement, and voluntary revision; revision remarks are required. Therefore revision lineage is not optional metadata.

## Important access limitation discovered

The current web-indexed snapshot exposes the table and sample records, but a direct page open in this research session returned the page shell with the financial table controls and no hydrated row data. The indexed snapshot and the direct-open rendering are therefore not equivalent. This session has NOT yet downloaded the underlying NSE CSV or any issuer XBRL document.

Consequently:
- no 20-company filing coverage is claimed;
- no XBRL parser success is claimed;
- no metric values are marked verified;
- the company-by-company pilot remains NOT STARTED.

## Next controlled step

Use the official page's company/symbol filter and CSV/XBRL download controls (or the official exchange's documented downloadable artifacts) to retrieve a small number of issuer filings first. Preserve the original downloaded bytes and metadata. Validate one non-financial issuer with consolidated + standalone contexts and one revised/original pair before expanding to all 20 companies.

For each downloaded artifact record:
- NSE symbol and ISIN verified against the official security master
- period end and period duration
- submission version and revision remarks
- audited status
- consolidated/standalone basis
- broadcast/filing timestamp
- exact XBRL URL and document hash
- taxonomy concept, contextRef, unit, decimals/scale for every extracted fact

Do not infer a company filing exists merely because the portal supports the company filter. Do not infer all seven metrics exist as direct XBRL facts. Ratios must be calculated only from aligned, traceable facts and documented formulas.

## Safety status

No runtime code, data cache, scanner thresholds, UI, main branch, PR merge, or Google AI Studio app was changed.
