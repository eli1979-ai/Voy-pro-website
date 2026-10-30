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
## October 28 follow-up: audit hardening and deferred owner actions

The owner has requested that **all actions requiring them be deferred** while independent development continues. The consolidated later-action checklist is [issue #604](https://github.com/eli1979-ai/Voy-pro-website/issues/604). Do not ask again for the already supplied #488 v6 source, the already installed v6.2, or the already supplied Google business Maps link. Live ACF edits, PHP theme source access, backup restore verification and exact meeting-pin confirmation remain blocked pending that queue.

The source auditor now fails closed on an apparent `200 OK` HTML document if it is short, skeletal, lacks `<body>`/home navigation, does not identify Budapest, or is a Cloudflare challenge. This avoids the earlier false-green outcome for `<html><p>Hello</p></html>`. A short or blocked response has `status: inconclusive`, and the CLI exits with code `2`; it **does not** signify clean production pages.

The extractor now checks actual `<a href>`, `<iframe src>`, and external `<script src>` attributes for FareHarbor. It deliberately does **not** treat the word `fareharbor.com` inside harmless inline JavaScript (e.g. the already installed WPCode v6.2 CTA converter) as proof of a checkout link. Likewise, a reference to Pilvax **inside** a JS text-replacement function alone is not proof of the currently rendered map location. A true original server-side footer `BOOK NOW` anchor to FareHarbor still triggers the issue. None of these source checks certify how a browser's WPCode JS transforms the DOM.

Added coverage for `maps.app.goo.gl` as a possible Google profile evidence URL; this detects existence of a source link, **not identity or pin correctness**. The three-platform trust bar remains marked for manual DOM verification when links are dynamically injected.

The new `--self-test` has eight cases (expanded from four): a fully populated dirty homepage, a Hebrew route claim, a Cloudflare challenge, a skeletal HTML response, inline JS false positives, a real external FareHarbor anchor, a long but unstructured response, and an unexpected different-city page. The updated code was evaluated in an isolated JS harness against the exact GitHub-fetched source; all eight tests passed. Standard website GitHub Actions validation will be checked against the final draft PR SHA; the standalone source auditor remains a separate test unless a future authorized CI integration is approved.

**Do not auto-fix:** Checkout/booking links, home ACF fields, PHP menu or iframe URLs. These require source ownership, live-browser verification and/or approved release gates. This PR remains a read-only audit of the **old WordPress site**, not part of the new VOY PRO customer frontend.
