# VOY PRO Budapest — Request-to-Book private relay (draft, disabled)

**Verified 23 October 2026: installed but public intake DISABLED.** Website PR #373 (the EN/HE/HU customer request form), server-only relay PR #376 and mock-only integration coverage PR #378 are now merged into `main`. The website is served to real visitors, but `GET /api/request-to-book` on both the public domain and Preview returns **HTTP 404** JSON `{"error":"request_intake_disabled"}`. No accepted FBM/CRM request has been verified and no request intake flag has been enabled.

The browser sends a same-origin POST only; FBM's `POST /api/public/request-to-book` needs a private `x-fbm-intake-secret` retained on the server. The form falls back to a WhatsApp message the guest must send when the relay is disabled. A tested `202 pending_review` is **only a simulated contract** so far, not proof of Staging CRM persistence, staff or inventory availability, booking, payment, or a confirmed tour. The shared Vercel project `voy-pro-staging` also serves the public `voy-pro.com` alias; do not conflate a Git branch or Preview with isolated production infrastructure.

## Required private runtime configuration (not yet configured)
- `VOY_RTB_RELAY_ENABLED=true` **only after explicit owner approval** and isolation of production vs Staging.
- `VOY_RTB_ABUSE_PROTECTION_VERIFIED=true` only after enforceable per-IP and per-request abuse controls are configured and tested at the actual ingress (e.g. platform WAF/managed rate limit). This environment flag is **an operational attestation, not rate limiting**.
- `VOY_RTB_FBM_BASE_URL=https://ezraider-os-staging.vercel.app/` — currently restricted to **Staging** host; no production FBM targeting without a separate implementation and approval.
- `VOY_RTB_FBM_INTAKE_SECRET` — only as a Vercel server environment secret; minimum 32 chars, to match the already-authorized FBM Staging intake secret. Never paste it into code, logs or chat.

The upstream FBM intake flag is separately disabled by default; it must not be enabled simply because this handler is deployed. A successful 202 means **pending human review**, not confirmed capacity, pricing, staff, fleet or payment.

## Verified Preview deployment and backend contract (22 October 2026)
- Inspected the deployed Vercel Preview at `https://voy-pro-staging-bg5k8bpny-eli1979-5448.vercel.app/api/request-to-book`. A real GET returned **HTTP 404**, JSON `{"error":"request_intake_disabled"}`, and `Cache-Control: no-store`. This confirms Vercel actually deployed the root `api/` function; it does **not** establish a working POST or end-to-end Staging CRM acceptance.
- Cross-checked the current FBM `app/api/public/request-to-book/route.ts`: server expects `tourSlug`, `requestId`, `preferredStartAt` (unambiguous ISO time), `partySize`, `contactName`, `email`, `phone`, `requestedGuideLanguage`, and an **explicit boolean** `englishAlternativeAccepted`. The relay converts Budapest-local date/time into `preferredStartAt` and forwards exactly this shape.
- FBM returns **202/pending_review** only after CRM linkage, **409** for a repeated request ID with a changed payload, and **503** when the request/CRM link is unresolved. No booking, payment, staffed departure or accepted availability is implied.
- Security regression now rejects a base URL at an unapproved port (for example `https://ezraider-os-staging.vercel.app:8443/`) despite an allowlisted hostname. Only the canonical default HTTPS origin is valid.
- **Historical as of 22 October:** the website form was still a draft at this point. The form and relay are both now merged (23 October), but the deployed relay is still explicitly disabled. A real visitor follows the manual WhatsApp fallback on HTTP 404. Never enable either server-side flag merely because the code is deployed.

**Still unverified:** enforceable ingress WAF/rate limit, authorised server secret installation, authenticated synthetic CRM request/409 replay test, and an owner-approved public release. These are hard blockers.

## Canonical website → relay request
```json
{
  "tourSlug": "heroes-square",
  "requestId": "11111111-1111-4111-8111-111111111111",
  "preferredLocalDate": "2026-11-05",
  "preferredLocalTime": "14:00",
  "partySize": 2,
  "contactName": "Example Guest",
  "email": "example@example.invalid",
  "phone": "",
  "requestedGuideLanguage": "he",
  "englishAlternativeAccepted": false
}
```

