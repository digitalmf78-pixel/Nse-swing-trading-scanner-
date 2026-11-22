# Research-only NSE/BSE fundamental data pilot

This folder is isolated from the scanner runtime. The intended production implementation is TypeScript because this Google AI Studio project is a Node.js/TypeScript application.

## Current TypeScript extractor

- `xbrl_extract.ts` extracts raw XBRL/iXBRL facts, contexts, entity identifiers, periods, dimensions, units, nil flags, decimals, inline scale/sign, and basic inline fractions.
- `nse_filing_pair.ts` is the shared TypeScript resolver for exactly one official NSE Original filing per period and basis. It rejects ambiguous pairs, wrong basis/version, and non-official archive URLs. The ITC, HDFC Bank and KSHINTL workflows now use it instead of Python metadata selection.
- `nse_revision_pair.ts` resolves a single Original plus the complete set of Revision rows for the same issuer/period/basis. It sorts revisions chronologically and rejects duplicate sequence IDs; it never silently selects the latest revision.\n- `nse_integrated_filing_client.ts` is the shared TypeScript NSE Integrated Filing - Financials metadata client. It fetches all pages with bounded retries/timeouts, validates response shape and symbol/type, detects conflicting duplicate sequence IDs, and explicitly marks pagination incomplete if the page ceiling is reached. Its period-history selector distinguishes Original-only, full revision history, missing Original and blocked history; it never substitutes a Revision for a missing Original, and it requires usable publication/revision timestamp provenance.
- `cashflow_reconciliation_guard.ts` checks opening cash + net cash movement against cash-flow closing cash, reconciles cash-flow closing cash to balance-sheet cash, and optionally cross-checks OCF against the exact statement row. Missing or inconsistent values fail closed; the result is always candidate-only.
- `metric_revision_guard.ts` evaluates metric-level Original/Revision values. Identical versions remain candidate-only; changed values require an exact-period/basis/concept official statement cross-check; conflicts become `REVIEW_REQUIRED` with null selected value. It never grants production approval.
- `fundamental_profile.ts` defines the seven-metric provenance-first TypeScript data contract and validates status, issuer, ISIN, period, basis, official exchange source, units, raw fact references and formula version. Unvalidated metrics must carry null values and an explanation; a profile cannot silently mix NSE and BSE sources.
- `metric_growth_candidate.ts` calculates only mechanical same-period YoY Revenue/Profit Growth candidates after exact concept, unit, basis, undimensioned group context and calendar alignment checks. It blocks TTM, negative/zero prior bases and period mismatches. Its output is explicitly `CANDIDATE_ONLY` and can never mark itself production-approved.
- `operating_cashflow_candidate.ts` compares only same-period cash-flow-statement OCF facts. It preserves positive/negative direction, withholds percentage change for a zero/negative prior base, and never derives quarterly OCF by subtracting YTD values.
- `quarterly_ocf_from_ytd.ts` can derive quarterly OCF only from four exact current/prior H1-YTD and Q1-YTD facts with matching concept, unit, basis, dimensions and dates. Any mismatch blocks the derivation. The KSHINTL filing pilot also distinguishes an explicit `WhetherCashFlowStatementIsApplicableOnCompany=false` from a missing OCF fact, while a missing prior-year original filing remains a separate `MISSING` state. The KSHINTL four-filing workflow checks whether Q1 YTD cash-flow facts actually exist before attempting a Q2 derivation.
- `metric_audit_matrix.ts` combines each issuer's seven metric data statuses with the sector/formula readiness catalog. It keeps MISSING, NOT_APPLICABLE, BLOCKED and CONFLICT distinct, labels source-validated metrics as candidate-only where definitions permit, and never grants production approval. It does not calculate metrics or invent missing values.\n- `seven_metric_candidate_engine.ts` orchestrates Revenue Growth, Profit Growth and OCF candidates only after callers supply already-selected facts. It rechecks every fact against its filing-period envelope, preserves concept/unit/basis/date blocks, and keeps ROE/ROCE/Debt-Equity/Interest Coverage blocked by definition. It cannot approve production.\n- `xbrl_metric_fact_selector.ts` selects exactly one undimensioned XBRL fact for a requested concept and exact duration, requiring explicit filing-level basis and resolvable unit. It rejects missing concepts, ambiguous duplicates, segment contexts, nil/non-numeric values and unresolved units.\n- `seven_metric_xbrl_pipeline.ts` connects explicit issuer concept mapping, exact XBRL fact selection, current/prior period envelopes, candidate calculations and the seven-metric audit matrix. It never guesses taxonomy extensions; issuer concept maps must be researched and explicitly supplied.
- `metric_definition_policy.ts` is the explicit seven-metric readiness catalog: Revenue Growth, Profit Growth and OCF are candidate-only for non-financials; ROE, ROCE, Debt/Equity and Interest Coverage stay blocked until definitions and statement mappings are resolved. Bank, NBFC, Insurance and unknown-sector paths are separately gated.
- It uses `fast-xml-parser` (MIT; TypeScript declarations; ESM/CommonJS support) and rejects DTD/entity declarations.
- It has a 25 MB input limit and intentionally rejects ZIP input; archive decompression is a separate ingestion step.
- It fails closed for numeric facts with missing/unresolved contexts or units, duplicate context/unit IDs, unsupported scale/sign attributes, Inline XBRL format transformations, and unresolved continuation chains. Warnings must be treated as a validation failure by the issuer-pilot workflows.
- `xbrl_extract.test.ts` contains synthetic tests for context/entity metadata, standard facts, nil facts, inline scale/sign, fractions, DTD rejection, and broken references.
- `sector_metric_policy.test.ts` covers bank-sector exclusions and exact period/basis/group-context checks.
- `group_fact_selection.ts` selects only one unique undimensioned group fact after exact context checks; segment facts cannot be added to manufacture a group total. Its dedicated tests cover ambiguity, wrong periods and unresolved contexts.
- `statement_reconciliation.test.ts` covers named statement-presentation variants and fail-closed mapping decisions.
- The isolated GitHub Actions test workflow runs every `research/fundamental_pilot/*.test.ts` file. Latest verified run: 160 tests passed, 0 failed (workflow run 45070080897; commit fa4bcbb3705137d9b4e98b00162ab62f943fb9e7).\n- Live metadata ingestion smoke test: workflow run 45068924150 fetched all 14 ITC filing metadata rows in one page, confirmed pagination complete, and resolved the exact 30-SEP-2026 Consolidated Original filing (NSE sequence 208371). No revision was present for that exact filing.\n- Real ITC XBRL extraction rerun: workflow run 45069238660 downloaded the official NSE Original XML and parsed 65 contexts / 392 facts / no parser warnings. Fourteen raw facts matched the initial target-concept list, including RevenueFromOperations, ProfitLossForPeriod and CashFlowsFromUsedInOperatingActivities. This validates the selected filing's raw extraction only; it does not validate accounting semantics or approve metrics. See https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45069238660.\n- Real ITC end-to-end smart pipeline rerun: workflow run 45069858760 checked full NSE Original/Revision history for current and prior H1, confirmed both were Original-only with complete metadata pagination, parsed 65/392 current and 52/367 prior contexts/facts with zero warnings, matched 9 exact prior-year fact keys, and selected unique group facts for Revenue, Profit and OCF. Mechanical candidates were Revenue Growth +35.41%, Profit Growth -17.02%, and OCF +35.71%; all remain candidate-only. ROE/ROCE/Debt-Equity/Interest Coverage remain blocked. See `ITC_SEVEN_METRIC_XBRL_PIPELINE_PILOT_2026-11-23.md` and https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45069858760. The package script `npm run test:fundamental-pilot` currently runs only `xbrl_extract.test.ts`, not the complete research test suite.

