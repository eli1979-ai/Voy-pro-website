# VOY PRO Website

Canonical staging source for the VOY PRO customer-facing website.

Current staged baseline: **v1.47.2** (v1.47.1 baseline + locally hosted Budapest photography across EN/HE/HU).

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

v1.43.0 restores the EN/HU/HE or destination-appropriate language picker to the mobile header while keeping the same language options inside the mobile menu as a fallback. The header picker uses compact mobile sizing and CI now treats hiding it again as a regression.

v1.44.0 separates tour discovery from booking intent on the Budapest homepages. The tour card/title now opens the full tour description, while a distinct availability button selects that tour and moves into booking when live. No-JavaScript fallbacks send Buda/Margaret/private availability buttons to the matching tour booking section, and Hungarian cards now link to their real tour pages instead of only the homepage booking anchor.


v1.45.0 adds a site-wide Branches and Legal footer, showing Budapest, Portugal · Marvão and Prague (Coming soon); publishes localized EN/HU/HE/PT Terms, Privacy, Cookie/Storage, Legal Notice and Accessibility pages; exposes persistent cookie-preference controls; and hardens the binding checkout with explicit Terms acceptance plus a payment-obligation submit label. Partner-destination and capacity requests remain non-binding until confirmed.

v1.45.1 completes the localized legal-center footer rollout so EN/HU/HE/PT legal pages carry the same Branches/Locations navigation (Budapest, Portugal · Marvão, Prague Coming soon) as the rest of the site. It preserves the v1.45.0 binding checkout payment-obligation hotfix and does not move any FBM business logic into the website.

v1.45.2 standardizes the Branches/Locations column site-wide to country-first naming: Hungary, Budapest; Portugal, Marvão; Czechia, Prague, with localized equivalents in Hebrew, Hungarian and Portuguese. Prague remains marked Coming soon.

v1.46.0 hardens the post-booking customer journey: Manage Booking links use a refresh-safe URL fragment for the secure token, legacy query-token links migrate to the fragment on load, Manage Booking WhatsApp support includes booking context, HE/HU footers are localized, contact/date controls are accessibility-hardened, cookie preferences work on the Manage page, and the cancellation control is wired to the existing FBM manage-cancellation contract while preserving contact fallback when automated cancellation is unavailable.

v1.47.0 hardens the active booking funnel: standard checkout advances to Step 3 only after quote + hold creation, mobile CTA follows the active step, checkout submissions are duplicate-guarded and reuse a stable idempotency key across retries, Stripe-cancel returns show a clear recovery message, and Marvão HE/PT copy is aligned with the VOY PRO request-first flow instead of implying a direct partner booking handoff.
\nv1.47.1 adds a local Marvão photo gallery across English, Hebrew and Portuguese using four locally hosted Pombais-supplied images, with responsive layout, lazy loading, descriptive alt text and no runtime hotlink dependency on Pombais media.\n
v1.47.2 removes the Budapest photography runtime dependency on `ezraidereu.com`: Budapest hero, gallery, social-sharing and tour schema image references now use locally hosted VOY PRO assets across English, Hebrew and Hungarian pages. CI rejects any Budapest HTML that reintroduces an EZRaiderEU media dependency and verifies the local image set is present.\n