Client must obtain a **real affirmative checkbox action** to set English alternative consent to true; no website locale default. It must generate one stable UUID for an immutable submission and reuse it for a network retry **only when every field is identical**. FBM returns 409 on same key with changed language/consent. The relay resolves date/time in `Europe/Budapest`, rejects spring-forward gaps and fall-back ambiguous local times, and lets FBM enforce lead time/horizon. It returns only sanitized statuses and never echoes contacts/credentials.

The relay enforces same-origin JSON POST and ≤4 KiB input; this is *not* proof of bot protection or authorization. Only an operational anti-abuse control and Staging synthetic CRM end-to-end acceptance can justify activation. Keep true Production unchanged.

## Next release gates
1. Validate this function deploys to Preview as an actual Vercel serverless endpoint; it must fail closed with 404 when disabled.
2. Approve and install staging-only environment secrets, scoped rate limits, anti-spam, and authoritative FBM Staging endpoint/flags.
3. **Completed in #373 / #378:** the client POSTs to the same-origin route, distinguishes `202` vs `400`, `409`, `503`, and retains an immutable UUID/payload on ambiguous retries. CI exercises the actual browser module plus the real relay against a mocked FBM, including 409.
4. **Unverified:** conduct an isolated, authorized synthetic Staging FBM/CRM end-to-end test. Assert a single linked request + CRM lead, 202 pending_review, identical replay and changed-language/consent 409. Never send real customer personal information in this test.
5. Require explicit owner review/approval before runtime enabling, project Firewall changes, credential installation, altering any live aliases, or Production enablement. Merge of safe mock-only QA is not runtime enablement.

## Validation hardening — request/consent replay

The relay accepts only **canonical RFC 4122 UUID v4** external request keys generated by the browser's `crypto.randomUUID()`, not ad-hoc or low-entropy keys. It rejects a claimed English fallback of `true` when English is the primary guiding language; the real website hides that checkbox when English is selected and always sends `false` in this case.

The isolated mocked-upstream regression exercises **two identical POST retries** (same acknowledgement), then **changes to language or consent using the same request key** (409). This tests serialization parity and prevents a mistaken future change from silently accepting a modified payload under the old key. The definitive replay guard remains in the FBM CRM intake and still needs a real Staging synthetic write test before public activation.

Read-only Staging product preflight on 2026-10-22: all three special tours have `sales_enabled=false`, `public_enabled=false`, `website_visible=false`; the extended Buda + Margaret record additionally has `active=false`. A pending human-review request is not a public sale. Confirm whether the extended tour's `active=false` is intentional before enabling intake; do not alter canonical product flags in this PR.

## Activation preflight — 23 October 2026 (read-only evidence, NO-GO)

| Gate | Latest evidence | Result |
| --- | --- | --- |
| Website → relay → mock FBM integration | Merged #378, GitHub Actions SUCCESS and Vercel main deployment READY at `759fb672`; tests cover 404, 202, 503 retry and 409 through relay | **PASS — mock only** |
| Relay deployed and still disabled | `https://voy-pro.com/api/request-to-book` returned 404 JSON `request_intake_disabled`; same behavior on recent Preview | **PASS — fail closed** |
| Real Staging schema fields | Read-only Supabase Staging inspection confirmed `requested_guide_language`, `english_alternative_accepted`, `english_alternative_recorded_at`, `english_alternative_source`, `customer_id`, `lead_id` on `tour_booking_requests` | **PASS — field presence only** |
| Uniqueness | Staging has unique index on `(location_id, source, external_request_id)` | **PASS — structural protection** |
| Staging product state | `heroes-square` and `citadella-advanced` active; `buda-margaret-extended` currently `active=false`. The three tours remain request-only; do not override visibility/sales flags | **REVIEW** |
| Server secrets and relay feature flags | Non-decrypted Vercel project environment-variable listing exposed no RTB variables; it cannot attest to any hidden or separately scoped values | **NOT VERIFIED** |
| Enforceable ingress abuse control | Firewall API read for `active` returned `404 Seawall Config not found`; this does **not** establish that all protections are absent | **NOT VERIFIED** |
| Genuine end-to-end Staging CRM submission | No authenticated synthetic POST/CRM audit has been conducted | **NOT VERIFIED** |

