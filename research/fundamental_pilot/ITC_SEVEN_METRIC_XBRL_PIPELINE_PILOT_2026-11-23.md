# ITC seven-metric XBRL candidate pipeline pilot — 2026-11-23

## Scope and status

Research-only validation of the TypeScript pipeline using official NSE Integrated Filing - Financials XBRL for ITC Limited. No production code, scanner filter, scoring, ranking, UI, API or Google AI Studio app was changed.

**Status: Candidate-only; not production approved.**

Workflow run: https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45069858760

## Official filing pair and revision gate

| Field | Current H1 | Prior H1 |
|---|---|---|
| Issuer | ITC Limited | ITC Limited |
| Symbol | ITC | ITC |
| Period end | 30-Sep-2026 | 30-Sep-2025 |
| Basis | Consolidated | Consolidated |
| Filing | Original, Un-Audited | Original, Un-Audited |
| NSE sequence ID | 208371 | 123570 |
| Broadcast | 02-Nov-2026 18:55:59 | 30-Oct-2025 18:07:04 |
| Revision history | ORIGINAL_ONLY | ORIGINAL_ONLY |

The official NSE API returned 14 ITC metadata rows in one page; pagination was complete. The shared history selector confirmed exactly one Original and no Revision rows for each selected period. Both Original sequence IDs matched the separate exact-period filing-pair resolver. The revision gate therefore permitted a candidate calculation. This conclusion is specific to these two ITC periods, not to every issuer or period.

Official XBRL archive files:
- Current: https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1751357_02112026065559_WEB.xml
- Prior: https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1561750_30102025060703_WEB.xml

SHA-256:
- Current: `23b97727608d7fa2cdb89ac5a898f01f6f5da75b8fbec07101b25553b3d62a8e`
- Prior: `23efb9a23df0dc7565eec22add6be9d46c4602250c88fc998caed015a19f3818`

## Raw XBRL parser and fact matching

| Check | Current filing | Prior filing |
|---|---:|---:|
| Contexts | 65 | 52 |
| Facts | 392 | 367 |
| Parser warnings | 0 | 0 |

The prior-year comparison matched 9 exact concept / calendar-period-shape / dimensions / unit keys, with zero unmatched keys. The smart selector independently selected one unique undimensioned group fact for each of Revenue, Profit and OCF in both filings.

## Mechanical H1 candidate outputs

All monetary values below are raw XBRL values in INR, shown in crore for readability. Calculations are same-period H1 mechanical candidates only.

| Metric | Current H1 | Prior H1 | Candidate result |
|---|---:|---:|---:|
| Revenue from operations | ₹60,101.70 Cr | ₹44,385.21 Cr | +35.41% |
| Profit/Loss for period | ₹8,738.12 Cr | ₹10,529.96 Cr | -17.02% |
| Operating cash flow | ₹8,362.97 Cr | ₹6,162.60 Cr | +₹2,200.37 Cr; +35.71% |

The pipeline result was:
- Revenue Growth: `CANDIDATE_ONLY`
- Profit Growth: `CANDIDATE_ONLY`
- Operating Cash Flow: `CANDIDATE_ONLY`
- ROE, ROCE, Debt/Equity and Interest Coverage: blocked by unresolved formula definitions
- Audit matrix: 3 candidate metrics, 4 blocked metrics
- Production approval: `false`

These are not certified comparable-growth conclusions. The ITC filing disclosures concerning acquisitions and GST/cess changes require comparability qualification. Profit/Loss for period also remains subject to the metric policy's numerator/attribution definition. OCF in this run was not independently reconciled to the signed results PDF.

## Definition and production gates still open

1. The PBT presentation audit found that the XBRL candidate matches the main financial-results PBT, while the segment-results presentation includes the associates/JV share in its bridge. PBT mapping remains blocked until the intended definition is explicitly selected.
2. ROE needs owner-attributable numerator/equity and annualization policy.
3. ROCE needs EBIT bridge and capital-employed / lease perimeter policy.
4. Debt/Equity needs a settled lease-liability perimeter.
5. Interest Coverage needs a settled EBIT and finance-cost definition.
6. The three flow candidates still require issuer-specific statement-row/PDF reconciliation and comparability review before any production mapping.

## Conclusion

The new TypeScript pipeline successfully completed this real-issuer sequence:

`official NSE metadata → exact Original/revision history gate → official XBRL parse → exact concept/context/unit selection → current/prior period guard → three candidate calculations → seven-metric audit matrix`

This proves the pipeline works on this selected ITC consolidated H1 pair. It does not prove universal taxonomy coverage, and it does not authorize production integration. Continue with another non-financial issuer and then expand sector-specific mapping. Keep the scanner runtime disconnected until the remaining gates are resolved.
