Review every open comment on a pull request, evaluate each one, and apply the ones you choose.

**Input:** $ARGUMENTS — PR number (e.g. `61`). Omit to use the current branch's open PR.

Follow these steps carefully:

## 1. Resolve PR number

If `$ARGUMENTS` is provided, use it as the PR number.

Otherwise, detect the open PR for the current branch:

```bash
gh pr view --json number --jq '.number'
```

If no open PR is found, tell the user and stop.

## 2. Fetch open review comments

Fetch both inline diff comments and top-level review body comments:

```bash
# Inline comments (attached to specific lines/files)
gh api repos/{owner}/{repo}/pulls/<pr>/comments

# Review-level comments (overall review body text)
gh api repos/{owner}/{repo}/pulls/<pr>/reviews
```

Filter the results:
- **Inline comments:** keep only top-level ones (no `in_reply_to_id` field, or `in_reply_to_id` is null). Skip replies.
- **Review-level comments:** keep only reviews where `body` is non-empty and `state` is `CHANGES_REQUESTED` or `COMMENTED`. Skip `APPROVED` reviews with empty bodies.
- **Auto-dismiss rule:** if a top-level inline comment thread has a reply authored by the PR author, skip the whole thread — the author has already responded or dismissed it.

To get the PR author for the auto-dismiss rule:

```bash
gh api repos/{owner}/{repo}/pulls/<pr> --jq '.user.login'
```

## 3. Evaluate each comment

For each retained comment:

1. Read the referenced file at the relevant line to understand the context (use the local working copy, not the API).
2. Classify the comment into one of three levels using these criteria:

   | Level | When to apply |
   |-------|---------------|
   | **HIGH** | Correctness bug, security issue, missing error handling on a failure path, broken API contract, data loss risk, race condition |
   | **MEDIUM** | Design concern that will cause future pain, confusing naming that will mislead other devs, missing test coverage for a non-trivial path, meaningful performance issue |
   | **NIT** | Style preference, minor wording, optional suggestion, minor formatting, purely aesthetic change |

3. Write one sentence explaining your classification.

## 4. Present the evaluation

Display a formatted table, sorted **high → medium → nit**:

```
#   Level    File : Line          Author         Comment
─────────────────────────────────────────────────────────────────────────────
1   [HIGH]   src/foo.ts:42        alice          "Missing null check before ac…"
2   [MED]    src/bar.ts:10        bob            "Consider extracting this into…"
3   [NIT]    src/baz.ts:7         alice          "Prefer const here"
```

After the table, list each entry again with its full comment body and your 1-sentence reasoning:

```
1  [HIGH]  src/foo.ts:42
   Comment: "Missing null check before accessing res.data — will throw if the API returns 404."
   Reasoning: This is a correctness bug that will cause a runtime crash in production.

2  [MED]  src/bar.ts:10
   Comment: "Consider extracting this into a helper function."
   Reasoning: The duplicated logic will cause future inconsistencies when one copy is updated but not the other.

3  [NIT]  src/baz.ts:7
   Comment: "Prefer const here"
   Reasoning: Style preference with no functional impact.
```

## 5. Ask which comments to address

Ask the user:

> Which comments should I address? Enter numbers separated by commas (e.g. `1,3`), `all`, or `none`.

Wait for the user's response before continuing.

If the user says `none`, report that no changes will be made and stop.

## 6. Implement selected changes

For each selected comment number, in order:

1. Read the full relevant file.
2. Apply the minimal fix that addresses the comment — do not refactor surrounding code or fix unrelated issues.
3. Follow all project conventions:
   - Strict Controller → Service → Repository layering — no skipping
   - DTOs must use `class-validator` decorators for request validation
   - Storage calls go through the S3-compatible abstraction
   - TypeScript strict mode — no implicit `any`

## 7. Run checks and commit

Run checks in order and fix any failures introduced by your changes:

```bash
npm run build
npm run lint
```

Then commit **only the files you changed** (never `git add -A`):

```bash
git add <files you changed>
git commit -m "fix: address PR review comments (#<pr>)"
```

## 8. Report

Show the user:
- Which comments were addressed (by number)
- Which were skipped (by number), and why
- The commit hash
