Plan a new feature, task, or bug fix and create a GitHub issue.

**Input:** $ARGUMENTS — a description of what needs to be built or fixed.

Follow these steps carefully:

## 1. Parse the request

From $ARGUMENTS, determine:
- **Type:** `feat` (new capability), `fix` (bug), or `task` (refactor/chore)
- **Short slug:** 3-5 words, lowercase, hyphenated (for the issue title)

If the type cannot be clearly determined from $ARGUMENTS, ask the user before continuing.

## 2. Clarify before planning

Before exploring the codebase or designing anything, identify every aspect of the request that is ambiguous, underspecified, or has multiple valid interpretations.

For each ambiguity, ask a direct question. Do not assume. Do not pick a default silently.

Examples of things that often need clarification:
- Scope: does "add X" mean just the backend, just the UI, or both?
- Behavior: what should happen on error, empty state, or edge cases?
- Data: which fields are required vs optional? Are there constraints or validations?
- Relations: does this interact with existing entities — and if so, how?
- Auth: should this endpoint be protected? Who can access it?
- Prioritization: if multiple approaches exist, which tradeoffs does the user prefer?

Ask all questions in a single message — numbered list, one question per line. Wait for the user's answers before proceeding.

Only skip this step if $ARGUMENTS is detailed enough that every decision can be made without guessing.

## 3. Explore the codebase

Search for all files, modules, routes, types, and tests relevant to this feature. Understand the current state before planning anything. Look at:
- Relevant modules in `src/modules/`
- Shared types and DTOs in the module's `dto/` and `entities/` folders
- Database entities and migrations
- Existing tests for the area you'll be touching

## 4. Design the implementation

Think through:
- Which existing files change and how
- New files to create (only if necessary)
- Database schema / migration changes (if any)
- Controller → Service → Repository layer boundaries (no skipping)
- What could break (DTOs, API contracts, shared entities)
- Tests to write or update

## 5. Identify documentation impact

Before writing the issue, determine which docs in `docs/` would need updating:

| Change type | Affected doc |
|---|---|
| New or modified API route | `docs/api.md` |
| New or modified DB entity/field | `docs/data-models.md` |
| AI flow change | `docs/ai.md` |
| Architectural change | `docs/architecture.md` |
| Deploy, env vars, infra | `docs/infra.md` |
| Milestone or feature status | `docs/roadmap.md` + `docs/index.md` |

List the affected docs in the issue under "Docs to Update".

## 6. Assess complexity

Based on your codebase exploration and design, classify the task complexity as one of:

| Level | Criteria |
|---|---|
| **LOW** | Isolated change; 1–2 files; no schema changes; straightforward logic |
| **MEDIUM** | 3–6 files across 2–3 modules; minor schema change; some interdependencies |
| **HIGH** | Cross-cutting change; new domain entities; significant refactor; multiple interacting systems |

Choose the **highest** level that applies. If in doubt, go one level up.

## 7. Create the GitHub issue

Run:
```
gh issue create --title "<type>: <short description>" --body "<body>"
```

Use this exact body structure:

```markdown
## Description

<What this does and why. 2-4 sentences.>

**Complexity:** <LOW | MEDIUM | HIGH> — <one sentence justifying the level>

## Acceptance Criteria

- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>

## Implementation Plan

<Step-by-step technical plan. List files to change, new files, approach. Be specific enough that implementation can start without re-exploring the codebase.>

## Test Plan

<What tests to write or update. Be specific: which service, which edge cases.>

## Docs to Update

- `docs/<file>.md` — <reason>

## Notes

<Constraints, open questions, related issues, migration notes. Omit if none.>
```

## 8. Report

Show the user the issue number, URL, and the assessed complexity level.
