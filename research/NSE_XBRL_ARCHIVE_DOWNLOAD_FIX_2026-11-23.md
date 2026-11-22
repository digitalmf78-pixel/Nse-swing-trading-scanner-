# NSE XBRL archive download diagnosis and fix — 2026-11-23

## Scope and safety
Research-only work for the separate Google AI Studio NSE Swing Trading Scanner, on `research/free-fundamental-sources`.
No scanner runtime, live-price path, Yahoo path, filters, ranking, UI, main branch, or deployed Google AI Studio app was changed.

## Root cause

The earlier download failures were caused by the inspection environment and file handling, not evidence that NSE had removed the files:

1. The web page resolver can identify the official NSE ZIP links but rejects the binary response with `400 Unsupported content-type: application/zip`. This is a limitation of the page-reading tool; it is not an HTTP failure from a normal ZIP-capable downloader.
2. The local execution container could not resolve/reach `nsearchives.nseindia.com` at the time of the earlier direct attempt (DNS/network restriction).
3. The official NSE page exposes different links for the Excel submission utility and the taxonomy archives. The first link is a ZIP containing an `.xlsm` workbook; it is not itself the taxonomy. The taxonomy is in separate ZIP links.

The official NSE XBRL information page lists the Regulation 33 Ind AS format and taxonomy archives and was updated 06/11/2026:
https://www.nseindia.in/static/companies-listing/xbrl-information

## Fix implemented

Added isolated GitHub Actions workflow:
`.github/workflows/nse-xbrl-download-diagnostic.yml`

The workflow runs on pushes that change only this workflow file on the research branch, and also supports manual dispatch. It:
- downloads the four exact official NSE links with curl;
- sends a browser user-agent, NSE page Referer, and ZIP/octet-stream Accept header;
- retries transient failures;
- checks non-empty files and ZIP magic bytes;
- runs `unzip -t` on every archive;
- records SHA-256 hashes, file types, and archive manifests;
- uploads the downloaded files as a temporary GitHub Actions artifact (7-day retention).

This bypasses the local container's DNS restriction and the web viewer's inability to display ZIP MIME types. It does not bypass authentication or use a paid data API.

## Verified execution

- Workflow commit: `d56efeb0f4efbef1b1ee7f6f43bc0a8524663bea`
- Workflow run: `45056368232`
- Result: SUCCESS
- Artifact: `nse-ind-as-xbrl-format-and-taxonomies`
- Artifact ID: `14767437405`
- Artifact size: 1,884,355 bytes
- Artifact expiry: 2026-11-29 (temporary CI artifact)

All four official archives downloaded and passed ZIP integrity checks:

| Archive | Downloaded bytes | SHA-256 |
|---|---:|---|
| Ind AS Equity/Debt format | 526,539 | `a5d7e5ffefdd03d86e86d6bdb4e56497219d1e840f7fbc2ef525f2a4cfcd53fb` |
| Ind AS Integrated Filing format | 916,562 | `5f95193312e2921fe2b4fbfeedc9cbe2958b31ed6cde224654cf56b83b61616a` |
| Financial Results Ind AS taxonomy | 209,120 | `2760bdcda96c4ed472add9559a7001c215cd2a8aad9cb0db195f69af791c45af` |
| Integrated Filing Finance Ind AS taxonomy | 232,782 | `d06512f59f06a6ca126a90f185884a5679c9c666c0ab1c9d38b32449004c0441` |

## Initial archive inspection

- The Equity/Debt format ZIP contains `Financial Results - Ind AS (Equity and Debt Format).xlsm`.
- The Integrated Filing format ZIP contains `Integrated Filing (Finance)_Ind AS.xlsm`.
- The Financial Results taxonomy ZIP contains the Ind AS 2020-03-31 XSD, calculation, definition, label, reference, presentation and role files, plus its workbook.
- The Integrated Filing Finance taxonomy ZIP contains the 2025-01-31 `in-capmkt` XSD, calculation, definition, presentation, label, reference, role and taxonomy-package metadata, plus its workbook.

All nested ZIPs passed `unzip -t`. These are now real downloaded files, not links-only evidence.

## What this fixes — and what it does not

**Fixed:** official NSE Ind AS format and taxonomy ZIP downloads are now reproducible through a dedicated research-branch GitHub Actions workflow; downloaded bytes and hashes are verified and available in a temporary artifact.

**Not yet fixed/verified:** the raw issuer-specific XBRL attachment for KSHINTL (or another issuer) has not yet been downloaded through this workflow. The taxonomy archives are not issuer filing instances. The parser has not yet been run against a real issuer XBRL/iXBRL payload. No seven-metric concept mapping or scanner-runtime integration is approved by this download test.

Next safe step: use the exact XBRL attachment URL from one NSE Integrated Filing row, download it through the same validated CI path, then test the research-only TypeScript parser against those original bytes.
