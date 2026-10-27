# VOY PRO Website development cost and CI/CD policy

Status: **operating guidance with an approval-gated Vercel Git Preview rollout**. The checked-in `vercel.json` on each branch is authoritative; a change proposed in a Draft PR is **not active on `main`** until independently approved and merged. This document never authorizes public-domain, checkout, security or Production changes.

## Purpose and scope

Keep the customer-facing VOY PRO website iterating quickly while minimizing redundant billable Vercel builds. Favor GitHub Actions and locally assembled static artifacts for routine validation; reserve Vercel deployments for meaningful release candidates and end-to-end verification.

Repository: **public** `eli1979-ai/Voy-pro-website`; do not place secrets, customer data, private test fixtures or deployment credentials in build artifacts or PRs. Coordinate changes to booking availability, prices, discounts, attribution and API consumers with the FBM owner. Do not edit the FBM repository from website tasks.

## Verified project facts and critical caution

- Current GitHub workflow `.github/workflows/verify-staging.yml` runs `npm run build`, launch readiness, site QA and many regression assertions on push to `main` and pull requests.
- `package.json` composes many validators into the build script and creates `dist/`. Preserve these checks or provide proven coverage equivalent to the existing checks.
- The **manual** Prebuilt workflow `.github/workflows/deploy-prebuilt-staging.yml` uses the pinned official Vercel CLI and a reviewed `main` source. The no-deploy run [#40549976170](https://github.com/eli1979-ai/Voy-pro-website/actions/runs/40549976170) and protected Preview run [#40553212926](https://github.com/eli1979-ai/Voy-pro-website/actions/runs/40553212926) **both succeeded** on 2026-10-27, proving GitHub-built output, route/security/redirect parity, isolated `vercel deploy --prebuilt`, and protected Preview HTTP checks. The Preview has no public-domain aliases. This **does not approve Production deployment**.
- The Vercel project called `voy-pro-staging` was observed serving the custom domains `voy-pro.com` and `www.voy-pro.com`, with production-target deploys. **Do not treat the project name `staging` as proof that it is disposable.** Verify live mapping before touching it.
- A public GitHub repository generally allows standard GitHub-hosted Actions runners without billed Actions minutes under GitHub's prevailing rules. Confirm current account conditions and runner types; third-party/AI, larger runners and related services can have separate charges.

## Standard workflow

1. Read current `main`, make one atomic feature/fix on its own branch, and use a draft PR. Keep PR scope narrow and follow `AGENTS.md`.
2. Run fast local targeted checks as changes are made; use GitHub Actions to validate exact source/build output. Do not create Vercel previews just to validate text, translations, CSS syntax, docs or tests.
3. Keep all required `npm run build`, `npm run verify:launch`, `npm run qa:site` and relevant SEO/language/mobile/accessibility/payment/booking security gates. Optimize redundant execution **only if** before/after evidence shows equal coverage.
4. Where user-facing visual or API integration testing is needed, assemble a reviewed release candidate and produce one protected Vercel preview with relevant browser/smoke checks. Do not require every corrective commit to create a new Vercel build.
5. Merge/promote only after required checks and explicit owner approval. Avoid automated changeover of public domains. Check noindex/canonical URLs, SEO behavior and booking flow against exact candidate after any deploy path change.

## Build/deploy cost controls — verified candidate, merge still gated

- Inventory Vercel previews and production deployments separately; count excessive branch builds and build failures. Team-wide Build CPU charges also include other projects, so do not attribute all of them to this website.
- An approved candidate for `git.deploymentEnabled` explicitly permits `main`, `release/**` and `preview/**` while disabling routine branch Previews with `"**": false`. **Vercel states a matching `true` wins.** On 2026-10-27, controlled Git pushes showed **zero** deployments for routine `ci/vercel-preview-allowlist-20261027` while the `preview/cost-policy-rc-20261027` and `release/cost-policy-rc-20261027` branches each produced **one READY Preview**, without public-domain aliases. Three GitHub CI checks remained green for the routine branch. See Draft PR #575. These observations do not mean the candidate has already been merged to `main`.
- Do not substitute `ignoreCommand`, disable Production Git integration, bypass deployment protection or remove any full GitHub QA gate.
- Evaluate a GitHub-produced `dist/` artifact published via Vercel Build Output API / prebuilt deployment. Confirm exact parity with current `vercel.json` redirects, headers, trailing slashes, static files, robots/noindex rules, runtime API paths, environment semantics and deployment protection; never accept a shortcut that silently omits security headers or public redirects.
- For any deploy CLI, pin a reviewed exact version and use protected `VERCEL_TOKEN` environment secret rather than embedding tokens in command lines or logs. Restrict any secrets-bearing job to reviewed, appropriately approved source.
- Only benchmark Vercel build machine tiers where builds still run on Vercel. Compare billable dollars and latency, not headline minute price.
- Keep Production domains and automatic production deployment active until an approved replacement has passed a rollback test. Current custom domain mapping takes priority over misleading project labels.

## Optional GitHub Copilot Free assistance

GitHub Copilot Free is an **optional helper**, not a substitute for the website's CI, automated validation or review/approval process.

1. Verify authenticated Copilot access **in the current agent/IDE/CLI environment** before attempting to use it. Access to the GitHub repository does not mean this chat or its tools can invoke Copilot; report accurately when no direct access exists.
2. Within the **confirmed remaining free-tier allowance**, use Copilot selectively for high-impact debugging, explaining failing checks, reviewing focused diffs, or proposing improvements that may avoid redundant builds. Do not invoke it on every commit or create any mandatory Copilot gate.
3. Require explicit owner approval before installing/integrating Copilot CLI in automation, changing credentials, enabling a paid feature, accepting usage beyond the free allowance, or modifying GitHub Actions/production deployments. Check account privacy and data-use settings before enabling any access.
4. Never send secrets, customer or booking data, payment details, private FBM interfaces/code, private production traces or unpublished business materials to Copilot. Even though this website repository is public, minimize prompts and sanitize identifiers. Respect third-party source/license conditions.
5. Treat Copilot suggestions as **untrusted** and validate them through existing build, localization, SEO, accessibility, security, booking/checkout and browser QA gates. Maintain human approval for merges and all deployment changes.
6. Record what Copilot actually did, any useful result, usage/quota constraints and when access was unavailable. Do not assert that Copilot tested or reviewed a PR unless it demonstrably did so.

The presence of this section does not install, connect or authorize Copilot in any chat or CI runner.

## Measurement and change control

Measure per week and per billing cycle: GitHub workflow minutes (standard vs any charged runners), Vercel build CPU cost, preview/deploy count, median and p95 test and deploy duration, cache hit rate, failed builds, remaining free/paid quota, and booking/SEO regression rate. Working objective: reduce unnecessary Vercel Build CPU by approximately 80% while preserving all required site checks and no-cost standard public repository Actions where applicable. Targets are not guarantees.

Any implementation PR must explain: cost hypothesis, exact triggers changed, tests maintained, staging/live domains affected, prior and projected build count, evidence of preview/production parity, safe rollback, and whether owner approval is needed.

## Sequenced rollout and remaining gates

1. **Baseline collected:** separate production-target and Preview deployment counts, build-wall-time samples and team-wide Build CPU charge categories; custom-domain routing inspected.
2. **Prebuilt proven:** an official GitHub-runner build and isolated protected Preview succeeded. It is not permission to deploy or promote to Production.
3. **Allowlist tested:** Vercel's actual Git integration suppressed one routine branch while preserving explicitly named `preview/**` and `release/**` branch Previews; their HTTP security/noindex checks passed. This is separate from future live `main` verification.
4. **Requires owner approval:** merge the rollout PR only after full green CI and reviewed real-branch evidence; `main:true` must remain intact. Immediately verify the Git-connected Production-target deployment, domain aliases and public noindex/security behavior on the exact approved merged commit. If anything fails, revert only the Git Preview allowlist block, preserving all headers, routes, payment behavior and domains.
5. **Measure later:** compare Vercel build counts and attributable billing over a normal development cycle, not just the two one-off verification Previews. Any GitHub branch-protection/ruleset hardening is a separate approval-gated security task.

This policy does **not** permit altering `.github/**`, `vercel.json`, package dependencies, production settings, payment/business rules or merging PRs without the existing explicit approvals.
