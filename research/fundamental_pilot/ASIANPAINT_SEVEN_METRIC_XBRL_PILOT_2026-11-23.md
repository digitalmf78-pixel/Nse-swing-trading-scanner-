# Asian Paints consolidated H1 smart XBRL pilot — 2026-11-23

## Status

**Research-only; candidate-only; not production approved.** No scanner runtime, production filter, scoring, ranking, UI, API or Google AI Studio app was changed. All work remains on `research/free-fundamental-sources`.

Workflow: https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45071133441

## Official NSE filing selection

| Field | Current H1 FY27 | Prior H1 FY26 |
|---|---|---|
| Issuer | Asian Paints Limited | Asian Paints Limited |
| Symbol | ASIANPAINT | ASIANPAINT |
| Period end | 30-Sep-2026 | 30-Sep-2025 |
| Basis | Consolidated | Consolidated |
| Filing | Original, Un-Audited | Original, Un-Audited |
| NSE sequence | 206843 | 126864 |
| Revision history | ORIGINAL_ONLY | ORIGINAL_ONLY |

The shared NSE client fetched the full metadata page and the history selector found one Original and no Revision for each exact period/basis. The parser extracted 18 contexts / 294 facts for current H1 and 10 contexts / 269 facts for prior H1, with zero warnings in both files. The comparative matcher found 13 exact concept/period/dimension/unit matches and zero unmatched keys.

Official NSE XBRL archive:
- Current: `https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1751357_02112026065559_WEB.xml`
- Prior: `https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1561750_30102025060703_WEB.xml`

## Correct profit attribution mapping

The consolidated XBRL contains both:
- `ProfitLossForPeriod`: total group profit before allocation to owners and non-controlling interests
- `ProfitOrLossAttributableToOwnersOfParent`: profit attributable to owners of the parent
- `ProfitOrLossAttributableToNonControllingInterests`: NCI allocation

The pipeline now requires `OWNERS_OF_PARENT` attribution for consolidated Profit Growth and rejects unallocated `ProfitLossForPeriod`. The H1 profit allocation reconciles exactly:
- Current: ₹2,644.80 Cr total = ₹2,606.88 Cr owners + ₹37.92 Cr NCI
- Prior: ₹2,135.28 Cr total = ₹2,093.36 Cr owners + ₹41.92 Cr NCI

This distinction matters: the owner-attributable Profit Growth candidate is +24.53%, not the +23.86% that would result from using total group profit.

## Three metric candidates and official PDF tie-out

Official NSE results PDF (29-Oct-2026):  
https://nsearchives.nseindia.com/corporate/ASIANPAINT_29102026140936_OutcomeofBM29102026signed.pdf

| Metric | Current H1 | Prior H1 | Mechanical result | PDF tie-out |
|---|---:|---:|---:|---|
| Revenue from operations | ₹20,518.45 Cr | ₹17,469.82 Cr | +17.45% | Matched |
| Profit attributable to owners | ₹2,606.88 Cr | ₹2,093.36 Cr | +24.53% | Matched |
| Operating cash flow | ₹1,899.83 Cr | ₹3,482.26 Cr | −₹1,582.43 Cr / −45.44% | Matched |

The workflow compared exact XBRL values with the signed NSE PDF for both current and prior H1. All three metrics matched. The total profit = owners' profit + NCI allocation check also passed. The PDF's cash-flow statement shows a material working-capital absorption, including inventory movement of −₹1,519.08 Cr versus +₹708.44 Cr in the prior H1; this is a context item, not a causal conclusion.

The candidate pipeline result is 3 candidate metrics and 4 formula-blocked metrics. ROE, ROCE, Debt/Equity and Interest Coverage remain blocked by unresolved definitions. No metric is production-approved.

## Conclusion and remaining gates

This pilot validates the real issuer path from official NSE Original/revision history through XBRL parsing, exact group-fact selection, explicit owner-profit attribution, prior-period comparison, official statement PDF tie-out and seven-metric audit matrix.

It does not establish organic growth, a final valuation or production suitability. Acquisitions, disposals, accounting/presentation changes and issuer-specific comparability notes still require review. Continue to another issuer and sector-specific mapping before considering any production integration.
