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


---

## IMPLEMENTATION-READY DELTA FOR EXPLICIT OWNER APPROVAL — 2026-11-04

**This section is the exact proposed implementation delta; it is NOT applied.** Do not cherry-pick these hunks into public main or use an uncontrolled Vercel preview. This is a proposal appended to the SAME #763 evidence document, not a second competing design.

### One-to-one RED classification (19 failures, five fixes)

| Root | Exact observed red assertions | Count | One minimal owner-approved remedy |
| --- | --- | ---: | --- |
| A. Main gate ignores manualOnly | Budapest EN/HE/HU availability submit (3); EN/HE/HU forbidden-network assertions (3); direct exported API GET availability, POST quotes/holds/bookings/capacity/payment/sessions/attribution (8) | **14** | Effective bookingEnabled must be false whenever manualOnly is not explicitly false; keep API wrapper fail closed; disable form |
| B. Selection recovery | EN saved selection offered restore | **1** | Suppress initSelectionRecovery, clear obsolete selection |
| C. RTB independent loader | RTB form mounts; RTB mocked POST attempts (2) | **2** | Gate requestOnlyTourRoute script loading, retain authored WhatsApp links |
| D. Payment retry | EN cancelled-payment page displays stored Stripe retry link | **1** | Clear sessionStorage payment retry; show support notice; never claim charge outcome |
| E. Affiliate independent widget | Synthetic first-party affiliate mount reads catalog | **1** | Gate first-party widget mount independently; off-domain affiliate client remains FBM server responsibility |
| **Total** | | **19** | No duplication of authorization/pricing/holds in the website |

The 62 PASS / 19 FAIL run is https://github.com/eli1979-ai/Voy-pro-website/actions/runs/41799626936 on exact #763 head b1ada9664bb493c1e435438bbe715ea693510216; mock-only Chrome, not a server authorization test.

### Exact six-file *future* patch scope

Proposed files: (1) **site/assets/runtime-config.js**, (2) **site/release.json**, (3) **site/assets/site.js**, (4) **site/assets/affiliate-booking-widget.js**, (5) **scripts/qa-booking-funnel-browser.mjs**, (6) **scripts/qa-public-live-booking-fixtures.mjs**. No other production files, no new dependencies, no CSS or HTML edits, no Manage edit, no RTB server rewrite. Tests #763 remain the mandatory acceptance harness. **All hunks below describe edits to source after owner approval, not actual branch changes.**

#### 1. Runtime / release (atomic, exact token changes; retain rest of original bytes)

~~~diff
# site/assets/runtime-config.js — replace the only occurrence, preserve existing API host and public key
- bookingEnabled:true
+ manualOnly:true,bookingEnabled:false

# site/release.json
- "booking_enabled": true,
+ "booking_enabled": false,
~~~

Do not alter target=staging, seo_indexable=false, FBM URL, client key, payment provider or pricing. Both fields must change in the SAME approved release. No legacy public checkout flag may become active in a Production-targeted release without a separate signed go.

#### 2. site/assets/site.js — one effective gate, not one guard per API endpoint (root A)

~~~diff
  const cfg = window.VOY_CONFIG || window.VOY_RUNTIME_CONFIG || {};
+ const manualOnly=cfg.manualOnly!==false; // absent/malformed flag => fail closed
  const apiRoot = (cfg.apiRoot || '').replace(/\/$/,'');
  ...
- const bookingEnabled=!!(!isLegalPage&&destinationId!=='network'&&cfg.bookingEnabled&&apiRoot&&clientKey);
+ const bookingEnabled=!!(!manualOnly&&!isLegalPage&&destinationId!=='network'&&cfg.bookingEnabled&&apiRoot&&clientKey);
~~~

**Deliberately leave** the existing central API entrypoint line unchanged:
~~~
if(!bookingEnabled) throw new Error('BOOKING_NOT_CONFIGURED');
~~~
Every invocation, including window.VOYBookingIntelligence.api from a stale caller, then fails BEFORE network. Existing createSession/patchSession/analytics guards already use this effective bookingEnabled; do not duplicate or weaken them. The active-booking regression fixture must explicitly opt into manualOnly:false (below), rather than weakening default-deny behavior.

#### 3. site/assets/site.js — disable all checkout surfaces while leaving the booking anchor and contact visible (root A)

~~~diff
- ensureCheckoutShell();
+ if(!manualOnly)ensureCheckoutShell();

  const form=document.querySelector('#availability-form');
