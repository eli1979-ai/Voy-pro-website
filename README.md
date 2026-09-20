# VOY PRO Website

Canonical staging source for the VOY PRO customer-facing website.

Current staged baseline: **v1.33.0** (consolidated from verified v1.32.9).

The deployable website lives in `site/`. The build copies that canonical source to `dist/` and verifies browser JavaScript syntax.

Key Budapest booking capabilities preserved in this baseline:
- live catalog and availability from EZRaider OS / FBM public APIs;
- Buda and Margaret tour selection with resilient fallback UI;
- booking confirmation WhatsApp message with booking reference, tour, date/time, party, guide language, payment method, total and referral attribution;
- payment capabilities loaded from the backend;
- secure Pay now by card flow appears only when online-card payment is really enabled;
- automatic email/WhatsApp confirmations remain backend responsibilities and activate only with configured providers.

Historical patch/build machinery is archived under `legacy/v1.32.9-build-chain/` and must not be used for new feature development.
