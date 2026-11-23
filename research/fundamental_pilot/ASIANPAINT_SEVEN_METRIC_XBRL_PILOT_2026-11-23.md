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


## Automated issuer-value regression coverage

The shared `statement_comparative_guard.test.ts` now includes issuer-specific assertions for Asian Paints H1 FY27:
- Revenue: ₹20,518.45 Cr current / ₹17,469.82 Cr prior.
- Owner-attributable profit: ₹2,606.88 Cr / ₹2,093.36 Cr.
- OCF: ₹1,899.83 Cr / ₹3,482.26 Cr.
Each assertion requires current XBRL, current PDF, prior Original XBRL, prior Original PDF and current comparative to agree. All remain candidate-only.


## H1 FY27 consolidated OCF line-item bridge

The consolidated cash-flow statement in the same official NSE results PDF was checked line by line (PDF statement headed “Unaudited Consolidated Statement of Cash Flows”, ₹ crore; extracted statement lines 761–794). This is a current-filing comparative, not a revised prior filing: the prior H1 value in the current PDF is exactly the prior Original value. Therefore no reclassification adjustment is applied and the prior base remains ₹3,482.26 Cr.

| Cash-flow bridge | H1 FY26 | H1 FY27 | Change |
|---|---:|---:|---:|
| Operating profit before working capital changes | 3,463.06 | 3,939.97 | +476.91 |
| Working-capital movements (sum of seven disclosed lines) | +601.90 | −1,373.20 | −1,975.10 |
| Cash generated from operations | 4,064.96 | 2,566.77 | −1,498.19 |
| Income tax paid (net of refund) | −582.70 | −666.94 | −84.24 |
| Net cash generated from operating activities | **3,482.26** | **1,899.83** | **−1,582.43** |

The seven working-capital lines reconcile exactly in both periods. The largest swing is inventories: +₹708.44 Cr in H1 FY26 versus −₹1,519.08 Cr in H1 FY27, a −₹2,227.52 Cr movement. Other movements partly offset it. The change in cash generated reconciles as +₹476.91 Cr operating profit before working capital plus −₹1,975.10 Cr working-capital movements = −₹1,498.19 Cr; the additional ₹84.24 Cr tax outflow reconciles the final OCF decline to −₹1,582.43 Cr. This is a cash-flow bridge, not a causal conclusion about inventory or demand.

The adjustment block also reconciles from PBT and all disclosed non-cash/other adjustments: ₹3,463.06 Cr prior and ₹3,939.97 Cr current. Profit attribution independently ties: total group PAT ₹2,644.80 Cr = owners ₹2,606.88 Cr + NCI ₹37.92 Cr; prior ₹2,135.28 Cr = owners ₹2,093.36 Cr + NCI ₹41.92 Cr. All values are ₹ crore.

Regression tests assert the working-capital line sums, cash-generated subtotal, taxes-to-OCF bridge, profit allocation, and fail-closed behavior when a disclosed inventory movement is tampered. These are research-only checks; production approval remains false.
