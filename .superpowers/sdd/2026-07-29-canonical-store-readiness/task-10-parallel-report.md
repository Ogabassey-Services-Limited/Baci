# Task 10 parallel report

## Scope

Implemented canonical, merchant-scoped mobile store-readiness invalidation in
the Task 10 isolated worktree. No remote Supabase, deployment, or changes to
the controller/recovered worktrees were made.

The recovered payout patch was inspected and classified. Only its visual bank
picker safe-area background fix and its focused regression test were ported.
The recovered tactical merchant-before-readiness ordering was deliberately not
ported.

## TDD evidence

- RED: `pnpm --filter baci-mobile-admin exec vitest run lib/invalidate-store-readiness.test.ts`
  failed before implementation because `./invalidate-store-readiness` did not
  exist (Vite import-resolution failure, 0 tests collected).
- GREEN: the same helper suite passed after implementation (2/2).
- Focused mutation and UI suite: 10 files, 65 tests passed.

## Implementation

- Added `invalidateStoreReadiness(queryClient, merchantId)`, which rejects an
  empty ID and awaits only `storeReadinessKeys.detail(merchantId)`.
- Payout, KYC, product lifecycle, store settings, social media, analytics,
  builder publish, and store publish now use exact merchant readiness keys.
- Independent invalidations run concurrently; the old merchant-first
  sequencing and broad `['store-readiness']` invalidation were removed.
- Stock-only updates do not invalidate readiness. Draft/AI builder mutations
  still do not invalidate readiness; only successful builder publish does.
- KYC requires a nonempty merchant ID and refetches verification status only
  after concurrent cache invalidations settle.
- Ported the bank picker bottom-safe-area theme background regression test.

## Validation

- `pnpm --filter baci-mobile-admin exec vitest run …` — PASS (10 files, 65 tests)
- `pnpm --filter baci-mobile-admin exec biome check …` — PASS (21 changed/task files)
- `pnpm --filter baci-mobile-admin typecheck` — PASS

## Constraints / handoff

- No full monorepo suite or CodeRabbit was run, per the parallel-task brief.
- This task is ready for a fresh Sol xhigh review before cherry-pick.
