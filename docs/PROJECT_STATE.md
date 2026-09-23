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
