# EZRaiderEU WordPress v6.2 — owner-installed release checkpoint (28 October 2026)

## Owner statement and verification boundary
On 28 October 2026 the owner reported **“6.2 הותקן”** (v6.2 installed) at the legacy Budapest WordPress website (Jetpack site ID 258220563). Treat installation as **owner-reported**, not independently observed in live rendered DOM. The public EN URL returned a Cloudflare verification challenge to web fetch; public HU and HE snapshots available from a crawler are stale and show original HTML, not necessarily post-JavaScript links. The WordPress REST connector does not expose current WPCode snippet contents or browser event listeners. Never claim end-to-end success based on a prior offline fixture.

## WordPress read-only post-release checks
- Confirmed active theme `ezraider`, classic non-block PHP. The three home pages are rendered from `templates/template-home.php` / ACF, not REST-editable page blocks.
- Classic menus still exist: EN footer #16 assigned to location `menu-2`; HU #17 and HE #18 exist as language menus (not explicitly assigned to the one global theme location), with six whitelisted section fragment URLs each based on the last full readback. Do not overwrite language assignments just because only one menu is in the global location.
- WPCode Lite active (version 2.4.0) and FareHarbor for WordPress **also remains active** (version 3.6.15). WPCode v6.2 rewrites legacy FareHarbor anchors to WhatsApp on the client side, but this does **not** prove that FareHarbor plugin JavaScript is inactive nor authorize disabling it before PHP/theme dependency analysis.
- The Jetpack site has **no active Backup product** (`backup.storage_status.backup_available=false`), and rewind is unavailable/no_site_found. An independently held `.wpress` archive exists from 26 October but is not restoration-tested and is older than 28 October content updates. Refresh/test a full-site backup independently. Avoid modifying active theme/plugins.

## Read-only browser diagnostic
Source: `docs/legacy-wordpress/ezraidereu-v6-2-live-footer-probe.js`.
Run while viewing the actual footer. The output reports allowed locale link destinations, whether the current page has matching target IDs, simple center-point hit test for obstructing layers, presence of green WhatsApp marker and converted FareHarbor link count. It **does not** click any links, edit the page, perform network requests, inspect cookies or user data, or prove that clicking works. If a footer is below the viewport, the hit test prints `offscreen`; scroll to the footer and run again.

The probe was separately exercised in a local headless Chromium fixture for EN/HU/HE, inner-page cross-navigation, and an intentional opaque overlay; **24/24 synthetic assertions passed**. It was **not executed against production** due to Cloudflare/browser access. Existing v6.2 code checks remain 12 Node synthetic cases + 41 integrated offline Chromium scenarios, and prior PR #601 CI green. No new Vercel Preview.

## Release follow-ups / safety
1. Obtain confirmation from an actual user browser that **all 6 footer links work** on the EN/HU/HE home pages and on at least one tour-detail page (desktop and narrow mobile). If they do not, record one affected URL and link label, run the above probe in the browser (only if helpful), and fix the actual target/overlay issue. Avoid a second WPCode snippet.
2. Preserve the owner's exact original v6 as rollback, and mark v6.2 as a WordPress-only **owner deployment**. The file in this repository is **not** run by the VOY PRO frontend, and a draft PR merge alone would never publish it to WordPress.
3. Do not combine v6.2 with archived generic #594, which is superseded for installation. Do not change the map here: owner-installed v6.2 retains the previously identified unverified search-based map marker and business-address meeting-point label. Those need separate verified business/meeting-point source and release.
4. The safe multilingual copy draft #596 is still **unpublished** because actual ACF field keys and source `templates/template-home.php` remain unavailable. No direct FBM booking, OTA, permissions, payments or live provider changes.
5. No Production or GitHub main merge was performed in this review.
