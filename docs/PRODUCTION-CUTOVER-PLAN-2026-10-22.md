# VOY PRO W2.1 — Production infrastructure evidence and cutover gate

**Checked: 2026-10-22. Status: NO-GO for public Production switch.**
This file describes the next operational steps; it does **not** authorize a
production migration or a payment-mode change.

## 26 October 2026 — fresh independent provider verification (read-only)

**Decision: still NO-GO.** This update supersedes stale impressions that
Production infrastructure has not yet been provisioned; it does **not** mean
Production applications, bookings or payments are ready.

| Component | Direct observation, 2026-10-26 | Operational conclusion |
| --- | --- | --- |
| Website Staging Vercel project | `voy-pro-staging`, ID `prj_mllzA4eTnK6ITda3AI7BpHbmVe7j`, has `voy-pro.com` and `www.voy-pro.com` aliases; latest `main` deployment is `READY` | Public hostname still points to **Staging** |
| Website Production Vercel project | `voy-pro-production`, ID `prj_BH99wHz2Loh0gU8UF7zjpgzXT12y`, exists; `live=false`, `latestDeployment=null`; Vercel Authentication applies to all deployments; only default project hostname attached | **Protected empty project shell**, no Production website release |
| FBM Production Vercel project | `ezraider-os-production`, ID `prj_fNkNsAOtZVqGlFsBAieFmehkDPeg`, exists; `live=false`, `latestDeployment=null`; Vercel Authentication applies to all deployments; only default project hostname attached | **Protected empty project shell**, no Production API release |
| FBM Staging Supabase | `EZRaider OS Staging`, ref `ieuuobbfginqkngkzbfa`, `ACTIVE_HEALTHY` (current provider listing) | Independent Staging database still operational |
| FBM Production Supabase | `EZRaider OS Production`, ref `slfwrgssovjqcqdigzqo`, `ACTIVE_HEALTHY`, `eu-central-1` | Separate project is provisioned; **not** an application-ready database |
| Production schema | A read-only `information_schema.tables` count returned **0 public base tables**; the Production migration-history listing returned **0 applied migrations** | Schema and policies have **not** been deployed |
| Website source release | `site/release.json` has `target=staging`, `seo_indexable=false`; `site/robots.txt` disallows all crawling | Public Production index/SEO launch remains disabled |
| Production attestation | `launch/production-environment.json`: `status=unverified`, `owner_cutover_approved=false`, `public_api_base_url=null` | No Production cutover authorization |

**Do not confuse Vercel's deployment target `production` _inside_ the
`voy-pro-staging` project with a separate Production project.** The actual
`voy-pro-production` and `ezraider-os-production` shells still have no
deployed applications.

### Remaining work, in order

1. **FBM owner / separate development chat:** reconcile the migration baseline
   before touching the empty Production database. The 515 source migrations /
   564 Staging records / 48 extra distinct Staging names below were observed on
   **2026-10-22**, not reaudited in today's provider-status check. Document and
   test canonical migration replay in isolation; never blindly copy Staging
   data, keys or migration history.
2. **Infrastructure:** prepare protected, independent website and FBM build
   artifacts and environment-scoped public/private credentials. Keep Staging
   deployments unchanged and keep Production shells inaccessible to customers.
3. **Validation:** prove migration/schema/RLS parity, required Supabase
   security-advisor results, isolated backups/restoration, Production API and
   client-key origin/CORS policy, and the whole live availability → hold →
   booking → refund/cancellation contract without actual customer transactions.
4. **Payments and controlled cutover:** verify provider mode, permissions,
   failure handling and rollback. Require explicit owner approval before
   creating real-money transactions, changing domains, enabling indexation or
   connecting the public website to Production.

**This is an evidence-only checkpoint.** No migrations, Production
deployments, payments, aliases, DNS, robots, secrets or customer data were
changed while checking these facts.

---

## Verified state from connected providers

- Vercel website project: `voy-pro-staging` (`prj_mllzA4eTnK6ITda3AI7BpHbmVe7j`).
  Both `voy-pro.com` and `www.voy-pro.com` currently belong to it.
- Vercel FBM backend project: `ezraider-os-staging`
  (`prj_h5j84vU4HLucTxiWtQQUue9zcn1V`).
- The operational Staging Supabase project is `EZRaider OS Staging`
  (`ieuuobbfginqkngkzbfa`); a separate empty Production project is described below.
- Source `site/assets/runtime-config.js` still requests the staging FBM API.
- `site/release.json` still has `target=staging` and `seo_indexable=false`.
  `site/robots.txt` still contains `Disallow: /`.
- A Vercel **production-target** deployment inside a project named staging is
  not a separate production application or database.

## Isolated Vercel shells created on 22 October 2026

Both resources now exist in the existing Vercel team, with Vercel Authentication
enabled for **all** deployments. They have **no connected Git repository,
no application deployment and no custom/public VOY PRO domain alias**.
Vercel's default `.vercel.app` project domains may still exist but require
authentication; this is not a public cutover.

- `voy-pro-production`: `prj_BH99wHz2Loh0gU8UF7zjpgzXT12y`
- `ezraider-os-production`: `prj_fNkNsAOtZVqGlFsBAieFmehkDPeg`

The public `voy-pro.com` alias remains on `voy-pro-staging`.
The independent Production Supabase database, API configuration, verified
payments, migration parity, and explicit release approval are **not** present.
The source release gate remains **NO-GO** and the recorded IDs in the
attestation do **not** mean the full environment is approved.

## Free-plan Supabase Production now provisioned — 22 October 2026

The existing `VOY Pro` organization returned a **$0/month** quote, and a new
project was created without a plan upgrade:

- Name: `EZRaider OS Production`.
- Project ref: `slfwrgssovjqcqdigzqo`; origin:
  `https://slfwrgssovjqcqdigzqo.supabase.co`.
- Region: `eu-central-1`; project health: `ACTIVE_HEALTHY`.
- Staging stays on its separate project `ieuuobbfginqkngkzbfa`.
- **No application tables or applied migrations yet** in new Production.
- No Production Vercel project has been connected to this database, and
  no payments, webhooks, customers, bookings or credentials were transferred.
- Free-tier projects can have capacity, sleep and backup limitations.
  Do not enable real customer transactions without a tested independent
  backup/restore and recovery plan.

### Migration reconciliation blocker before schema rollout

Read-only inspection found **515 GitHub migration files** under
`Ezraider-os/supabase/migrations` and **564 applied migration records**
in the existing Staging database. Every GitHub migration name appears
in Staging, but **48 extra distinct migration names** appear only in the
Staging history (one Staging name occurs twice). Historical migration
timestamps frequently differ, so naive version-number matching is not
a reliable parity check.

Before applying migrations to the new empty Production database, reconcile
the 48 staging-only changes to the canonical GitHub migrations, verify
the clean rebuild can reproduce the necessary schema/functions/policies,
and run security advisors. **Do not clone live/staging customer rows or
blindly replay Staging's migration ledger**. Document the authoritative
source migration baseline in FBM first.

The release attestation remains `status=unverified` and
`owner_cutover_approved=false` while all these checks remain outstanding.

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
