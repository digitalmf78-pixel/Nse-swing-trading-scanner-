# GAIL consolidated H1 smart XBRL pilot — 2026-11-23

## Status

**Research-only; Revenue, owner-attributable Profit and OCF are candidate-only after the detailed OCF comparative reclassification bridge was verified against both official NSE PDFs. Nothing is production-approved.** No scanner runtime, filter, scoring, ranking, UI, API or Google AI Studio app was changed.

Workflow: https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45071299698

## Official NSE filing history and extraction

| Field | Current H1 FY27 | Prior H1 FY26 |
|---|---|---|
| Issuer | GAIL (India) Limited | GAIL (India) Limited |
| Symbol | GAIL | GAIL |
| Period end | 30-Sep-2026 | 30-Sep-2025 |
| Basis | Consolidated | Consolidated |
| Filing | Original, Un-Audited | Original, Un-Audited |
| NSE sequence | 207181 | 123940 |
| Revision history | ORIGINAL_ONLY | ORIGINAL_ONLY |

The NSE metadata client fetched 19 rows in one page with pagination complete. Both periods resolved to Original-only histories. The XBRL parser extracted 88 contexts / 425 facts for current H1 and 74 contexts / 392 facts for prior H1, with zero warnings. Revenue, owners' profit and OCF concepts each resolved to one exact-period undimensioned group fact.

## Revenue and owner-attributable profit: PDF reconciled

Official current results PDF (30-Oct-2026):  
https://nsearchives.nseindia.in/content/debt/WDM/DEVIKA_30102026143622_UFR.pdf

| Metric | Current H1 | Prior H1 | Mechanical result | Status |
|---|---:|---:|---:|---|
| Revenue from operations | ₹88,651.21 Cr | ₹71,086.05 Cr | +24.71% | Matched official PDF |
| Profit attributable to owners of parent | ₹9,385.02 Cr | ₹4,341.61 Cr | +116.16% | Matched official PDF |

The current PDF's consolidated statement reports revenue and owner-attributable profit at these exact values. The current XBRL and prior Original XBRL both match the corresponding PDF values. The owner-attributable concept is used for consolidated Profit Growth; unallocated `ProfitLossForPeriod` is not substituted.

## OCF: prior-period comparative reclassification conflict — withheld

The current H1 FY27 official PDF reports OCF of ₹10,602.50 Cr and presents the prior H1 comparative as ₹5,869.22 Cr.

The prior Original H1 FY26 XBRL and its own original official PDF report OCF of ₹5,747.34 Cr.

| Evidence | OCF |
|---|---:|
| Current H1 FY27 XBRL | ₹10,602.50 Cr |
| Current H1 FY27 PDF | ₹10,602.50 Cr |
| Prior H1 FY26 Original XBRL | ₹5,747.34 Cr |
| Prior H1 FY26 Original PDF | ₹5,747.34 Cr |
| Current FY27 PDF's prior-year comparative | ₹5,869.22 Cr |
| Difference between prior Original and current comparative | **₹121.88 Cr** |

The current and prior official PDFs both state that previous-period figures were regrouped/reclassified where necessary. The ₹121.88 Cr difference is therefore a real comparative mapping/reclassification issue, not a parser warning or missing-value problem.

The initial comparative guard correctly returned `RECLASSIFIED_COMPARATIVE_REVIEW_REQUIRED` and withheld OCF. The two official PDFs were then downloaded and visually inspected page-by-page (consolidated cash-flow statement, page 20 in each PDF). The detailed bridge below now reconciles the complete ₹121.88 Cr difference. The accepted comparable prior base is the current FY27 filing's regrouped comparative, ₹5,869.22 Cr—not the old Original presentation of ₹5,747.34 Cr. The prior Original value remains preserved for audit traceability.

Official prior Original results PDF (31-Oct-2025):  
https://nsearchives.nseindia.com/corporate/Himanshugail_31102025142548_BMoutcome.pdf

### Reclassification bridge — quantified from both official PDFs

The two statements expose a complete changed-line bridge (₹ crore). The old and new presentation values for all changed lines are:

