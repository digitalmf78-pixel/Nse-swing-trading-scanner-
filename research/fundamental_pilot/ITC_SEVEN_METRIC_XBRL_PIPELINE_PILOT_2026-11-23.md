# ITC seven-metric XBRL candidate pipeline pilot — 2026-11-23

## Scope and status

Research-only validation of the TypeScript pipeline using official NSE Integrated Filing - Financials XBRL for ITC Limited. No production code, scanner filter, scoring, ranking, UI, API or Google AI Studio app was changed.

**Status: Candidate-only; not production approved.**

Workflow run: https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45071137005

Latest owner-attribution rerun: this workflow run uses the updated owner-profit concept map; the earlier unallocated profit result is superseded.

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
| Profit attributable to owners of parent (`ProfitOrLossAttributableToOwnersOfParent`) | ₹8,738.12 Cr | ₹10,529.96 Cr | -17.43% |
| Operating cash flow | ₹8,362.97 Cr | ₹6,162.60 Cr | +₹2,200.37 Cr; +35.71% |

The pipeline result was:
- Revenue Growth: `CANDIDATE_ONLY`
- Profit Growth: `CANDIDATE_ONLY`
- Operating Cash Flow: `CANDIDATE_ONLY`
- ROE, ROCE, Debt/Equity and Interest Coverage: blocked by unresolved formula definitions
- Audit matrix: 3 candidate metrics, 4 blocked metrics
- Production approval: `false`

These are not certified comparable-growth conclusions. The ITC filing disclosures concerning acquisitions and GST/cess changes require comparability qualification. Profit Growth now uses the owners-of-parent allocation concept for consolidated filings; the earlier unallocated `ProfitLossForPeriod` candidate is not accepted. The owner-profit mapping remains candidate-only until official PDF statement-row tie-out. OCF has now been independently reconciled to ITC's official consolidated results PDF: H1 FY27 ₹8,362.97 Cr and H1 FY26 ₹6,162.60 Cr both match the XBRL values exactly. The PDF also confirms owners' profit is ₹8,562.53 Cr (current) and ₹10,370.31 Cr (prior), not the total PAT values ₹8,738.12 Cr and ₹10,529.96 Cr previously attributed to owners in this pilot. The percentage remains approximately -17.43% by coincidence, but the earlier selected values are not owner-attributable facts; Profit Growth is blocked until the pipeline's selected QName/value is re-extracted and independently asserted against the owner-allocation rows.

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


## Follow-up official PDF reconciliation — 23-Nov-2026

Official ITC consolidated results PDF:
https://itcportal.com/content/dam/itc-corporate/pdfs/financial-result/quarterly-results-2026-2027/september-2026/ITC-Financial-Result-Q2-FY2027-cfs.pdf

The PDF's consolidated statement of cash flows reports:
- H1 FY27 net cash from operating activities: ₹8,362.97 Cr.
- H1 FY26 net cash from operating activities: ₹6,162.60 Cr.
Both values match the current/prior XBRL candidates exactly. The H1 OCF candidate therefore passes numeric statement-row tie-out for this filing pair. The PDF also states previous-period figures may be rearranged where necessary; this does not alter the exact OCF totals in this pair.

**Critical profit-attribution correction:** the same official consolidated PDF separates total PAT from allocation to owners and NCI:
- H1 FY27 total profit for period: ₹8,738.12 Cr; owners of parent: ₹8,562.53 Cr; NCI: ₹175.59 Cr.
- H1 FY26 total profit for period: ₹10,529.96 Cr; owners of parent: ₹10,370.31 Cr; NCI: ₹159.65 Cr.

The official NSE iXBRL filing page independently confirms the same current H1 values in ₹ lakh: total profit ₹8,73,812; owners ₹8,56,253; NCI ₹17,559. Thus the earlier pilot's ₹8,738.12 Cr / ₹10,529.96 Cr pair was total PAT, not owner-attributable profit. The ratio happens to produce almost the same percentage (-17.43%) as the correctly attributed owner values, but this arithmetic coincidence does not validate the old fact mapping.

**Decision:** OCF = PDF_MATCHED / candidate-only. Profit Growth = BLOCKED pending re-extraction and regression tests that assert the selected owner-attributable QName values are ₹8,562.53 Cr and ₹10,370.31 Cr, and reject total PAT as a substitute. Revenue remains PDF matched but comparability is qualified due Sproutlife and Century Pulp & Paper acquisitions and the filing's excise-duty comparability note. No metric is production-approved.
