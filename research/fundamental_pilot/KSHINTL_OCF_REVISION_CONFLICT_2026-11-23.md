# KSH International prior-year OCF revision conflict

Date: 2026-11-23  
Issuer: KSH International Limited (`KSHINTL`)  
Period: H1 ended 30-Sep-2025  
Basis: Standalone  
Status: **REVISION_CHANGED_REVIEW_REQUIRED — do not use prior-year OCF in scanner comparisons**

## All official NSE XBRL versions found

| NSE sequence | Type | Date | OCF fact (INR) | OCF (₹ crore) |
|---:|---|---|---:|---:|
| 133769 | Original | 05-Jan-2026 | -456,850,000 | -45.685 |
| 133770 | Revision 1 | 05-Jan-2026 | -456,850,000 | -45.685 |
| 176290 | Revision 2 | 21-Jul-2026 | -778,690,000 | -77.869 |
| 176295 | Revision 3 | 21-Jul-2026 | -778,690,000 | -77.869 |

The latest two revisions are identical to one another for the OCF fact; the first revision is identical to the original. The two later revisions differ from the original/first revision by ₹321.84m (₹32.184 Cr).

## Official statement cross-check

The company's 05-Jan-2026 signed financial-results PDF reports H1 FY2025-26 net cash flow from operating activities of **-₹456.85m**. The 04-Nov-2026 current-period financial-results PDF also reports the prior-year comparative H1 OCF as **-₹456.85m**.

Thus, the original and first revision XBRL agree with both published statement PDFs, while the later revised XBRL value -₹778.69m does not.

## Internal cash reconciliation conflict in later revision

For the same 30-Sep-2025 reporting period:
- Original/first revision `CashAndCashEquivalentsCashFlowStatement` closing cash: ₹85.89m.
- Later revisions `CashAndCashEquivalentsCashFlowStatement` closing cash: -₹235.95m.
- Balance-sheet `CashAndCashEquivalents` remains ₹85.89m in the later revision.
- Difference between later cash-flow closing cash and balance-sheet cash: ₹321.84m.
- The `InterestPaidClassifiedAsOperatingActivities` fact also changes sign from -₹160.92m to +₹160.92m between original and later revisions.

The exact ₹321.84m difference matches the change in the OCF fact and the change in the cash-flow closing cash fact. This is a material reconciliation inconsistency. This report does not infer the cause.

## Revision remark contradiction

The later revision remark says the exchange asked for a correction to the denomination of Related Party Transaction disclosures and that no other revision was made. The fact-level XBRL comparison nevertheless shows:
- Original / first revision: 310 facts.
- Later revisions: 340 facts.
- Later revision has changed financial cash-flow facts in addition to the RPT disclosure corrections.
- OCF value, cash-flow closing cash, net cash movement and the sign of an interest-paid fact differ.

The workflow compares all four versions and preserves each XML separately. It reports `OCF_REVISION_CHANGED_REVIEW_REQUIRED`; it does not automatically select the original or revised value.

## Additional rendered NSE iXBRL cross-check (21-Jul-2026 revision)

The NSE-hosted rendered iXBRL page for Revision 2 (sequence 176290) was independently inspected. Its human-readable cash-flow statement presents the revised values directly in INR lakhs:
- Net cash from operating activities: **-7,786.90 lakhs** (=-₹77.869 crore).
- Opening cash and cash equivalents: **1,036.70 lakhs**.
- Net increase/(decrease) in cash and cash equivalents: **-3,396.20 lakhs**.
- Closing cash and cash equivalents per cash-flow statement: **-2,359.50 lakhs**.
- Balance-sheet cash and cash equivalents in the same rendered filing: **858.90 lakhs**.

The cash-flow statement roll-forward itself reconciles: 1,036.70 - 3,396.20 = -2,359.50 lakhs. However, its closing cash does not match the same filing's balance-sheet cash: -2,359.50 - 858.90 = -3,218.40 lakhs (=-₹32.184 crore). Therefore the precise issue is a **cross-statement closing-cash mismatch**, not a failed opening-to-closing roll-forward.

This rendered NSE iXBRL page shows the changed OCF and cash figures in readable presentation, so a simple XBRL numeric scale/sign parser defect is not a sufficient explanation for the discrepancy. The underlying reason remains unresolved; no cause is inferred.

Rendered official NSE page: https://nsearchives.nseindia.in/corporate/ixbrl/INTEGRATED_FILING_INDAS_176290_21072026110834_iXBRL_WEB.html

## Safe scanner decision

1. Keep the original and every revision in immutable source history.
2. For this issuer-period OCF metric, set value to null with status `REVIEW_REQUIRED` until the discrepancy is resolved against an authoritative corrected statement or explicit issuer/exchange clarification.
3. Do not automatically overwrite original with latest revision solely because the row says Revision.
4. Do not automatically retain original solely because it matches the older PDF; the latest exchange revision must also be accounted for.
5. Do not calculate H1 OCF YoY for this KSHINTL period.
6. Do not derive quarterly OCF: current Q1 2026 says cash-flow statement is not applicable, and prior Q1 2025 original is absent from the current official NSE index response.

## Validation evidence

- Workflow completed: https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45063423833
- Artifact (all four XML versions and metadata): https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45063423833/artifacts/14770387468
- Official 05-Jan-2026 results PDF: https://kshinternational.com/investor-relations-documents/KSHINTL_Board-Meeting-Outcome_UFR-LRR_Q2andHY_05-01-2026.pdf
- Official 04-Nov-2026 results PDF: https://nsearchives.nseindia.com/corporate/INTERNATIONAL_04112026191648_KSH_BM_Outcome_04112026Signed.pdf

No scanner runtime, main branch, app UI, filter/scoring, live-price path, or Google AI Studio app sync was changed.
