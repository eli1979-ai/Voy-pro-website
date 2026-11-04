# P0 Manual-only — independent RED-first browser acceptance packet

**Status:** test-only candidate / no behavior change / NO-GO.  
**Source baseline:** `eli1979-ai/Voy-pro-website@7e51d77ce7d7c0e0d6e55f0d3ba3bb141983f5ef`.  
**FBM contract baseline:** `eli1979-ai/Ezraider-os@20c2fadccf13929df226eebde088c964194acccd`.  
**Tracking:** [Website Production gate #317](https://github.com/eli1979-ai/Voy-pro-website/issues/317); [FBM Pilot v1 #1090](https://github.com/eli1979-ai/Ezraider-os/issues/1090).

## Scope and isolation

Extend **the existing** `scripts/qa-booking-funnel-browser.mjs` real-Chrome local fixture, not a new test server, framework, workflow, payment integration, or public preview. Ten extra scripted scenarios are appended to the existing suite (original booking-regression cases are preserved). Browser `page.route('**/*')` allows only localhost static files and synthetic `booking-browser-fixture.invalid` responses; all other origins are aborted. Same-origin `/api/request-to-book` POST is intercepted and returns an inert synthetic disabled response. **No call may reach FBM, Stripe, WhatsApp, a real customer, or public `voy-pro.com`.** Test `manualOnly:true` intentionally with a stale conflicting `bookingEnabled:true` value. A future fail-closed implementation must honor manual-only even with stale JavaScript/client state.

**Run from a local checkout after `npm run build`:**

```sh
node scripts/qa-booking-funnel-browser.mjs
```

The test is already invoked by the current visual browser QA workflow; do not edit workflows or `package.json`. The generated report is `visual-qa-output/booking-funnel/report.md`. **Expected initially: nonzero exit with detailed `FAIL:` lines. Do not invert assertions, mark RED as PASS, or relax the fake route interception.** The standard previous scenarios also continue to run to demonstrate no regression from the test-only patch.

## P0 acceptance scenarios

| Scenario | Expected result **after** separately authorized client code change | Current-source predicted RED |
| --- | --- | --- |
| EN / HE / HU Budapest Buda detail | Tour heading, RTL only for Hebrew, correct WhatsApp; no sessions from click, no availability GET, form disabled or hidden | `manualOnly` ignored when stale `bookingEnabled:true`; form/session still active |
| EN / HE / PT Marvão | Contact points to the Marvão WhatsApp channel; no FBM Session/Attribution | Manual-only ignored when stale `bookingEnabled:true` |
| Saved selection in localStorage | No restoring a booking funnel in manual-only | Existing `initSelectionRecovery()` can render recover CTA |
| Stale Stripe checkout link in sessionStorage, payment cancelled URL | No `data-payment-retry` link even if previously valid | `initPaymentReturnNotice()` does not gate retry on manual-only |
| Budapest advanced/request-only tour | RTB form is not mounted; synthetic form submit never POSTs same-origin relay; WhatsApp remains | `rtb-request.js` loader not bound to `bookingEnabled` |
| Existing customer /manage with a synthetic token | When self-service is intentionally disabled, do not send token; show usable support email | Baseline may PASS on `bookingEnabled:false`, but *historical self-service is also lost* |
| Isolated affiliate widget mount on the website | Manual-only must not silently leave an affiliate booking client running | Widget consumes independent `data-api-root`/`data-client-key` and disregards website flag |

Network safety assertions record GET availability (it invokes FBM `ensure_public_departures`), POST Quote/Promotion/Ancillary, Hold, Booking, Payment Intent, Capacity Request, Session/Attribution, and marketing events. With the current source, the audit is expected to turn RED for at least some cases. Not every potential server-side write can be proven by a browser-only test.

## Strict failure semantics

- A missing fixture, navigation error, absent required WhatsApp contact, or JavaScript timing failure is **FAIL**, not a green test.
- The intercept returns synthetic data even for denied sensitive calls and records each attempt. A mocked HTTP 200 or 403 is **not** counted as a successful server-side denial; the presence of any forbidden attempt fails the client acceptance gate.
- Test identifiers, tokens, phone inputs, and checkout URLs are synthetic. The tests do not exercise real WhatsApp delivery, real payment/reconciliation, production host deployment, FBM access policy or authenticated Manage Booking records.
- The prior 16/16 source-mapping checks are not a substitute for these runtime tests. Chrome QA results must be reported at the exact PR head once CI finishes.

## Minimum future behavior diff (requires **separate specific owner approval**)

1. `site/assets/runtime-config.js`: set `manualOnly:true`, `bookingEnabled:false`; keep public key and host unchanged in this candidate (do not copy key into this doc).
2. `site/release.json`: `booking_enabled:false`; preserve `target=staging` and `seo_indexable=false`.
3. `site/assets/site.js`: authoritative `manualOnly` fail-closed guard even if old `bookingEnabled` survives cache; hide/disable availability/checkout, quote/hold/payment and selection recovery; retain localized tours, contact links and explicit unconfirmed WhatsApp wording; disable old Stripe retry; do not mount advanced RTB while manual-only. Avoid silently modifying pricing or payment business logic.
4. The legacy Manage Booking page currently tests `c.bookingEnabled`, thereby losing all token self-service on global disable. **Owner decision:** temporary human-support-only (existing fallback), or a separately reviewed read-only Manage capability. Do not independently re-enable PATCH/POST cancellation, riders or rescheduling.
5. FBM must independently implement and test **server-side per-client deny** for website-originated public availability/holds/bookings/capacity requests/payment, including direct HTTP/absent Origin/stale JS; ensure the affiliate client has an explicit separate decision and authorized staff manual booking remains available. User has **not** authorized FBM writes, policy changes, Production cutover or live transaction tests.
6. Verify no future Production fallback to Staging via existing release guard. Keep public domain/SEO/preview unchanged.

## Proposed release order / rollback

**Now:** test-only draft branch; expected RED; no public behavior change. Rollback = close unmerged PR / discard test branch.  
**Later after owner approval:** FBM server denial first in isolated approved environment with signed negative canaries → client/manual-only future draft on pinned source → red→green mocked Chrome + `npm run build`, `npm run verify:launch`, `npm run qa:site` → explicit owner approval for separate merge/release. Public Vercel `voy-pro-staging` serves real domains; even a source merge can automatically deploy. Rollback any future website release to a separately approved known-safe revision; **never roll back FBM server denial** while public checkout remains unapproved.

## Owner approval packet (NOT requested for this test-only PR)

Approve a future *separate* change to the above three source files and scoped support/QA behavior **only**, after FBM verifies its independent server gate. Choose one existing-customer policy: **(A)** temporarily pause all Manage self-service and direct customers to human support, or **(B)** authorize a specifically scoped read-only Manage redesign after FBM supports it. This proposal does not request or assume approval to merge, deploy, change payments, pricing, public aliases, DNS, auth, credentials or databases.

**No SEO, marketing, design or additional booking-engine work in scope.**
