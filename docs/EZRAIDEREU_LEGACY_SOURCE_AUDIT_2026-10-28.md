# EZRaiderEU legacy WordPress — public-source audit (2026-10-28)

Scope: `https://ezraidereu.com/budapest/` and two localized home pages. Read-only HTML audit; no WordPress administrative updates, plugin changes, direct booking client activation, or external payments. Distinct from VOY PRO frontend and FBM runtime.

## Evidence
- WordPress Jetpack site `258220563`, custom PHP theme `ezraider`.
- Localized homepage page IDs: EN `7`, HU `90`, HE `92`.
- WordPress REST lists **21 published tour CPT records** (7 tour families x 3 languages), last modified on October 28, 2026.
- Public homepage HTML includes old `voy.pro.eu@gmail.com` even though the 21 tour detail posts and three Recommendations posts were updated with `Voyprobud@gmail.com`.
- Public sources include some FareHarbor booking links, especially global/footer BOOK NOW. Do not redirect customers to an unapproved or unconnected FBM widget.
- Public `iframe` source included `Budapest, Pilvax köz 1-3, 1052`. Business directory lists `EZRaider Budapest by VOY PRO, Városház u. 14, 1052`; independently verify exact official Google Business Profile, place ID, and **meeting point** before map replacement.
- Blanket eligibility/accessibility statements and an obsolete Lisbon reference remain in some homepage source sections.
- The WPCode #488 frontend snippet installation/version and client-side trust stripe cannot be certified using a raw-HTML crawl; verify real desktop+375px mobile DOM and links in all three languages.
- Jetpack Backup endpoint returned `unavailable/no_site_found` during this audit. A recoverable WordPress files+DB backup remains a release gate for PHP, ACF, WPCode or site-wide setting changes.

## Running checks
```
node scripts/audit-legacy-ezraidereu-public.mjs --self-test
node scripts/audit-legacy-ezraidereu-public.mjs --json
node scripts/audit-legacy-ezraidereu-public.mjs --fixture-dir /path/to/html-snapshots
```
The script only performs three known public GETs. Non-HTML/Cloudflare challenge pages and fetch failures are **inconclusive** (exit 2), rather than falsely considered passing. Detectable high-severity issues return exit 1, otherwise exit 0. CLI output **does not certify rendered DOM**, payment, booking or Google Maps place validity. No cron/CI workflow added.

## Release sequence
1. Confirm tested backup and restore procedure (files+DB), and obtain versioned `templates/template-home.php` plus ACF field groups/current values on EN/HU/HE home pages.
2. Correct source fields for Budapest contact email, outdated region/vehicle claims and child/suitability restrictions. Preserve WordPress admin email separately.
3. Replace incorrect map only with verified **own** business listing and meeting point; do not guess from approximate coordinates.
4. De-duplicate floating WhatsApp while preserving content CTAs; one trusted three-source Google/Tripadvisor/GetYourGuide bar, verified supplier IDs and dated counts.
5. On desktop/mobile EN/HU/HE confirm concise tour cards, full details, link destination, accurate cross-language tour routes, menu and `mailto`, no old FareHarbor entry points only when an approved booking alternative exists.
6. FBM issue #981 owns the canonical `first_party_embed` readiness, mapping and availability/checkout logic. Do not activate before explicit owner approval.

Tracking: `eli1979-ai/Voy-pro-website#589` and `eli1979-ai/Ezraider-os#981`. This is an evidence/QA-only handoff, **not** a website launch approval.