# GitHub Copilot instructions — VOY PRO Website

Read `AGENTS.md`, `docs/DEVELOPMENT-COST-POLICY.md` and `docs/GITHUB-PLATFORM-STRATEGY.md` before working on the site.

- Work on one atomic change per branch and draft PR; inspect actual `main` and never infer code state from chat history. Do not modify FBM core here.
- FBM is canonical for price, capacity, payment, booking, discounts, waivers and availability. The website must only consume approved FBM APIs; never invent prices or availability.
- Preserve EN/HE/HU/PT language coverage, mobile RTL, SEO, accessibility, consent, analytics privacy, booking/Manage and checkout security. Run the existing `npm run build`, `npm run verify:launch`, `npm run qa:site` and applicable browser tests.
- This repository's Vercel `git.deploymentEnabled` allowlist protects routine branches, but the `voy-pro-staging` project serves public domains. Never change `main` deployment, aliasing, security headers, redirects or noindex without separate approval.
- No automatic merge, production rollout, paid agent/service, marketplace integration, credential change, Codespaces start or GitHub workflow modification. Copilot assistance must stay within confirmed free allowance and approved data-handling.
- Do not send private FBM sources, secrets, customer/payment data, private traces or unpublished business information to Copilot. Independently verify Copilot's suggestions; don't claim tests/reviews that did not run. Keep all mandatory safety checks.
- If Copilot isn't accessible in the current environment, state that fact and continue with existing tools.
