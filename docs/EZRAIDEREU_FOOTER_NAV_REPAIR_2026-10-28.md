# EZRaiderEU legacy WordPress — footer navigation remediation (2026-10-28)

## Scope and verified observations

Site: `https://ezraidereu.com/budapest/`, WordPress Jetpack ID `258220563`, classic PHP theme `ezraider`.

The owner reports the footer navigation bar is not working. The read-only classic WordPress menus inspection finds **18 footer links** already point to absolute same-language homepage URLs with the six valid-intent fragments `#whyezraider`, `#about`, `#tours`, `#gallery`, `#blog`, `#contact`:

- Footer EN menu `16`, item IDs `124–129`, assigned at theme location `menu-2`.
- Footer HU menu `17`, item IDs `130–135`, managed as locale translation.
- Footer HE menu `18`, item IDs `136–141`, managed as locale translation.
- Header menus `2`, `14`, `15` share these destinations. Do not update header links or change existing menu positions just to work around a footer defect.

**Key distinction:** Menu URL values are correct; it is *not* proven that each PHP-generated target element has its fragment ID or that the live footer receives pointer/click events. The connected WordPress REST content surface does not expose the bespoke `templates/template-home.php` or ACF-generated HTML, nor does the available cloud crawler execute the page's real frontend scripts. Do not assert the root cause as proven from menu records alone.

## Prepared fallback

`docs/legacy-wordpress/ezraidereu-footer-nav-patch-v1.html` is an *append-only* HTML/CSS/JS block for the existing **owner-managed WPCode HTML snippet #488**. It does not create any additional snippet and does not run in VOY PRO or FBM.

- Only intercepts unmodified primary-clicks on **footer** links whose exact HTTPS host is `ezraidereu.com`/`www.ezraidereu.com`, whose destination is one of the three known Budapest home paths, and whose hash is one of the six legacy section keys. It does not intercept tours, booking, WhatsApp, language switcher, or header navigation.
- For same-page targets, scrolls to the existing matching ID; for an absent ID, may fall back to an **exact** localized heading label, then updates the URL hash without reloading. If neither exists, it marks the link unresolved and leaves native click behavior unchanged.
- For cross-page targets, navigates to the explicit existing locale homepage URL. Ctrl/Meta/Shift/Alt clicks and `target=_blank` remain native.
- Adds link-specific pointer/stacking CSS only; does not blanket-change the footer z-index, theme animations, or overlay event capture.

## Validation

- `node --check` on the extracted inline JS: PASS.
- `node scripts/check-legacy-ezraidereu-footer-nav.mjs`: PASS, twelve synthetic cases (eight original plus Hebrew encoded-path, Hungarian heading fallback, HTTP rejection, and malformed-fragment rejection) for direct ID, heading fallback, inner-page translation navigation, header noninterference, modified click, external URL, unsupported hash and missing target.
- GitHub Actions `npm run build`, `npm run verify:launch`, and `npm run qa:site` to be verified against exact draft PR head.
- **No** live frontend DOM or pointer hit testing was possible. These tests do not establish that the overlay/click root cause is fixed on production.

## Release boundary and rollback

1. Obtain and test a restorable backup of the WordPress site files and database. Jetpack Backup presently reports `unavailable/no_site_found`; this does not prove no host backup exists.
2. Obtain a copy of the complete current active WPCode snippet `#488`, preserve it as versioned rollback evidence, and confirm the actual footer HTML and target IDs in a browser inspector.
3. If the footer still fails due to missing anchor IDs or theme click interception, append this single block **to the existing snippet only**. Do not install a second snippet or indiscriminately replace existing v5/v6 logic.
4. Validate all six footer links on EN/HU/HE homepages, a tour-detail page in each locale, desktop and 375px mobile; test keyboard activation, no scroll jumps to wrong sections, newsletter widget, menu language switch, floating WhatsApp, and booking enquiry links. Verify both default and logged-out/incognito views, clear cache if needed.
5. If any regression, restore the previous full version of snippet `#488` and clear cache. If the defect is a click-blocking overlay, repair it in the actual PHP/CSS theme after obtaining the source instead of adding more global JS.
6. Keep `Ezraider-os#981` first-party FBM booking launch gate separate; none of this permits payment/booking activation.

This is an **installation-ready proposal only**, not a production fix. Do not merge the source-only PR or publish a WPCode change without following the site release approval and visual QA process.
## Further verification — 28 October (separate autonomous pass)

An additional **read-only DOM probe** is staged at `docs/legacy-wordpress/ezraidereu-footer-dom-probe.js`. In the live browser console while scrolled to the footer, it audits **only** the six exact on-page fragment names, permitted hosts and three locale homepage paths. It returns rows with current href, same-page versus cross-page status, matching `id`, exact heading fallback, CSS visibility and pointer-event state, bounding dimensions and the actual `elementFromPoint` at the link center. It DOES NOT modify the page, send any request or install anything. It is a diagnostic, not a fix or a click automation. An `offscreen` hit-test means the footer was outside the viewport. Even `link-receives-hit` does not rule out a JS click handler suppressing navigation.

Public page text independently confirms all three locale footers include their six navigation links and also carry a legacy `BOOK NOW` FareHarbor link. Crawled text is not a live JavaScript browser; it cannot say whether a WPCode conversion is installed and running. **Do not equate a raw FareHarbor source link with a functioning checkout or active link post-JS.** The archived proposed WPCode v6 *already includes* a general FareHarbor-to-source-aware-WhatsApp rewrite; before applying any new footer booking fix, inspect snippet #488 to avoid duplicate or conflicting logic.

Read-only WP REST content re-audit in the same pass: all **21/21** published tour CPT posts, seven each in EN/HU/HE, contain exactly one WhatsApp URL and a `Voyprobud@gmail.com` reference, with **zero** `fareharbor` occurrences in their stored content. This applies to individual tour post content, **not** the legacy PHP template/footer.

**Diagnostic code parsing:** standalone DOM probe syntax checked in a JavaScript parser (PASS). GitHub Actions on the new exact PR head must be inspected separately; successful website build does not automatically run the standalone browser probe or the separate synthetic tests.

**No site mutation:** No WordPress menu, theme, ACF, widget, WPCode, booking, DNS or production change was made in this pass. Draft PR stays unmerged.

The 28 October follow-up revision of the draft patch explicitly catches malformed percent-encoding in URL fragments and leaves native browser behavior unchanged. Twelve synthetic cases were re-run locally with Node and passed; the browser probe remains unexecuted in production.
