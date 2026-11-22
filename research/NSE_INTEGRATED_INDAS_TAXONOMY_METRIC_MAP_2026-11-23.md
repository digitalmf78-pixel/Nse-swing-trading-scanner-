# NSE Integrated Filing Ind AS taxonomy — seven-metric concept audit

Date: 2026-11-23
Project: Google AI Studio NSE Swing Trading Scanner
Branch: `research/free-fundamental-sources`
Status: taxonomy-only research; no runtime integration.

## Source archive inspected

Official NSE XBRL information page:
https://www.nseindia.in/static/companies-listing/xbrl-information

Official Integrated Filing Finance Ind AS taxonomy archive:
https://nsearchives.nseindia.com/web/sites/default/files/inline-files/Taxonomy%20Integrated%20filing%20finance%20%28IndAS%29.zip

Inspected files from the downloaded archive:
- `core/in-capmkt.xsd`
- `core/in-capmkt-lab.xml`
- `core/in-capmkt-pre-2025-01-31.xml`
- `core/in-capmkt-cal-2025-01-31.xml`
- `core/in-capmkt-def-2025-01-31.xml`
- `META-INF/taxonomyPackage.xml`

The taxonomy namespace is `http://www.sebi.gov.in/xbrl/2025-01-31/in-capmkt`.

## Candidate concepts for the seven metrics

| Target metric | Taxonomy concept QName | Type / period type | Finding |
|---|---|---|---|
| Revenue Growth | `in-capmkt:RevenueFromOperations` | monetary / duration | Raw revenue fact; growth must be calculated against a comparable prior-year duration. |
| Profit Growth | `in-capmkt:ProfitLossForPeriod` | monetary / duration | Total profit/loss for period. Also present: `ProfitLossForPeriodFromContinuingOperations`; keep the two concepts distinct. |
| ROE | No direct ROE concept found | — | Must be calculated from aligned profit and equity facts under an explicit formula. |
| ROCE | No direct ROCE concept found | — | Must be calculated from aligned EBIT and capital-employed facts under an explicit formula. |
| Debt/Equity | `in-capmkt:DebtEquityRatio` | `num:percentItemType` / duration | Disclosed ratio concept exists. Preserve its raw unit, value and context; do not reinterpret without instance validation. |
| Interest Coverage | `in-capmkt:InterestServiceCoverageRatio` | `num:percentItemType` / duration | Disclosed ratio concept exists. Type/meaning needs special validation; see below. |
| Operating Cash Flow | `in-capmkt:CashFlowsFromUsedInOperatingActivities` | monetary / duration | Net cash flows from (used in) operating activities; use the cash-flow statement fact, not FCF or net cash movement. |

Additional schema facts useful for ratio derivation:
- `in-capmkt:ProfitBeforeTax`: monetary, duration.
- `in-capmkt:FinanceCosts`: monetary, duration.
- `in-capmkt:Assets`: monetary, instant.
- `in-capmkt:Equity`: monetary, instant.
- `in-capmkt:EquityAttributableToOwnersOfParent`: monetary, instant.
- `in-capmkt:BorrowingsNoncurrent`: monetary, instant.
- `in-capmkt:BorrowingsCurrent`: monetary, instant.
- `in-capmkt:DebtServiceCoverageRatio` is also present, but is not one of the seven target metrics.

## Important taxonomy semantics to validate against raw instances

### PercentItemType on debt/equity and interest coverage

The NSE taxonomy declares DebtEquityRatio, DebtServiceCoverageRatio and InterestServiceCoverageRatio as `num:percentItemType`, not `pureItemType`.

The XBRL Data Type Registry describes `percentItemType` as a percentage intended to be represented as a fraction, not multiplied by 100; its unit should be `xbrli:pure`. For example, 20% is represented as 0.20, not 20:
https://www.xbrl.org/dtr/dtr.html

XBRL US also documents the pure-unit requirement and warns that percentage values represented on a 0–100 scale instead of 0–1 are a common tagging error:
https://xbrl.us/guidance/percentage-item-types/

