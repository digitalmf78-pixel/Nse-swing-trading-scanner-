# KSHINTL raw NSE XBRL access diagnosis — 2026-11-23

## Project and safety scope
This is the separate Google AI Studio NSE Swing Trading Scanner research branch:
`research/free-fundamental-sources`.

No main branch, production scanner runtime, live-price path, Yahoo path, filters, scoring, ranking, UI, thresholds, cache, or deployed Google AI Studio app was changed.

## Official filing row successfully discovered

The NSE Integrated Filing API endpoint was identified from the official NSE page's own JavaScript:
`/api/integrated-filing-results`.

A request filtered by:
- index: equities
- symbol: KSHINTL
- type: Integrated Filing- Financials

returned the exact original standalone filing row:

- Symbol: KSHINTL
- Company: KSH International Limited
- ISIN: INE987S01020
- sequence ID: 209920
- quarter ended: 30-SEP-2026
- submission: Original
- basis: Standalone
- audit status: Un-Audited
- broadcast time: 04-Nov-2026 21:06:19
- creation time: 04-Nov-2026 21:06:44
- XBRL size reported by NSE: 84.71 KB
- iXBRL HTML size reported by NSE: 95.21 KB

Official XBRL URL returned by the API:
https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1753217_04112026090644_WEB.xml

Official human-readable iXBRL rendering:
https://nsearchives.nseindia.in/corporate/ixbrl/INTEGRATED_FILING_INDAS_209920_04112026210644_iXBRL_WEB.html

## Corrected raw XML access finding

The earlier diagnosis that raw XML was region-blocked was incomplete and is superseded by the successful run below.

- The API endpoint returned the exact KSHINTL XBRL URL and filing metadata.
- A first attempt through the NSE website proxy `/api/download_xbrl` returned an Akamai region-restriction HTML page instead of XML.
- The exact archive URL was then fetched directly from `nsearchives.nseindia.in` and `nsearchives.nseindia.com` using the correct archive host and browser-style headers.
- Both archive hosts returned HTTP 200 and the same original 86,742-byte XBRL XML.
- The direct response headers identified `content-type: application/xml`.
- The returned document begins with an XML declaration and an `xbrli:xbrl` root; it is not an HTML block page.

Therefore the file is available. The working route is the direct NSE archive host request; the NSE proxy endpoint is not required for this tested filing.

## Original XML evidence

- File: `KSHINTL_2026-09-30_original_NSE_XBRL.xml`
- Size: 86,742 bytes
- SHA-256: `4db8678cf8f79372a7c4506ac6f16eeaf7125d75d8f58d79c64db53add9b4442`
- NSE filing row: sequence ID 209920, Original, Standalone, Un-Audited, 30-SEP-2026
- Temporary artifact: `nse-kshintl-real-xbrl-diagnostic`
- Artifact ID: `14768745504`
- Workflow run: `45058154097`
- Artifact expiry: 2026-11-29

## Real TypeScript parser result

The existing research-only TypeScript extractor ran against the downloaded original XBRL bytes.

- Contexts: 43
- Facts: 398
- Units: 3
- Warnings: 0
- Key-fact assertions: PASS

The workflow asserted exact concept/context/unit/value combinations for:
- Q2 revenue and profit (`OneD`, 2026-07-01 to 2026-09-30)
- H1 YTD revenue and profit (`FourD`, 2026-04-01 to 2026-09-30)
- closing equity, current and non-current borrowings (`OneI`, instant 2026-09-30)
- H1 YTD operating cash flow
- Q2 and H1 finance costs

The parser result and assertions are recorded in:
`research/fundamental_pilot/KSHINTL_REAL_XBRL_PARSER_VALIDATION_2026-11-23.md`.

## Separate CI test issue fixed

The earlier parser-test workflow failed before executing tests because it ran `npm install` for the entire app. Existing app dependency constraints conflict:
- root `esbuild@0.25.x`
- `vite@8.3.x` optional peer expects `esbuild@^0.27.0 || ^0.28.0`

This is unrelated to the XBRL parser. The research workflow now installs only `fast-xml-parser@5.12.1` into a temporary dependency directory and runs Node 22's TypeScript stripping test runner, without resolving unrelated app dependencies.

Verified latest unit-test run:
- workflow: Fundamental pilot tests
- run ID: 45058251366
- result: SUCCESS
- 11 tests passed, 0 failed (the suite is the isolated synthetic parser regression suite; the real-file assertions are run separately in the NSE diagnostic workflow).

## Remaining limitation

This validates one real KSHINTL standalone unaudited instance. It does not prove full taxonomy coverage, multi-issuer compatibility, consolidated filing support, revision selection, seven-metric mapping, or ratio formulas. Keep the parser disconnected from scanner runtime until those are validated.
