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

## 28 October 2026 — integrated v7 candidate prepared after v6.2 was installed by owner

**Owner report:** WPCode #488 **v6.2 is installed**. The earlier v6.1 source-only candidate did not contain v6.2's final live-footer navigation fallback and therefore MUST NOT be used as an installation replacement. It remains archival documentation.

**New single-snippet future candidate:** `docs/legacy-wordpress/ezraidereu-wpcode-488-v7-integrated-map-hold.html` is based on the exact owner-supplied v6.2 replacement file, **not** the standalone archived v6.1. It:
- Retains the entire second `<script>` (footer click interception) **byte-for-byte**, SHA-256 `fc2c9e2d6ce17f13c27ffbd9abf094e2e68153b01ecdc3af1bd6f8b47b810080`.
- Preserves the exact runtime implementation of `function rewrite()`, `function correctBudapestEmail()`, and `function repairTourNavigation()` from the owner-installed v6.2 candidate, including WhatsApp / source attribution, mail correction and clickable tour cards.
- Removes only v6.2's unverified `google.com/maps?q=` iframe reassignment, visible Pilvax address substitution and unsupported new “meeting point” card insertion, plus comments explaining the change. It does **not** create a verified new embed or change any server-side address.
- Still includes the candidate three-provider trust links. The Google Maps shortlink supplied by the owner is retained for an external profile link, but it has not been independently resolved to an official Place ID from the available public data.

**Focused validation:** Local exact-file diff and JavaScript `node --check` on both inline scripts PASS; SHA-256 check confirms the footer script unchanged; three other business functions byte-for-byte unchanged; no guessed iframe or meeting-point DOM injection remains. Added `scripts/check-legacy-ezraidereu-wpcode-v7-integrated.mjs` with the known 12 synthetic footer scenarios plus the map/invariance safeguards. The standalone test is not wired into the standard VOY PRO website build; exact GitHub CI to be verified after final commit.

**Critical restriction:** This candidate is NOT a map fix, and it must **NOT be installed in Production** merely because it eliminates an incorrect guess. With v6.2's map override removed, the legacy PHP/ACF template's existing iframe may resurface and lead to an old or incorrect location, potentially affecting guests. Wait until both the exact owner-approved guest entrance/location and a correct official Google embed can be included and visually reviewed, with a restorable up-to-date site backup. A Draft PR merge in the VOY PRO website repository would not deploy it to legacy WordPress anyway.

The only owner actions are deferred in [#604](https://github.com/eli1979-ai/Voy-pro-website/issues/604). Do not interrupt the owner for this optional source candidate now.

## 29 October — authoritative parcel evidence reconciles the two streets

New **official legal address evidence** reduces the previous ambiguity:

- [Hungarian National Legislation Database — District V ordinance 5/2020](https://njt.jog.gov.hu/jogszabaly/2020-5-SP-5Y254.3), entry `VH487`: parcel/cadastral number **24285**, `Városház utca 12-14. = Pilvax köz 4.`. The equals sign indicates two address expressions for the **same registered property**.
- [Hungarian National Legislation Database — District V ordinance 14/2008](https://njt.jog.gov.hu/jogszabaly/2008-14-SP-5Y254), entry `209`: **24285**, `Városház utca 12-14. = Pilvax köz 4.`. Independent historical legal corroboration.
- [District V local ordinance register 6/2020](https://or.njt.hu/onkormanyzati-rendelet/2020-6-SP-254), row `550`: **24285**, `Városház utca 14, Pilvax köz 4`. This is the exact Budapest business-directory street number.
- Public [business listing](https://www.top-rated.online/cities/Budapest/place/p/13373076/EZRaider%2BBudapest%2Bby%2BVoy%2BPRO) identifies **EZRaider Budapest by VOY PRO** at `Városház u. 14` and +36 30 099 3099. A different nearby building/hotel at `Pilvax köz 1-3` **must not be used** as the tour guest meeting point.

**Conclusion, carefully scoped:** The `Városház utca 14` and `Pilvax köz 4` address strings are not inherently conflicting: official legal sources tie them to the **same cadastral property #24285**. This significantly reduces uncertainty about the correct *building*. However, a building can have multiple entrances. No source above identifies the actual tour entrance door, the Google Business Profile Place ID or the precise coordinates of the correct map pin. Therefore **the final pin and iframe embed remain unverified**.

**Future implementation rule:** retain the previously owner-supplied official Google Business Profile shortlink `https://maps.app.goo.gl/F4DHtcpbWZrVjpqz5?g_st=ac` as the safe link to the business listing when such a link is needed, without inventing Place IDs or appending unverified coordinates. Do not geocode `Városház utca 14`, `Pilvax köz 4` or the nearby `Pilvax köz 1-3` as a substitute for a genuinely verified exact guest entrance. Do not install the separate v7 map-hold snippet into live WordPress while its legacy PHP iframe still has unknown coordinates.

**Owner action impact:** The owner does **not** need to supply the business Maps profile link again, nor choose which street address belongs to the same registered property. Only the **entrance/pin confirmation** and usual restore/release gates remain deferred under issue #604.
