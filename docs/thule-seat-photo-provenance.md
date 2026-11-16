# Thule child-seat product photos: provenance

**Issue:** #826. **Date:** 2026-11-16.

The two Thule seat photos on the EZRaider pages (EN/HE/HU/PT) and the Budapest family pages (EN/HE/HU/ES) are served from this site. Visitors' browsers make no request to any Thule host. They replace the earlier click-to-load photos from `www.thule.com`.

| File | Model | Source upload (owner-supplied) | Source SHA-256 | Optimized file | Optimized SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `site/assets/images/thule/yepp-2-maxi.webp` | Thule Yepp 2 Maxi Rack Mount (model 12041302) | `1628154.png`, RGBA 500×500 | `6564771e40c54c626dfc882d520cfc184577cc158aae4e82525d3935439f889f` | WebP RGBA 500×500, 15,220 bytes | `03ab0743e2adefc4c098a01e48804c3d28bc27b12875dcd0065ed571a18fcda2` |
| `site/assets/images/thule/yepp-junior.webp` | Thule Yepp Junior (official page: Yepp Junior Budget, 12020309) | `1447607.png`, RGBA 1200×1200 | `5082879b48ec9cbe7b3282f5e932186376784fea320c0fab07e596d56b76d9be` | WebP RGBA 560×560, 18,368 bytes | `45c50f95f94393e419541dd7ca2ef6f3fc8dacc16b6d27c2f166852f0e335a1f` |

## Rights and credit

- **Owner decision, 2026-11-16 (issue #826):** VOY PRO uses the manufacturer's product photography for these two seat models. The owner supplied both image files directly.
- **What this does not show:** the owner's decision does not prove that Thule licenses third parties to re-host these photos. No such license is claimed here. If public re-hosting needs a documented basis (a distributor permission or Thule's media terms), record it in this file.
- **Kept on every page:** the visible Thule credit ("Product image: Thule" / "Official Thule product photos…") and the links to the official Thule product pages.

## Maintenance

- **Spanish pages:** `site/es/budapest/with-kids/` is generated from the English page by `node tools/es-budapest/generate.mjs`, which keeps the English image markup and credit.
- **Guards:**
  - `scripts/qa-site.mjs` and `scripts/check-budapest-group-discovery.mjs` require exactly these two local files and reject remote Thule image URLs and opt-in controls.
  - `scripts/qa-visual-browser.mjs` checks at 320, 390 and 1440 px that both photos load and decode, and that there are zero Thule network requests.
