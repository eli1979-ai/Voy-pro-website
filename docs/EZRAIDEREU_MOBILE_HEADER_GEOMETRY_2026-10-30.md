# EZRaiderEU Budapest — mobile logo/title overlap measurement gate

Status: **source-only diagnostic, no live WordPress fix**. Locale-coverage gate now requires both Buda and Citadella tour pages in EN/HU/HE at mobile widths, Hebrew RTL computed direction, and fails closed on malformed tour paths. Browser-selected elements must be visually verified before accepting any coordinates. Work owner: [Issue #723](https://github.com/eli1979-ai/Voy-pro-website/issues/723). The user supplied Android screenshots of the logo overlapping the start of the H1 for Buda Castle and Citadella. Do not upload those screenshots or WP-admin credentials to this public repository.

## Actual ownership and boundary

- The old live `https://ezraidereu.com/budapest/` site uses a **classic PHP WordPress theme `ezraider`**, not the VOY PRO static-site components.
- The connected WordPress API can read content and theme identity, but **does not expose the classic theme PHP/CSS, Customizer Additional CSS, or live DOM computed styles**.
- Work's prior authenticated source inspection [#685](https://github.com/eli1979-ai/Voy-pro-website/issues/685#issuecomment-6518143822) accessed `header.php`, `single.php` and the WordPress admin, but did not report the H1/logo layout geometry. Do not guess the final CSS selectors or publish a general `h1` margin.
- Never mutate WPCode #488, global Header & Footer, booking links, translation menus, themes or Production to solve this geometry bug. Backup restore/isolated staging remains blocked under [#604](https://github.com/eli1979-ai/Voy-pro-website/issues/604).

## Read-only Work browser procedure

1. Visit `https://ezraidereu.com/budapest/tours/buda-castle-tour/` and `https://ezraidereu.com/budapest/tours/citadella-tour/` plus their HU and HE equivalents. Use responsive viewport **320, 375, 390, 414, 768, and 1366 CSS px** where the browser supports it. If Work cannot resize, mark unavailable; do not invent results.
2. Inspect the real theme `header.php`, `single.php`, CSS/media queries and Additional CSS **without saving** to determine whether header/logo is positioned absolute/sticky and whether heading/hero clearance is insufficient.
3. In a browser DevTools Console **only if authorized and supported**, run the snippet below on a public tour page. It only reads rectangles and prints minimal layout numbers; it does not write the site, send requests, click links, collect cookies or inspect private admin data. Verify the selected elements visually — a wrong logo or H1 is invalid data.
4. Collect each readback privately in `{ "measurements": [ ... ] }` (no customer data). Run `node scripts/check-legacy-ezraidereu-mobile-header-geometry.mjs --input /private/measurements.json` and `--self-test`. A `pass` is **geometry only**, never publish authorization; `fail` means actual overlap/overflow, `inconclusive` includes missing elements/locale/viewport evidence.
5. Preview the *smallest CSS-only fix* in the browser locally or on an isolated restored WordPress target, scoped to tour-detail page and mobile viewport. Preserve visible logo, touchable hamburger, normal H1 flow and HE RTL; check both page titles and all tour language variants. Require a **verified restore checkpoint and a specifically authorized WordPress release** before saving the live CSS.

## Work #723 — verified source and exact **preview-only** CSS candidate

[Authenticated Work browser/source report](https://github.com/eli1979-ai/Voy-pro-website/issues/723#issuecomment-6527718677) confirmed that `single.php` emits `.page-top.page-top--home > .page-header` ahead of `main.page-content.page-content--subpage`, that `header.php` loads `css/style.css?v=732`, and that the active mobile CSS uses `.page-top { position:absolute; top:30px; height:80px }` with inadequate tour-title clearance. **The root theme `style.css` is metadata, not the active stylesheet**. The verified hamburger selector is `.menu-btn`, so the read-only console snippet below checks it explicitly.

Work tested **this precise CSS in WordPress Customizer Preview only**, then canceled without publishing:

```css
@media (max-width: 667px) {
  body.single-tours .page-top.page-top--home {
    position: relative;
    top: auto;
    height: auto;
  }
  body.single-tours .page-content--subpage {
    padding-block-start: 16px;
  }
}
```

At `320×480` on Citadella HU, Work measured real pre-change logo/H1 bounding-box overlap **55×19.719 CSS px**, and after preview **0 overlap**; logo bottom `69.719`, H1 top `126` (56.281px apart). Source-only proposed CSS avoids `z-index` hiding or global `h1` offsets and has **not been installed**. Work also verified Buda EN/HU/HE at 320px (including RTL and opening mobile menu), Citadella HE/HU at 320px, and Citadella EN at 720px; **Citadella EN 320px and exact 375/390/414/768/1366 widths remain unverified**. Other 15 tours were not tested.

The existing `.wpress` backup has **not** been restore-tested in an independently isolated environment; Customizer Preview **is not staging**. No live CSS publication, WPCode changes, provider changes or booking cutover is authorized by this evidence. This candidate is to be validated after the gated [recovery work #604](https://github.com/eli1979-ai/Voy-pro-website/issues/604); then require explicit release approval and rollback instructions. The new geometry checker has stronger six-locale-family/RTL evidence requirements than Work's prior browser session, so **no checker `pass` on actual Work data is claimed**.

## Versioned preview CSS package and rollback requirements

[The exact scoped CSS candidate](legacy-wordpress/ezraidereu-mobile-header-preview-candidate-20261030.css) contains only the **two mobile-only tour selectors** that Work preview-tested; it is an additive source-only review artifact, NOT injected into a site. The candidate matches the CSS code block above. The regression checker now includes real Work [Citadella HU geometry measurements](https://github.com/eli1979-ai/Voy-pro-website/issues/723#issuecomment-6527718677): 55×19.719px logo/H1 intersection before the change and zero in Preview, with 56.281px resulting vertical clearance. These are historical preview measurements and do not certify the current live CSS, all routes or full live viewport coverage.

**Non-negotiable release plan (not executable from this draft):** (1) locate actual Budapest WordPress hosting and prove an independently restored, isolated backup with separate DB/files, outbound safety and a private URL; ensure backup postdates latest Hungarian edits. (2) Record current Additional CSS in a *private* rollback checkpoint; ensure no unrelated edits need preservation. (3) Test this **exact** candidate on isolated Staging at 320/375/390/414/667/768/1366px, both reference tours in EN/HU/HE, representative other tours and long Hebrew titles; check menu, icon, scrolling, RTL and WhatsApp without sending messages. (4) Obtain a *specific* owner-approved WordPress release, then publish only these CSS rules in Customizer and verify real public Android Chrome behavior after caching. (5) For rollback, remove only these two added tour-specific rules or restore the **exact previous Additional CSS** while preserving any concurrent CSS edits; do not roll back WordPress database or overwrite unrelated settings.

**Blocked:** Restore target/host proof and scoped owner release approval remain absent under [#604](https://github.com/eli1979-ai/Voy-pro-website/issues/604). Work's Customizer Preview was explicitly canceled and was NOT staging or live publication. No new Work session dispatched by this file.

## Browser console read-only measurement

```js
(() => {
  // Actual classic theme selector identified by Work #723; fall back for older templates.
  const header = document.querySelector('body.single-tours .page-top.page-top--home, #masthead, header.site-header, .site-header, header');
  const logo = header?.querySelector('.custom-logo, .custom-logo-link img, .site-branding img, .logo img, img');
  const title = document.querySelector('main h1, article h1, h1.entry-title, h1');
  const menu = header?.querySelector('.menu-btn, .menu-toggle, .hamburger, button[aria-expanded], button[aria-controls], .nav-toggle')
    || document.querySelector('body.single-tours .menu-btn');
  const rect = el => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {x:r.x,y:r.y,width:r.width,height:r.height};
  };
  const htmlLang = (document.documentElement.lang || '').toLowerCase();
  const locale = htmlLang.startsWith('he') ? 'he' :
    htmlLang.startsWith('hu') ? 'hu' : htmlLang.startsWith('en') ? 'en' : null;
  const result = {
    url: location.origin + location.pathname, locale,
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    documentDir: getComputedStyle(document.documentElement).direction,
    header: rect(header), logo: rect(logo), menu: rect(menu), title: rect(title)
  };
  console.log(JSON.stringify(result, null, 2));
})();
```

If a selector finds the wrong element or returns null, inspect it manually and revise the selector *in the temporary browser console only*. Never fabricate geometry. The script intentionally treats missing rectangles or incomplete coverage as `inconclusive`, rather than a false green.

## Acceptance and evidence

- Actual mobile H1 text begins **below** the logo/header, not behind it. At least **8 CSS px clearance** relative to the measured header; no logo/H1, menu/H1 or logo/menu intersection.
- The hamburger remains visible and clickable; the logo remains visible; all relevant tour pages have correct H1 and no horizontal overflow.
- EN, HU, HE (including computed `documentDir=rtl` for Hebrew) and representative phone/tablet/desktop layouts examined. Require **both Buda and Citadella in each of EN/HU/HE** on mobile (six locale-tour combinations), one 320px sample and one tablet/desktop; do not accept only one tour per language.
- The console output and any screen evidence stay in a private Work session; share only a summary and redacted technical measurements in [#723](https://github.com/eli1979-ai/Voy-pro-website/issues/723).
- **No WP live write from this repository**: a browser-only preview is not a confirmed deployment; isolated restore, approved diff and rollback must be separately established.

This is one isolated QA component. It must not be confused with public website GitHub Actions build checks or the legacy source-audit Draft PR #591.
