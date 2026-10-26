# EZRaiderEU WordPress × VOY PRO affiliate widget — controlled pilot plan

**Status:** PREPARATION ONLY — **not installed or tested on EZRaidereu.com**.  
**Owner approval required before any change to the old WordPress site, DNS, FBM client/origin allowlists, customer booking flow, payment or live environment.**

This pilot uses the existing user-owned **EZRaidereu.com** WordPress website as the *future* test host. It must not redirect the old site to `voy-pro.com`, replace its booking pages, merge brands, or treat a Staging test as a public launch. VOY PRO and the EZRaider-branded acquisition channel remain separate customer entry points; operational truth/affiliate attribution stays in FBM.

## Zero-impact preparation (safe now)

1. Website source ready: `site/assets/affiliate-booking-widget.js`; first-party documented API parameters in `docs/AFFILIATE_NATIVE_WIDGET.md`. The current widget is **English UI only**, Budapest products only, and selects requested guide language from the live FBM catalog. No implied acceptance of English as an alternative.
2. Use a dedicated **test affiliate account, coupon and browser-public client** issued by FBM for the *test environment*. Validate that the specific coupon is affiliated to the intended test partner, not to an unrelated public campaign. Never hardcode any Supabase/Stripe/service-role token in WordPress.
3. Determine the exact origin that the pilot browser actually sends — `https://EZRaidereu.com` and `https://www.EZRaidereu.com` are distinct allowed origins. FBM must authorize the exact test origin and bind browser client to its approved partner policy. Origin headers and public client keys alone are not proof of partner identity.
4. After `npm run build`, inspect the **generated** `dist/assets/affiliate-booking-widget-manifest.json`. It records the exact `public_path`, full SHA-256 and byte length of a content-addressed copy of the reviewed script. Confirm `archive_status=PERSISTED_ACROSS_DEPLOYS` in the manifest and that the identical hash-named file is committed under `site/assets/`, so subsequent builds retain it. An archive status of `BUILD_ONLY_NOT_RETAINED` blocks installation: the generated file may disappear on the next deployment. Then confirm the same file is actually served by the intended approved Vercel deployment; **pin that precise path in WordPress**, not the mutable `/assets/affiliate-booking-widget.js` alias or a manifest fetched dynamically by browsers. The manifest is a build fingerprint, **not** approval to install, Stripe readiness, CORS acceptance, or an SRI header. **Do not assume** the Vercel target label `production` inside the `voy-pro-staging` project means the separate Production environment is ready. Choose a verified Staging asset and FBM Staging endpoint, both owned/approved, before inserting any snippet.
5. Read-only WordPress reconnaissance when the pilot is authorized: identify theme/plugin script minification, cache/CDN, Content Security Policy, HTTPS redirects, whether the editor strips `<script>` tags, existing booking widgets and staging/preview capabilities. Do not change any of these in the preparation phase.

## Pilot installation — do **not** execute until the user approves

Create a **private, non-indexed WordPress test page**, with a single custom HTML block or a reviewed theme/code snippet that inserts the following markup, replacing placeholders only with administrator-approved **browser-public Staging values**:

```html
<div id="voy-affiliate-booking"></div>
<script
  defer
  data-voy-affiliate-widget
  data-target="voy-affiliate-booking"
  data-affiliate="TEST_PARTNER_COUPON"
  data-api-root="https://APPROVED_FBM_STAGING_HOST"
  data-client-key="APPROVED_PUBLIC_STAGING_BROWSER_KEY"
  src="https://APPROVED_REVIEWED_VOY_SCRIPT_HOST/assets/affiliate-booking-widget.REVIEWED_SHA256_PREFIX.js"
></script>
```

A WordPress editor may strip the script from an HTML block based on role/security policy; if so, use a separately reviewed theme-level injection on **that test page only**, without introducing an unapproved plugin. Do not expose a private client configuration in WordPress source; only the intentionally public-scoped test key may be embedded. Set `script-src` for the approved script origin and `connect-src` for the exact FBM API origin only if an existing CSP requires this and the policy owner approves it.

The final script filename must be copied verbatim from the reviewed build manifest; do not hand-type the hash. An asset with a different hash is a different release requiring separate review. **Do not add a `script integrity=` attribute** without first verifying the script response's cross-origin CORS policy: browser SRI on cross-origin scripts has separate requirements. The SHA-256 manifest is an out-of-band review fingerprint, not browser-enforced Subresource Integrity. The script itself still accepts only an intentionally public partner-scoped browser key.\n\nWordPress caching, deferred-JS rewriting and cookie-consent optimization must not reorder/remove the target; review the *actual rendered HTML and Network requests* rather than trusting the editor view. One script per mount; duplicate scripts are handled defensively but are not recommended.

## Acceptance matrix (future owner-approved pilot)

| Test | Expected evidence |
| --- | --- |
| Private page on desktop and mobile | Exactly one functional widget; no console errors, overflow, or theme CSS leakage |
| Origin and API CORS | Valid `OPTIONS`/approved `GET` only for the exact WordPress origin; rejected unapproved origin |
| Catalog and date | Budapest catalog and FBM-owned booking horizon, not hardcoded WordPress tour options |
| Guiding language | Guest explicitly chooses a supported language; unsupported language clears on tour switch; no implicit English fallback |
| Affiliate attribution | Exactly one originating coupon, correct discount in FBM server quote; correct `affiliate_id` verified internally, **not inferred from the frontend** |
| Group/child passengers | FBM-controlled capacity and rules; no combining seats/riders across separate orders |
| Sellable departure | Test-only hold/booking flow permitted only under approved isolated Staging conditions, no real guests or charges |
| Requestable departure | Pending human-review reference, **no** hold, payment or misleading confirmation |
| Race/failure | Expired departure, changed language, double-click, 503 retry with same idempotency key; ambiguous expired-hold response asks staff before retry |
| WordPress variants | Redirect/canonical origin (`www` vs apex), script deferred/head order, caching and logged-out access policy |
| Cleanup | Remove **only** the test-page snippet and discard/revoke the dedicated test client/coupon through FBM owner; clear cache; verify original WordPress booking pages untouched |

**No external card payment** in the pilot without a separate explicit approval and a payment-safe test environment; do not perform real bookings using public customer or company data. Screenshot only synthetic personal information, and keep credentials out of screenshots/logs/issue comments.

## Stop / rollback conditions

Stop on any cross-origin failure, unexpected real charge, duplicate booking, leaked key, missing affiliate attribution, unsupported language default, misleading 'confirmed' status, or unverified staff readiness. Revert the test-page HTML/snippet and clear only its cache; retain the old EZRaiderEU website navigation/booking logic unchanged. Coordinate separately with FBM for revocation of temporary coupon/public client/origin; do not modify Vercel aliases or production database.

## Exit criteria before any public deployment

Pass local/mock Chrome regressions; approved staging WordPress browser acceptance; FBM audit of coupon ownership, guide-language request, booking reference and commission event; written sign-off for exact origins, environment and rollback. **This document does not authorize activation** and does not close public Production/SEO/payment blockers (see `docs/public-release-readiness.md`).
