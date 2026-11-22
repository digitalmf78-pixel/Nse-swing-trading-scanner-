# NSE XBRL Ingestion Findings — 2026-11-22

## Scope
Research-only documentation for the separate Google AI Studio NSE Swing Scanner. No runtime code, main branch, deployed app, Yahoo price path, scanner filters, ranking, or UI changed.

## Official source findings

### 1. Taxonomy is sector-specific
NSE's official XBRL Filing Information page lists separate Regulation 33 Integrated Filing-Financial XBRL archives and taxonomy archives for:
- Ind AS
- Other-than-banks
- Banking
- NBFC
- General insurance
- Life insurance
- REITs/InvITs and other categories

The page explains that the instance document carries taxonomy-tagged facts together with measurement unit, reporting period, and scale. This confirms that a single universal concept map is unsafe. Source: https://www.nseindia.in/static/companies-listing/xbrl-information

### 2. Integrated Filing index is a discovery source
The official NSE Integrated Filing page exposes fields including symbol, company name, quarter end, original/revised submission type, audited/unaudited status, consolidated/standalone basis, details link, XBRL link, broadcast timestamp, revised timestamp, and revision remarks. The indexed page showed 31,173 financial filing records and 20 rows per page when inspected. Source: https://www.nseindia.in/companies-listing/corporate-integrated-filing

### 3. Download endpoint is not yet verified
The public page shows a CSV download control and an XBRL-to-Excel utility. The static page extraction exposed the CSV icon asset rather than the underlying data endpoint. Do not hardcode or guess a CSV/API URL. The exact download/network request must be captured and tested before implementing automated ingestion.

### 4. Official filing submission process
NSE's XBRL information page says listed companies submit through NEAPS data entry/file upload and can download XBRL files after submission. This supports treating issuer filing instances and exchange metadata as primary source material, while still validating each downloaded artifact.

## Engineering implications
1. Discover filing metadata first; fetch the exact XBRL document referenced by that record.
2. Keep the exchange's original/revised, basis, audit status, period end, and broadcast/revision timestamps attached to every source document.
3. Select taxonomy by filing type/issuer sector; do not apply the non-bank taxonomy to banks/NBFCs/insurers.
4. Never infer a download URL from an icon path or fabricate an endpoint.
5. Validate the downloaded file's MIME type, size, XML/ZIP signature, issuer identifier, context dates, and taxonomy namespace before extracting facts.
6. Keep the raw filing immutable and store a content hash for auditability.
7. Continue to keep all experiments on research/free-fundamental-sources until a real-filing pilot and 20-issuer validation pass.

## Current limitation
The actual NSE filing index and taxonomy archives are publicly discoverable, but the raw data-download endpoint for the index was not confirmed in this inspection. The existing TypeScript extractor therefore remains synthetic-fixture-tested only; it is not yet validated against a downloaded issuer XBRL instance. No production integration is approved.


## Follow-up: exact official taxonomy archive links identified

The NSE XBRL information page exposes direct archive links for Regulation 33 Integrated Filing-Financial formats and taxonomies. The Ind AS financial-results XBRL format archive link resolved to:

- https://nsearchives.nseindia.com/web/mediaattachment/2026-06/Financial_Results_-_Ind_AS_Equity_and_Debt_Format_20260605152622.zip

The same official page exposes separate XBRL-format and taxonomy archive links for Other-than-Banks, Banking, NBFC, General Insurance, Life Insurance, and REITs/InvITs. This is useful for building taxonomy-specific concept dictionaries. Source page: https://www.nseindia.in/static/companies-listing/xbrl-information (XBRL File Formats table, rows 6–12).

### Download limitation
The web link resolver identified the official ZIP URL but could not fetch the ZIP payload (unsupported application/zip content type); a direct download attempt from the current execution environment also failed. Therefore the archive bytes, schema contents, and actual issuer filing bytes have NOT yet been inspected. Do not mark taxonomy mapping or raw filing parsing as validated on the basis of the link alone.

### Next implementation gate
Obtain the archive bytes in a supported environment, inspect the taxonomy entry points and concept labels, then add taxonomy-specific mapping tests. In parallel, obtain one issuer filing's raw XBRL/iXBRL payload through the NSE filing row's XBRL link. Until those artifacts are locally readable, keep the extractor research-only and do not wire it into scanner runtime.
