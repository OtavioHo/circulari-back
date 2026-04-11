Implement a GitHub issue and open a pull request.

**Input:** $ARGUMENTS — the issue number (e.g. `42`).

Follow these steps carefully:

## 1. Fetch the issue

```bash
gh issue view $ARGUMENTS
```

Read the full description, acceptance criteria, and implementation plan. This is your spec — follow it.

## 2. Check complexity and model

Look for the `**Complexity:**` line in the issue description. Map it to the recommended model:

| Complexity | Recommended model | Model ID |
|---|---|---|
| LOW | Haiku | `claude-haiku-4-5-20251001` |
| MEDIUM | Sonnet | `claude-sonnet-4-6` |
| HIGH | Opus | `claude-opus-4-6` |

If the issue has no complexity label, treat it as MEDIUM.

**Check whether the current model matches the recommendation.** You can see the active model in the session header. If there is a mismatch, stop and tell the user:

> This is a **<LEVEL>** complexity task. Please re-run with the recommended model:
> ```
> claude --model <model-id>
> ```
> Then run `/implement $ARGUMENTS` again.

Do not proceed with implementation until the model matches, unless the user explicitly says to continue anyway.

## 3. Create a feature branch

Determine the type from the issue title (`feat`, `fix`, or `task`) and build a slug from the title.

```bash
git checkout main
git pull
git checkout -b <type>/<issue-number>-<short-slug>
```

Example: `feat/42-image-upload-s3`

## 4. Implement

Follow the implementation plan from the issue. Read each relevant file before editing it. Do not add features, refactors, or improvements beyond what the issue describes.

Key conventions for this project:
- Strict Controller → Service → Repository layering — no skipping
- No business logic in controllers; no DB access in services
- Use NestJS dependency injection; no manual `new` for services
- DTOs must use `class-validator` decorators for request validation
- Storage calls go through the S3-compatible abstraction, never directly to AWS SDK
- OpenAI calls are isolated in the AI service module

## 5. Run all checks locally

Run these in order and fix any failures before continuing:

```bash
npm run build
npm run lint
npm run test
```

If tests fail in code you changed, fix the code. If tests are missing for new behavior you added, write them.

## 6. Update documentation

Read the issue's "Docs to Update" section and apply all content changes to the relevant files in `docs/`.

Then audit every doc for stale badges — update any badge that no longer reflects reality based on what you just implemented:

**In the relevant doc file(s)** (`docs/api.md`, `docs/ai.md`, etc.):
- Sections you fully implemented: change badge to `<Badge type="tip" text="Implemented" />`
- Sections you partially implemented: change badge to `<Badge type="warning" text="In Progress" />`
- Sections untouched: leave as-is

**In `docs/roadmap.md`**:
- Check off completed tasks: `- [ ]` → `- [x]`
- If all tasks in a milestone are done, update its badge to `<Badge type="tip" text="Implemented" />`
- If some tasks are done, update its badge to `<Badge type="warning" text="In Progress" />`

**In `docs/index.md`**:
- Update the Feature Status Summary table to match the badge state of each feature you touched.

Badge reference:
- `<Badge type="danger" text="Not Implemented" />` — not started
- `<Badge type="warning" text="In Progress" />` — partially done
- `<Badge type="tip" text="Implemented" />` — complete

## 7. Commit

Stage only the files you changed (never `git add -A`). Commit with:

```
<type>: <short description> (#<issue-number>)
```

Example: `feat: add image upload to S3 (#42)`

## 8. Push and open PR

```bash
git push -u origin <branch-name>
```

Then open a PR:

```bash
gh pr create \
  --title "<same as issue title>" \
  --body "$(cat <<'EOF'
Closes #<issue-number>

## What changed

<2-4 bullet points describing the actual changes made>

## Test plan

- [ ] Build passes
- [ ] Lint passes
- [ ] Tests pass
- [ ] <any manual verification steps>
EOF
)"
```

## 9. Report

Show the user the PR URL and remind them to review before merging.