## Sector and context safety gates

- `sector_metric_policy.ts` is a research-only applicability guard, not a calculator or production metric mapper.
- `statement_reconciliation.ts` compares a raw candidate with named statement presentations but always leaves metric mapping unapproved. This prevents one statement row from being silently substituted for another when presentation definitions differ.
- Bank ROCE, industrial Debt/Equity and industrial EBIT/interest coverage are explicitly marked not applicable as generic formulas.
- Bank revenue/profit growth, ROE and OCF remain blocked pending bank-specific definitions and period/basis validation.
- NBFC, insurance and unknown-sector profiles fail closed rather than inheriting industrial formulas.
- Context selection requires exact dates, duration-vs-instant shape, no dimensions for group totals, and an explicit matching filing-level consolidation basis.
- The ITC pilot found two PBT presentations in the same consolidated filing: main financial-results PBT and segment-results PBT. The XBRL candidate matches the main financial-results PBT; the segment presentation includes the associates/JV share in its bridge. Both can be arithmetically reconciled, but the scanner's intended PBT definition remains unselected and mapping stays blocked.
- The HDFC Bank prior-year pair pilot matched 311 raw fact keys across two original consolidated banking filings, with 11 unmatched keys and no conflicting duplicates. Those unmatched keys remain unresolved.
- The KSH International standalone prior-year pair pilot matched 31 same-shape concept/dimension/unit keys across original filings, with zero unmatched keys, zero conflicting duplicates and zero parser warnings. A later all-revisions audit found that 30-SEP-2025 OCF changed in two subsequent revisions despite remarks describing only RPT denomination corrections; the later XBRL value also conflicts with both the original and current comparative PDFs and with the balance-sheet cash fact. The prior-year OCF metric is now `REVIEW_REQUIRED` and no YoY comparison is accepted. See `KSHINTL_OCF_REVISION_CONFLICT_2026-11-23.md`.
- The GAIL revision-history pilot found one Original and two Revision rows for the same consolidated 30-JUN-2026 period. All three XBRL XML payloads were byte-identical (SHA-256 identical); each revision matched all 159 fact keys with zero changes. This is a regression case proving the resolver preserves all revisions instead of silently selecting one.
- The ARSS Infrastructure standalone 30-JUN-2026 pair also had one Original and one Revision; both XML files were byte-identical and all 68 fact keys matched without changes.
- The Mittal Life Style consolidated 30-JUN-2026 pair had one Original and one Revision. Four EPS-related XBRL facts changed from ₹0.16 to ₹0.02; the other 62/66 matched facts were unchanged. The NSE API returned one exact duplicate revision row, which the resolver deduplicated safely. This is the positive test that revised financial values must be compared and retained, not merely labeled.
- The YoY candidate calculator has regression cases reproducing the ITC Q2/H1 and KSHINTL Q2 mechanical Revenue/Profit comparisons. The OCF candidate tests exercise generic same-period arithmetic, preserving negative/positive direction and withholding percentages for non-positive prior bases. KSHINTL's issuer-specific prior-year OCF is blocked separately by its revision conflict. These are calculations on pilot facts; they are not organic-growth certifications or production metric approvals.
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
