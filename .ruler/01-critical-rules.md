# Critical Rules (MUST READ FIRST)

## NEVER Do

- **NEVER** use the admin/service-role Supabase client for user-facing operations. Use `@/lib/supabase/server` for SSR and `@/lib/supabase/client` for browser.
- **NEVER** modify `proxy.ts` without explicit approval — it handles auth, CSRF, rate limiting, and custom domains. A bug here breaks everything.
- **NEVER** use `dangerouslySetInnerHTML`. Use the sanitization utilities in `lib/sanitize*.ts`.
- **NEVER** edit existing migration files in `supabase/migrations/`. Migrations are append-only.
- **NEVER** add manual `React.memo`, `useCallback`, or `useMemo` — React Compiler handles memoization.
- **NEVER** add ESLint config files or plugins — we use Biome exclusively.
- **NEVER** use npm or yarn — this is a pnpm monorepo. Use `pnpm turbo <command>`.
- **NEVER** run raw Vercel cloud builds that consume Vercel build minutes (such as running plain `vercel` or `vercel --prod` without `--prebuilt`). **ALWAYS** deploy using `vercel deploy --prebuilt` after either running a CI-driven `vercel build` or a local `pnpm turbo build` first, ensuring the existing CI deployment flow is fully permitted.
- **NEVER** use `select('*')` — always select specific columns.


## ALWAYS Do

- **ALWAYS** validate API inputs with Zod before any database operation.
- **ALWAYS** check auth (`supabase.auth.getUser()`) as the first operation in protected API routes.
- **ALWAYS** add RLS policies when creating new database tables.
- **ALWAYS** run `pnpm turbo lint && pnpm turbo typecheck` after writing or modifying code.
- **ALWAYS** include a regression test when fixing a bug — the test must reproduce the exact failing condition.
- **ALWAYS** follow the Boy Scout Rule: when editing a file over 300 lines, extract the logic you touched into smaller files (hooks, utils, sub-components, schemas). Don't refactor the whole file — just leave it better than you found it.

## High-Risk Areas

- The `payments/webhook` routes process real money. Triple-check any changes.
- The `src/ai/` directory has per-user rate limits. Respect them in any modifications.
- `proxy.ts` is the middleware — auth, CSRF, rate limiting, custom domains all flow through it.
