# VOY PRO W2.1 — Production infrastructure evidence and cutover gate

**Checked: 2026-10-22. Status: NO-GO for public Production switch.**
This file describes the next operational steps; it does **not** authorize a
production migration or a payment-mode change.

## Verified state from connected providers

- Vercel website project: `voy-pro-staging` (`prj_mllzA4eTnK6ITda3AI7BpHbmVe7j`).
  Both `voy-pro.com` and `www.voy-pro.com` currently belong to it.
- Vercel FBM backend project: `ezraider-os-staging`
  (`prj_h5j84vU4HLucTxiWtQQUue9zcn1V`).
- The only accessible Supabase project is `EZRaider OS Staging`
  (`ieuuobbfginqkngkzbfa`).
- Source `site/assets/runtime-config.js` still requests the staging FBM API.
- `site/release.json` still has `target=staging` and `seo_indexable=false`.
  `site/robots.txt` still contains `Disallow: /`.
- A Vercel **production-target** deployment inside a project named staging is
  not a separate production application or database.

## Safe creation order — keep public website untouched

1. **Supabase Production** (human-approved external provisioning): create a
   new project in the approved region/organization. Document the new
   non-secret project ref. Apply the canonical FBM migrations (new environment
   only). Do not import synthetic staging customers/bookings, overwrite real
   operational data or store admin passwords in Git. Run RLS, schema,
   bookings/hold and payment-ledger idempotency checks before any customers.
2. **FBM Production**: provision a separate Vercel project connected to a
   protected source branch/release, scoped to the new Supabase project.
   Explicitly set `EZRAIDER_RELEASE_CHANNEL=production`,
   `EZRAIDER_DEV_MODE=false`, the **new** Supabase public/server values
   and independently stored server secrets. Start with `ENABLE_STRIPE=false`,
   `PAYMENTS_LIVE_MODE=false` and other external outbound providers disabled
   until their own go/no-go gates pass. Never point at Staging on fallback.
   Validate `/api/health/ready`, `/api/v1/payments/capabilities`,
   availability, quotes, holds, bookings, cancellation and staff readiness.
3. **Website Production**: provision a second Vercel website project with
   **no public aliases yet**, separately from `voy-pro-staging`. Configure
   the browser `apiRoot` to the audited FBM Production `/api/v1` URL and
   a Production-scoped *public* browser client key. Verify CORS for the
   intended `https://voy-pro.com` origin without loosening other origins.
   Preserve all current staging preview projects and URLs.
4. **Attestation**: after independent live verification, put the actual
   new public identifiers in `launch/production-environment.json`:
   `website_vercel_project_id`, `fbm_vercel_project_id`,
   `supabase_project_ref`, `public_api_base_url`, and `verified_at`.
   No tokens, passwords, service-role keys, personal data or Stripe keys.
   Mark `status=verified` **only with actual provider evidence**.
5. **Owner release approval**: after reviewing source/target project IDs,
   production database and payment-mode plan, the owner expressly approves
   the cutover. Only then set `owner_cutover_approved=true` on the release
   candidate and enable release/indexability sources. Run
   `npm run build`, `npm run verify:launch`, `npm run qa:site`, and
   `npm run verify:public-release` against the **candidate**. Verify the
   actual new Vercel project/domain bindings externally too: a source
   manifest by itself cannot prove live ownership.
6. **Commercial acceptance**: in isolated staging use controlled test
   checkouts; in Production use provider-certified low-risk readiness
   checks, never an unapproved real payment. Explicitly check affiliate
   attribution, net-receipt commission posting, refunds, emails, language
   readiness, extras, child seating, Manage Booking, EN/HE/HU mobile/RTL,
   analytics attribution and support WhatsApp.
7. **Domain/SEO cutover**: only when approved, bind `voy-pro.com` and
   `www` to the new production website; perform URL smoke tests, HTTPS,
   canonical, sitemap and `robots.txt` checks; confirm no unintended
   legacy `EZRaiderEU` redirects or Search Console migration. Keep the
   existing staging domains as staging (no alias collision).

## Rollback

Record the pre-cutover public Vercel project and deployment IDs and the
current custom-domain configuration **before** switching. If there are
critical availability, booking, reconciliation, provider or SEO failures,
disable affected commercial features safely and restore the previously
approved website deployment/domain route. **Do not** blindly roll back
database migrations or replay/refund real payments: financial records need
a separately coordinated reconciliation/incident process.

## Static gate

`npm run verify:public-release` now also checks
`launch/production-environment.json` and blocks unverified or reused
Staging Vercel/Supabase IDs, missing explicit owner approval, malformed API
endpoints, and runtime API mismatches. Normal Staging builds remain possible;
the existing test suite includes an entirely synthetic positive fixture and
multiple negative fixtures.

**Limit:** this is a fail-closed *source check*, not provider attestation. A
successful test **never** constitutes a verified DNS switch, live Stripe
readiness or Production database authorization. No external resources,
aliases or live customers were changed by this task.
