# GAIL consolidated H1 smart XBRL pilot — 2026-11-23

## Status

**Research-only; Revenue and owner-attributable Profit are candidate-only. OCF YoY is withheld for a comparative reclassification conflict. Nothing is production-approved.** No scanner runtime, filter, scoring, ranking, UI, API or Google AI Studio app was changed.

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

The shared `statement_comparative_guard.ts` returned `RECLASSIFIED_COMPARATIVE_REVIEW_REQUIRED`. The pipeline preserves the raw mechanical OCF comparison (+84.48%) for audit traceability but removes it from accepted candidates, sets OCF source status to `CONFLICT`, and marks the audit row `DATA_CONFLICT`. No OCF YoY value is released. A statement-level reclassification bridge is required before it can be used.

Official prior Original results PDF (31-Oct-2025):  
https://nsearchives.nseindia.com/corporate/Himanshugail_31102025142548_BMoutcome.pdf

### Reclassification bridge — quantified from both official PDFs

The two statements expose the exact subtotal bridge (₹ crore):

| Cash-flow bridge line | Prior Original PDF (31-Oct-2025) | Current FY27 PDF comparative (30-Oct-2026) | Difference |
|---|---:|---:|---:|
| Subtotal of operating adjustments | 783.21 | 884.29 | +101.08 |
| Operating profit before working-capital changes | 6,377.45 | 6,478.53 | +101.08 |
| Changes in working capital | 512.80 | 533.60 | +20.80 |
| Cash generated from operations | 6,890.25 | 7,012.13 | +121.88 |
| Direct taxes paid | (1,142.91) | (1,142.91) | 0.00 |
| Net operating cash flow | 5,747.34 | 5,869.22 | +121.88 |

The arithmetic fully explains the ₹121.88 Cr OCF movement at subtotal level: ₹101.08 Cr arises before working-capital changes and ₹20.80 Cr in the working-capital subtotal; tax paid is unchanged. The FY27 filing explicitly says prior-period figures were regrouped/reclassified to correspond with current-period classification/disclosure (note 3 to consolidated cash flows). The original and current comparative statements also present different detailed line-item groupings, so this subtotal bridge is not proof that the underlying cash economics changed.

**Decision:** classify this as a disclosed comparative regrouping/reclassification, not as an unexplained XBRL parser defect. However, until each affected detailed adjustment and working-capital line is mapped across the two presentations, OCF YoY remains REVIEW_REQUIRED; neither ₹5,747.34 Cr nor ₹5,869.22 Cr is silently selected as the comparable base. No OCF growth output is released.

## Final seven-metric audit matrix

- Revenue Growth: candidate-only, +24.71%, official PDF matched.
- Profit Growth: candidate-only, +116.16%, owner-attributable numerator and official PDF matched.
- Operating Cash Flow: **CONFLICT / REVIEW_REQUIRED; no YoY value released**.
- ROE, ROCE, Debt/Equity and Interest Coverage: remain blocked by unresolved generic definitions and issuer mapping.
- Final matrix: 2 candidate metrics, 5 blocked/conflict metrics.
- Production approval: `false`.

## Business and accounting comparability notes

The 30-Oct-2026 PDF notes that RLNG allocation under the Petronet LNG contract was reduced to zero from 4-Mar-2026 and remained disrupted during the half year, with mitigation through alternative procurement. The same filing describes a material contingent excise matter under appeal. These disclosures are contextual risk factors; this pilot does not attribute the profit movement to any one factor. The financial results are unaudited and subject to limited review, not a full-year audit.

## Conclusion

The pilot demonstrates that a source pipeline must compare not only Original XBRL with its own PDF, but also the prior Original value with the current filing's comparative statement. Revenue and owner-profit values reconcile; OCF does not. The shared comparative guard preserves both values and withholds the OCF growth output instead of silently choosing one.

Continue to reconcile the ₹121.88 Cr OCF comparative difference and validate more issuers. Keep all production paths disconnected until every metric has a resolved definition, period/basis mapping, revision history and official statement reconciliation.


## Automated issuer-value regression coverage

The shared `statement_comparative_guard.test.ts` now includes issuer-specific assertions:
- Revenue: ₹88,651.21 Cr current / ₹71,086.05 Cr prior Original.
- Owner-attributable profit: ₹9,385.02 Cr / ₹4,341.61 Cr.
- OCF: current ₹10,602.50 Cr matches current PDF; prior Original ₹5,747.34 Cr matches its own PDF; current filing comparative ₹5,869.22 Cr remains separately preserved.
The OCF regression asserts `RECLASSIFIED_COMPARATIVE_REVIEW_REQUIRED`, difference ₹121.88 Cr, and null comparable prior value. This prevents a silent selection of either comparative base.
