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

## Final validation (reviewed exact head)

- Focused mutation/UI suite (abbreviated command; 16 exact test targets were
  captured in the Task 10 commit receipt): `pnpm --filter baci-mobile-admin
  exec vitest run <Task-10-targets>` — PASS (16 files, 103 tests)
- Changed-file Biome command (abbreviated; same Task 10 target set):
  `pnpm exec biome check <Task-10-changed-files>` — PASS
- `pnpm --filter baci-mobile-admin typecheck` — PASS

## Constraints / handoff

- No full monorepo suite or CodeRabbit was run, per the parallel-task brief.
- This task is ready for a fresh Sol xhigh review before cherry-pick.

## Controller integration verification

- The Task 10 commits were cherry-picked only after the fresh Sol xhigh review.
- Subsequent exact-head review rounds hardened post-success refresh isolation,
  mutation-time merchant scoping, mock lifecycle, and settings extraction.
- The latest integration-stage Sol xhigh re-review approved integrated head
  `55b61f846a` with no Critical or Important findings.
- Controller focused readiness suites, changed-file Biome, and mobile/web
  package typechecks passed. The final exact-head CodeRabbit verification and
  serial full monorepo test receipt remain Task 11 gates.

## Sol review fix round 1

- Added exact awaited readiness invalidation after successful product archive;
  failed archives retain their existing list/detail/inventory refresh only.
- NIN, BVN, and CAC verification cards now await the KYC refresh before their
  verified success UI is shown. A refresh rejection propagates through the
  mutation lifecycle to each existing error path.
- Extracted analytics save cache/readiness invalidation into
  `lib/analytics-save-readiness.ts`, keeping the screen focused on UI state.
- RED: the new archive success assertion initially failed because readiness was
  never invalidated. GREEN: archive/KYC/analytics focused suite passed 11/11.

## Sol review fix round 2

- Added focused NIN, BVN, and CAC card mutation tests. Each holds the refresh
  Promise and proves verified success completion remains pending until it
  resolves; removing the card-level `await` makes those regressions fail.
- Expanded the lifecycle coverage for archive, KYC, analytics, builder, payout,
  product, and publish flows. The final reviewed count is recorded above.

## Sol review fix round 3 and final approval

- Product archive now performs its authoritative product/list/inventory refreshes
  and its success-only exact readiness refresh in one awaited `onSettled`
  `Promise.all`. Failed archives still await the authoritative product refreshes
  but never refresh readiness.
- Deferred-promise tests prove co-start and completion waiting for payout,
  analytics, builder publish, active product creation, explicit product status
  changes, product archive, and store publish. They also retain failure,
  missing-merchant, draft/AI, and stock-only exclusions.
- CAC now asserts the verified result transition after the awaited KYC refresh
  resolves; NIN and BVN retain their existing success/error lifecycle coverage.
- The historical Task 10 isolated-worktree Sol xhigh review approved exact
  head `961ce278b4e52e9a6e2370c9ed561f4bac5a568d` with no remaining Task 10
  findings. The later integration-stage review is recorded separately above.
