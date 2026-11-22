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
https://nsearchives.nseindia.com/corporate/xbrl/INTEGRATED_FILING_INDAS_1753217_04112026090644_WEB.xml

Official human-readable iXBRL rendering:
https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_209920_04112026210644_iXBRL_WEB.html

## Root cause of raw issuer XBRL download failure

The filing URL and row metadata are valid; the API successfully returned them. The failure occurs only when attempting to retrieve the raw XML bytes from the cloud runner.

1. Direct GET to the exact `nsearchives.nseindia.com/corporate/xbrl/...xml` URL returned HTTP 400 from the GitHub-hosted runner.
2. The NSE website's own front-end JavaScript was inspected. Its XBRL download handler calls:
   `/api/download_xbrl?fileUrl=` + `encodeURIComponent(JSON.stringify(url))`.
3. Repeating the request through that official NSE download endpoint returned HTTP 200 but the body was a 22,073-byte HTML page, not XML. The response headers identify AkamaiNetStorage; the page title is "Service Temporarily Unavailable" and the message is "This site is not accessible in your region at the moment."
4. This establishes a regional access restriction on raw filing delivery from the GitHub Actions runner location. It is not a missing file, bad API row, ZIP-format issue, or TypeScript parser error.
5. The human-readable iXBRL URL downloads successfully (97,498 bytes), but it is rendered HTML, not the raw iXBRL instance. It contains no `ix:nonFraction`, `xbrli:context`, or other inline-XBRL fact markup, so it must not be passed to the raw XBRL extractor as a valid fixture.

## Download workflow evidence

- API response correctly contains the KSHINTL row and the raw XBRL URL.
- Raw XBRL direct-download attempt: HTTP 400.
- NSE proxy route: HTTP 200, but returns region-restriction HTML instead of XML.
- The response preview and headers were saved in a temporary Actions artifact for diagnosis (7-day retention); they are not treated as a filing fixture.

## Separate CI test issue fixed

The earlier parser-test workflow failed before executing tests because it ran `npm install` for the entire app. Existing app dependency constraints conflict:
- root `esbuild@0.25.x`
- `vite@8.3.x` optional peer expects `esbuild@^0.27.0 || ^0.28.0`

This is unrelated to the XBRL parser. The research workflow now installs only `fast-xml-parser@5.12.1` into a temporary dependency directory and runs Node 22's TypeScript stripping test runner, without resolving unrelated app dependencies.

Verified run:
- workflow: Fundamental pilot tests
- run ID: 45057318672
- result: SUCCESS
- tests: 11 passed, 0 failed
- duration: 256 ms

These are synthetic parser regression tests only; they do not prove real issuer filing compatibility.

## Next safe action

Obtain the exact raw XML bytes through a network route located in India or another official exchange route that is not region-blocked. Once the exact XML is available:
1. verify it is XML, not an HTML block page;
2. preserve the API row metadata and raw file hash;
3. run the TypeScript extractor against the actual bytes;
4. compare extracted contexts, units, periods, and facts with the official filing rendering and issuer filing;
5. record all parser gaps before any seven-metric mapping.

Do not fabricate an XBRL fixture from the rendered HTML or PDF. Do not weaken the parser to accept an HTML block page. Do not connect this research parser to the scanner runtime yet.
