---
description: Run the full pre-commit quality check sequence — lint, typecheck, and test
---

# Pre-Commit Quality Gate

Run all quality checks before committing. Fix any issues found at each step.

## Steps

### 1. Lint
```bash
pnpm turbo lint
```
If errors found, fix them and re-run.

### 2. Typecheck
```bash
pnpm turbo typecheck
```
If errors found, fix them and re-run.

### 3. Test
```bash
pnpm turbo test
```
If tests fail, fix them and re-run.

### 4. CodeRabbit Review
```bash
coderabbit review --prompt-only -t uncommitted
```
Review the AI feedback. Fix any critical or high severity issues before proceeding.

### 5. Summary
Report results:
- Lint: PASS/FAIL (N issues fixed)
- Typecheck: PASS/FAIL (N issues fixed)
- Test: PASS/FAIL (N tests passing)

If all pass: "All checks passed. Ready to commit."
Do NOT skip any steps. Do NOT commit if any step fails.
