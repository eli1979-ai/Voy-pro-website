# VOY PRO Website Agent Rules

This repository is the source of truth for the VOY PRO customer-facing website.

## Operating model
- Inspect the current `main` implementation before changing anything.
- Perform exactly one atomic task at a time.
- Do not infer implementation state from chat history.
- Preserve existing business rules unless the task explicitly changes them.
- Prefer the smallest change that fully solves the requested task.
- Do not mix unrelated refactors into a task.
- Do not edit `legacy/` for new development.

## Required validation
After every implementation:
1. Run `npm run build`.
2. Run `npm run verify:launch`.
3. Run `npm run qa:site`.
4. Stop if any validation fails and fix only the failure caused by the task.
5. Report files changed, tests run, remaining risks, and the next recommended atomic task.

## Safety / authority
Allowed without further approval:
- Read repository state.
- Modify customer-facing website code under `site/`.
- Modify QA scripts under `scripts/` when required by the approved task.
- Update documentation that describes the completed change.

Requires explicit human approval before implementation:
- Changing business rules, pricing logic, payment behavior, legal text, production data, secrets, authentication, or external provider credentials.
- Editing GitHub workflows, `vercel.json`, `package.json`, or repository-level security/deployment configuration.
- Introducing a new dependency.
- Merging to `main`.
- Changing production database state.

## Delivery
Development-agent work must end as a branch + draft PR. Never merge automatically.
