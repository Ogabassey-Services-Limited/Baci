# Scout Notes

## 2026-06-28 — Test-only guardrails rollup
**Learning:** Small route/schema/security utility tests can be safely folded together when they add coverage without changing runtime behavior. Avoid importing stale PR branch runtime files wholesale; cherry-pick only the intended test files to prevent silent reverts.
**Action:** For stale Scout branches, reapply the test intent on top of current `main`, then run the specific test files and inspect the resulting diff before closing duplicates.
**Source:** PRs #2747, #2786, #2807, and #2826, verified against current main on 2026-06-28.

## 2026-07-01 — Testing hooks through React renderHook
**Learning:** Simple config hooks still run inside React's dispatcher contract and should be tested with React Testing Library's `renderHook` instead of direct function calls.
**Action:** Use `renderHook(() => useHook(...))` for hook test coverage, including no-argument fallback cases and representative valid keys.
**Source:** React Testing Library `renderHook` API, verified 2026-07-01.

