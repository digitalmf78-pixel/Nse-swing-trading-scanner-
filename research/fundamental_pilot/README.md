# Research-only NSE/BSE fundamental data pilot

This folder is isolated from the scanner runtime. The intended production implementation is TypeScript because this Google AI Studio project is a Node.js/TypeScript application.

## Current TypeScript extractor

- `xbrl_extract.ts` extracts raw XBRL/iXBRL facts, contexts, entity identifiers, periods, dimensions, units, nil flags, decimals, inline scale/sign, and basic inline fractions.
- It uses `fast-xml-parser` (MIT; TypeScript declarations; ESM/CommonJS support) and rejects DTD/entity declarations.
- It has a 25 MB input limit and intentionally rejects ZIP input; archive decompression is a separate ingestion step.
- `xbrl_extract.test.ts` contains synthetic tests for context/entity metadata, standard facts, nil facts, inline scale/sign, fractions, DTD rejection, and broken references.
- Run with `npm run test:fundamental-pilot` after installing project dependencies.

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
- A real NSE issuer filing's raw bytes could not yet be downloaded in the research environment. KSHINTL's official human-readable filing was inspected, but the parser has not been run against its raw XBRL/iXBRL bytes.
- Do not connect this pilot to app runtime until real filing fixtures, taxonomy mapping, period/basis/revision rules, and cross-source reconciliation pass.

## Data quality rules

- Keep raw fact, concept, unit, scale/decimals, context, dimensions, period, entity identifier, filing URL, publication time, filing version, audit status, and consolidation basis.
- Missing is null + an explicit status; never substitute zero, an estimate, or a previous-period value.
- Preserve original and revised filings; a revised filing supersedes only the same issuer, period, basis, and statement type.
- Do not mix consolidated and standalone data or quarter, YTD, FY, and TTM periods.
- OCF must be sourced from the cash-flow statement's net cash from operating activities, not free cash flow, net cash movement, or profit.
- Banks, NBFCs, and insurers need sector-specific ratio definitions; generic industrial formulas must not be forced onto them.
