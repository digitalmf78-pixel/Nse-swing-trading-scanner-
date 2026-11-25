# ROE research evidence — ITC Limited (NSE)

**Status: research evidence only. Not a production-approved ROE profile.**

## Issuer and scope

- Issuer: ITC Limited (NSE symbol: ITC; Main Board equity).
- Reporting basis: consolidated.
- Currency/unit: INR, amounts reported in INR lakhs in the iXBRL filing and INR crores in the audited annual results PDF.
- This evidence packet records issuer-reported source facts. It does not prescribe a universal ROE formula, calculate a scanner ROE, or activate production use.

## Official NSE-hosted source evidence

### 1. H1 FY2026–27 and Q2 FY2026–27 profit attributable to owners

Official NSE Integrated Filing — IndAS, approved 2 November 2026:

https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_208371_02112026185559_iXBRL_WEB.html

The filing identifies ITC Limited, Main Board equity, consolidated and unaudited, with INR lakhs as the rounding unit. The financial-results periods are 1 July–30 September 2026 (quarter) and 1 April–30 September 2026 (year to date).

Reported values:
- Profit or loss attributable to owners of parent, Q2 FY2026–27: INR 4,16,840 lakh.
- Profit or loss attributable to owners of parent, H1 FY2026–27: INR 8,56,253 lakh.
- Non-controlling interests are separately reported: INR 6,093 lakh for Q2 and INR 17,559 lakh for H1.
- Total profit for period is separately reported and is not interchangeable with profit attributable to owners.

### 2. Q1 FY2026–27 profit attributable to owners

Official NSE Integrated Filing — IndAS, approved 31 July 2026:

https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_181205_31072026172353_iXBRL_WEB.html

The filing identifies ITC Limited, Main Board equity, consolidated and unaudited, INR lakhs. Period: 1 April–30 June 2026.

Reported values:
- Profit or loss attributable to owners of parent, Q1 FY2026–27: INR 4,39,413 lakh.
- Non-controlling interests are separately reported: INR 11,466 lakh.
- The filing's Q1 result includes the Sproutlife consolidation/re-measurement event described in its notes. This is relevant context when comparing periods.

### 3. Closing owners' equity at 30 September 2026

The Q2 integrated filing above includes a consolidated statement of assets and liabilities for the period ending 30 September 2026, in INR lakhs:
- Equity share capital attributable to owners: INR 1,25,305 lakh.
- Other equity: INR 70,14,867 lakh.
- Total equity attributable to owners of parent: INR 71,40,172 lakh.
- Non-controlling interest: INR 53,827 lakh.
- Total equity including non-controlling interest: INR 71,93,999 lakh.

For an owners-attributable ROE denominator, the filing's explicit **Total equity attributable to owners of parent** is the relevant observed line. Total equity including NCI is a different amount and must not be substituted.

### 4. Opening owners' equity at 31 March 2026

Official NSE-hosted audited annual results PDF, dated 21 May 2026:

https://nsearchives.nseindia.com/corporate/ITC_21052026155432_Results.pdf

The consolidated balance sheet reports, in INR crores, as at 31 March 2026:
- Equity share capital: INR 1,252.95 crore.
- Other equity: INR 71,254.35 crore.
- Attributable to owners of the parent: INR 72,507.30 crore.
- Non-controlling interests are disclosed separately in the consolidated balance sheet.

The annual results state that the consolidated financial results and balance sheet were audited and approved by the Board on 21 May 2026. The PDF is an NSE-hosted official filing; it is not an XBRL fact source.

## Provenance and alignment controls

- Profit facts are duration facts; equity facts are instant/balance-sheet facts.
- Do not compare or pair facts across standalone and consolidated bases.
- Do not use total profit for period or total equity including NCI in place of owners-attributable facts.
- The H1 profit period is 1 April–30 September 2026. The observed equity dates are 31 March 2026 and 30 September 2026.
- The March 2026 opening equity is sourced from the audited NSE-hosted PDF, whereas the September 2026 closing equity and interim profit are from the NSE-hosted iXBRL filing. Preserve source type and source URL for each fact; do not represent the PDF-derived March value as an XBRL fact.
- The Q2 filing notes that Century Pulp and Paper was included from 1 August 2026 and that the results are consequently not comparable with previous periods. Sproutlife became a subsidiary from 1 April 2026; the issuer also flags comparability of results. These events must remain visible as caveats.
- The filing separately reports exceptional items, including acquisition-related items and the Sproutlife fair-value remeasurement gain. Do not silently remove or adjust them.

## What this evidence does not establish

- It does not establish a universal ROE numerator/denominator formula or annualisation convention for every issuer.
- It does not establish an issuer-wide XBRL QName allowlist.
- It does not calculate or approve an ROE ratio.
- It does not approve production use, modify runtime mapping, change scanner thresholds, or alter delivery/technical selection logic.

**Disposition:** retain as issuer-specific research evidence only. Keep ROE production approval false until the existing evidence gates, period/basis/date matching, revision controls, and metric-policy approval are independently satisfied.
