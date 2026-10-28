# EZRaiderEU WordPress — published content link graph, 28 October 2026

## Scope and trust boundaries

Authenticated Jetpack WordPress site `258220563`. This is **read-only** QA of stored published WordPress post content, **not** an end-to-end HTTP / live-browser / Google Maps / checkout test. No WordPress editing, booking cutover, deployment or third-party paid service calls.

The precise link-contract snapshot lives in `docs/legacy-wordpress/ezraidereu-published-link-contract-20261028.json`; the dependency-free validator lives in `scripts/check-legacy-ezraidereu-link-graph.mjs`.

It includes **7 tour families × 3 locales = 21** WordPress `tours` CPT objects, plus **9 blog posts + 3 recommendations pages = 12** editorials. The three legacy home pages are included only as known valid link destinations; they are not part of this validator's 33 editable stored-content records, since their real copy comes from PHP/ACF.

### Readback results

Authenticated WordPress `context=edit` fetches of all **33/33** stored content objects were passed through the validator's `auditRecord` logic in a standalone, no-network JavaScript harness with a URL-path parsing shim. Every record passed **0 errors**, in these batches:

| Content type | IDs | Passed |
|---|---|---:|
| EN tours | 38, 43, 44, 45, 46, 47, 48 | 7/7 |
| HU tours | 256, 258, 259, 260, 261, 262, 263 | 7/7 |
| HE tours | 271, 272, 273, 274, 275, 276, 277 | 7/7 |
| Blog posts | 439, 373, 369, 228, 221, 219, 217, 54, 49 | 9/9 |
| Recommendations pages | 390, 393, 396 | 3/3 |

This tests canonical permalink/ID mapping, known internal WordPress references, mailto `Voyprobud@gmail.com`, exactly one `wa.me/36300993099` link per stored content object, absence of old Budapest email and FareHarbor in that *stored* content, all three languages' translation partners within each tour family, and existing `<!--more-->` plus `.ezre-tour-long-copy` marker on the 21 tour posts.

It does not prove any given link returns HTTP 200 externally. The user's WordPress site can serve Cloudflare challenges or stale HTML to unauthenticated crawlers. An authenticated WordPress record/link is not a verified public browser click. Does not inspect ACF generated homepage, global theme footer, PHP source, client-run WPCode or Google Maps exact meeting point.

### Negative-case regression tests

The validator's local `--self-test` exercises **9 scenarios** over 33 synthetic records:
1. Every record correct.
2. A translated-tour partner removed.
3. Old `voy.pro.eu@gmail.com` restored.
4. FareHarbor link inserted.
5. Unknown internal tour link inserted.
6. Tour full-copy marker removed.
7. Wrong WhatsApp number inserted.
8. One expected content record missing.
9. Duplicate content record.

All **9/9 passed** in the standalone JavaScript harness against the exact GitHub source. The script is ESM and intended to run as `node scripts/check-legacy-ezraidereu-link-graph.mjs --self-test` as a future low-cost source-level gate. These tests are distinct from standard website GitHub Actions and do not require Vercel previews.

### Running against future exported WordPress data

For a **private**, explicit WordPress REST export with the 33 records only, use:
```sh
node scripts/check-legacy-ezraidereu-link-graph.mjs --self-test
node scripts/check-legacy-ezraidereu-link-graph.mjs --input /private/wp-content-snapshot.json
```

Snapshot format:
```json
{
  "records": [
    {
      "id": 38,
      "link": "https://ezraidereu.com/budapest/tours/buda-castle-tour/",
      "status": "publish",
      "content": { "raw": "<p>...existing HTML...</p>" }
    }
  ]
}
```
The illustration above is intentionally partial and will fail the full 33-record audit. Actual WordPress content must never be committed to the **public** website repository or to logs containing guest data, payments, credentials or provider tokens. Only the 33 published IDs/URLs and pure code/aggregate test results belong in this repo.

### Safe next steps

- Preserve all **existing** Hebrew tour slugs exactly (including the historic Buda slug spelling), as they are published and already referenced from the translated tours.
- Once the original site files and ACF field groups are available, apply the separate source-level homepage text manifest in draft [#596](https://github.com/eli1979-ai/Voy-pro-website/pull/596), then rerun this link graph on new *stored* content and verify frontend routes and canonical/hreflang output with a real browser.
- Correct exact Google business pin/guest entrance only after verifying the owner-supplied Google Maps profile, not by text geocoding; see [#598](https://github.com/eli1979-ai/Voy-pro-website/pull/598).
- Existing WPCode #488 v6.2 installed by owner remains the active footer client patch. Do not add a second widget/snippet. Do not change FareHarbor plugin / FBM/OTA booking / payments.
- Every owner-required action is deferred in [#604](https://github.com/eli1979-ai/Voy-pro-website/issues/604), with no additional request in this autonomous pass.
