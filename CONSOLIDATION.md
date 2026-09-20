# VOY PRO website consolidation

v1.33.0 is a source consolidation of the verified v1.32.9 staging output.

## What changed
- The generated v1.32.9 website is now committed directly under `site/`.
- Normal builds copy `site/` to `dist/` and syntax-check the browser JavaScript.
- The old base64/tar + sequential override pipeline is retained under `legacy/v1.32.9-build-chain/` for audit/history only.
- No customer-facing behavior is intentionally changed by this consolidation.

## Development rule
New website work must edit the canonical files under `site/` (or introduce a proper source module structure later). Do not add another sequential patch chain.

## FBM boundary
FBM/EZRaider OS remains the source of truth for catalog, pricing, availability, bookings, payment capabilities and booking/payment state. The website is the customer-facing client of those public contracts.
