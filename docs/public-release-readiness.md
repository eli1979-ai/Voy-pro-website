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

## Verified environment reality — 21 October 2026 (read-only)

This update was checked against the **connected Vercel and Supabase accounts and the current website `main` source**, not inferred from a deployment's `target=production` label.

| Surface | Observed current state | Consequence |
| --- | --- | --- |
| Vercel website | `voy-pro-staging` (`prj_mllzA4eTnK6ITda3AI7BpHbmVe7j`) | Public aliases share the staging website project |
| Domain `voy-pro.com` | Verified on `voy-pro-staging` | A READY deployment there is not independently production-isolated |
| Domain `www.voy-pro.com` | Verified redirect 308 to `voy-pro.com`, same project | Same staging/project boundary |
| Vercel FBM API | `ezraider-os-staging` (`prj_h5j84vU4HLucTxiWtQQUue9zcn1V`) | No separately identified production FBM project |
| Other Vercel project | `voy-pro-binary-test` | Test project is not evidence of production readiness |
| Supabase | One accessible project: `EZRaider OS Staging` (`ieuuobbfginqkngkzbfa`, `ACTIVE_HEALTHY`) | No distinct production database can be verified through this account |
| Website release source | `site/release.json`: `target=staging`, `seo_indexable=false` | Source deliberately blocks production SEO |
| Website robots | `site/robots.txt`: `Disallow: /` | Crawlers deliberately excluded |
| Website runtime API | `ezraider-os-staging.vercel.app/api/v1` | No verified production booking API URL and scoped key |

**Verdict: NO-GO for Production switch, payment enablement, indexing and DNS/alias moves.**
The newly merged affiliate-native booking widget (PR #355) is a pilot foundation only: its existence does not establish authorized partner-origin CORS, affiliate/client-key binding, commission ledger accrual, or production payment readiness.

### Evidence that would unblock cutover

1. Identify **separate** production website and FBM deployment project IDs, production Supabase project/ref, and deployment ownership. Obtain proof that none of the production identities reuse staging databases, keys or credentials.
2. Verify actual production public API URL, browser-scoped key, allowed origin policy and production payment capabilities (no live charges for tests).
3. Execute catalog → availability → quote → hold → booking/confirmation → Manage Booking read-only or isolated staging tests and production-safe smoke checks under explicit authorization.
4. Create a reviewed cutover and rollback plan for `voy-pro.com`, `www`, SEO robots/sitemap/indexability and existing EZRaiderEU phased parallel domain handling.
5. Only **after those external proofs exist**, prepare a separately approved release candidate and run `npm run verify:public-release` with a production-scoped source configuration. Follow with mobile/RTL/WhatsApp/affiliate testing.
6. Require explicit owner approval for the public aliases, production data changes, payments, credentials, DNS and indexing changes. A successful Preview or production-target build inside `voy-pro-staging` never constitutes that approval.

No Vercel project/domain, Supabase resource, deployment, payment configuration, runtime key, `robots.txt`, or `release.json` was changed in this audit.
