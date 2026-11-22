# GAIL original and multiple revision XBRL comparison

Date: 2026-11-23  
Project: Google AI Studio NSE Swing Trading Scanner  
Branch: `research/free-fundamental-sources`  
Status: research-only; no production/runtime integration.

## Official NSE filing history

Issuer: GAIL (India) Limited  
Symbol: GAIL  
Period: 30-JUN-2026  
Filing family: Integrated Filing - Financials  
Audit status: Un-Audited  
Basis: Consolidated

| NSE submission | Sequence ID | NSE timestamp | Revision remark |
|---|---:|---|---|
| Original | 181081 | 31-Jul-2026 14:37:12 broadcast | — |
| Revision 1 | 181083 | 31-Jul-2026 14:40:40 revised | Technical error |
| Revision 2 | 181084 | 31-Jul-2026 14:41:13 revised | Technical error |

Official NSE XBRL files:
- [Original XBRL](https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1705900_31072026023719_WEB.xml)
- [Revision 1 XBRL](https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1705902_31072026024040_WEB.xml)
- [Revision 2 XBRL](https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1705903_31072026024113_WEB.xml)

## Key finding: two revisions exist, but all three XML payloads are byte-identical

The NSE API returned one Original and **two** Revision rows for the same issuer, period and consolidated basis. The first workflow correctly failed closed when it found two revisions rather than silently selecting one. The resolver was then upgraded to preserve the full revision history and sort it chronologically.

| Validation | Original | Revision 1 | Revision 2 |
|---|---:|---:|---:|
| XML bytes | 48,389 | 48,389 | 48,389 |
| Contexts | 53 | 53 | 53 |
| Facts | 159 | 159 | 159 |
| Parser warnings | 0 | 0 | 0 |
| Common fact keys vs Original | — | 159 | 159 |
| Changed common facts vs Original | — | 0 | 0 |
| Unmatched keys | — | 0 | 0 |
| Ambiguous keys | — | 0 | 0 |

All three SHA-256 hashes are identical:

`40b3fe2d890164c617a97d894ebf61637870e0e8477d03d78f42f7c46eb534c5`

This proves that the downloaded XBRL payloads are byte-for-byte identical in this particular filing history. It does **not** prove why NSE received two revisions or whether the associated human-readable filing metadata changed. Both revision remarks say “Technical error”; no numerical or context changes were found in the XML.

## Readiness decision

**Pass:** exact issuer/period/basis identity; one original plus all two revisions preserved; chronological revision ordering; 159/159 structural fact-key matches per revision; zero changed facts; zero unmatched/ambiguous keys; zero parser warnings.

**Not approved:** using revision metadata alone as proof of changed financial figures; choosing the latest revision without preserving history; any production metric mapping. The result is a revision-handling regression case, not a financial-performance assessment.

## Workflow evidence

- Workflow: [NSE GAIL original revision XBRL comparison](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/blob/research/free-fundamental-sources/.github/workflows/nse-gail-revision-pair-pilot.yml)
- Failed-first-attempt evidence (correctly rejected two revisions): [run 45061254454](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45061254454)
- Successful full-history comparison: [run 45061375973](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45061375973)
- Artifact (7-day retention): [original, both revisions, raw XML and comparison JSON](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45061375973/artifacts/14769810082)

Keep this pilot isolated on the research branch. Main branch, scanner filters, live-price path, UI and Google AI Studio app remain unchanged.
