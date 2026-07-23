# Critical Rules (MUST READ FIRST)

## NEVER Do

- **NEVER** use the admin/service-role Supabase client for user-facing operations. Use `@/lib/supabase/server` for SSR and `@/lib/supabase/client` for browser.
- **TEMPORARY LEGACY ANALYTICS EXCEPTION (owner-approved 2026-07-18; expires when queue-only delivery activates or on 2026-09-16, whichever comes first):** only these exact server-side edges are authorized: (1) `apps/web/src/app/api/analytics/conversion/route.ts -> apps/web/src/lib/analytics/trusted-server-ad-platform-fanout.ts`, where the route may construct the branded `createServiceClient('event-pipeline')`; (2) `apps/web/src/app/api/events/route.ts -> apps/web/src/lib/analytics/trusted-server-ad-platform-fanout.ts`, under the same branded-client rule; and (3) the existing byte-frozen `apps/web/src/app/api/platform/events/route.ts -> apps/web/src/app/api/platform/events/platform-event-forwarding.ts -> apps/web/src/lib/supabase/admin.ts#createAdminClient()` edge. These edges are server-only by contract and must never be imported, re-exported, or bundled into a client graph. The two merchant edges may construct the privileged client only after tenant identity is independently resolved from trusted host/domain context and matches any request value. Their authority is limited to the exact merchant entitlement, merchant credential, and feature-setting projections needed for legacy analytics/conversion fanout; the platform edge retains only its exact platform-settings projection. Raw or body-selected tenant identity confers no authority; mismatch or unverified paths construct no privileged client. Credential values must never enter responses, logs, event payloads, or client bundles. No sibling module, fourth importer/edge, or generic service-role route use inherits authorization. The owner acknowledges that the backend key inherently bypasses RLS; these controls constrain approved use, not that capability. Remove or re-approve this exception at expiry; reapproval is required even if queue-only activation has not occurred.
- **NEVER** modify `proxy.ts` without explicit approval — it handles auth, CSRF, rate limiting, and custom domains. A bug here breaks everything.
- **NEVER** use `dangerouslySetInnerHTML`. Use the sanitization utilities in `lib/sanitize*.ts`.
- **NEVER** edit existing migration files in `supabase/migrations/`. Migrations are append-only.
- **NEVER** add manual `React.memo`, `useCallback`, or `useMemo` — React Compiler handles memoization.
- **NEVER** add ESLint config files or plugins — we use Biome exclusively.
- **NEVER** use npm or yarn — this is a pnpm monorepo. Use `pnpm turbo <command>`.
- **NEVER** consume Vercel build minutes from Codex by running cloud-building deploy commands such as `vercel`, `vercel --prod`, or `vercel deploy --prod` without `--prebuilt`. Production deploys must use a local/prebuilt CI build and finish with `vercel deploy --prebuilt --prod`; the default runner is the VPS prebuilt flow on `bassey@82.29.190.219`, but owner-approved emergency fallback may use a GitHub-hosted runner for the same prebuilt flow. `vercel inspect` and `vercel logs` are allowed for status/debugging.
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
