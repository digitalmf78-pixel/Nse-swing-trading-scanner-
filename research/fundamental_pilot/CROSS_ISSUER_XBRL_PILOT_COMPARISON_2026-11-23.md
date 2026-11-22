# Cross-issuer NSE XBRL pilot comparison — KSHINTL standalone vs ITC consolidated

Date: 2026-11-23
Project: Google AI Studio NSE Swing Trading Scanner
Branch: `research/free-fundamental-sources`
Status: research-only; no scanner runtime changes.

## Purpose

Compare two original NSE Integrated Filing-Financials Ind AS instances from different issuers and reporting bases. This is an early cross-issuer parser and source-reconciliation check, not production validation.

## Filing pair

| Attribute | KSH International | ITC Limited |
|---|---|---|
| NSE symbol | KSHINTL | ITC |
| ISIN | INE987S01020 | INE154A01025 |
| NSE sequence ID | 209920 | 208371 |
| Quarter end | 30-Sep-2026 | 30-Sep-2026 |
| Submission | Original | Original |
| Audit status | Un-Audited | Un-Audited |
| Basis | Standalone | Consolidated |
| Broadcast | 04-Nov-2026 21:06:19 | 02-Nov-2026 18:55:59 |
| Raw XML bytes | 86,742 | 99,054 |
| SHA-256 | `4db8678cf8f79372a7c4506ac6f16eeaf7125d75d8f58d79c64db53add9b4442` | `23b97727608d7fa2cdb89ac5a898f01f6f5da75b8fbec07101b25553b3d62a8e` |

## Generic TypeScript parser comparison

| Parser output | KSHINTL standalone | ITC consolidated |
|---|---:|---:|
| Contexts | 43 | 65 |
| Facts | 398 | 392 |
| Units | 3 | 2 |
| Warnings | 0 | 0 |
| Duration contexts | Quarter + H1 YTD | Quarter + H1 YTD |
| Instant context | Present | Present |
| Dimensional contexts | Limited/single-segment issuer | Multiple expense and reportable-segment dimensions |

The parser successfully extracted both original XML instances. ITC adds a materially different multi-segment dimensional pattern; this confirms the generic context walker can see dimensions, but does not yet prove the future metric mapper will always select group-level facts rather than segment facts.

## Cross-issuer concept consistency

The following standard concept local names are present in both filings and use the same INR unit family:

- `RevenueFromOperations`
- `ProfitLossForPeriod`
- `ProfitBeforeTax`
- `FinanceCosts`
- `Equity`
- `BorrowingsCurrent`
- `BorrowingsNoncurrent`
- `CashFlowsFromUsedInOperatingActivities`

This is positive evidence that the same Ind AS Integrated Filing taxonomy concepts are reused across these two issuer instances. It is not evidence that every issuer or sector uses only these concepts; extensions, alternate taxonomy namespaces and bank/insurance taxonomies still need separate coverage.

## Period and unit handling

Both filings have separate duration contexts:
- `OneD`: 01-Jul-2026 to 30-Sep-2026 (Q2)
- `FourD`: 01-Apr-2026 to 30-Sep-2026 (H1 YTD)

Both also have instant contexts for balance-sheet facts. The parser preserves these context IDs and period dates. Any metric calculation must use exact context dates and must not mix:
- Q2 P&L facts with H1 cash-flow facts;
- duration facts with instant facts;
- standalone KSHINTL facts with consolidated ITC facts;
- ITC group totals with segment-dimension facts.

Both raw XBRL instances use INR units, while the NSE display pages present INR Lakhs. The two pilots reconciled key raw values to the same filing's rendered page using raw INR / 100,000 = INR Lakhs. The normalization layer must retain both raw and normalized values and the conversion formula.

## Seven-metric availability across the pair

| Target metric | KSHINTL standalone | ITC consolidated | Cross-issuer decision |
|---|---|---|---|
| Revenue Growth | Current Q2/H1; no aligned prior-year comparator in selected instance | Current Q2/H1; no aligned prior-year comparator in selected instance | Keep missing until prior-year filing is matched by basis and period |
| Profit Growth | Current Q2/H1; no aligned prior-year comparator | Current Q2/H1; no aligned prior-year comparator | Same |
| ROE | Closing equity and period profit; opening equity missing | Closing total equity and profit; opening equity and attribution policy needed | Do not calculate yet |
| ROCE | Required aligned average capital-employed inputs incomplete | Required average capital-employed and EBIT policy incomplete | Do not calculate yet |
| Debt/Equity | Raw borrowings/equity available; reported ratio blank | Raw borrowings/equity available; reported ratio blank | Do not calculate; lease-liability policy unresolved |
| Interest Coverage | Finance costs and profit inputs available; reported ratio blank | Finance costs and PBT inputs available; reported ratio blank | Do not calculate until EBIT/finance-cost policy is fixed |
| Operating Cash Flow | Direct H1 YTD OCF fact available | Direct H1 YTD OCF fact available | Concept and period pattern match in these two filings |

## ITC-specific comparability flags

The ITC issuer notes explicitly warn that:
- Century Pulp and Paper is included from 1-Aug-2026 and its relevant results are not comparable with previous periods.
- Sproutlife is included from 1-Apr-2026 and current quarter/H1 results are not comparable with previous periods.
- Changes in GST compensation cess and central excise duty affect gross revenue comparability.

These filing notes must be captured as issuer-period qualitative flags. A naive year-on-year revenue or profit growth number could be misleading even after a prior-year comparative filing is obtained.

## Important unresolved issue: ratio taxonomy data types

The downloaded NSE taxonomy declares Debt/Equity and Interest Service Coverage concepts as `percentItemType`. Neither KSHINTL nor ITC populates those reported ratio facts in the selected original instance; both human-readable NSE filings show blank ratio rows. Therefore the raw instance pair cannot yet confirm how the taxonomy's percentage unit/value semantics are used in practice. Do not derive or normalize these ratios based on the concept label alone.

## Readiness decision

Positive evidence:
- Two issuers, two reporting bases, same official NSE filing family.
- Original XML files obtained from NSE.
- Same TypeScript parser succeeds on both.
- Standard concept local names for revenue, profit, PBT, finance costs, equity, borrowings and OCF are consistent.
- Raw INR values reconcile to the official NSE display pages for key facts.
- Quarter, YTD and instant contexts remain distinct.

Still not approved:
- Production metric mapper or profile generation.
- ROE, ROCE, Debt/Equity or Interest Coverage formulas.
- Growth comparisons without prior-year period/basis/revision matching and comparability flags.
- Generic treatment of dimensional facts, extensions, banks/NBFCs/insurers or revised filings.

## Next test

Use the two real filing pairs to build context-selection regression cases, then add a third issuer with a revised filing and one alternate sector taxonomy. Keep all work on the research branch until the source and calculation rules are repeatably validated.

## CI coverage note

The isolated research workflow now runs every TypeScript `*.test.ts` file and the independent Python XBRL extractor `test_*.py` suite. This coverage change is research-only; the scanner runtime and production data paths are untouched.