This creates a semantic question for the NSE concepts:
- Debt/equity is commonly consumed as a multiple (for example 0.8x), not as a percentage.
- Interest service coverage is commonly consumed as a multiple (for example 3.2x), not as a percentage.
- The taxonomy uses percentItemType for both.

Do not assume a raw value of 0.8 means 0.8x or 80%, and do not multiply/divide by 100 based on the label alone. The real issuer instance must be checked for `unitRef`, unit measure, decimals, raw fact value and the human-readable filing rendering. If the source fact is absent or blank, preserve null + MISSING.

### Ratio facts have duration period type

The taxonomy declares the three ratio facts above with `xbrli:periodType="duration"`. Keep the exact context start/end dates; do not silently convert them into point-in-time ratios or merge them with instant balance-sheet contexts.

### ROE and ROCE formulas remain unresolved

The taxonomy provides source facts but does not define the app's desired ratio policy.

Candidate ROE components:
- net profit for the matching period;
- average opening/closing equity for the same reporting basis;
- for consolidated reporting, distinguish total equity from equity attributable to owners of the parent.

Candidate ROCE components:
- EBIT, potentially reconciled as profit before tax plus finance costs;
- average capital employed;
- a documented decision on whether lease liabilities are included and whether capital employed is defined as equity plus interest-bearing debt or total assets less current liabilities.

Do not calculate ROE/ROCE until the formula is formally selected, all inputs are period-aligned, and the raw filing confirms their basis and units.

## Period rules for the pilot

- Revenue/profit growth: compare Q2 with prior-year Q2, or H1 YTD with prior-year H1 YTD. Never compare a quarter with a six-month YTD figure.
- OCF: keep the H1 cash-flow statement duration separate from the Q2 profit-and-loss duration. Quarter OCF may be derived from YTD only if the prior quarter YTD fact and same-basis filing are available and exact subtraction is valid.
- ROE/ROCE: align duration numerator with opening/closing instant balance-sheet values; retain formula and source context for every input.
- Original/revised and standalone/consolidated versions remain separate; revisions do not erase original raw facts.

## KSHINTL pilot implications

The official KSHINTL Q2 FY2026-27 filing row is original, standalone and unaudited. The human-readable filing shows:
- Q2 and H1 revenue in separate duration columns;
- H1 OCF in the cash-flow statement;
- debt/equity, DSCR and interest service coverage fields blank.

The original KSHINTL raw XBRL instance has now been downloaded from the exact URL returned by the official NSE API and parsed successfully by the research TypeScript extractor. It contains 43 contexts, 398 facts and 3 units with zero parser warnings. The following instance-level findings supersede the earlier pending-access note:

- Q2 and H1 YTD `RevenueFromOperations` and `ProfitLossForPeriod` are present in distinct duration contexts.
- H1 YTD `CashFlowsFromUsedInOperatingActivities` is present.
- Closing `Equity`, `BorrowingsNoncurrent`, `BorrowingsCurrent` and `FinanceCosts` facts are present with explicit INR units and period contexts.
- The reported `DebtEquityRatio`, `DebtServiceCoverageRatio` and `InterestServiceCoverageRatio` facts are not populated in this issuer instance; the human-readable NSE rendering also shows them blank.
- No direct ROE or ROCE fact was found; those remain formula-dependent.

The parser has proven raw fact extraction for this one instance, but not semantic mapping of every concept or full seven-metric profile generation. The instance-specific results are documented in `research/fundamental_pilot/KSHINTL_REAL_XBRL_PARSER_VALIDATION_2026-11-23.md`.

## Readiness decision

- Taxonomy package: downloaded and structurally inspected.
- Candidate standard concept names: identified for revenue, profit, PBT, finance costs, debt/equity, interest coverage, assets, equity, borrowings and OCF.
- Direct ROE/ROCE concepts: not found; explicit formula policy required.
- Ratio data type semantics: requires instance-level unit/value reconciliation.
- Raw issuer instance/parser validation: one real KSHINTL standalone instance downloaded and parsed; 43 contexts, 398 facts, 3 units, zero parser warnings; key fact assertions passed.
- Scanner runtime integration: not approved.
