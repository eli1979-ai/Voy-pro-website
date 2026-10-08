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