- if(form){
+ if(form&&manualOnly){
+   // #availability-status is INSIDE the form in EN/HE/HU pages: never hide
+   // the entire form, or the human-contact explanation becomes invisible.
+   const status=form.querySelector('#availability-status');
+   for(const element of [...form.children]){
+     if(element!==status){element.hidden=true;element.style.display='none';}
+   }
+   form.querySelectorAll('input,select,textarea,button').forEach(el=>{el.disabled=true;});
+   const title=form.parentElement?.querySelector('h2');
+   if(title)title.textContent=locale==='he'?'בירור סיור עם הצוות':
+     locale==='hu'?'Érdeklődés a csapatnál':'Ask the local team about a tour';
+   if(status){
+     status.hidden=false;
+     status.setAttribute('role','status');
+     status.setAttribute('aria-live','polite');
+     status.textContent=locale==='he'
+       ?'זו פנייה בלבד, לא הזמנה מאושרת. הצוות יאשר זמינות, שעה ומחיר.'
+       :locale==='hu'
+         ?'Ez csak érdeklődés, nem visszaigazolt foglalás. A csapat ellenőrzi az időpontot, az elérhetőséget és az árat.'
+         :'This is an enquiry, not a confirmed booking. Our team will confirm the time, availability and price.';
+     const contact=document.createElement('a');
+     contact.className='btn';
+     contact.href=whatsAppUrl();
+     contact.rel='noopener noreferrer';
+     contact.textContent=locale==='he'?'פנייה ב־WhatsApp':
+       locale==='hu'?'Érdeklődés WhatsAppon':'Ask on WhatsApp';
+     status.insertAdjacentElement('afterend',contact);
+   }
+   setRuntimePriceState('unavailable');
+ }else if(form){
~~~

This is a new branch BEFORE the existing availability event handlers, hydrateCatalog and submission/hold flow. Keep all those legacy functions unchanged for a future separately approved public-booking product. Keep the same #booking anchor and all authored tour cards/branch WhatsApp links. The static displayed "from" prices are illustrative starting prices, **not** a live quote; do not assert verified availability.

#### 4. site/assets/site.js — RTB and cached-browser recovery (roots B/C/D)

~~~diff
- if(requestOnlyTourRoute){
+ if(requestOnlyTourRoute&&!manualOnly){
    const loader=document.createElement('script');
    loader.src='/assets/rtb-request.js?v=20261026r11';

- async function initSelectionRecovery(){
+ async function initSelectionRecovery(){
+   if(manualOnly){
+     const shell=document.querySelector('[data-resume-booking]');
+     if(shell)shell.hidden=true;
+     delStore('voy_recovery_state');
+     return;
+   }
    const shell=document.querySelector('[data-resume-booking]');if(!shell)return;

  function initPaymentReturnNotice(){
+   if(manualOnly){
+     clearPaymentRetry(); // remove stale sessionStorage Stripe redirect
+     if(qs.has('payment')){
+       const status=document.querySelector('#availability-status');
+       if(status)status.textContent=locale==='he'
+         ?'לא ניתן לאמת כאן את מצב התשלום. אין לנסות שוב לשלם דרך האתר; פנו לצוות לבירור.'
+         :locale==='hu'
+           ?'A fizetés állapota itt nem ellenőrizhető. Ne próbálj újra fizetni az oldalon; keresd a csapatot.'
+           :'Payment status cannot be verified here. Do not retry payment on this site; contact our team.';
+     }
+     return;
+   }
    if(qs.get('payment')==='success'){clearPaymentRetry();resetBookingStarted();return;}
~~~

Do not remove or alter the historical payment record in FBM; clearing an old browser **link** is not a refund or payment outcome. No automatic WhatsApp send, no CRM receipt. RTB relay remains its **independently OFF** same-origin server gate; an old browser or pinned script can bypass a loader check, hence mandatory server deny before release.

#### 5. site/assets/affiliate-booking-widget.js — only first-party widget mount (root E)

In install(script), AFTER the existing target lookup / early target-not-found return, and BEFORE the current shadow-root creation:

~~~diff
- const root=target.attachShadow({mode:'closed'});
+ // A VOY first-party page is controlled by the website manual-only flag.
+ // Third-party affiliate sites have no VOY_RUNTIME_CONFIG and MUST be
+ // governed by their distinct FBM client authorization, not our page flag.
+ const firstPartyConfig=window.VOY_RUNTIME_CONFIG;
+ if(firstPartyConfig&&firstPartyConfig.manualOnly!==false){
+   target.replaceChildren();
+   const note=document.createElement('p');
+   note.textContent='Online booking is unavailable. Please contact VOY PRO directly.';
+   target.appendChild(note);
+   script.dataset.voyMounted='true';
+   return;
+ }
+ const root=target.attachShadow({mode:'closed'});
~~~

Do **not** replace or regenerate any already published content-addressed affiliate asset automatically. This is a proposed mutable first-party widget guard. Previously pinned scripts / other domains are outside this safeguard; FBM must independently disable unauthorized public writers by scoped client/server policy. Test only the synthetic widget injected on the VOY first-party fixture.

#### 6. Preserve ACTIVE booking regression tests explicitly (not 19-test manipulation)

Default deny on a missing manualOnly flag is intentional. To preserve the old FULL checkout regression scenarios, update exactly TWO occurrences in EACH of the existing fixture scripts, **without changing any of the 10 manual-only scenarios, their expected outcomes or the network interceptor**:

~~~diff
# scripts/qa-booking-funnel-browser.mjs (2 occurrences, existing active-booking fixtures ONLY)
- window.VOY_RUNTIME_CONFIG={bookingEnabled:true,apiRoot:
+ window.VOY_RUNTIME_CONFIG={manualOnly:false,bookingEnabled:true,apiRoot:

# scripts/qa-public-live-booking-fixtures.mjs (2 occurrences, existing active-booking fixtures ONLY)
- window.VOY_RUNTIME_CONFIG={bookingEnabled:true,apiRoot:
+ window.VOY_RUNTIME_CONFIG={manualOnly:false,bookingEnabled:true,apiRoot:
~~~

This is a test-environment declaration, not loosening of RED-first tests. Do not replace the synthetic manual-only fixture (manualOnly:true) in PR #763. Affiliate widget stand-alone approved-origin tests use no website runtime and remain separate.

### Historical Manage Booking: two choices, one default

**A — RECOMMENDED P0: temporary human support.** Keep **site/manage/index.html unchanged**. Its existing gate is:
~~~
if(!token||!c.bookingEnabled){ ... mailto:support@voy-pro.com ...; return; }
~~~
When browser bookingEnabled=false, token-scoped customer self-service (view details, contact/riders edit, reschedule, cancellation) becomes unavailable through this site. Existing footer/email and other branch contact options continue; test #763 confirms synthetic token causes no Manage API call and a visible support email. **Impact disclosure/explicit owner approval required**; tell confirmed customers they must contact human support for booking changes, check-in or payment clarification. No automatic cancellation, and no claims about existing charge status.

**B — POST-PILOT option only: verified read-only Manage.** A *different* FBM-authorized read-only token endpoint may preserve limited details after signed token scope, location, expiry, PII minimization, and stale-token tests. The website must never expose cancel/riders PATCH/date-change or payment endpoints behind that read-only capability. Requires a separate FBM authorization review and a distinct website change; **not in the six-file P0 patch**. Do not silently equate read-only Manage with permission to modify bookings.

### RED→GREEN acceptance matrix and checks

| Existing #763 observable | Baseline 04 Nov | Expected after approved patch | Independent proof |
| --- | --- | --- | --- |
| Main form EN/HE/HU (3) | RED | Invisible/disabled input and submit, visible localized enquiry with WhatsApp | Chrome assertions unchanged |
| Budapest network EN/HE/HU (3) | RED | No FBM availability/session/attribution | Chrome intercepted request log |
| Exported API direct availability + seven POSTs (8) | RED | No outgoing request even with stale bookingEnabled:true | Chrome directProbe unchanged |
| Local selection recovery (1) | RED | No restore banner, stored non-PII choice cleared | Chrome seedSelection |
| RTB form / POST (2) | RED | No RTB form or synthetic POST, authored WhatsApp remains | Chrome mock relay |
| Stripe retry (1) | RED | No retry link; support-only payment status copy | Chrome seeded sessionStorage |
| Affiliate first-party mount (1) | RED | No independent catalog request with manualOnly:true | Chrome injected widget |
| Marvão EN/HE/PT, HE RTL, support-only historical Manage | PASS | Must stay PASS | Existing Chrome assertions |
| ACTIVE booking mode regression fixtures | Baseline legacy scenarios pass | Must stay PASS when manualOnly:false | Existing browser tests + external fixtures |

**Order after owner approval:** static checks of exact diff → npm run build → npm run verify:launch → npm run qa:site → existing CI Chrome #763 must show 19 prior failures resolved and all previously green assertions still PASS. Preserve the current Mock route interception and full browser suite. Then independent FBM server deny negative proof and owner-signed release/rollback gates; a Chrome GREEN is NOT commercial approval. Additional full authenticated Manage/live API/production proof is OUTSIDE this draft.

### Preflight actually performed in THIS review (no behavior change)

Verified the patch anchors against main/source: **site.js** six proposed anchor positions are unique (1 each), **affiliate widget** 1, **runtime-config** 1, **release** 1, and old active-mode test config literals **2 each** in qa-booking-funnel-browser.mjs and qa-public-live-booking-fixtures.mjs. Thus no ambiguous bulk replacement is needed. This is a **static edit-location proof**, NOT a compiled or runtime test of the proposed patch; no source file from the patch is modified. The already green artifact CI was #41799626924; RED Chrome #41799626936 remains the unmodified security baseline. No new Chrome runs are necessary for this documentation-only proposal.

### Single explicit approval sought in a FUTURE turn

Authorize **only** the six scoped code/fixture file edits above, with **Manage option A** (human-support-only for existing bookings) and consent to temporarily withdraw public site checkout/availability/RTB. This authorization would allow a reviewed draft behavioral candidate but **NOT** merge, deployment, payment change, provider or DNS change, FBM role/config/migration, independent affiliate server exemption or Production launch. **Release remains blocked until FBM signs off a server-side per-client deny canary, plus pilot gates #1068, #1030 and #939.** Any future rollback must KEEP the FBM deny policy active until public checkout has its own explicit release authorization.
