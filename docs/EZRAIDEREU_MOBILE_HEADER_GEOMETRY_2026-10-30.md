# EZRaiderEU Budapest — mobile logo/title overlap measurement gate

Status: **source-only diagnostic, no live WordPress fix**. Work owner: [Issue #723](https://github.com/eli1979-ai/Voy-pro-website/issues/723). The user supplied Android screenshots of the logo overlapping the start of the H1 for Buda Castle and Citadella. Do not upload those screenshots or WP-admin credentials to this public repository.

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

## Browser console read-only measurement

```js
(() => {
  const header = document.querySelector('#masthead, header.site-header, .site-header, header');
  const logo = header?.querySelector('.custom-logo, .custom-logo-link img, .site-branding img, .logo img, img');
  const title = document.querySelector('main h1, article h1, h1.entry-title, h1');
  const menu = header?.querySelector('.menu-toggle, .hamburger, button[aria-expanded], button[aria-controls], .nav-toggle');
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
    header: rect(header), logo: rect(logo), menu: rect(menu), title: rect(title)
  };
  console.log(JSON.stringify(result, null, 2));
})();
```

If a selector finds the wrong element or returns null, inspect it manually and revise the selector *in the temporary browser console only*. Never fabricate geometry. The script intentionally treats missing rectangles or incomplete coverage as `inconclusive`, rather than a false green.

## Acceptance and evidence

- Actual mobile H1 text begins **below** the logo/header, not behind it. At least **8 CSS px clearance** relative to the measured header; no logo/H1, menu/H1 or logo/menu intersection.
- The hamburger remains visible and clickable; the logo remains visible; all relevant tour pages have correct H1 and no horizontal overflow.
- EN, HU, HE (including RTL) and representative phone/tablet/desktop layouts examined.
- The console output and any screen evidence stay in a private Work session; share only a summary and redacted technical measurements in [#723](https://github.com/eli1979-ai/Voy-pro-website/issues/723).
- **No WP live write from this repository**: a browser-only preview is not a confirmed deployment; isolated restore, approved diff and rollback must be separately established.

This is one isolated QA component. It must not be confused with public website GitHub Actions build checks or the legacy source-audit Draft PR #591.
