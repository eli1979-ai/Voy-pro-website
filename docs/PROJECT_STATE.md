# VOY PRO Website — Project State

## Source of truth
The live implementation state is determined by:
1. GitHub `main` in `eli1979-ai/Voy-pro-website`.
2. The latest successful Vercel production deployment for project `voy-pro-staging`.
3. Passing repository validation workflows.

This document is a coordination aid, not a substitute for inspecting the repository and deployment.

## Orchestrator baseline
Created from:
- Initial branch baseline commit: `09116e1ee00eaa52e58e0a982bd7c66e6e060d96`
- Vercel project: `voy-pro-staging`
- Vercel project id: `prj_mllzA4eTnK6ITda3AI7BpHbmVe7j`
- Vercel team id: `team_AA8zTEaOrKIoyiAbn42L4CoU`
- Baseline deployment state: READY

## Existing quality gates
The repository already validates:
- build integrity;
- launch-readiness contract;
- site-wide static QA;
- booking and payment UI invariants;
- localization/accessibility regressions;
- sitemap, metadata and internal-link integrity.

## Development policy
- One atomic task per agent run.
- Agent work is isolated on a dedicated branch.
- Existing CI must pass before the result is considered reviewable.
- Vercel preview is used for customer-facing verification.
- Final merge to `main` always requires human approval.

## PR #28 image audit reconciliation

Audited current `main` at `58c5106` against the read-only PR #28 snapshot
(`d13d682`). All 12 Budapest/Marvão image files are already present with identical
contents. All intended image URL replacements and legacy preconnect removals
across the PR's 30 HTML files are also already present. No older page or runtime
files need to be copied over the newer checkout and accessibility implementation.

The temporary `scripts/discover-pombais-images.mjs`, its build hook and its
`ASSET_META`/`ASSET_CHUNK`/`ASSET_END` output are absent from current main and are
excluded from this reconciliation. The existing local Marvão photography and
customer-facing local-operator attribution remain in place.

`npm run qa:site` now rejects missing or empty local image references in HTML,
CSS and JavaScript (including versioned social images), and rejects reintroduced
EZRaiderEU/Pombais WordPress media dependencies. This check uses repository files
and does not fetch images during the build. Customer-facing files and protected
configuration are unchanged.

Validation passed: `npm run build`, `npm run verify:launch`, `npm run qa:site`
(61 HTML files, 39 sitemap URLs, zero QA warnings), and the unchanged inline
staging-artifact/booking UI assertions from `verify-staging.yml`. Isolated
temporary fixtures confirmed that versioned local images pass, while missing
images, empty images, runtime image errors and both legacy media hosts fail QA.

Draft PR creation and Vercel preview validation occur after the implementation
worker returns to the orchestrator; local validation does not establish preview
deployment success. The network-dependent public booking API smoke checks remain
for CI; this worker used only local source references and validation.
