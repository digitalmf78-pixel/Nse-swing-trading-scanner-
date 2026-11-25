# Vedanta Limited — official NSE EBIT evidence review (ROCE research)

## Scope and status

- Issuer: Vedanta Limited (NSE symbol: VEDL; ISIN: INE205A01025).
- Source: NSE-hosted Integrated Filing — IndAS, approved 28 October 2026.
- Reporting period: quarter ended 30 September 2026 and six months ended 30 September 2026.
- Basis: standalone, unaudited; presentation currency INR; filing values rounded in lakhs.
- This is issuer-level source research only. It does not approve a production QName, formula, ROCE calculation, or scanner input.

## What the official filing establishes

The NSE iXBRL filing's segment disclosure note explicitly states: “We have considered Earnings before interest and tax (EBIT) for segment results.” The same filing separately presents segment results and a reconciliation-style set of company financial results. This is direct issuer evidence that EBIT is used in the segment-results context.

The standalone financial-results table reports:
- Finance costs: INR 41,300 lakh for Q2 FY2026–27; INR 79,900 lakh for H1 FY2026–27.
- Total profit before exceptional items and tax: INR (21,800) lakh for Q2; INR 229,400 lakh for H1.
- Total profit before tax: INR (21,800) lakh for Q2; INR 229,400 lakh for H1.

The filing's additional ratio disclosure reports Interest Service Coverage Ratio of 0.49 for the quarter and 3.84 for the half year, with the footnote that current-period ratios are computed on continuing operations only and are not annualised.

## What this evidence does NOT establish

- The phrase “EBIT” is explicitly attached to **segment results**. It is not sufficient evidence that a single consolidated or standalone entity-wide reported EBIT fact exists or can be substituted for segment EBIT.
- The filing's standalone P&L does not provide a single entity-wide line labelled EBIT.
- PBT plus Finance Costs is not accepted here as a substitute for reported EBIT.
- Segment EBIT values must not be summed into entity EBIT unless the issuer's own reconciliation proves the treatment of unallocated items, eliminations, exceptional items, discontinued operations, and other adjustments.
- The disclosed Interest Service Coverage Ratio is not evidence of a universal formula for other issuers and is not used to infer an EBIT QName.

## Research conclusion

**ROCE reported-EBIT evidence status: PARTIAL / SEGMENT-ONLY.** The issuer confirms EBIT terminology for segment results, but this source alone does not satisfy the scanner's entity-level reported-EBIT evidence gate. Keep the generic reported-EBIT QName allowlist empty and production approval false. No ratio is calculated and no runtime mapping or scanner behaviour is changed.

## Official source

NSE Integrated Filing — IndAS (VEDL), board approval date 28 October 2026:
https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_205614_28102026174422_iXBRL_WEB.html

Relevant filing locations:
- Company identity, reporting period, basis and currency: filing header.
- Standalone financial results and finance costs: financial-results table.
- EBIT terminology: disclosure of notes on segment results.
- Interest Service Coverage Ratio and formula disclosure: additional ratio disclosures.
