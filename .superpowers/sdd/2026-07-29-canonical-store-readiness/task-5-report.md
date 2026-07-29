# Task 5 — canonical readiness API transport

## Outcome

Replaced the legacy cookie-only, route-local readiness calculation with a thin
authenticated transport. The route now authenticates a bearer or cookie request
through `authenticateApiRequest`, validates a route-neutral query, resolves the
requested merchant using the caller-scoped client, checks `dashboard.view`, and
passes the same scoped client to `loadStoreReadiness`.

The response contains the shared platform-neutral DTO. Temporary deprecated
type-only exports remain only because the web presentation adapter still imports
the old route types; Task 7 removes that compatibility seam after it introduces
the local href mapping. No route-local database query, cookie call, admin client,
or service role remains.

## Files

- `apps/web/src/schemas/store-readiness-query.ts` (new)
- `apps/web/src/schemas/store-readiness-query.test.ts` (new)
- `apps/web/src/app/api/merchant/readiness/route.ts` (rewritten)
- `apps/web/src/app/api/merchant/readiness/route.test.ts` (rewritten)

## TDD evidence

### RED

`pnpm --filter @baci/web exec vitest run src/schemas/store-readiness-query.test.ts`
exited 1 because `./store-readiness-query` did not exist.

`pnpm --filter @baci/web exec vitest run src/app/api/merchant/readiness/route.test.ts`
exited 1 with all 12 transport cases failing against the legacy route. It ignored
the request/bearer path, read `cookies()` directly outside request scope, and
returned 500 where the test expected the explicit auth, validation,
authorization, or loader responses.

### GREEN

`pnpm --filter @baci/web exec vitest run src/app/api/merchant/readiness/route.test.ts src/schemas/store-readiness-query.test.ts src/lib/api-auth.test.ts src/lib/store-readiness/load-store-readiness.test.ts`
passed: 4 files, 41 tests.

The schema test covers default web, explicit mobile, invalid UUID, and invalid
surface. The route test covers unauthenticated-before-lookup, bearer scoped
client identity, query ordering, cookie path, requested merchant resolution,
404, 403, platform-neutral DTO success, and stable 500 failure. It has no
cookies, admin-client, direct client-factory, or database-chain mocks.

## Verification

- Changed-file Biome: passed.
- `pnpm --filter @baci/web typecheck`: passed.
- `pnpm turbo lint --output-logs=errors-only`: passed, 3 successful tasks.
- `pnpm turbo typecheck --output-logs=errors-only`: passed, 5 successful tasks.
- `pnpm turbo test --output-logs=errors-only`: passed, 5 successful cached tasks.
- `git diff --check`: passed.
- Module sizes: route 88 lines; route test 249; schema 8; schema test 32.

## CodeRabbit

`coderabbit review --agent -t uncommitted` was attempted before commit, but the
organization review service returned a recoverable rate limit (28-minute wait;
no assigned organization seat). This is an external open exact-head review gate,
not a clean CodeRabbit result.

## Commit

Task implementation commit: `227492819f` (`refactor(api): serve canonical
readiness to web and mobile`).

## Notes for follow-up

- Task 7 must remove the deprecated route-only presentation types as it moves
  the setup checklist to the shared contract plus local web href mapping.
- A final committed-range/branch CodeRabbit review remains required when the
  organization rate limit clears.
