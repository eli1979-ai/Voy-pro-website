# VOY PRO parallel production launch

Decision date: 2026-09-20.

## Launch strategy

VOY PRO launches as a **new, independent website** on `voy-pro.com`.

The existing Budapest website under `ezraidereu.com/budapest/` remains live and unchanged during the first phase. This is **not** a domain migration and **not** a replacement launch.

## SEO contract for phase 1

- VOY PRO pages use self-referencing canonicals on `https://voy-pro.com/`.
- VOY PRO publishes its own sitemap at `https://voy-pro.com/sitemap.xml`.
- VOY PRO gets its own Search Console property.
- The old EZRaiderEU site keeps its own URLs, indexing and existing search equity.
- No 301/308 redirects are installed from EZRaiderEU to VOY PRO during phase 1.
- No Google Search Console Change of Address is submitted during phase 1.
- Do not set VOY PRO canonicals to EZRaiderEU and do not set EZRaiderEU canonicals to VOY PRO merely because the businesses are related.
- Content should remain meaningfully differentiated: EZRaiderEU may stay product/location focused; VOY PRO is the broader multi-location brand and booking platform.

## Production activation sequence

1. Attach `voy-pro.com` and `www.voy-pro.com` to the Vercel website project and verify SSL.
2. Use non-www `voy-pro.com` as the canonical host and permanently redirect the VOY PRO www variant to it.
3. Copy `launch/robots.production.txt` to `site/robots.txt`.
4. Set `site/release.json` to `target: production` and `seo_indexable: true`.
5. Build and run `npm run verify:launch`.
6. Verify representative EN/HE/HU pages, canonical tags, hreflang, sitemap, 404 handling, booking API, WhatsApp and payment capability.
7. Create/verify the `voy-pro.com` Search Console property and submit `https://voy-pro.com/sitemap.xml`.
8. Leave `ezraidereu.com/budapest/` live and monitor it separately.
9. Monitor VOY PRO indexing, 404s, Core Web Vitals and booking errors after launch.

## Existing EZRaiderEU media dependency

Some VOY PRO pages currently load Budapest gallery images from the old WordPress `/budapest/wp-content/` path.

Because EZRaiderEU remains live, this is **not a phase-1 launch blocker**. It should still be removed later so VOY PRO owns and serves its own media, but it no longer blocks launch.

## Future decision point

After both sites have real traffic and conversion data, choose one of three paths:

1. Keep both websites permanently with differentiated roles.
2. Consolidate selected content into VOY PRO while keeping EZRaiderEU as a product/brand site.
3. Migrate the old Budapest site into VOY PRO with direct URL-level redirects and Search Console migration steps.

The previously researched URL mapping is retained in `launch/future-migration-map.csv` only for option 3.

## Phase-1 blockers

- `voy-pro.com` / `www.voy-pro.com` are not yet attached to the Vercel project.
- Production robots and production release flags must only be activated at the actual VOY PRO domain launch.

No dependency on redirecting or shutting down EZRaiderEU is a phase-1 blocker.
