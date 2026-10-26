# VOY PRO Website development cost and CI/CD policy

Status: **proposed / documentation only**. This policy records the agreed direction and does not itself change GitHub Actions, Vercel settings, a live domain, required checks, or deployment behavior. Operational changes must be made via their own reviewed PRs and approved deployment changes.

## Purpose and scope

Keep the customer-facing VOY PRO website iterating quickly while minimizing redundant billable Vercel builds. Favor GitHub Actions and locally assembled static artifacts for routine validation; reserve Vercel deployments for meaningful release candidates and end-to-end verification.

Repository: **public** `eli1979-ai/Voy-pro-website`; do not place secrets, customer data, private test fixtures or deployment credentials in build artifacts or PRs. Coordinate changes to booking availability, prices, discounts, attribution and API consumers with the FBM owner. Do not edit the FBM repository from website tasks.

## Verified project facts and critical caution

- Current GitHub workflow `.github/workflows/verify-staging.yml` runs `npm run build`, launch readiness, site QA and many regression assertions on push to `main` and pull requests.
- `package.json` composes many validators into the build script and creates `dist/`. Preserve these checks or provide proven coverage equivalent to the existing checks.
- A **manual** prebuilt workflow exists in `.github/workflows/deploy-prebuilt-staging.yml`. It presently hardcodes an old release version (`1.33.0`), while the package version examined on 2026-10-27 was `1.48.99`. It also contains a hand-written Vercel output routes config. It is **not verified as a faithful, release-ready replacement**; review route/header/redirect parity, Git/commit provenance, secrets handling, failure/rollback, and protected-preview smoke access before using it.
- The Vercel project called `voy-pro-staging` was observed serving the custom domains `voy-pro.com` and `www.voy-pro.com`, with production-target deploys. **Do not treat the project name `staging` as proof that it is disposable.** Verify live mapping before touching it.
- A public GitHub repository generally allows standard GitHub-hosted Actions runners without billed Actions minutes under GitHub's prevailing rules. Confirm current account conditions and runner types; third-party/AI, larger runners and related services can have separate charges.

## Standard workflow

1. Read current `main`, make one atomic feature/fix on its own branch, and use a draft PR. Keep PR scope narrow and follow `AGENTS.md`.
2. Run fast local targeted checks as changes are made; use GitHub Actions to validate exact source/build output. Do not create Vercel previews just to validate text, translations, CSS syntax, docs or tests.
3. Keep all required `npm run build`, `npm run verify:launch`, `npm run qa:site` and relevant SEO/language/mobile/accessibility/payment/booking security gates. Optimize redundant execution **only if** before/after evidence shows equal coverage.
4. Where user-facing visual or API integration testing is needed, assemble a reviewed release candidate and produce one protected Vercel preview with relevant browser/smoke checks. Do not require every corrective commit to create a new Vercel build.
5. Merge/promote only after required checks and explicit owner approval. Avoid automated changeover of public domains. Check noindex/canonical URLs, SEO behavior and booking flow against exact candidate after any deploy path change.

## Build/deploy cost controls — for follow-on PRs, not automatic changes now

- Inventory Vercel previews and production deployments separately; count excessive branch builds and build failures.
- Consider Vercel ignored-build rules or explicit/manual preview deployment **only after** verifying that critical integration tests and required checks still run and public production releases are unaffected.
- Evaluate a GitHub-produced `dist/` artifact published via Vercel Build Output API / prebuilt deployment. Confirm exact parity with current `vercel.json` redirects, headers, trailing slashes, static files, robots/noindex rules, runtime API paths, environment semantics and deployment protection; never accept a shortcut that silently omits security headers or public redirects.
- For any deploy CLI, pin a reviewed exact version and use protected `VERCEL_TOKEN` environment secret rather than embedding tokens in command lines or logs. Restrict any secrets-bearing job to reviewed, appropriately approved source.
- Only benchmark Vercel build machine tiers where builds still run on Vercel. Compare billable dollars and latency, not headline minute price.
- Keep Production domains and automatic production deployment active until an approved replacement has passed a rollback test. Current custom domain mapping takes priority over misleading project labels.

## Measurement and change control

Measure per week and per billing cycle: GitHub workflow minutes (standard vs any charged runners), Vercel build CPU cost, preview/deploy count, median and p95 test and deploy duration, cache hit rate, failed builds, remaining free/paid quota, and booking/SEO regression rate. Working objective: reduce unnecessary Vercel Build CPU by approximately 80% while preserving all required site checks and no-cost standard public repository Actions where applicable. Targets are not guarantees.

Any implementation PR must explain: cost hypothesis, exact triggers changed, tests maintained, staging/live domains affected, prior and projected build count, evidence of preview/production parity, safe rollback, and whether owner approval is needed.

## Sequenced rollout — new PRs required

1. Collect historical build counts/cost per project and check current live domain mapping.
2. Repair and independently validate the existing manual prebuilt workflow as a *non-production experiment*; do not invoke it for live release until its outdated hardcoded version and routes/security parity are fixed.
3. Run a no-cost Actions build against a disposable preview, verify page routing, multilingual pages, API/checkout flows, robots headers, redirects, and published content.
4. Only after evidence and human approval, propose reducing redundant Git-triggered previews, keeping an explicit release route and safe rollback.
5. Recheck costs and quality after a full billing period.

This policy does **not** permit altering `.github/**`, `vercel.json`, package dependencies, production settings, payment/business rules or merging PRs without the existing explicit approvals.