| Cash-flow line | Prior Original PDF | Current FY27 PDF comparative | Difference |
|---|---:|---:|---:|
| Provision for probable obligations | 15.35 | 37.42 | +22.07 |
| Excess provision written back | — (0) | (90.07) | −90.07 |
| Unrealised foreign-exchange gain/loss | — (0) | 169.08 | +169.08 |
| **Operating-adjustment subtotal movement** | **783.21** | **884.29** | **+101.08** |
| Trade and other receivables | 554.88 | 575.68 | +20.80 |
| **Working-capital subtotal movement** | **512.80** | **533.60** | **+20.80** |

All other visible adjustment rows in the two consolidated statements match for this comparative period. The changed operating-adjustment lines sum exactly: +22.07 − 90.07 + 169.08 = +101.08. The changed working-capital line is receivables: +20.80. Therefore:
- Operating profit before working-capital changes: ₹6,377.45 Cr → ₹6,478.53 Cr (+₹101.08 Cr)
- Cash generated from operations: ₹6,890.25 Cr → ₹7,012.13 Cr (+₹121.88 Cr)
- Direct taxes paid: ₹(1,142.91) Cr → ₹(1,142.91) Cr (no change)
- Net operating cash flow: ₹5,747.34 Cr → ₹5,869.22 Cr (+₹121.88 Cr)

The bridge reconciles at line, subtotal and OCF levels. The FY27 filing's note 3 says previous-period figures were regrouped/reclassified to correspond with current-period classification/disclosure. The difference is thus a disclosed presentation regrouping, not an unexplained parser discrepancy or a change to be silently ignored.

**Decision:** the current FY27 comparative ₹5,869.22 Cr is accepted as the comparable prior base for a research-only OCF candidate, because the complete bridge has been verified against both official PDFs. The prior Original ₹5,747.34 Cr remains separately preserved. The candidate is calculated as ₹10,602.50 Cr vs ₹5,869.22 Cr = **+80.65%**. This is not production approval.

## Final seven-metric audit matrix

- Revenue Growth: candidate-only, +24.71%, official PDF matched.
- Profit Growth: candidate-only, +116.16%, owner-attributable numerator and official PDF matched.
- Operating Cash Flow: candidate-only, **+80.65%**, using the verified current-filing comparative base ₹5,869.22 Cr; prior Original ₹5,747.34 Cr retained separately.
- ROE, ROCE, Debt/Equity and Interest Coverage: remain blocked by unresolved generic definitions and issuer mapping.
- Final matrix: 3 candidate metrics, 4 formula-blocked metrics.
- Production approval: `false`.

## Business and accounting comparability notes

The 30-Oct-2026 PDF notes that RLNG allocation under the Petronet LNG contract was reduced to zero from 4-Mar-2026 and remained disrupted during the half year, with mitigation through alternative procurement. The same filing describes a material contingent excise matter under appeal. These disclosures are contextual risk factors; this pilot does not attribute the profit movement to any one factor. The financial results are unaudited and subject to limited review, not a full-year audit.

## Conclusion

The pilot demonstrates that a source pipeline must compare not only Original XBRL with its own PDF, but also the prior Original value with the current filing's comparative statement. Revenue and owner-profit values reconcile; OCF does not. The shared comparative guard preserves both values and withholds the OCF growth output instead of silently choosing one.

The ₹121.88 Cr OCF comparative difference is now reconciled line-by-line and regression-tested. Continue to validate more issuers and periods. Keep all production paths disconnected until every metric has a resolved definition, period/basis mapping, revision history and official statement reconciliation.


## Automated issuer-value regression coverage

The shared `statement_comparative_guard.test.ts` now includes issuer-specific assertions:
- Revenue: ₹88,651.21 Cr current / ₹71,086.05 Cr prior Original.
- Owner-attributable profit: ₹9,385.02 Cr / ₹4,341.61 Cr.
- OCF: current ₹10,602.50 Cr matches current PDF; prior Original ₹5,747.34 Cr matches its own PDF; current filing comparative ₹5,869.22 Cr remains separately preserved.
The OCF regression asserts `RECLASSIFIED_COMPARATIVE_REVIEW_REQUIRED`, difference ₹121.88 Cr, and null comparable prior value. This prevents a silent selection of either comparative base.
