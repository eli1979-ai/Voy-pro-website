# Legacy EZRaiderEU root / Lisbon safety — source-only release proposal (2026-10-28)

**Status: Draft HTML artifacts + offline tests. NOT INSTALLED, NOT MERGED, NOT A BOOKING DISABLE.**

This task is independent from the Budapest WordPress site `https://ezraidereu.com/budapest/`, the VOY PRO frontend and the FBM booking system.

## Observed on the public site

- Both `https://ezraidereu.com/` and `https://www.ezraidereu.com/` have an English landing page titled `EZRaider experience with VoyPro. Tours in Budapest, Lisbon, Athén.`, show **Budapest**, **Lisbon** and **VoyproAthén** destination cards, and invite customers to choose a destination and book.
- The visible Budapest card points to `/budapest` and redirects to the active multilingual WordPress site `/budapest/`.
- The Lisbon card points to `/lisbon` and redirects to `/lisbon/`. A current public HTML snapshot from 28 October 2026 shows four **FareHarbor BOOK NOW** anchors for old Lisbon experiences, and obsolete launch prices / old meeting-point text. This is particularly concerning because **Lisbon guided-city operations were discontinued**, but a public FareHarbor anchor **does not establish real-time purchasability or a completed booking**.
- The Athens card points at `https://athen.ezraidereu.com/`, which is not verifiable through the current web fetch, and must not be presented as currently operable on the evidence available.
- `wpcom_user_sites` returns exactly **one** connected Jetpack WordPress site, blog `258220563` with site root **`/budapest`**. No connected root-landing or Lisbon CMS editor, theme-file or hosting read/write tool exists. Do not misapply Budapest WPCode #488 or treat its installed v6.2 as global.

## Artifacts prepared

1. `docs/legacy-wordpress/ezraidereu-root-safe-landing-candidate.html`: a complete self-contained English HTML document for the **root landing only**, with one verified Budapest tour route, a Budapest-specific WhatsApp enquiry link, accessible headings, responsive layout, and conservative conditional rider language. No Lisbon/Athens card, booking checkout, payment, analytics, remotely hosted script, external font, image library or unverified Marvão/Prague destination URL.
2. `docs/legacy-wordpress/ezraidereu-lisbon-no-booking-candidate.html`: a neutral legacy Lisbon landing that says new tour bookings are unavailable *through this website*, does not purport to cancel existing reservations, and directs existing purchasers to their **own booking confirmation provider**. No obsolete prices, fares, meeting pin or live FareHarbor CTA. This message is a **proposal**, pending business approval; it must not be published as if existing customer bookings are cancelled.
3. `scripts/check-legacy-ezraidereu-root-lisbon-candidates.mjs`: no-network, dependency-free static gate. Root whitelist of expected internal and Budapest WhatsApp links; no Lisbon/Athens booking links, no forms/embeds/scripts, no FareHarbor, no accidental standalone booking CTA. Lisbon gate requires a non-bookable notice and an existing-reservation safeguard. Test command: `node scripts/check-legacy-ezraidereu-root-lisbon-candidates.mjs --self-test`. **10 synthetic scenarios PASS** (two valid candidates and eight deliberately unsafe mutations) in isolated local JavaScript execution of the exact committed files.

## Exact deployment ownership / release boundary

**Do not install either HTML document as a second WordPress page or into WPCode #488.** The existing legacy root and Lisbon paths may be a separate PHP theme, static site, or multi-install hosting configuration, and this repo holds only proposed documents, not the live source. Preserve the entire current layout/assets and URL routing on any future implementation.

Before an owner-approved live release:

- Identify actual serving files, CMS, host and responsible team for `/`, `/lisbon/`, `www` and `/budapest/` from hosting, not by guessing from public page appearance. Take a current, **restore-tested** files+DB backup for relevant applications.
- Audit possible existing bookings, obligations to guests, FareHarbor products and current provider access. Safely prevent **new** obsolete Lisbon purchases only after operational/provider confirmation. Replacing visual links alone does not disable direct provider URLs or old marketing URLs elsewhere. Do not cancel any paid booking or modify a refund, provider access, customer record or payment state without separate approval.
- Review exact copy for Lisbon/Athens; choose whether to preserve historic destination page, show a transparent inactive notice, or provide a verified current alternative. This proposal intentionally does not invent a Marvão/Prague booking URL or assert Athens' operational status.
- Check the known-good Budapest URL `/budapest/` and all three locale home/tour pages unaffected by routing changes. Check old root SEO, canonical and index coverage and `www` redirect before changing anything. Lisbon's proposed HTML deliberately contains **no** robots noindex directive; SEO de-indexing needs a separate decision.
- Deploy exact reviewed source with backup/rollback; clear caches; test root and Lisbon on desktop/mobile, keyboard and screen reader basics, and confirm no FareHarbor CTAs in the actual Lisbon rendered DOM. Rollback must not silently reactivate unwanted FareHarbor sales.

## Links and owner workflow

Tracking issue: [#609](https://github.com/eli1979-ai/Voy-pro-website/issues/609). All owner-required actions are explicitly deferred in the existing [#604](https://github.com/eli1979-ai/Voy-pro-website/issues/604) queue so the owner is not interrupted.

Current business truth source is the operating team, not the archived root landing. No production WordPress, DNS, payments, redirects, Vercel, FTP, GitHub main or FareHarbor changes were made in this task. A green GitHub build on a docs-only PR does not certify any live browser or FareHarbor checkout state.

## Independent public-source regression audit

A second, separate script `scripts/audit-legacy-ezraidereu-root-lisbon-public.mjs` is now included to validate the *real source HTML once root/Lisbon are corrected*. It does NOT deploy or change those sites.

Usage:
```sh
node scripts/audit-legacy-ezraidereu-root-lisbon-public.mjs --self-test
node scripts/audit-legacy-ezraidereu-root-lisbon-public.mjs --fixture-dir /path/to/public-html
node scripts/audit-legacy-ezraidereu-root-lisbon-public.mjs
```
For `--fixture-dir`, provide `root.html` and `lisbon.html` obtained from a public **server response**; scripts are stripped before the scan. Without fixtures it sends only two public GET requests, with a 15-second timeout each. It never executes scripts, sends forms or opens FareHarbor checkout. It detects obsolete root destination CTAs, a stale title, actual FareHarbor anchors in Lisbon source, old published prices and missing non-bookable status. It deliberately returns **inconclusive (exit 2)** for Cloudflare challenges, short/skeletal documents, unreadable responses, or missing minimal page structure — never a false clean. Known severe links return **exit 1**. Passing source-only status is **not proof** of browser click behavior or that the FareHarbor provider is disabled.

Isolated local execution of the exact GitHub-fetched JavaScript ran **9/9 self-test assertions successfully**, including root/Lisbon legacy fixtures, challenge/error pages, a single-anchor page, and safe replacements. This source auditor is not currently wired into GitHub Actions and must not be made a fragile production CI gate when Cloudflare blocks anonymous automated GETs. The prior 10 candidate safety tests remain separate.
