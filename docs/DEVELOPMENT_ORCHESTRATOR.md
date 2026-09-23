# Development Orchestrator v1

## Purpose
The Development Orchestrator coordinates one approved VOY PRO Website development task from implementation through a reviewable pull request.

It is intentionally conservative. Version 1 does not choose product priorities, alter business rules, or merge code.

## Workflow
1. User defines one atomic task.
2. Orchestrator checks out current `main`.
3. Existing repository tests are run before changes.
4. Codex reads `AGENTS.md` and implements only the supplied task.
5. A protected-file guard checks that the task stayed within its authority.
6. Build and QA run again.
7. Changes are committed to a dedicated `agent/<run-id>` branch.
8. A draft pull request is opened against `main`.
9. Existing PR CI and Vercel preview deployment run normally.
10. Human review/QA decides whether to merge.

## What the orchestrator may edit
By default:
- `site/**`
- `scripts/**`
- `README.md`
- `docs/PROJECT_STATE.md`

The workflow will reject a run that changes protected repository/deployment configuration.

## Protected paths
The agent may not change these in v1:
- `.github/**`
- `AGENTS.md`
- `vercel.json`
- `package.json`
- `legacy/**`

If a legitimate task requires one of these, handle it as a separately approved human-supervised change.

## How to run
GitHub:
1. Open the repository.
2. Go to **Actions**.
3. Choose **VOY PRO Development Orchestrator**.
4. Click **Run workflow**.
5. Paste one atomic task into the task field.
6. Leave the base branch as `main`.
7. Run.

Good task:
"On the Budapest booking flow, preserve the selected departure time when the user navigates back from checkout. Change only this behavior. Add or update the smallest relevant regression check."

Bad task:
"Improve the whole website."

## Completion contract
A successful run must produce:
- a dedicated branch;
- passing build and QA;
- a draft PR;
- a concise Codex report in the GitHub Actions summary.

No production merge occurs automatically.

## Required secret
The workflow requires a repository Actions secret named:
`OPENAI_API_KEY`

The secret is used only by the official `openai/codex-action` during the run. Do not commit API keys to the repository.

## Working with ChatGPT
Recommended operating loop:
1. Use ChatGPT to decide the requirement and acceptance criteria.
2. Run the Orchestrator with the final atomic task.
3. Review the draft PR, CI and Vercel preview.
4. Use ChatGPT/Work for independent QA if the change is user-facing.
5. Merge only after approval.