**No-go rule:** Do not set `VOY_RTB_ABUSE_PROTECTION_VERIFIED=true` based solely on a document, static test, HTTP 404 smoke, platform-default DDoS protection, `Origin` header, or a flag named "verified". It must represent a demonstrably enforced limit at actual public ingress, tested with safe traffic on the intended deployment. Do not add a naive per-function in-memory counter; serverless instances and regions cannot enforce a global threshold.

### Low-overhead ingress proposal (NOT applied)

Vercel's documentation currently describes WAF rate limiting on all plans with a fixed window and an included request allowance; confirm the *account's plan, existing rule capacity and billing guard* before enabling. Reference: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting and https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing .

Proposed **review-only** rule: exact request path `/api/request-to-book` **AND** HTTP method `POST`; count by source IP, fixed window 10 minutes, indicative threshold 20 requests per source per window; exceeders return `429`. Do not enforce immediately: evaluate shared hotel/group NAT behavior, false positives, existing rule budgets and actual usage. A staged `Log` phase permits measuring candidates but provides *no actual throttling* and therefore is not sufficient to set the abuse-protection flag.

A rate-limiting action should be applied only after owner approval and controlled Staging tests confirm path/method scope, actual 429s, no blockage of unrelated website routes, safe recovery after the window and a rollback path. Since the existing Vercel staging project serves `voy-pro.com`, configuring Firewall there may affect **real customers** even if the request intake itself is disabled. Prefer a dedicated isolated Staging ingress or an approved rollout that is explicitly safe for the public alias.

### One-time authorized Staging CRM smoke — future execution contract

1. Confirm isolated Staging Vercel domain/project, per-environment secrets and actual WAF 429 behavior. Never paste secrets into chat, CI logs, or repo.
2. Verify Staging `FBM_REQUEST_TO_BOOK_INTAKE_ENABLED` is approved for the controlled test, its schema parity, product flags and the intended location. Do not touch the separate Production DB or public alias.
3. Submit one obviously synthetic unique `requestId` and non-real contact data for an active Budapest request-only product via the actual website form and relay.
4. Verify exactly one `tour_booking_requests` row, matching language and consent audit fields, populated `customer_id` and `lead_id`; only `pending_review` and no departure, hold, booking, receivable or payment.
5. Retry identical immutable body and UUID: same request and linked CRM identifiers. Retry same UUID with changed language or opt-in: HTTP 409 and no additional CRM side effects. Verify concurrent duplicate safety as an independent step.
6. Switch test-only enabling flags off again, confirm 404 `request_intake_disabled`, and retain only non-PII evidence and rollback documentation.

**Open state:** all runtime activation, real CRM writes, Firewall configuration, secret changes, and Product/Production mutations remain out of scope until explicit approval.


### Reproducible live disabled-ingress smoke (read-only)

After reviewing a deployment, an operator can test whether a specific VOY PRO website ingress is **still disabled** by running:

```bash
node scripts/verify-rtb-disabled-live.mjs --origin=https://voy-pro.com
```

The script makes only a `GET /api/request-to-book` against an explicitly allowlisted HTTPS website host, with no contact details, body, authorization header, or redirects. It requires **HTTP 404** with JSON `{"error":"request_intake_disabled"}` and `Cache-Control: no-store`. An SSO response, generic Vercel 404, 405, redirect, wrong hostname, network error, or unexpected response fails closed; it never claims success. For isolated Preview use an exact deployment origin under the allowlisted `voy-pro-staging-...-eli1979-5448.vercel.app` host format, provided that Preview access permits the request.

The offline fake-response regression `scripts/test-rtb-live-disabled.mjs` runs in site QA, but **does not make a real HTTP request**. The live script runs only after an operator supplies `--origin`; it must not be treated as evidence of WAF enforcement, CRM/FBM E2E, a safe enabled POST, or approval to change flags. Checking a disabled GET does not exercise a throttling rule. To activate intake, the separate owner-gated firewall and synthetic Staging CRM acceptance tests above remain necessary.

**Read-only Vercel observation (2026-10-23):** the public `voy-pro.com` domain remains attached to `voy-pro-staging`; the read for the active Vercel Firewall configuration returned `404 Seawall Config not found`. The result does not establish that all protection is absent, but cannot substantiate the release requirement of enforced per-path throttling. No Firewall rule or environment variable was changed by this check.
