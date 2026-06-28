# Scout Notes

## 2026-06-28 — Test-only guardrails rollup
**Learning:** Small route/schema/security utility tests can be safely folded together when they add coverage without changing runtime behavior. Avoid importing stale PR branch runtime files wholesale; cherry-pick only the intended test files to prevent silent reverts.
**Action:** For stale Scout branches, reapply the test intent on top of current `main`, then run the specific test files and inspect the resulting diff before closing duplicates.
**Source:** PRs #2747, #2786, #2807, and #2826, verified against current main on 2026-06-28.
