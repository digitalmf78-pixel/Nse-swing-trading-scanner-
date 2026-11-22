# TEMBO standalone Original/Revision metric audit — 2026-11-23

## Scope and safety

Research-only audit on `research/free-fundamental-sources`. No scanner runtime, main branch, Google AI Studio deployment, live-price path, filters, ranking, UI or reload behavior changed.

This is a metric-level revision and raw-source audit. It is **not** a completed financial statement tie-out and does not approve any metric for production.

## Official NSE Integrated Filing metadata

Issuer: Tembo Global Industries Limited  
Symbol: TEMBO  
Basis: Standalone  
Audit status: Un-Audited  
Period pair: 30-SEP-2026 H1 YTD vs 30-SEP-2025 H1 YTD

| Filing | NSE sequence | Type | Date/time | NSE archive |
|---|---:|---|---|---|
| Current H1 | 214120 | Original | 13-Nov-2026 23:55:04 | [Current XBRL](https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1758151_13112026115504_WEB.xml) |
| Prior H1 | 126134 | Original | 11-Nov-2025 18:40:56 | [Prior Original XBRL](https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1571450_11112025064056_WEB.xml) |
| Prior H1 | 135854 | Revision | 19-Jan-2026 18:16:54 | [Prior Revision XBRL](https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1604641_19012026061653_WEB.xml) |

The revision remark is: **“As per query received from Exchange dated 12_01_2026”.** The API returned one Original and one Revision for the exact same issuer, period and standalone basis. Metadata pagination completed (1 page, 16 rows, zero exact duplicate rows, zero warnings).

The current period is Original-only. The prior period has a complete Original + Revision history. The revision was not discarded or silently treated as a duplicate.

## Real XBRL parser evidence

| Filing | XML bytes | Contexts | Facts | Parser warnings | SHA-256 |
|---|---:|---:|---:|---:|---|
| Current Original 214120 | 182,944 | 131 | 718 | 0 | `4adde397cfbf688a3bfba4cc87736ad18b55547cf8de16f1d34cf5c0f5671d1a` |
| Prior Original 126134 | 161,238 | 121 | 617 | 0 | `e1fd6f0e906b4acf38d5b151ff16e254a9c450bebedfa409e6b621ff96fc795b` |
| Prior Revision 135854 | 170,001 | 127 | 661 | 0 | `9cc4cd99ac9cb938b04f1604681a3d11fc97800ee0e1a203ec29ff1f299b7bfc` |

All three official XML files downloaded and parsed independently. No parser warnings were emitted. Original and Revision have different XML hashes and different context/fact counts; therefore the Revision is not a byte-identical resubmission.

## Exact H1 YTD metric fact selection

The TypeScript selector required:
- exact duration 01-Apr to 30-Sep for each year;
- exact standalone filing-level basis;
- one unique undimensioned group/entity fact;
- a resolvable INR unit;
- a numeric, non-nil value.

All six selections (three metrics × Original/Revision) returned `SELECTED_UNIQUE_GROUP_FACT`.

| Metric fact | Current 2026 Original | Prior 2025 Original | Prior 2025 Revision |
|---|---:|---:|---:|
| RevenueFromOperations | ₹434.2363 Cr | ₹454.4821 Cr | ₹454.4821 Cr |
| ProfitLossForPeriod | ₹87.4786 Cr | ₹31.3187 Cr | ₹31.3187 Cr |
| CashFlowsFromUsedInOperatingActivities | **−₹63.6439 Cr** | ₹64.4929 Cr | ₹64.4929 Cr |

Raw values are INR in XBRL. Conversion shown is INR ÷ 10,000,000 = ₹ crore. Negative OCF is preserved; it is not converted to zero or treated as missing.

## Metric-level revision decision

| Metric | Original vs Revision | Decision |
|---|---|---|
| Revenue Growth prior-year base | Identical value and INR unit | `REVISIONS_IDENTICAL_CANDIDATE` |
| Profit Growth prior-year base | Identical value and INR unit | `REVISIONS_IDENTICAL_CANDIDATE` |
| OCF prior-year base | Identical value and INR unit | `REVISIONS_IDENTICAL_CANDIDATE` |

The January 2026 Revision changed the XML payload and added/changed filing facts, but the three exact H1 YTD metric facts above are unchanged. This is why revision checks must be metric-specific: a filing can be revised without changing every metric.

The revision status is still candidate-only. It does not prove that the current 2026 filing's facts are correct or that the year-on-year comparison is economically comparable.

## Official statement cross-check still required

- The prior-year Original H1 values for revenue (₹45,448.21 lakh) and profit (₹3,131.87 lakh) are visible in the NSE-hosted 11-Nov-2025 results publication: [NSE prior-year results PDF](https://nsearchives.nseindia.com/corporate/TEMBO_12112025111810_Covering_merged.pdf).
- The 19-Jan-2026 clarification/revision announcement is preserved separately: [NSE revision clarification PDF](https://nsearchives.nseindia.com/corporate/TEMBO_19012026180809_1Clarification__on_Finacial_Results_with_Outcome_of_BM_Signed.pdf).
- The current 13-Nov-2026 board-meeting results attachment is identified as [TEMBO_13112026183052_Final_Outcome_of_BM_13-11-26_SD.pdf](https://nsearchives.nseindia.com/corporate/TEMBO_13112026183052_Final_Outcome_of_BM_13-11-26_SD.pdf). The full detailed statement has not yet been extracted and reconciled line-by-line in this pilot.

Therefore no Revenue Growth, Profit Growth or OCF growth percentage is released here. In particular, OCF changes from positive ₹64.4929 Cr to negative ₹63.6439 Cr in the raw H1 candidates; it must be reconciled to both official cash-flow statements before any interpretation.

## Workflow evidence

- Successful workflow: [NSE TEMBO standalone fundamental revision audit — run 8](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45072380263)
- Artifact: [Raw NSE XBRL files, filing metadata and revision audit](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45072380263/artifacts/14773768302)

## Readiness decision

- NSE metadata pagination and exact issuer/period/basis selection: PASS.
- Current Original and prior Original + all prior Revisions downloaded: PASS.
- Three raw XBRL parses: PASS, zero warnings.
- Exact YTD metric selection: PASS for all six version/metric combinations.
- Prior-year revision comparison for Revenue, Profit and OCF: identical across Original and Revision.
- Current/prior official PDF statement tie-out: **PENDING**.
- Issuer note and accounting comparability review: **PENDING**.
- Metric growth calculation/release: **NOT RELEASED**.
- Production approval: **NO**.

The workflow and all raw artifacts remain on the isolated research branch. The scanner runtime and Google AI Studio app remain untouched.
