# Legacy EZRaiderEU WordPress WPCode v6.1 — fail-closed map safety (28 October 2026)

**STATUS: SOURCE-ONLY / UNINSTALLED / HOLD.** WordPress site 258220563; owner-managed site-wide footer WPCode snippet #488. This is NOT a separate new snippet, not a live WordPress modification, not a deployable VOY PRO website asset, and not a replacement for fetching the CURRENT #488 body first.

## Issue discovered during source audit

The archived v6 snippet includes three unsafe location operations that do not follow the required source-of-truth gate:
1. Rewrite of the existing Google Maps iframe to a textual search query for an address, `google.com/maps?q=...&output=embed`. That does not preserve a verified Google Business Profile place ID or guarantee an exact marker.
2. Replace `Pilvax köz 1–3` with `Városház utca 14` anywhere visible in homepage body text, without confirming whether it denotes an old guest meeting point, site contact address, or unrelated context.
3. Insert a new card titled "Our Budapest meeting point" with the business-address text as though it were independently approved operating instructions.

Public business-listing sources corroborate a **business address** at Városház u. 14. They do **not** independently prove the **departure meeting point**. The historic Google Maps shortlink `https://maps.app.goo.gl/F4DHtcpbWZrVjpqz5?g_st=ac` could not be programmatically resolved to its actual profile/place ID in this environment. Do not conflate those facts.

## What the v6.1 candidate does

- Preserves the previously prepared v6 WhatsApp, single-green-float, tour title and image navigation, three-platform review-panel proposal, GetYourGuide supplier identity and Budapest email-replacement logic for later review.
- **Removes only** the automatic iframe mutation, speculative Pilvax replacement, and new meeting-point card insertion. The existing iframe is left untouched until a verified first-party place ID and operations-confirmed meeting-point instruction are available. This deliberately DOES NOT repair the existing possibly incorrect map.
- Retains the historic Google shortlink inside the proposed review bar solely as a **candidate requiring independent identity verification before any publish**. Do not treat the unchanged link as verified.
- Does not add footer navigation interception. The independent draft [#594](https://github.com/eli1979-ai/Voy-pro-website/pull/594) handles that concern; consolidate only after inspecting current production WPCode #488 and diagnosing rendered footer DOM. Do NOT install two competing snippets.
- Does not alter FareHarbor or booking server state. Any UI-level CTA rewrite remains a proposed script, not proof checkout was changed in production.

## Tests and review gates

- `node --check` on extracted inline JavaScript: PASS locally.
- `node scripts/check-legacy-ezraidereu-wpcode-map-safety.mjs`: 10 source-level assertions PASS locally.
- GitHub website Build/Launch/QA checks are separate; they **do not** automatically execute this new standalone test.
- Still required before using this as WPCode #488 content: current exact snippet full export, server files+DB restorable backup, compare-diff with active snippet, consent from owner for public source change, desktop/mobile EN/HE/HU browser QA, correct Google profile/place ID and confirmed guest meeting point, one WhatsApp widget, correct tour-card semantics, and trust-source identity checks.
- Rollback: restore exact saved prior #488 content in the SAME snippet; never create a second snippet.

Original v6 was a prepared but not verified-installed document in the Library. v6.1 here is simply a safer candidate; not a deployment or confirmation of live behaviour.
