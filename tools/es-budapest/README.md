# Spanish Budapest preview pages

`site/es/budapest/**` is generated from the English Budapest pages so the 14 Spanish
routes keep the same layout, components, photography and page-specific content.

```
node tools/es-budapest/generate.mjs --extract   # list English copy without a translation
node tools/es-budapest/generate.mjs             # write the 14 Spanish pages
```

- `es-dictionary.json`: English → Spanish copy. Generation fails if any visible
  English string has no translation, so English changes must be translated here.
- `pages.json`: approved Spanish title, meta description, WhatsApp prefill and
  static decision facts (price, duration, meeting point) per route.
- `route-visuals/`: the route photo strip and schematic that `site.js` renders on
  the three English tour pages, captured from a local build.

The Spanish pages are static on purpose: no `site.js`, forms, iframes, FBM API,
availability, checkout or payment. Live booking is replaced by a WhatsApp inquiry
panel, and runtime-only English features (mobile menu, meeting-point map, review
ticker, Thule photo opt-in, group planner) have static or omitted equivalents.
Do not enable Spanish booking or payment without separate owner authorization.
