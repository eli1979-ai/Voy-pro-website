# Cost-controlled Vercel Preview branches — approval-gated rollout

**Status: candidate only.** Neither `vercel.json` nor Vercel project settings contain this policy today. This document does not authorize modifying them. It is a release plan, not an instruction to bypass a required PR check.

## Verified 2026-10-27 baseline

- The website main commit `6929686c9bfcb5210d10c67ea03dd2959f41da26` passed the Staging and Prebuilt-offline GitHub workflows.
- That main commit deployed via the existing Git integration to the `voy-pro-staging` Vercel project, which owns public `voy-pro.com` / `www.voy-pro.com`. The public release remains `target=staging`, `seo_indexable=false`; do not infer independent Production readiness from a Vercel project name.
- Six sequential PR merges generated six separate Vercel Production-target builds; many development branch pushes also trigger billable Preview builds. The measured team-wide Build CPU cost is not a website-only estimate.
- Public Git-built served HTTP was inspected on the immutable latest main deployment: eight critical pages plus robots and JS had expected security/noindex headers; `/manage/` was `private, no-store`; `site.js`, `robots.txt`, `release.json` bytes matched main. The three legacy redirect URLs were observed reaching a valid HTML page, but their intermediate redirect status was not observable through the source connector.
- Offline #566 checks passed. **The official GitHub Actions `vercel build` and isolated `vercel deploy --prebuilt` pilot have not run.**

## Desired policy after the pilot succeeds

Vercel supports branch selection in `git.deploymentEnabled` using minimatch patterns. If a branch matches multiple rules, an explicit `true` wins; this is important for `main` and release candidates.

Candidate: `docs/candidates/vercel-git-preview-allowlist.json`. It contains only this block, which would later be **merged** into the existing `vercel.json`, never replace its other settings:

```json
{
  "git": {
    "deploymentEnabled": {
      "**": false,
      "main": true,
      "release/**": true,
      "preview/**": true
    }
  }
}
```

- `main`: retains current automatic production-target Git deployments and custom-domain assignment.
- `release/**` and `preview/**`: allow **reviewed** candidate-specific Git Preview deployments as an escape hatch.
- Other branches (feature, docs, CI and routine fixes): no automatic Git Preview deployment; GitHub Actions tests continue on every PR and push as currently configured.
- Manual reviewed `vercel deploy --prebuilt` remains a separate release path; this candidate is for **automatic Git-driven** deployments only. Verify this distinction in a protected pilot rather than assume.

## Release gates (all required before any activation)

1. Manually run `Validate VOY PRO prebuilt Staging (manual)` on `main` with `publish_preview=false`. Confirm the GitHub worker can authenticate, run Vercel CLI, produce `.vercel/output/` and pass official parity checks. If no repository `VERCEL_TOKEN` secret exists, configure it through protected GitHub Actions settings without displaying or copying its value.
2. For one reviewed candidate, run `publish_preview=true` and confirm a unique protected `.vercel.app` URL, complete security/noindex/redirect/Manage Booking parity, EN/HE/HU/PT pages, runtime assets and FBM read-only/sandbox booking checks. Do not assign `voy-pro.com`.
3. Confirm GitHub branch protections and required status checks do not depend on Vercel's automatically generated Preview status; full `npm run build`, `npm run verify:launch`, `npm run qa:site`, browser QA and booking fixture QA must still complete.
4. Verify the exact minimatch behavior on a temporary test project or reviewed test branch before changing the public-domain project's `vercel.json`; particularly test a routine branch, `release/rc-test`, `preview/rc-test` and `main`.
5. Only after explicit approval, apply the candidate Git block to `vercel.json` in its own PR and merge when CI is green. Observe deployment counts and statuses over the next normal development cycle. Keep production auto-deploy enabled throughout.
6. Roll back by removing only the `git.deploymentEnabled` block from `vercel.json`, then restore/confirm the public-domain auto-deploy path. Do not roll back by disabling the website or moving domains.

## Why not just use an ignored build step?

Vercel documents that `ignoreCommand` can avoid full build CPU when it exits 0, but those canceled attempts still count toward deployment quota/concurrency. Branch-based `git.deploymentEnabled` is the more direct way to suppress unneeded Preview deployments. It also removes automatic Preview status/URLs from affected branches, so the approval and manual-release escape hatch above are essential.

Docs: https://vercel.com/docs/project-configuration/git-configuration and https://vercel.com/docs/project-configuration/project-settings#ignored-build-step

Offline guard: `node scripts/test-vercel-git-preview-policy.mjs`. It checks the candidate's structure and eight unsafe mutations, and fails if suppression is unexpectedly applied to live `vercel.json`. It is deliberately **not a substitute for testing Vercel's real branch matcher**.
