# Public release readiness – VOY PRO site

The public alias `voy-pro.com` and `www.voy-pro.com` were observed pointing
to the Vercel project `voy-pro-staging` on 2026-10-08. Therefore,
`VERCEL_ENV=production` alone **does not identify a public-ready release**:
it is also used for production-target deployments of the staging project.

## Read-only preflight

```sh
npm run verify:public-release
```

This command exits nonzero when the *checked-in source files* still have a
staging release flag, blocked robots, or staging booking API / client key.
It does not deploy, enable indexing, or switch the booking backend.
Normal staging builds use `npm run build` and are not blocked by these
public-cutover checks; the guard's fixture tests do run in CI.

## Production cutover checklist

- Establish and verify the intended environment/domain boundary and Vercel alias.
- Prepare production FBM endpoint and a suitable public client key; validate
  availability, booking, payment, and confirmation against the actual endpoint.
- Set release target and SEO indexability consistently; enable crawler access
  and sitemap only when the public release is ready.
- Run `npm run verify:public-release` against the final proposed source.
- Manually test mobile, RTL, contact forms, WhatsApp and analytics attribution.
- Obtain owner approval before changing the public alias, payment environment,
  or indexing policy.

**Not a runtime/ownership check:** The script cannot validate Vercel domain
aliases or live Stripe/FBM credentials. It does not replace those checks.

## Verified environment reality — 23 October 2026 (read-only)

Checked the connected Vercel projects/deployment aliases and current website `main` source; separately consulted checked-in `launch/production-environment.json` and the merged shell-provisioning PRs (#365 and #366). A checked-in attestation is not itself a live database/API acceptance test.

| Surface | Evidence as of 2026-10-23 | Consequence |
| --- | --- | --- |
| Public website + aliases | `voy-pro.com` and `www.voy-pro.com` still belong to Vercel project `voy-pro-staging` (`prj_mllzA4eTnK6ITda3AI7BpHbmVe7j`); `www` redirects to the apex | Public traffic is **still on the staging project** |
| Latest staging website build | Vercel READY at `a98d669` on `main`; build emitted successful site/review QA | Verifies build/static contracts **only**, not visual browser QA or independent public release |
| Separate website Production shell | `voy-pro-production` (`prj_BH99wHz2Loh0gU8UF7zjpgzXT12y`) exists, is protected by SSO, has no domains and **no deployment** | Identity provisioned; **not live or cut over** |
| Staging FBM API | `ezraider-os-staging` (`prj_h5j84vU4HLucTxiWtQQUue9zcn1V`) remains the website's runtime API | Existing public booking path still depends on staging |
| Production FBM Vercel identity | `ezraider-os-production` (`prj_fNkNsAOtZVqGlFsBAieFmehkDPeg`) recorded in the checked-in production manifest and #365 | An isolated shell identity **does not attest** to a functioning API, keys or payment readiness |
| Production Supabase identity | `EZRaider OS Production` project ref `slfwrgssovjqcqdigzqo` recorded after creation on Free in #366; manifest says empty/no migrations | **No usable production schema is attested**; independently verify state before migrations |
| Staging → Production migrations | #366 recorded 515 repository migration files vs. 564 staging history records (48 extra distinct names) | Reconcile actual histories before any Production schema import |
| Website release + crawlers | `site/release.json`: `target=staging`, `seo_indexable=false`; `site/robots.txt`: `Disallow: /` | Indexing remains intentionally blocked |
| Website browser API | `site/assets/runtime-config.js` still targets `ezraider-os-staging.vercel.app/api/v1` with a staging browser key | Production API host/public key and consumer contract are **not verified** |
| Request-to-Book | Server relay exists but remains disabled; no `VOY_RTB_*` env names in the currently visible `voy-pro-staging` env list | No real website → FBM/CRM intake proven; retain manual WhatsApp fallback |
| Ingress abuse protection | Active Vercel firewall config request returned `404 Seawall Config not found` | **Not verified**; this does not prove the absence of every security control |

**Verdict: NO-GO** for public Production cutover, payment enablement, SEO indexability or DNS/alias changes. A deployment with Vercel target `production` **inside `voy-pro-staging` is not an isolated Production deployment**. Do not turn on the RTB relay based on passed mock tests or a self-declared abuse-protection flag.

The merged affiliate booking widget (#355) remains a pilot foundation, not proof of partner-origin CORS, affiliate/client-key binding, commission accrual or live payment readiness.

### Evidence still required before cutover

1. **FBM-owned:** reconcile Staging migration history and provision/verify schema and configuration in the separate Production database. Check real deployment identity, access policies, secrets and rollback/backup procedure; never reuse Staging secrets or data.
2. **FBM + website contract:** obtain a stable Production public API base URL and browser-scoped client key, verify allowed origins and end-to-end catalog → availability → quote → hold → booking → payment capability → confirmation → Manage Booking, using production-safe checks only. No unauthorized live charges.
3. **Website Request-to-Book (separate release gate):** verify enforceable path-scoped ingress rate limiting on an isolated ingress, install server-side staging credentials only with approval, and run a synthetic linked request/CRM acceptance and idempotency replay test. Keep `VOY_RTB_RELAY_ENABLED` off until all conditions and owner approval are met. See `docs/budapest-rtb-relay-architecture.md` and FBM issue #820.
4. **Website release candidate:** prepare a separately reviewed Production-scoped `release.json`, runtime API/client key, crawler settings, canonical/hreflang/sitemap and a domain-switch/rollback plan that preserves the independent EZRaiderEU channel. Run `npm run verify:public-release` and all ordinary validation gates.
5. **Human checks and approvals:** actual desktop/mobile, touch/RTL, WhatsApp, affiliate attribution, bookings, cancellation and refund behavior must be tested. Explicit owner approval is mandatory for aliases, DNS, indexing, payments, credentials or Production data changes.

**Scope of this revision:** documentation-only reconciliation of read-only observations and already-recorded shell creation. No deploy, database migration, credentials, security policy, payment setting, domain alias, robots or runtime configuration changed.
