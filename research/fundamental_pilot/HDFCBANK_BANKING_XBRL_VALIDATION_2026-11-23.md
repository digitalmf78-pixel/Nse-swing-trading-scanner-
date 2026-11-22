# HDFC Bank consolidated banking XBRL parser validation — 2026-11-23

## Scope and safety

Research-only test on `research/free-fundamental-sources` for the Google AI Studio NSE Swing Trading Scanner. No main-branch, scanner-runtime, live-price, Yahoo, ranking, filters, UI or deployed-app changes.

## Official NSE filing identity

Resolved from the official NSE Integrated Filing-Financials API:

- Company: HDFC Bank Limited
- Symbol: HDFCBANK
- Scrip code: 500180
- ISIN: INE040A01034
- NSE sequence ID: 202132
- Quarter end: 30-SEP-2026
- Submission: Original
- Audit status: Un-Audited
- Basis: Consolidated
- Broadcast: 17-Oct-2026 17:47:13
- NSE iXBRL page: https://nsearchives.nseindia.in/corporate/ixbrl/INTEGRATED_FILING_BANKING_202132_17102026174812_iXBRL_WEB.html
- Original XBRL instance: https://nsearchives.nseindia.in/corporate/xbrl/INTEGRATED_FILING_BANKING_1740913_17102026054812_WEB.xml

The NSE display identifies HDFCBANK, ISIN INE040A01034, second quarter, consolidated and unaudited. It is a bank-specific `INTEGRATED_FILING_BANKING` instance, unlike the KSHINTL and ITC `INTEGRATED_FILING_INDAS` instances.

## Original XML and generic parser result

The official original XBRL instance was downloaded by GitHub Actions and parsed using the same research TypeScript extractor:

- XML bytes: 80,749
- Contexts: 71
- Facts: 322
- Units: INR, pure, INR per share
- Distinct concepts: 172
- Parser warnings: 0
- Workflow: https://github.com/digitalmf78-pixel/Nse-swing-trading-scanner-/actions/runs/45058871284
- Artifact: `nse-hdfcbank-consolidated-banking-xbrl-pilot`, ID `14768169271`, retained until 29-Nov-2026.

The principal duration contexts include:
- `OneD`: 01-Jul-2026 to 30-Sep-2026 (Q2)
- `FourD`: 01-Apr-2026 to 30-Sep-2026 (H1 YTD)

The parser also extracted instant contexts and expense/other dimensional contexts. Facts with dimensions must not be confused with group-level bank totals.

## Bank-specific concept coverage found in the actual instance

The parsed bank instance includes concepts that are specific or particularly relevant to banks, including:

- `InterestEarned`
- `InterestExpended`
- `InterestOnBalancesWithReserveBankOfIndiaAndOtherInterBankFunds`
- `InterestOrDiscountOnAdvancesOrBills`
- `Advances`
- `Deposits`
- `Borrowings`
- `GrossNonPerformingAssets`
- `NonPerformingAssets`
- `CET1Ratio`
- `AdditionalTier1Ratio`
- `OperatingProfitBeforeProvisionAndContingencies`
- `CashFlowsFromUsedInOperatingActivities`

These are not interchangeable with industrial-company concepts such as RevenueFromOperations, FinanceCosts, BorrowingsCurrent/Noncurrent or generic capital employed. Bank analysis needs its own taxonomy mapping and ratio policy.

## Seven target metrics: banking applicability warning

The generic seven-metric set was designed for broad non-financial issuers. For a bank:

| Generic target | Banking interpretation / safe decision |
|---|---|
| Revenue Growth | Do not assume industrial `RevenueFromOperations`; bank interest income and other income need a bank-specific income definition. |
| Profit Growth | Use the correct bank profit fact and same-basis comparable periods; preserve exceptional and consolidation effects. |
| ROE | Requires average equity and an explicit attributable-profit policy; not approved from this parse alone. |
| ROCE | Generic industrial ROCE is not suitable as-is for a deposit-taking bank. Mark N/A or use a separately approved bank metric set. |
| Debt/Equity | Industrial debt/equity is not a meaningful generic bank screen because deposits and borrowings are operating funding sources; do not apply the non-financial threshold. |
| Interest Coverage | Generic EBIT/finance-cost coverage is not appropriate for a bank; interest earned/expended and net interest income are central operating measures. |
| Operating Cash Flow | The bank cash-flow taxonomy contains operating cash-flow facts, but its interpretation differs from non-financial operating cash flow. Preserve raw statement classification and do not apply the same positive-OCF threshold automatically. |

Do not force industrial-company formulas or thresholds onto banks. A sector-specific bank scorecard should be designed separately.

## What this proves and does not prove

Proved:
- The same generic XML extractor can parse a third issuer's original NSE filing.
- It successfully parses a bank-specific consolidated instance with 71 contexts, 322 facts and 172 distinct concepts.
- It recognizes INR, pure and INR/share units and multiple reporting contexts.
- It sees bank-specific interest, deposit, advances, NPA and capital adequacy concepts.

Not proved:
- Full taxonomy XSD validation or every bank filing variant.
- Correct bank-specific concept mapping or regulatory ratio calculations.
- Correct ROE, NIM, GNPA/NNPA, CRAR, CET1 or any bank scorecard calculation.
- That industrial-company seven-metric formulas should apply to banks.

## Readiness decision

The generic XML extraction layer has now parsed three real issuers across two non-bank Ind AS instances and one bank-specific consolidated instance. The next development should separate sector taxonomy profiles and prevent generic industrial metrics from being calculated for banks. Keep all work research-only.
