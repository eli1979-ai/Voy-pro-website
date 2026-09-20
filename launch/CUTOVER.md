# VOY PRO production cutover

Verified preparation date: 2026-09-20.

## Current state

- Canonical production host in the new site is `https://voy-pro.com`.
- The Vercel website project currently has only `vercel.app` aliases; `voy-pro.com` and `www.voy-pro.com` are not attached yet.
- Staging intentionally serves `site/robots.txt` with `Disallow: /`.
- The old Budapest site remains live and indexed under `ezraidereu.com/budapest/`.
- Several new pages still load gallery images from the old WordPress `/wp-content/` path. Do **not** blanket-redirect `/budapest/wp-content/` during cutover until those assets are self-hosted or copied.

## Cutover sequence

1. Freeze content changes for the migration window.
2. Attach `voy-pro.com` and `www.voy-pro.com` to the Vercel project and verify SSL.
3. Choose one canonical host (recommended: non-www `voy-pro.com`) and permanently redirect the other variant to it.
4. Copy `launch/robots.production.txt` to `site/robots.txt`.
5. Set `site/release.json` to `target: production` and `seo_indexable: true`.
6. Build and run `npm run verify:launch`.
7. Verify representative EN/HE/HU pages, sitemap, robots, 404 status, booking API, WhatsApp and card-payment capability.
8. Configure the old WordPress host with direct 301 redirects from each known legacy URL in `launch/redirect-map.csv` to its final VOY PRO URL.
9. Keep `/budapest/wp-content/` reachable until the website images are migrated off the old host.
10. Verify both `ezraidereu.com` and `www.ezraidereu.com` variants in Search Console; after redirects are live, submit Change of Address to `voy-pro.com` for every applicable verified legacy variant.
11. Submit `https://voy-pro.com/sitemap.xml` in Search Console.
12. Monitor old/new indexing, 404s, redirect chains and booking errors daily during the first week, then weekly.
13. Keep permanent redirects for at least one year; preferably indefinitely for high-value legacy URLs.

## Do not do during the same cutover

- Do not change tour URLs again.
- Do not change the canonical domain again.
- Do not remove the old host immediately.
- Do not enable blanket redirects that catch WordPress media assets before the new site owns those images.

## Launch blockers

- Custom production domains not yet attached to the Vercel project.
- WordPress image dependency still exists.
- Old-host redirect rules must be installed on the old host; Vercel cannot redirect requests that never reach Vercel.
