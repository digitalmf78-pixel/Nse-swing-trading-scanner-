# Research-only NSE XBRL pilot parser

This module is isolated from the scanner runtime. It extracts raw XBRL/iXBRL facts, contexts, entity identifier, periods, dimensions, units, nil flags, decimals and inline scale/sign.

## Run tests
```bash
python -m unittest -v
```

## Important limits
- This is a raw-fact extractor, not a seven-metric fundamentals engine.
- It does not yet map NSE taxonomy concepts to Revenue, Profit, ROE, ROCE, Debt/Equity, Interest Coverage or Operating Cash Flow.
- It does not select consolidated versus standalone contexts or revised versus original filings.
- It does not derive quarter-only values from YTD periods or calculate ratios.
- It must be validated against real NSE issuer filings before any production use.
- Do not connect it to app runtime until the official filing pilot and independent source-document checks pass.
