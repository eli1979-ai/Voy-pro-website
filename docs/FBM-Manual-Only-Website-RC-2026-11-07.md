# FBM Manual-only website source RC — 2026-11-07

**Status: source-only / no public deployment / NO-GO until server gate.**
Repo `eli1979-ai/Voy-pro-website`; base `237c723d169bdcef58eb872a8725bd16e0a2b540`. This is a pre-merge integration check of source from draft PRs #764, #765 and #769. No business mode or runtime configuration has been activated.

## Source composition

- #764: retain a **single** final `await load()` in generated `dist/manage/index.html`; preserve confirmed read-back checks on departure changes. Real Chrome tests serve the actual built HTML from localhost and intercept all non-local origins.
- #765: only `HTTP 423` with `PUBLIC_BOOKING_MANUAL_ONLY` enters localized EN/HE/HU booking-paused, no-confirmation, human-WhatsApp UX. Generic 403/409 behavior is retained.
- #769: when (and only when) browser runtime specifies `manualOnly: true`, first-party public checkout/API bridge, session starts, expired Stripe retry links, stored checkout selection, RTB submission UI and affiliate embed UI are disabled. Normal config unchanged.
- The #763 manual-only acceptance harness is the **byte-identical source basis**, with only extra built-page Chrome scenarios from #764; no original assertions dropped or softened.

## Server dependency / security gate

Website UI changes are **not authorization**. FBM Core draft #1092 must be independently approved, installed and verified in authorized Staging before any public release. Server `HTTP 423` + `PUBLIC_BOOKING_MANUAL_ONLY` is required, bound to persisted destination/public client and server-only location UUIDs. Required denied public paths include **POST** `/api/v1/bookings`, `/holds`, `/quotes`, `/booking-capacity-requests`, `/payments/intents`, `/sessions`, `/attribution/sync`; **GET** schedule-writing `/experiences/:id/availability` and calendar; legacy `/api/public/v1/bookings`, `/api/bookings/create`, `/api/payments/create-checkout` and direct PostgREST/RPC. Cover copied public keys, forged Origin, stale JS, off-site affiliate embed, cross-branch and both direct and browser transports.

Allow existing authenticated staff manual bookings; Manage token-protected historical booking details according to independent server checks. No historical online payment promise while the legacy checkout is blocked for the pilot location; do not silently enable a new payment route.

## Gates for the protected release candidate

1. **Source QA** on exact composite SHA: `npm run build`, `npm run verify:launch`, `npm run qa:site`, browser/mobile/RTL QA with all original 19 manual-only assertions, 13 423 UX assertions and both Manage scenarios; all external browser requests synthetic/blocked. Explicitly review EN/HE/HU Budapest, EN/HE/PT Marvão, WhatsApp href and no sends, affiliate widget, RTB, restored Stripe retry, no false booking/payment confirmation.
2. **FBM gate**: owner-reviewed #1092 tests in isolated local PostgreSQL with signed Auth/RLS/PostgREST, exact HTTP 423 route matrix and no write side effects; then explicit, independent owner approval for code+environment Staging installation, followed by isolated Staging checks. Confirm correct Budapest UUID and web client key binding, with no effects on other branches or staff.
3. **Preview gate**: only after explicit approval, use a protected, isolated Vercel Preview on a reviewed `preview/**` branch that is NOT aliased to public domains; validate the exact SHA and pilot server connection in an owner-approved test environment. **Do not** assume the Vercel project `voy-pro-staging` is disposable: it serves `voy-pro.com`.
4. **Merge & publication gate**: never merge #764, #765, #769 or this composite without explicit owner approval. `main` deploys to a public domain; verify automatic deployment mappings and perform a final safety audit immediately before any approved source merge. No PR merge automatically authorizes public activation, mode change, DNS, payments or runtime config modification.
5. **Manual pilot go/no-go**: smoke check WhatsApp→CRM/manual booking→guide/vehicle allocation→check-in→completion with synthetic data first; verify no client can make public bookings, holds, payments or schedule writes. Monitor denied-request counts, customer-facing WhatsApp fallback and public page reachability.

## Safe sequence and rollback

Review #764 then #765 then #769 source independently, then test this composite exact SHA. Server #1092 must independently pass its gate before public release; do not rely on source order to provide enforcement. Owner must authorize all protected steps separately. After approved activation, roll back **website presentation** to the previous verified public deployment / revert isolated source patch if necessary, while **retaining the server's 423 deny gate**. If a server revert would reopen public booking, do not perform it without a separately approved fail-closed alternative. Keep the previous public commit and deployment IDs for exact rollback; never alter alias/DNS implicitly.

**No public exposure, no direct FBM business writes, and no Vercel Preview is authorized by this document or RC.**
