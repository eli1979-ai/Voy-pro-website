# EZRaiderEU current WPCode #488 — scoped footer repair from owner-supplied active v6 (2026-10-28)

**Status: prepared, tested offline, NOT INSTALLED.** This is an owner-managed classic WordPress artifact, stored under `docs/legacy-wordpress/` for review only. It is NOT a VOY PRO production site deployment and is NOT an FBM booking integration.

## Exact source verification

Owner-supplied current WPCode #488 text arrived 2026-10-28. SHA-256 of the **complete original UTF-8 file**: `f98c127bfa1f5fc4a9e102c63f3fb52b9aa461d8e0c7c77780346f2d0e42da64`. This is byte-identical to the previously archived standalone v6 source.

The proposed v6.2 candidate in `docs/legacy-wordpress/ezraidereu-wpcode-488-v6-2-footer-only.html` has exactly **one additional CSS footer-only block and one self-contained JS footer-only click handler** inside the **SAME** WPCode #488 HTML snippet. The existing v6 inline JavaScript is byte-identical, SHA-256 `c88645d381f5916fe0bd9e3146dc185134ced2a6776fa79a0c216eb929a6e3ed`. The Node regression checker enforces this exact digest and tests 12 synthetic scenarios.

All of the following original v6 behaviors therefore remain untouched by this phase: single green floating WhatsApp button, dedup of overlapping red float, source-aware FareHarbor-to-WhatsApp link rewriting, clickable tour-detail titles/media, homepage short-copy display, Budapest contact mailto correction, three-provider reviews bar, and the **existing** Google iframe/text meeting-point mutation.

**Known issue intentionally NOT fixed by this footer-only patch:** the current owner's v6 code rewrites the map iframe to an address-based Google search and labels the public business address as “meeting point” without a verified Google Business Profile place ID or independent operations approval. The separate uninstalled v7 candidate removes these mutations but would uncover the original PHP map, which may be stale. Fix the map from authoritative venue/guest meeting-point data separately; don't falsely claim this release makes maps accurate.

## What the footer handler does

- Scopes capture-phase clicks to the classic WordPress footer, and only six whitelisted fragments: `#whyezraider`, `#about`, `#tours`, `#gallery`, `#blog`, `#contact`.
- Allows only HTTPS links to the exact three Budapest locale home paths EN `/budapest/`, HU `/budapest/fooldal/`, HE `/budapest/בית/`. Offsite links, header links, non-footer links, modified clicks, downloads and unknown fragments remain unmodified.
- On the correct homepage: navigate to an existing ID, or a narrow localized exact-heading fallback if no ID is present, update hash, scroll; otherwise leave native behavior.
- On tour/detail pages: navigate to the link's locale homepage section (no false scroll on the current tour page).
- Catches malformed percent encoding and leaves browser-native link handling intact; retains reduced-motion support.
- Adds only a link-specific CSS stacking hint, not global overlay removal. A fully opaque/full-page element overlapping the footer can still prevent a click. Live browser hit-testing is required to distinguish that issue.

## Verification completed

- Local source generation checked exact original-to-archive byte identity.
- All inline scripts pass `node --check`.
- Node: 12 footer synthetic cases PASS; current v6 main runtime byte-for-byte SHA check PASS.
- Isolated desktop/mobile Chromium exercises 41 fixture scenarios with the integrated v6.2 code: 3 locales × 6 footer links × both with and without target IDs, keyboard, cross-page navigation and overlay detection; WhatsApp once, FareHarbor rewrite, contact email, unchanged **v6** map behavior. **41/41 PASS**.
- Browser test uses synthetic PHP-like DOM and fake site location; production network was not touched. This is not proof the footer works on the actual WordPress site.
- Standard GitHub Actions build, launch and site QA to be verified for the PR's exact HEAD. These CI scripts do **not** automatically execute the standalone legacy check, so preserve local Node + Chromium evidence as separate gates.
- No Vercel preview is needed for this docs-only artifact; no WordPress, staging DB, production, domain, plugin, WPCode, theme or checkout settings were changed.

## Release checklist — explicit owner deployment gate

1. Verify a **restorable** backup of both WordPress database and site/theme files. Jetpack Backup on site `258220563` reports unavailable/no_site_found and no included Backup plan. A saved full `.wpress` export may help but must be checked for restore suitability and recentness. Never commit real customer data to this public repository.
2. Confirm the current active WPCode HTML snippet is indeed `#488`, Auto Insert / Site Wide Footer, and unchanged since the owner supplied this code. Save its full original exact content locally.
3. After owner release approval, replace the **existing** snippet #488 code with the complete v6.2 HTML. Never create or activate a second snippet and never append the same footer JS twice.
4. Clear any frontend/cache/CDN layers; verify incognito desktop and mobile 375px for 6 footer links × 3 locales on both homepage and tour-detail page. Check keyboard, header navigation, short home cards, full tour content, 1 green WhatsApp, no red overlap, source-aware Whatsapp enquiry, public email, GYG/Tripadvisor/Google reviews, and map identity (known separate risk).
5. If overlay hit-test shows another element covers links, revert the attempted change and patch the PHP/theme overlay rather than global `z-index` shortcuts. If regression, restore original v6 full code into same #488 and clear cache.
6. Defer risk-corrected homepage ACF copy (#596) and exact Google Maps marker fix to their own source-verified WP tasks. FBM direct booking issue `eli1979-ai/Ezraider-os#981` is not activated by this patch.

PRs #594 (generic footer candidate) and #598 (map fail-closed) are source-only design predecessors: **do not install them concurrently**, and do not merge this artifact into the newer VOY PRO site runtime.