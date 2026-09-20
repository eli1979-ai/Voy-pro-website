# VOY PRO Website

Canonical staging source for the VOY PRO customer-facing website.

Current staged baseline: **v1.42.0** (site-wide QA hardening on the custom-domain baseline).

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

v1.39.0 removes the Portugal booking handoff to the local partner. Marvão requests now stay with VOY PRO, preselect the chosen route, carry date/group/language context into VOY PRO WhatsApp, and keep Pombais visible only as the local operator. Until FBM has a dedicated Marvão public booking client, Portugal pages deliberately do not write sessions or marketing events through the Budapest client.

v1.40.0 makes the shared browser runtime destination-aware. Budapest continues using its existing public booking client; Portugal/Marvão has destination id `portugal-marvao` but makes no FBM session or marketing calls until a dedicated destination client key is configured. This prevents Portugal CTA clicks from creating Budapest sessions and prepares the website for a future Marvão public client without another frontend architecture change.

v1.41.0 verifies the Budapest public booking API from the new custom domain `https://voy-pro.com` as well as the Vercel staging origin. The custom domain is live, but search-engine indexing remains intentionally blocked until the FBM production-environment decision is finalized.

v1.42.0 adds a permanent site-wide static QA gate covering all public sitemap URLs, internal links/fragments, canonical and hreflang integrity, metadata, H1s, duplicate IDs, image alt attributes, RTL, safe external links and destination isolation. It also replaces hash-only WhatsApp fallbacks for special requests and improves form label/control associations for accessibility.
