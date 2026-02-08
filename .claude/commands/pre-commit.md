Run the full pre-commit quality check sequence:

1. Run `pnpm turbo lint` — fix any errors found
2. Run `pnpm turbo typecheck` — fix any type errors found
3. Run `pnpm turbo test` — ensure tests pass
4. Run `coderabbit review --prompt-only -t uncommitted` — review changes with CodeRabbit AI and fix any critical/high issues
5. Report a summary of results

If any step fails, fix the issue and re-run that step before proceeding.
Do NOT skip any steps. Do NOT commit if any step fails.

After all checks pass, report: "All checks passed. Ready to commit."
