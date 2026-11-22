# ARSS Infrastructure original/revision XBRL comparison

Date: 2026-11-23  
Project: Google AI Studio NSE Swing Trading Scanner  
Branch: `research/free-fundamental-sources`  
Status: research-only; no production/runtime integration.

## Official NSE filing identity

Issuer: ARSS Infrastructure Projects Limited  
Symbol: ARSSINFRA  
Period: 30-JUN-2026  
Basis: Standalone  
Audit status: Un-Audited

| Submission | Sequence ID | Timestamp | Revision remark |
|---|---:|---|---|
| Original | 187485 | 14-Aug-2026 18:01:12 broadcast | — |
| Revision | 187497 | 14-Aug-2026 18:09:01 revised | NA |

Official NSE XML:
- [Original XBRL](https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1714748_14082026060640_WEB.xml)
- [Revision XBRL](https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1714767_14082026060901_WEB.xml)

## Comparison result

| Check | Original | Revision |
|---|---:|---:|
| XML bytes | 14,514 | 14,514 |
| Contexts | 3 | 3 |
| Facts | 68 | 68 |
| Parser warnings | 0 | 0 |
| Common fact keys | — | 68 |
| Changed common facts | — | 0 |
| Unmatched keys | — | 0 |
| Ambiguous keys | — | 0 |

Both XML files have the same SHA-256:

`483a9b643a8e9a8c8674f0460b84d27177f3458f661bc98f955e212fab413b1e`

The payloads are byte-identical. NSE's revision row is retained as a separate filing record, but this comparison found no numerical/context changes in the XML. The revision remark is “NA”; the audit does not infer the reason for the revision or claim that other non-XBRL filing metadata was unchanged.

## Readiness decision

**Pass:** exact Original + Revision identity for same issuer, period and standalone basis; both official NSE XML files downloaded; 68/68 fact keys match; zero changed, unmatched or ambiguous facts; zero parser warnings.

**Not approved:** metric mapping, treating the revision label as evidence of changed financial figures, or silently overwriting the original. Both source versions remain independently preserved.

## Workflow evidence

- Workflow: [NSE ARSSINFRA original revision XBRL comparison](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/blob/research/free-fundamental-sources/.github/workflows/nse-arssinfra-revision-pair-pilot.yml)
- Successful run: [GitHub Actions run 45061500998](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45061500998)
- Artifact (7-day retention): [Original, revision and raw XML evidence](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45061500998/artifacts/14769661628)

Keep this pilot on the isolated research branch. Main branch, scanner filters, live-price path, UI and Google AI Studio app remain unchanged.
