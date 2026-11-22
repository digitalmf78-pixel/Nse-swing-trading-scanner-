# KSH International standalone prior-year original XBRL comparison

Date: 2026-11-23  
Project: Google AI Studio NSE Swing Trading Scanner  
Branch: `research/free-fundamental-sources`  
Status: research-only; no production/runtime integration.

## Official NSE filing pair

| Attribute | Current period | Prior-year comparable |
|---|---|---|
| Issuer / symbol | KSH International Limited / KSHINTL | KSH International Limited / KSHINTL |
| Period end | 30-SEP-2026 | 30-SEP-2025 |
| Filing type | Integrated Filing - Financials | Integrated Filing - Financials |
| Submission | Original | Original |
| Audit status | Un-Audited | Un-Audited |
| Basis | Standalone | Standalone |
| NSE sequence ID | 209920 | 133769 |
| Broadcast | 04-Nov-2026 21:06:19 | 05-Jan-2026 18:56:13 |
| NSE XBRL XML | [Current original XML](https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1753217_04112026090644_WEB.xml) | [Prior-year original XML](https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1595183_05012026065614_WEB.xml) |
| NSE iXBRL | [Current filing](https://nsearchives.nseindia.in/corporate/ixbrl/INTEGRATED_FILING_INDAS_209920_04112026210644_iXBRL_WEB.html) | [Prior-year filing](https://nsearchives.nseindia.in/corporate/ixbrl/INTEGRATED_FILING_INDAS_133769_05012026185614_iXBRL_WEB.html) |

The prior-year 30-SEP-2025 filing was broadcast on 05-Jan-2026, materially later than its period end. This is recorded as filing metadata; the comparison does not assume why it was submitted later. Both rows are explicitly marked Original and Un-Audited, with no revised date or revision remark. NSE's API row reports no attached PDF (`pdf_attach` points to `null)); this pilot therefore relies on the official XBRL/iXBRL records and does not claim a separate PDF reconciliation.

## Parser and structural comparison

| Check | Current | Prior year |
|---|---:|---:|
| XML contexts | 43 | 21 |
| Facts | 398 | 310 |
| Selected target-family facts | 31 | 31 |
| Parser warnings | 0 | 0 |

- Same concept + same period calendar shape + same dimensions + same unit matched: **31**
- Unmatched keys: **0**
- Conflicting duplicate keys: **0 current; 0 prior**
- Workflow status: `PARSE_AND_STRUCTURAL_COMPARISON_PASS`
- Current XML SHA-256: `4db8678cf8f79372a7c4506ac6f16eeaf7125d75d8f58d79c64db53add9b4442`
- Prior XML SHA-256: `04cff8f15fe3b27264ab93492a40831f968e04d8b24ed26556f664b75cae3f1b`

Raw facts were parsed from the official NSE XML. Values below are converted from INR to ₹ crore by dividing by 10,000,000. These are same-concept, same-calendar-shape mechanical comparisons, not approved metric calculations or investment signals.

## Selected raw fact comparisons

| Fact / period | Current (₹ Cr) | Prior original (₹ Cr) | Mechanical change |
|---|---:|---:|---:|
| Revenue from Operations — Q2 | 1,319.65 | 712.15 | +85.31% |
| Revenue from Operations — H1 YTD | 2,483.89 | 1,270.86 | +95.45% |
| Profit for the Period — Q2 | 47.95 | 29.59 | +62.05% |
| Profit for the Period — H1 YTD | 90.17 | 52.27 | +72.51% |
| Finance Costs — Q2 | 22.25 | 9.26 | +140.18% |
| Finance Costs — H1 YTD | 39.53 | 16.58 | +138.47% |
| Operating Cash Flow — H1 YTD | +42.57 | -45.69 | Sign changed from negative to positive |

Operating cash flow is present only for the H1 YTD shape in the selected facts. No quarterly OCF was inferred by subtraction. A percentage-growth calculation for OCF was deliberately omitted because the prior-year denominator is negative; the sign change and absolute values are more informative and avoid a misleading percentage.

Additional raw facts extracted (not approved as ratios):
- PBT Q2: ₹63.86 Cr vs ₹36.54 Cr; H1: ₹120.75 Cr vs ₹70.07 Cr.
- Equity instant: ₹898.86 Cr vs ₹350.47 Cr.
- Current + non-current borrowings instant: ₹341.26 Cr vs ₹484.31 Cr (raw components retained separately in artifact).
- These figures must be reconciled to the source statement rows and classification rules before any Debt/Equity or Interest Coverage calculation.

## Comparability and interpretation restrictions

1. These percentages are mechanical XBRL fact comparisons. They do not establish organic growth, recurring growth, or future performance.
2. The same concept and calendar shape matched, but the pilot has not yet reconciled each value against the official statement row or reviewed the full notes for acquisitions, capacity changes, restructuring, exceptional items or accounting policy changes.
3. Profit growth is based on `ProfitLossForPeriod` as tagged in these filings; do not silently substitute PBT or continuing-operations profit.
4. Finance costs increased materially in the raw facts. This is not itself an Interest Coverage ratio; the numerator definition and period alignment still need validation.
5. H1 OCF moved from negative to positive. This is a raw cash-flow observation, not a complete cash-conversion or free-cash-flow assessment.
6. Debt/Equity is not calculated. Current and non-current borrowings are separate facts; other debt-like liabilities, cash netting policy, equity definition and instant-date comparability need validation.
7. Standalone facts cannot be merged with consolidated facts or with other source profiles.

## Readiness decision

**Pass:** exact official NSE original standalone filing-pair resolution; raw XML retrieval; parser extraction with zero warnings; 31 same-shape concept/dimension/unit matches; no unmatched keys or conflicting duplicate keys.

**Not approved:** production metric mapping, organic-growth interpretation, Debt/Equity, Interest Coverage, ROE/ROCE, or any scanner threshold. The seven-metric production path remains disconnected.

## Workflow evidence

- Workflow: [NSE KSHINTL prior-year original XBRL comparison](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/blob/research/free-fundamental-sources/.github/workflows/nse-kshintl-prior-year-comparison.yml)
- Initial successful structural run: [GitHub Actions run 45060668527](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45060668527)
- Latest parser/resolver regression run: [GitHub Actions run 45061122648](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45061122648) — 31 matches, 0 unmatched keys, 0 conflicting duplicates, 0 parser warnings.
- Latest artifact (7-day retention): [KSHINTL raw XML and comparison evidence](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45061122648/artifacts/14768699001)

Keep all work on the isolated research branch. Main branch, scanner filters, live-price path, UI and Google AI Studio app remain unchanged.
