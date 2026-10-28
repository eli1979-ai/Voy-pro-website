# GitHub Development Platform Strategy — VOY PRO Website

**Status: prepared only.** No Codespace/agent/billed service created. No change to production domains, CI workflows, `vercel.json` or security controls. These proposals require a separately reviewed change for activation.

## Verified current state (2026-10-28)

- Public repository `eli1979-ai/Voy-pro-website`; static `site/` builds `dist/` via `npm run build`, with many important embedded checks; all must remain.
- Site's `vercel.json` already suppresses ordinary Git branch previews and enables `main`, `release/**`, `preview/**`. The project named `voy-pro-staging` actually serves public custom domains. Keep it unchanged.
- The previous cost analysis reported 12 production-target `main` deployments in one period. Team-wide Vercel Build CPU reduction is preliminary; website-only savings have **not** been proven.
- Standard GitHub-hosted Actions for a public repository are generally free. This does not make Codespaces, Copilot credits, premium models, Marketplace subscriptions, third-party scanners or Vercel builds free.

## GitHub platform operating model

1. Keep one atomic draft PR per issue. Test on GitHub Actions; create a Vercel Preview only when integrated browser/API testing requires one. Preserve existing public Production routing, noindex headers, redirects and checkout protections.
2. Prepare a shared GitHub Projects board across FBM and website with fields: repository, task, owner, domain, risk, dependent PR, evidence, blocking reason, stage, required approval and release target. Creating the actual board is a separate step, not accomplished by this file.
3. Use GitHub Copilot Free only on a verified eligible IDE/GitHub session and limited free quota, for short, non-sensitive code explanations or diff reviews. GitHub connector access from ChatGPT is not Copilot access. Do not enable paid cloud agents or automatic review loops.
4. Review native Dependabot **alerts** first. Do not add `.github/dependabot.yml` until PR volume, dependency churn, CI minutes and branch gates are measured; auto updates can launch additional jobs. Evaluate public CodeQL separately for risk, need and cost; AI credit-consuming scans are not automatically free.
5. Avoid third-party GitHub Marketplace integrations until their pricing, permissions, retention, security and actual added value have been independently assessed.

## Optional Codespaces pilot

`.devcontainer/devcontainer.json` defines a minimal official Node 22 development container with 2-core/4GB requirement. It does **not** auto-install dependencies, start tests, run a DB, forward ports or import secrets. A Codespace is started only when explicitly created, and its compute and stopped-storage usage are billed to the separate Codespaces allowance.

Before first start, check account allowance/usage (GitHub Pro typically 180 core-hours and 20GB storage per month), enable a Codespaces budget with stop-usage and shorten the default idle timeout to 5–10 minutes in Settings → Codespaces. Closing the browser tab alone does not stop the Codespace. Keep ports private and use no customer/Stripe/Supabase/WhatsApp production credentials.

Manual source-only website commands after opening the Codespace:
```bash
node --version
npm run build
npm run verify:launch
npm run qa:site
```

No remote database, Vercel deploy, additional Actions runs or external providers should be triggered by these steps. Codespaces is not a replacement for required CI checks.

## Budget and acceptance

User configured a $10 monthly Actions budget; it is **not verified** whether overspending is blocked. Track Actions minutes by repo/runner, Codespaces core-hours/storage, Copilot credits, Marketplace fees, Vercel build charges and agent API cost separately. Target near-zero incremental spend without degrading safety or pushing hidden costs to another service.

No modification to `.github/workflows/**`, Production, deployed settings, package dependencies, business/checkout rules or merge is authorized by this roadmap. Report precise build/test evidence and rollback plan before proposing implementation. For subsequent PRs, first measure baseline and safe Copilot use, then optionally pilot a manually controlled Codespace, then consider a GitHub Projects view and dependency/security integration. No purchasing or enabling paid features without owner approval.
