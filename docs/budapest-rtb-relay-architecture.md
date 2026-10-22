# VOY PRO Budapest — Request-to-Book private relay (draft, disabled)

**State 22 October 2026: no public activation.** The public website is static and FBM's `POST /api/public/request-to-book` requires a private server-side `x-fbm-intake-secret`; the secret must never be exposed in browser code, HTML, public runtime configuration, GitHub or analytics.

This branch introduces a root `api/request-to-book.js` Node.js Vercel Function and local regression tests only. A Vercel project using a build command + `outputDirectory: "dist"` should be able to include root `api/` Vercel Functions by convention, but a READY build is not proof that the function route works. Verify function routing in Preview before any release. **No `site/` browser code calls this function**, and the PR #373 WhatsApp handoff remains independent.

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
- The current website form draft PR #373 remains a **manual WhatsApp handoff** and is not connected to this relay. Never enable both runtime flags merely because the Preview function is available.

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
3. Update the client PR #373 to POST to the same-origin route (no secret) and clearly distinguish `202` vs `400`, `409`, `503`, with retries retaining identical UUID+payload.
4. Synthetic end-to-end acceptance through Staging CRM; no payments or confirmation.
5. Obtain explicit owner release approval before merging, enabling or attaching public domains.

## Validation hardening — request/consent replay

The relay accepts only **canonical RFC 4122 UUID v4** external request keys generated by the browser's `crypto.randomUUID()`, not ad-hoc or low-entropy keys. It rejects a claimed English fallback of `true` when English is the primary guiding language; the real website hides that checkbox when English is selected and always sends `false` in this case.

The isolated mocked-upstream regression exercises **two identical POST retries** (same acknowledgement), then **changes to language or consent using the same request key** (409). This tests serialization parity and prevents a mistaken future change from silently accepting a modified payload under the old key. The definitive replay guard remains in the FBM CRM intake and still needs a real Staging synthetic write test before public activation.

Read-only Staging product preflight on 2026-10-22: all three special tours have `sales_enabled=false`, `public_enabled=false`, `website_visible=false`; the extended Buda + Margaret record additionally has `active=false`. A pending human-review request is not a public sale. Confirm whether the extended tour's `active=false` is intentional before enabling intake; do not alter canonical product flags in this PR.
