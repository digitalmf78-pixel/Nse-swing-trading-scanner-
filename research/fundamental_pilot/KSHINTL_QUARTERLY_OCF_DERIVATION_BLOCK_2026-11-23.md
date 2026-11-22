# KSH International quarterly OCF derivation availability audit

Date: 2026-11-23  
Project: Google AI Studio NSE Swing Trading Scanner  
Branch: `research/free-fundamental-sources`  
Status: research-only; no production/runtime integration.

## Question tested

Can KSHINTL's Q2 quarterly Operating Cash Flow be safely derived as H1 YTD OCF minus Q1 YTD OCF for both the current year and prior year?

The workflow resolved the official NSE filing index for KSHINTL. The response contained 8 total rows (not a truncated 100-row page), so the absence of a 30-JUN-2025 original standalone row is a real missing filing in this returned index, not pagination.

## Four required filing/fact inputs

| Required input | Filing status | NSE sequence ID | Exact OCF fact |
|---|---|---:|---|
| Current H1 YTD, 30-SEP-2026 | Original standalone found | 209920 | Found: INR 425,710,000 |
| Current Q1 YTD, 30-JUN-2026 | Original standalone found | 184852 | **Not found** for the exact cash-flow context |
| Prior H1 YTD, 30-SEP-2025 | Original standalone found | 133769 | Found: INR -456,850,000 |
| Prior Q1 YTD, 30-JUN-2025 | **No original standalone filing row in NSE index** | — | Missing |

Official NSE XML:
- [Current H1 original](https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1753217_04112026090644_WEB.xml)
- [Current Q1 original](https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1711433_10082026091918_WEB.xml)
- [Prior H1 original](https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1595183_05012026065614_WEB.xml)

All three downloaded XML instances parsed with zero warnings. The Q1 2026 filing had no exact undimensioned `CashFlowsFromUsedInOperatingActivities` fact for 01-Apr-2026 to 30-Jun-2026. The NSE index returned `totalCount=8` and no original standalone filing for 30-JUN-2025.

## Decision

<badge color="warning">Quarterly OCF derivation blocked</badge>

The required four-input rule cannot be satisfied. **No Q2 quarterly OCF is calculated.** Missing Q1 cash-flow data and missing prior-year filing are not replaced with zero, profit, FCF, or inferred amounts.

The H1 YTD facts remain valid raw observations for their own periods:
- Current H1 OCF: ₹42.571 Cr
- Prior H1 OCF: -₹45.685 Cr

Do not present either H1 value as Q2-only OCF. The current/prior H1 comparison can be retained as a YTD cash-flow observation, with percentage change withheld because the prior base is negative.

## Regression/workflow evidence

- TypeScript derivation helper: `research/fundamental_pilot/quarterly_ocf_from_ytd.ts`
- Workflow: [KSHINTL quarterly OCF exact YTD derivation audit](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/blob/research/free-fundamental-sources/.github/workflows/nse-kshintl-quarterly-ocf-derivation.yml)
- Successful diagnostic run: [GitHub Actions run 45062694317](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45062694317)
- Artifact (7-day retention): [Four-filing availability and raw XML evidence](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45062694317/artifacts/14769778141)

The workflow succeeds as a diagnostic because it correctly records the missing evidence and blocks the calculation. No runtime, main branch, scanner filters, live-price path, UI or Google AI Studio app changes were made.
