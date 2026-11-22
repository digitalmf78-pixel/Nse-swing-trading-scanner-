# SARVESHWAR original versus revised NSE XBRL pair validation — 2026-11-23

## Scope and safety

Research-only revision-handling test on `research/free-fundamental-sources`. No scanner runtime, main branch, Google AI Studio deployment, live-price path, filters, ranking or UI changes.

## Official NSE filing pair

Resolved from the official NSE Integrated Filing-Financials API for Sarveshwar Foods Limited:

- Symbol: SARVESHWAR
- Period end: 30-SEP-2026
- Basis: Standalone
- Audit status: Un-Audited
- Original NSE sequence ID: 214112
- Original broadcast: 13-Nov-2026 23:43:43
- Revision NSE sequence ID: 214113
- Revision timestamp: 13-NOV-2026 23:44:09
- Revision remarks field: blank in API metadata for both records
- Original iXBRL: https://nsearchives.nseindia.in/corporate/ixbrl/INTEGRATED_FILING_INDAS_214112_13112026234343_iXBRL_WEB.html
- Revision iXBRL: https://nsearchives.nseindia.in/corporate/ixbrl/INTEGRATED_FILING_INDAS_214113_13112026234428_iXBRL_WEB.html

The official NSE listing shows an Original and a Revision for the same issuer, quarter, standalone basis and unaudited status.

## Download and parser results

Both official XBRL XML files downloaded successfully:

| Result | Original | Revision |
|---|---:|---:|
| XML bytes | 308,919 | 308,919 |
| Contexts | 238 | 238 |
| Facts | 1,143 | 1,143 |
| Units | INR and INR/share | INR and INR/share |
| Parser warnings | 0 | 0 |
| NSE sequence ID | 214112 | 214113 |

- SHA-256 original: `040fe7e200c2fb84f0212ad715eb00a42002acefeae7c70130e488ae6ca08695`
- SHA-256 revision: `040fe7e200c2fb84f0212ad715eb00a42002acefeae7c70130e488ae6ca08695`
- Workflow: https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45058945424
- Artifact: `nse-sarveshwar-original-revision-xbrl-pair`, ID `14768581593`, retained until 29-Nov-2026.

## Exact fact comparison

The regression compares facts by the composite key:
`concept + contextRef + unitRef`

- Original fact keys: 1,143
- Revision fact keys: 1,143
- Common fact keys: 1,143
- Changed common raw values / numeric values / nil flags: 0

The two downloaded XML files have the same SHA-256 hash and identical byte size. The NSE index distinguishes them with different sequence IDs and marks the second record as a Revision, but the underlying XML payload is byte-for-byte identical.

## Correct interpretation

This test proves the ingestion layer can:
- discover both Original and Revision rows;
- preserve their separate sequence IDs and metadata;
- download both linked XML files;
- parse both files independently;
- avoid overwriting the original with the revision;
- compare their facts and detect that this particular revision row points to identical XML content.

It does **not** prove that the issuer's revision changed no financial results in every disclosure channel. The XBRL payloads are identical; the revision may be administrative, or a separate document/metadata change may exist outside this XML. The API's revision remarks field is blank, so no reason is inferred.

## Required production rule

Do not deduplicate filings only by symbol + quarter + basis, and do not assume every Revision changes facts. Retain both filing records with sequence ID, submission type, revision timestamp, remark, URL and content hash. If content hashes match, mark `SAME_XBRL_CONTENT_AS_PRIOR_VERSION` while preserving both metadata rows. If hashes differ, compare the fact sets and retain both raw versions. A revision may supersede an earlier version for current-profile selection only after matching issuer, period, basis and statement type; the original must remain in the audit trail.

## Readiness decision

- Original/revision metadata discovery: PASS.
- Both original/revision raw XML downloads: PASS.
- Both parses: PASS.
- Same-period and same-basis identity checks: PASS.
- Content-hash comparison: PASS.
- Financial fact changes in this pair: none; XML identical.
- General revision-selection engine: not implemented and not approved for runtime.
