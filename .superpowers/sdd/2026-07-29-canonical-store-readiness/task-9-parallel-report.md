# Task 9 — React Native app-focus recovery

## Scope

- Worktree: `.worktrees/readiness-task9-app-focus` (relative to the repository root)
- Branch: `codex/readiness-task9-app-focus`
- Base: `907cdb724bfa9a63a8a1189396d9f5c8673b2c1b`
- Code commit: `726648f0b9eb90ffc80d46860c9a3000a7808899`

## TDD evidence

1. RED — `hooks/useReactQueryAppFocus.test.ts` failed because the new hook module did not exist.
2. RED — `lib/QueryProvider.test.tsx` then failed because the provider invoked the focus bridge zero times.
3. GREEN — both files pass after the minimal `AppState` to TanStack `focusManager` bridge and a single `QueryProvider` installation.

## Behavior

- Reads `AppState.currentState` on mount.
- Maps `active` to focused and `background`/`inactive` to unfocused.
- Removes the subscription returned by the matching AppState registration.
- Leaves `useNetworkState` as the only NetInfo/`onlineManager` owner.

## Validation

- `pnpm --filter baci-mobile-admin exec vitest run hooks/useReactQueryAppFocus.test.ts lib/QueryProvider.test.tsx` — 2 files, 3 tests passed.
- No existing `useNetworkState` test file exists in this package, so no unrelated network test was added or modified.
- `pnpm exec biome check apps/mobile-admin/hooks/useReactQueryAppFocus.ts apps/mobile-admin/hooks/useReactQueryAppFocus.test.ts apps/mobile-admin/lib/QueryProvider.tsx apps/mobile-admin/lib/QueryProvider.test.tsx` — passed.
- `pnpm --filter baci-mobile-admin typecheck` — passed.
- The repository pre-commit hook also passed `check-podfile-lock`, Turbo lint, and Knip.

## Out of scope

- No remote services, Supabase, deployment, or main execution worktree changes.
- No CodeRabbit run; controller owns fresh Sol review before integration.
