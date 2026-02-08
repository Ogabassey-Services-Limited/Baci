---
description: Complete ship flow from quality checks through commit to PR creation
---

# Ship Workflow

Complete the current work and prepare for shipping.

## Steps

### 1. Quality Checks
```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```
Fix any issues before proceeding.

### 2. CodeRabbit Review
```bash
coderabbit review --prompt-only -t uncommitted
```
Review the AI feedback. Fix any critical or high severity issues before proceeding.

### 3. Stage Changes
Stage all relevant files. Do NOT stage:
- `.env*` files
- `node_modules/`
- Lock files (`pnpm-lock.yaml`)

### 4. Commit
Create a conventional commit:
```
type(scope): description
```
Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`
Scope: `web`, `mobile-admin`, `mobile-storefront`, `shared`, `config`

### 5. Push
```bash
git push -u origin <current-branch>
```

### 6. Create PR
Create a pull request with:
- Short title (under 70 characters)
- Summary (1-3 bullet points)
- Test plan (bulleted checklist)

```bash
gh pr create --title "type(scope): description" --body "## Summary
- Change 1
- Change 2

## Test plan
- [ ] Verify X
- [ ] Test Y"
```
