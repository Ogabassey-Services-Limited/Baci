Complete the current work and prepare for shipping:

1. Run `pnpm turbo lint` — fix any issues
2. Run `pnpm turbo typecheck` — fix any issues
3. Run `pnpm turbo test` — fix any failing tests
4. Run `coderabbit review --prompt-only -t uncommitted` — review with CodeRabbit AI, fix any critical/high issues
5. Stage all relevant changes (not .env, node_modules, or lock files)
6. Create a commit with a conventional commit message
7. Push to the current branch
8. Create a PR with proper title, summary, and test plan

Conventional commit format: type(scope): description
Types: feat, fix, refactor, test, docs, chore, perf
Scope: web, mobile-admin, mobile-storefront, shared, config

If a description of what was done is provided: $ARGUMENTS
