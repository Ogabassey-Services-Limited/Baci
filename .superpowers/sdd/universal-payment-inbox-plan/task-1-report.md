# Task 1 — dormant webhook evidence foundation

## Delivered files

- `supabase/migrations/20260801150000_payment_webhook_evidence_foundation.sql`
  creates only the three sealed private evidence relations plus the approved
  generation binding unique target. The final SHA-256 is
  `c1e2851810d827e9bab54d6cb24140a71e81ac930e3f95640c40cee6d51d0dd6`.
- `supabase/migrations/tests/payment_webhook_evidence_foundation.sql` provides
  the transactional catalog, ACL/RLS, closed-JSON, FK/cycle, uniqueness,
  retention, prerequisite, and rollback assertions without asserting
  writer-owned semantics.
- `apps/web/src/lib/payments/payment-webhook-evidence-migration.test.ts`
  guards migration scope, roles, forced RLS, and the no-writer boundary.
- The pending replay source registry, expected fixture, and pending count were
  updated together (77 to 78).

## RED evidence

- RED-A: `pnpm --filter web exec vitest run
  src/lib/payments/payment-webhook-evidence-migration.test.ts` failed before
  DDL with the expected missing migration-path assertion and `ENOENT`.
- RED-B cut 1: in an isolated disposable PostgreSQL container, applying the
  migration with neither prerequisite failed at
  `private.payment_ingress_contract_generations` missing. The transaction
  left all three new relations absent.
- RED-B cut 2: after applying only the generation foundation, applying this
  migration failed at the absent `payment_control_plane` role. The transaction
  rolled back the new relations and the redundant generation unique target.

## GREEN evidence

- With the foundation plus required companion-role boundary present, the
  migration applied and the transactional SQL replay contract passed.
- Focused migration source contract passed (3 tests).
- Replay source test passed (6 tests); replay-manifest test passed (9 tests).
- `pnpm turbo lint` passed (existing warnings only) and `pnpm turbo typecheck`
  passed.

## Limitations

- Full local Supabase chronological bootstrap is blocked by an unrelated,
  pre-existing syntax error in
  `20260525140048_quiz_authoritative_answer_scoring.sql` at
  `extract(epoch FROM ...)`; it occurs before either prerequisite. It is not
  counted as RED-B or as a migration failure.
- The broader `verify-supabase-history-replay-manifest.test.ts` did not emit a
  result before its Vitest runner stalled, so it was terminated; the two direct
  replay manifest/source contracts above passed.
- This slice intentionally does not enforce digest equality, append-only
  behavior, cross-row child conservation/projection, status transitions,
  review binding, or any order/financial authority. Those remain guarded-writer
  work by the sealed design.
