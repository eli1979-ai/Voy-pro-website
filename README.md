# VOY PRO Website

Canonical staging source for the VOY PRO customer-facing website.

Current staged baseline: **v1.38.0** (parallel-site launch strategy on the launch-readiness baseline).

The deployable website lives in `site/`. The build copies that canonical source to `dist/` and verifies browser JavaScript syntax.

Key Budapest booking capabilities preserved in this baseline:
- live catalog and availability from EZRaider OS / FBM public APIs;
- Buda and Margaret tour selection with resilient fallback UI;
- booking confirmation WhatsApp message with booking reference, tour, date/time, party, guide language, payment method, total and referral attribution;
- payment capabilities loaded from the backend;
- secure Pay now by card flow appears only when online-card payment is really enabled;
- automatic email/WhatsApp confirmations remain backend responsibilities and activate only with configured providers.

Historical patch/build machinery is archived under `legacy/v1.32.9-build-chain/` and must not be used for new feature development.

Mobile funnel hardening in v1.33.1 keeps language selection inside the mobile menu, prevents the consent banner from colliding with fixed CTAs, and shows approved Budapest fallback prices before live FBM pricing hydrates.

v1.34.0 shortens the path from hero to booking, places route choice before the photo gallery, defaults guide language from the selected site locale when available, and compacts group composition inputs without changing live booking rules.

v1.35.0 adds multilingual TouristTrip + Offer + itinerary structured data to Buda, Margaret and Extended tour pages, fixes breadcrumb hierarchy, and adds large social-sharing images. FAQ content remains visible to users but no FAQPage markup is emitted because Google retired FAQ rich results in 2026.

v1.36.0 connects the Budapest planning/intent pages to the most relevant tour pages and their own local booking forms, adds a multilingual intent hub to the Budapest homepage, fixes intent-page breadcrumb hierarchy, and records accurate sitemap lastmod dates for pages changed in the September 20 release sequence.

v1.37.0 adds automated launch-readiness validation, production robots and redirect-migration plans, makes the root redirect permanent, and fixes the multilingual where-to-stay booking/breadcrumb metadata. Staging remains blocked from indexing until the final domain cutover.

v1.38.0 changes the launch strategy from domain migration to parallel operation: the existing EZRaiderEU Budapest site remains live on its current domain while VOY PRO launches independently on voy-pro.com. No legacy redirects or Search Console Change of Address are part of the initial launch. A future migration map is retained only as reference.
