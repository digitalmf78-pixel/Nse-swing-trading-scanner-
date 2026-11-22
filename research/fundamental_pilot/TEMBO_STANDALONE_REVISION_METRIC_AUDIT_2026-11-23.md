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


## Follow-up: official PDF statement tie-out — critical Profit fact conflict

The full current NSE-hosted results PDF has now been inspected. It explicitly presents the standalone and consolidated statements in separate columns, in ₹ lakhs.

| Metric | Current H1 2026 XBRL candidate | Current H1 2026 official standalone PDF | Result |
|---|---:|---:|---|
| Revenue from operations | ₹4,342.363 lakh | ₹4,342.363 lakh | MATCH |
| Profit/(Loss) for period | ₹8,747.860 lakh | ₹4,654.33 lakh | **CONFLICT — BLOCK** |
| Net cash generated from operating activities | −₹6,364.39 lakh | −₹6,364.39 lakh | MATCH |

Sources: current official NSE results attachment, standalone statement and cash-flow statement; [official current results PDF](https://nsearchives.nseindia.com/corporate/TEMBO_13112026183052_Final_Outcome_of_BM_13-11-26_SD.pdf).

The profit conflict is not a unit conversion issue: the XBRL fact is INR 874,786,000 (₹8,747.86 lakh), while the PDF reports ₹4,654.33 lakh. The same YTD context has XBRL PBT INR 670,160,000 and TaxExpense INR −204,626,000. The reported PDF PBT is ₹6,701.60 lakh and tax expense totals ₹2,047.27 lakh, giving reported profit ₹4,654.33 lakh. The XBRL profit fact therefore does not reconcile to the statement and appears to reflect a sign/formula or source-fact inconsistency. We do not infer which upstream party caused it.

The prior-year PDF shows standalone H1 2025 profit ₹3,131.87 lakh, matching the prior Original/Revision XBRL candidate. The current profit XBRL fact remains blocked; no profit growth is released. For reference only, the PDF-to-PDF reported profit change would be +48.61%, but it is **not** accepted as a pipeline metric until the source conflict is reconciled and the fact-selection policy is corrected.

The prior-year standalone cash-flow comparative in the current 2026 PDF is OCF ₹6,449.29 lakh, matching the prior-year XBRL candidate ₹6,449.29 lakh. Current standalone OCF is −₹6,364.39 lakh in both XBRL and PDF. This confirms the raw cash-flow figures tie out, but the large negative swing still requires business/working-capital note interpretation before treating it as a quality signal.

### Updated readiness decision

- Revenue: source/PDF matched; candidate-only pending note/comparability review.
- Profit: **XBRL/PDF conflict; REVIEW_REQUIRED; no growth value released.**
- OCF: XBRL/PDF matched for current and prior H1 comparative; candidate-only pending working-capital and note review.
- Prior-year Original vs Revision: the three prior metric facts remain identical.
- Production approval: **NO**.

This is a concrete false-confidence case: the XBRL selector returned a unique, undimensioned, exact-period fact with zero parser warnings, yet the selected Profit fact conflicts materially with the official standalone results statement. Parser success and unique-context selection are not enough; issuer statement tie-out is a mandatory independent gate.


## Follow-up: working-capital / Other Current Assets note review

The complete filing text was inspected through the 13-Nov-2026 board-results document. The standalone cash-flow and balance-sheet values are in ₹ lakhs.

### Other Current Assets movement

| Standalone line | 31-Mar-2026 | 30-Sep-2026 | Movement |
|---|---:|---:|---:|
| Other current assets (balance sheet) | 12,330.74 | 30,161.86 | **+17,831.12** |
| Cash-flow adjustment: (Increase)/Decrease in other current assets | — | **(17,831.12)** | **−17,831.12 cash impact** |

The cash-flow adjustment exactly equals the increase in the balance-sheet Other Current Assets line, with the expected negative cash-flow sign. This is not an arithmetic mismatch. It is the largest single negative working-capital adjustment disclosed in the standalone operating cash-flow bridge.

Other material standalone working-capital movements in the same bridge (₹ lakh):
- Trade receivables: −4,740.34 cash impact.
- Trade payables: +2,195.16 cash impact.
- Inventory: +3,228.47 cash impact.
- Loans: −719.29 cash impact.
- Other current assets: −17,831.12 cash impact.
- Other financial assets/current financial assets: +3,682.93 cash impact.

Operating profit before working-capital changes is ₹7,944.01 lakh; after the disclosed working-capital movements, cash generated from operations is −₹4,976.53 lakh; after net taxes paid of ₹1,387.86 lakh, net OCF is −₹6,364.39 lakh. This arithmetic matches the published cash-flow statement.

### Cash-flow roll-forward and balance-sheet tie-out

| Check | Value (₹ lakh) | Result |
|---|---:|---|
| Opening cash and cash equivalents | 7,453.75 | |
| Net increase/(decrease) in cash | −7,370.59 | |
| Closing cash and cash equivalents | 83.16 | PASS: roll-forward |
| Balance-sheet cash and cash equivalents at 30-Sep-2026 | 83.16 | PASS: exact tie-out |

The closing cash tie-out passes. OCF is therefore a source-matched negative number, not a missing fact or parser sign artifact. It is materially affected by the ₹178.3112 crore increase in Other Current Assets. The filing does not provide a detailed sub-breakdown of this balance-sheet line in the inspected result notes, so the underlying nature, recoverability and timing of those balances remain **UNRESOLVED**. Do not infer that the increase is necessarily advances, receivables or a particular project spend. The filing's general note says funds raised in the previous period were utilised to strengthen working capital and investments in Defence/Solar subsidiaries, but it does not explicitly attribute this specific Other Current Assets movement to those uses.

### Profit XBRL mismatch: arithmetic signature

The official standalone statement reports H1 profit after tax ₹4,654.33 lakh, with PBT ₹6,701.60 lakh and tax lines Current Tax −₹1,668.45 lakh, Earlier Year Tax −₹1.01 lakh, Deferred Tax −₹377.81 lakh. The XBRL selected ProfitLossForPeriod candidate is ₹8,747.86 lakh.

The selected XBRL profit candidate is not merely different from the PDF: it has the arithmetic signature of **PBT minus a negative tax-expense amount**, rather than PBT plus the negative tax-expense amount. The XBRL PBT candidate is ₹6,701.60 lakh and the XBRL tax-expense candidate is reported as a negative amount in the raw facts; subtracting a negative tax amount can inflate the derived profit. The PDF's PBT-to-PAT bridge is consistent with adding the negative tax expense lines. This strongly suggests a sign/semantic tagging inconsistency in the profit fact or its upstream calculation, but this audit does not assign responsibility or rewrite the raw XBRL fact.

**Control decision:** the selector must not accept a unique ProfitLossForPeriod fact solely because it has the exact period, basis, unit and no dimensions. The official statement bridge must independently reconcile PBT + tax expense (and any other applicable components) to PAT. For TEMBO, Profit remains REVIEW_REQUIRED and null for metric output. The raw XBRL fact and its provenance remain preserved.

### Updated TEMBO decisions

- Revenue: exact standalone PDF match; candidate-only.
- Profit: official statement bridge conflict with XBRL fact; REVIEW_REQUIRED, no value released.
- OCF: exact standalone PDF match; cash-flow roll-forward and balance-sheet cash tie-out pass; candidate-only, with working-capital quality flag due the large Other Current Assets increase.
- Other Current Assets explanation/recoverability: unresolved from this interim filing; needs detailed ledger/annual report or management disclosure, not inference.
- Production approval: **NO**.
