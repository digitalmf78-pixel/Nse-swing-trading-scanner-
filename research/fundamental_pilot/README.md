# Research-only NSE/BSE fundamental data pilot

This folder is isolated from the scanner runtime. The intended production implementation is TypeScript because this Google AI Studio project is a Node.js/TypeScript application.

## Current TypeScript extractor

- `xbrl_extract.ts` extracts raw XBRL/iXBRL facts, contexts, entity identifiers, periods, dimensions, units, nil flags, decimals, inline scale/sign, and basic inline fractions.
- `nse_filing_pair.ts` is the shared TypeScript resolver for exactly one official NSE Original filing per period and basis. It rejects ambiguous pairs, wrong basis/version, and non-official archive URLs. The ITC, HDFC Bank and KSHINTL workflows now use it instead of Python metadata selection.
- It uses `fast-xml-parser` (MIT; TypeScript declarations; ESM/CommonJS support) and rejects DTD/entity declarations.
- It has a 25 MB input limit and intentionally rejects ZIP input; archive decompression is a separate ingestion step.
- It fails closed for numeric facts with missing/unresolved contexts or units, duplicate context/unit IDs, unsupported scale/sign attributes, Inline XBRL format transformations, and unresolved continuation chains. Warnings must be treated as a validation failure by the issuer-pilot workflows.
- `xbrl_extract.test.ts` contains synthetic tests for context/entity metadata, standard facts, nil facts, inline scale/sign, fractions, DTD rejection, and broken references.
- `sector_metric_policy.test.ts` covers bank-sector exclusions and exact period/basis/group-context checks.
- `group_fact_selection.ts` selects only one unique undimensioned group fact after exact context checks; segment facts cannot be added to manufacture a group total. Its dedicated tests cover ambiguity, wrong periods and unresolved contexts.
- `statement_reconciliation.test.ts` covers named statement-presentation variants and fail-closed mapping decisions.
- The isolated GitHub Actions test workflow runs every `research/fundamental_pilot/*.test.ts` file. Latest verified run: 41 tests passed, 0 failed. The package script `npm run test:fundamental-pilot` currently runs only `xbrl_extract.test.ts`, not the complete research test suite.

## Sector and context safety gates

- `sector_metric_policy.ts` is a research-only applicability guard, not a calculator or production metric mapper.
- `statement_reconciliation.ts` compares a raw candidate with named statement presentations but always leaves metric mapping unapproved. This prevents one statement row from being silently substituted for another when presentation definitions differ.
- Bank ROCE, industrial Debt/Equity and industrial EBIT/interest coverage are explicitly marked not applicable as generic formulas.
- Bank revenue/profit growth, ROE and OCF remain blocked pending bank-specific definitions and period/basis validation.
- NBFC, insurance and unknown-sector profiles fail closed rather than inheriting industrial formulas.
- Context selection requires exact dates, duration-vs-instant shape, no dimensions for group totals, and an explicit matching filing-level consolidation basis.
- The ITC pilot found two PBT presentations in the same consolidated filing: main financial-results PBT and segment-results PBT. The XBRL candidate matches the main financial-results PBT; the segment presentation includes the associates/JV share in its bridge. Both can be arithmetically reconciled, but the scanner's intended PBT definition remains unselected and mapping stays blocked.
- The HDFC Bank prior-year pair pilot matched 311 raw fact keys across two original consolidated banking filings, with 11 unmatched keys and no conflicting duplicates. Those unmatched keys remain unresolved.
- The KSH International standalone prior-year pair pilot matched 31 same-shape concept/dimension/unit keys across original filings, with zero unmatched keys, zero conflicting duplicates and zero parser warnings. It exposed comparable Revenue, Profit, Finance Costs and H1 OCF raw facts; these remain mechanical comparisons, not approved metric mappings.
- The ITC prior-year pilot matched nine exact concept/period/dimension/unit facts and now distinguishes the main Financial Results PBT from the alternate segment-results PBT presentation. PBT mapping remains blocked until the scanner's intended definition is explicitly chosen.
- These guards do not prove taxonomy concepts are correctly mapped; all seven metrics remain unapproved for production.

## Python prototype

`xbrl_extract.py` is retained as an earlier research prototype only. It is not part of the Google AI Studio runtime path and is not the preferred implementation.

## Official source strategy

1. NSE Integrated Filing - Financials / Regulation 33 XBRL is primary.
2. BSE Integrated Filing - Financial is an official cross-check/fallback.
3. Screener.in packages may be used only as non-authoritative comparison sources after terms and data provenance are checked. They must not override official filings.
4. Yahoo Finance remains price-only in the target design. Its current fundamental code path has not yet been removed because the official replacement is not yet validated.

NSE official references:
- Integrated Filing: https://www.nseindia.in/companies-listing/corporate-integrated-filing
- Financial Results: https://www.nseindia.com/companies-listing/corporate-filings-financial-results
- XBRL information and Regulation 33 taxonomies: https://www.nseindia.in/static/companies-listing/xbrl-information
- BSE Financial Results: https://www.bseindia.com/corporates/Comp_Resultsnew.aspx

## Important limits — not production-ready

- This is a raw-fact extractor, not a seven-metric fundamentals engine.
- It does not yet map the current NSE Regulation 33 taxonomy concepts to all seven metrics.
- It does not yet select a single consistent consolidated/standalone basis, audited status, or original/revised filing version.
- It does not yet derive quarter-only values from YTD periods or calculate ratios.
- It does not yet handle ZIP decompression, Inline XBRL continuation chains, or every issuer-specific taxonomy extension.
- The synthetic test suite is not evidence of real-issuer parser correctness.
- Real official NSE raw XBRL bytes have now been downloaded and parsed for ITC, HDFC Bank and KSH International in isolated GitHub Actions runs. This validates selected real-issuer parser paths only; it does not prove complete taxonomy coverage across the NSE universe.
- Do not connect this pilot to app runtime until real filing fixtures, taxonomy mapping, period/basis/revision rules, and cross-source reconciliation pass.

## Data quality rules

- Keep raw fact, concept, unit, scale/decimals, context, dimensions, period, entity identifier, filing URL, publication time, filing version, audit status, and consolidation basis.
- Missing is null + an explicit status; never substitute zero, an estimate, or a previous-period value.
- Preserve original and revised filings; a revised filing supersedes only the same issuer, period, basis, and statement type.
- Do not mix consolidated and standalone data or quarter, YTD, FY, and TTM periods.
- OCF must be sourced from the cash-flow statement's net cash from operating activities, not free cash flow, net cash movement, or profit.
- Banks, NBFCs, and insurers need sector-specific ratio definitions; generic industrial formulas must not be forced onto them.
