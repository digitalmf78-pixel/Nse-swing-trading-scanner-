# Mittal Life Style original/revision XBRL comparison

Date: 2026-11-23  
Project: Google AI Studio NSE Swing Trading Scanner  
Branch: `research/free-fundamental-sources`  
Status: research-only; no production/runtime integration.

## Official NSE filing identity

Issuer: Mittal Life Style Limited  
Symbol: MITTAL  
Period: 30-JUN-2026  
Filing family: Integrated Filing - Financials  
Audit status: Un-Audited  
Basis: Consolidated

| Submission | Sequence ID | NSE timestamp | Revision remark |
|---|---:|---|---|
| Original | 184670 | 10-Aug-2026 18:30:40 broadcast | — |
| Revision | 191586 | 03-Sep-2026 15:38:12 revised | EPS is corrected |

Official NSE XBRL:
- [Original XBRL](https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1711210_10082026063039_WEB.xml)
- [Revision XBRL](https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1720640_03092026033812_WEB.xml)

The NSE API returned the same Revision sequence row twice. The TypeScript resolver safely deduplicated one exact duplicate row (same sequence ID and same metadata/URLs); it would reject conflicting rows reusing a sequence ID. Reported exact duplicate API rows: **1**.

## Comparison result

| Check | Original | Revision |
|---|---:|---:|
| XML bytes | 10,876 | 10,876 |
| Contexts | 2 | 2 |
| Facts | 66 | 66 |
| Parser warnings | 0 | 0 |
| Common fact keys | — | 66 |
| Changed common fact keys | — | 4 |
| Unmatched keys | — | 0 |
| Ambiguous keys | — | 0 |

The revision changed four per-share XBRL facts. Each was reported as ₹0.16 in the Original and ₹0.02 in the Revision, for the same duration 01-Apr-2026 to 30-Jun-2026 and same INR/share unit:

| XBRL concept | Original | Revision |
|---|---:|---:|
| Basic EPS — continuing operations | ₹0.16 | ₹0.02 |
| Diluted EPS — continuing operations | ₹0.16 | ₹0.02 |
| Basic EPS — continuing and discontinued operations | ₹0.16 | ₹0.02 |
| Diluted EPS — continuing and discontinued operations | ₹0.16 | ₹0.02 |

The other 62 matched fact keys were unchanged. The revision remark “EPS is corrected” is consistent with the four changed per-share facts. This is a structural XBRL comparison, not an independent accounting opinion. NSE's API row had no attached PDF, so no separate PDF-to-XBRL reconciliation is claimed.

## Readiness decision

**Pass:** exact issuer/period/basis identity; one Original plus one Revision; exact duplicate API row safely deduplicated; 66/66 matched fact keys; four changed EPS facts surfaced; zero unmatched/ambiguous keys; zero parser warnings.

**Not approved:** treating the revised EPS as a production metric without checking the full financial statement and notes; merging EPS concepts; or silently overwriting the original. The original and revised raw filings remain independently preserved. EPS is not one of the scanner's seven target metrics.

## Workflow evidence

- Workflow: [NSE MITTAL original revision XBRL comparison](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/blob/research/free-fundamental-sources/.github/workflows/nse-mittal-revision-pair-pilot.yml)
- Successful run: [GitHub Actions run 45061806268](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45061806268)
- Artifact (7-day retention): [Original, revision and comparison JSON](https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45061806268/artifacts/14769454035)

Keep this pilot isolated on the research branch. Main branch, scanner filters, live-price path, UI and Google AI Studio app remain unchanged.
