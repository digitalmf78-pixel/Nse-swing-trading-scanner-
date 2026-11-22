# BSE financial-results XBRL source access review

Date: 2026-11-23  
Project: Google AI Studio NSE Swing Trading Scanner  
Decision: **Do not add a BSE runtime connector yet.** Keep the current validated NSE research path isolated.

## What is officially established

1. BSE's Notice 20250523-40 dated 23-May-2025 says its XBRL utility for “Integrated Filing - Financial” is available in the XBRL section of the Listing Centre and equity-listed entities are required to submit financial results using that utility. The notice also says the PDF financial results are filed separately through Corporate Announcements. This establishes that BSE issuers produce XBRL submissions; it does not by itself establish an unrestricted public bulk-download API.
2. BSE's official Market Data Self Data Feed page lists Corporate Data APIs covering company financials, disclosures, corporate announcements and actions, with registration/KYC, plan selection and payment. This is a structured BSE data product, not a confirmed free API for this scanner.
3. The BSE public XBRL details page returned HTTP 403 to this research session. A public page or issuer filing link being visible in a browser is not proof that bulk automated retrieval is permitted or stable.

## Third-party open-source discovery

The PyPI project `india-xbrl-filings` documents a possible BSE Integrated Filing RSS path and reports that BSE's older financial-results attachment links can expire. However, its own legal notice explicitly restricts use to personal/educational purposes and says not to use it for commercial products/services/resale. It also describes its exchange endpoints as unofficial and undocumented.

**Decision:** do not copy or depend on that project's code, endpoint client, headers, or implementation for this app. Its MIT code license does not override the project's explicit data-use restriction or the exchange's terms. We may independently evaluate official BSE access after reviewing BSE's own terms and confirming the endpoint/attachment behavior directly.

## Current project source policy

- NSE: continue using the official NSE Integrated Filing API + original XBRL archive, as exercised in the issuer pilots. Preserve original/revision history, exact filing basis, sequence ID, broadcast/revision metadata, and raw XML checksum.
- BSE: no runtime integration and no cross-exchange metric merge. First obtain a clearly permitted access path, determine whether filings are downloadable without a paid feed, characterize attachment retention, and validate the BSE taxonomy separately.
- If BSE's only suitable structured access is a paid feed or requires authorization not currently available, leave BSE metrics as `MISSING` rather than scrape, infer, or silently fall back to NSE data.

## Source links

- BSE official notice 20250523-40: https://www.bseindia.com/markets/MarketInfo/DownloadAttach.aspx?attachedId=6b163bb8-fbe3-4e14-be9a-47b99f2cfaaf&id=20250523-40
- BSE official Self Data Feed: https://marketdata.bseindia.com/
- BSE public XBRL details page: https://www.bseindia.com/corporates/xbrldetails.aspx
- Third-party package legal note and BSE research (not approved for project use): https://pypi.org/project/india-xbrl-filings/

No scanner runtime, main branch, live-price path, UI, or Google AI Studio app changes were made.
