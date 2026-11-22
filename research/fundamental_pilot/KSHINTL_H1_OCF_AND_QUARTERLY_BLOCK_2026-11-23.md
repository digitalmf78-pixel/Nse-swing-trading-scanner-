# KSH International standalone H1 OCF and quarterly-derivation audit

Date: 2026-11-23  
Issuer: KSH International Limited (`KSHINTL`)  
Exchange/source: Official NSE Integrated Filing - Financials XBRL originals  
Basis: Standalone  
Status: **Current H1 OCF extracted; prior-year OCF revision conflict requires review; Q2 quarterly derivation blocked**

## Official filing identities

| Role | Period end | NSE sequence | Filing type | Broadcast |
|---|---|---:|---|---|
| Current H1 (Q2 filing) | 30-Sep-2026 | 209920 | Original, Un-Audited | 04-Nov-2026 21:06:19 |
| Current Q1 | 30-Jun-2026 | 184852 | Original, Un-Audited | 10-Aug-2026 21:19:16 |
| Prior H1 (Q2 filing) | 30-Sep-2025 | 133769 | Original, Un-Audited | 05-Jan-2026 18:56:13 |
| Prior Q1 | 30-Jun-2025 | Not found | No matching Original in the NSE Integrated Filing API result (8 rows returned) | — |

The Q1 and H1 filing URLs, sequence IDs and metadata are retained in the workflow artifact. The Q2 H1 XML instances are original NSE archive files.

## H1 Operating Cash Flow

Concept: `in-capmkt:CashFlowsFromUsedInOperatingActivities`  
Unit: INR; raw XBRL values retained; converted below to INR crore.

| Period | Raw XBRL INR | INR crore | Cash-flow statement |
|---|---:|---:|---|
| H1 FY2026-27 | 425,710,000 | ₹42.571 Cr | Applicable = true |
| H1 FY2025-26 Original / first Revision | -456,850,000 | -₹45.685 Cr | Applicable = true |
| H1 FY2025-26 later Revisions (seq 176290 / 176295) | -778,690,000 | -₹77.869 Cr | Applicable = true; conflicts with original and filed PDF |

- The Original and first Revision agree at -₹45.685 Cr, but later Revisions change the same OCF fact to -₹77.869 Cr.
- The original PDF and the current 2026 PDF comparative both show -₹45.685 Cr; later revised XBRL does not reconcile to those statements.
- Therefore no prior-year OCF value is accepted and no YoY growth or direction-change claim is made. The prior-year metric is `REVIEW_REQUIRED`, not a clean negative base.
- This is H1 YTD OCF, not Q2 standalone OCF. See `KSHINTL_OCF_REVISION_CONFLICT_2026-11-23.md`.

## Why Q2 quarterly OCF is blocked

The official 30-Jun-2026 Q1 filing (sequence 184852) contains the taxonomy fact:
`WhetherCashFlowStatementIsApplicableOnCompany = false`.

This is an explicit N/A / not-applicable flag in the filing, not a missing OCF value and not zero. Its XBRL instance has 11 contexts and 120 facts; no OCF cash-flow statement fact is present.

The NSE Integrated Filing API result for KSHINTL returned 8 rows. It included no 30-Jun-2025 Original filing, so prior-year Q1 YTD OCF cannot be sourced from this official index response. In addition, the 30-Sep-2025 H1 original/revision audit found that later revisions change OCF from -₹45.685 Cr to -₹77.869 Cr despite a revision remark saying only RPT denomination was corrected; this makes prior-year OCF unusable until resolved.

Consequently, the four inputs required for a valid Q2 derivation (current H1 YTD, current Q1 YTD, prior H1 YTD, prior Q1 YTD) do not exist. The TypeScript quarterly derivation is not called. Status is `BLOCKED_QUARTERLY_DERIVATION`, with three distinct blockers:
- `currentQ1: CASH_FLOW_STATEMENT_NOT_APPLICABLE`
- `priorQ1: MISSING_ORIGINAL_FILING`
- `priorQ2: REVISION_CHANGED_REVIEW_REQUIRED`

No zero, estimate, quarter subtraction, or synthetic value is generated.

## Validation evidence

- Workflow: https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45063010496
- Original/revision audit: https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45063423833
- Artifact: https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45063010496/artifacts/14770730575
- The workflow completed successfully because it correctly detected and preserved the expected blocked state; it did not claim that quarterly OCF was calculated.
- Parser warnings: 0 for all downloaded XML files.
- Q1 explicit applicability fact was independently confirmed in the raw XML.
- Research-only TypeScript regression suite: 104 passed, 0 failed (run https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45062784049).

## Source URLs

- Current H1 XBRL: https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1753217_04112026090644_WEB.xml
- Current Q1 XBRL: https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1711433_10082026091918_WEB.xml
- Prior H1 XBRL: https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1595183_05012026065614_WEB.xml
- Official NSE Integrated Filing index endpoint used by the workflow: https://www.nseindia.in/api/integrated-filing-results

No runtime integration, main-branch modification, scanner UI/filter/scoring change, live-price path change, or Google AI Studio app sync was performed.
