# KSHINTL original NSE XBRL parser validation — 2026-11-23

## Scope and safety

This is a research-only validation on `research/free-fundamental-sources` for the separate Google AI Studio NSE Swing Trading Scanner.
No main-branch, scanner-runtime, Yahoo live-price, Yahoo fundamental, ranking, filters, UI, or deployed app changes were made.

## Source discovery and filing identity

The official NSE Integrated Filing API was queried using symbol `KSHINTL` and type `Integrated Filing- Financials`. The exact selected row was:

- Company: KSH International Limited
- Symbol: KSHINTL
- Scrip code: 544664
- ISIN in original filing: INE987S01020
- NSE sequence ID: 209920
- Quarter ended: 30-SEP-2026
- Filing: Original
- Audit status: Un-Audited
- Basis: Standalone
- Broadcast: 04-Nov-2026 21:06:19
- Created: 04-Nov-2026 21:06:44
- Revision date/remark: none
- XBRL file size listed by NSE: 84.71 KB
- Original XBRL URL:
  https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_INDAS_1753217_04112026090644_WEB.xml
- NSE iXBRL display page:
  https://nsearchives.nseindia.in/corporate/ixbrl/INTEGRATED_FILING_INDAS_209920_04112026210644_iXBRL_WEB.html

The direct XBRL URL was blocked by an Akamai HTML response when fetched through the tested download path. The NSE website's own frontend JavaScript was inspected and showed that the XBRL download is proxied through `/api/download_xbrl?fileUrl=`. Using the NSE archive direct route with the correct archive host and browser-style headers returned the original XML. The `.in` and `.com` archive hosts both returned the same 86,742-byte XML with HTTP 200 and `content-type: application/xml`.

## Original file and reproducibility

- Downloaded XML size: 86,742 bytes
- SHA-256: `4db8678cf8f79372a7c4506ac6f16eeaf7125d75d8f58d79c64db53add9b4442`
- NSE format/taxonomy ZIP archives were also re-downloaded and ZIP-tested in the same workflow.
- Temporary GitHub Actions artifact: `nse-kshintl-real-xbrl-diagnostic`
- Artifact ID: `14767888395`
- Workflow run: `45057981376`
- Artifact retention: 7 days from 2026-11-22

The raw XML is standard XBRL instance XML (not the rendered HTML display page and not an Inline XBRL HTML file).

## Real-file parser result

The existing research-only TypeScript extractor `research/fundamental_pilot/xbrl_extract.ts` was run against the downloaded original XML in GitHub Actions.

- Contexts extracted: 43
- Facts extracted: 398
- Units extracted: 3
- Parser warnings: 0
- Parser execution: successful

The extractor correctly recognized issuer metadata, ISIN, reporting basis, periods, INR unit references, and standard numeric facts. The source includes two distinct duration contexts:
- `OneD`: 2026-07-01 to 2026-09-30 (quarter)
- `FourD`: 2026-04-01 to 2026-09-30 (six-month YTD)

It also includes an instant context `OneI` at 2026-09-30. These contexts must not be mixed.

## Key raw facts extracted from the original XML

All amounts below are raw INR values from the XBRL facts. Convert units explicitly only in a later normalization layer; do not infer scaling from a display label.

| Fact | Context | Raw INR | Meaning |
|---|---|---:|---|
| RevenueFromOperations | OneD | 13,196,540,000 | Q2 revenue |
| ProfitLossForPeriod | OneD | 479,530,000 | Q2 profit |
| RevenueFromOperations | FourD | 24,838,890,000 | Six-month YTD revenue |
| ProfitLossForPeriod | FourD | 901,730,000 | Six-month YTD profit |
| Equity | OneI | 8,988,560,000 | Equity at 30-Sep-2026 |
| BorrowingsNoncurrent | OneI | 228,430,000 | Non-current borrowings |
| BorrowingsCurrent | OneI | 3,184,150,000 | Current borrowings |
| FinanceCosts | OneD | 222,500,000 | Q2 finance costs |
| FinanceCosts | FourD | 395,310,000 | Six-month YTD finance costs |
| CashFlowsFromUsedInOperatingActivities | FourD | 425,710,000 | Six-month YTD operating cash flow |

The XML's presentation currency is INR. Its XBRL unit references use INR; the raw facts are rupees. The rendered NSE filing table displays INR Lakhs, so values reconcile by dividing the raw INR by 100,000. Example: Q2 revenue 13,196,540,000 INR = 131,965.40 INR Lakhs. This is consistent with the earlier NSE/issuer display reconciliation.

## Seven-metric coverage assessment for this filing

| Target metric | Evidence in this one filing | Safe status |
|---|---|---|
| Revenue Growth | Current Q2 and current six-month YTD revenue are present; same-period prior-year comparatives are not present in this instance | `MISSING_COMPARATIVE_PERIOD` |
| Profit Growth | Current Q2 and current six-month YTD profit are present; same-period prior-year comparatives are not present in this instance | `MISSING_COMPARATIVE_PERIOD` |
| ROE | Current period profit and 30-Sep equity exist, but there is no prior period equity in the selected instance to establish average equity; no direct ROE fact | `MISSING_REQUIRED_PERIOD` |
| ROCE | No direct ROCE fact; required average capital employed and approved EBIT/ROCE formula inputs are not fully available in this one instance | `MISSING_REQUIRED_PERIOD` |
| Debt/Equity | Borrowings and equity raw facts exist, but no reported debt/equity ratio fact is supplied in this instance; debt definition (including lease liabilities) needs an approved policy before deriving | `RAW_INPUTS_ONLY` |
| Interest Coverage | Finance costs and profit facts exist, but no reported interest coverage fact is supplied; EBIT definition/formula and period alignment need explicit approval before deriving | `RAW_INPUTS_ONLY` |
| Operating Cash Flow | Direct cash-flow statement fact is present for 01-Apr-2026 to 30-Sep-2026: INR 425,710,000 | `AVAILABLE_YTD` |

Important: blank reported ratios are not zero. This pilot does not calculate or populate the missing ratios, and does not convert this one filing into a complete seven-metric profile.

## Important parser limitations still open

A successful parse of one real XBRL instance is not proof of full taxonomy support. The parser currently extracts generic contexts, units and facts, but does not yet:
- validate concept names against the NSE/SEBI taxonomy XSD;
- resolve taxonomy labels, calculation relationships, presentation roles or formula linkbases;
- map facts to the seven target metrics;
- determine comparative periods across separate filings;
- select revisions or merge separate filings;
- decide when lease liabilities belong in debt;
- calculate ROE, ROCE, Debt/Equity or Interest Coverage;
- support every possible extension concept or every XBRL edge case.

The current parser's zero-warning result means this file was parsed without the implemented parser warnings; it does not mean every accounting fact is semantically validated.

## Next safe step

Add a repeatable real-filing regression test using this source hash and assert the key facts and contexts listed above. Then expand the pilot to a second issuer and a consolidated filing, checking taxonomy variations and the same seven metrics. Keep all work research-only until multi-issuer period, basis, unit, revision and formula validation is complete.
