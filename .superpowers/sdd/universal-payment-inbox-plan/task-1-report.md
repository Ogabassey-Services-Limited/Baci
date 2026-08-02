# Task 1 — dormant webhook evidence foundation

## Delivered files

- `supabase/migrations/20260801150000_payment_webhook_evidence_foundation.sql`
  creates only the three sealed private evidence relations plus the approved
  generation binding unique target. The final SHA-256 is
  `640f72cd35c32b489409ffce05b76bf71730b9ec365bfb93989181e2ba85c2bc`.
- `supabase/migrations/tests/payment_webhook_evidence_foundation.sql` provides
  the transactional catalog, ACL/RLS, closed-JSON, FK/cycle, uniqueness,
  retention, prerequisite, and rollback assertions without asserting
  writer-owned semantics.
- `apps/web/src/lib/payments/payment-webhook-evidence-migration.test.ts`
  guards migration scope, roles, forced RLS, and the no-writer boundary.
- Each evidence relation has one explicit restrictive deny-all RLS policy,
  preserving the dormant fail-closed boundary while satisfying the repository
  policy invariant.
- The pending replay source registry, expected fixture, and pending count were
  updated together (100 to 101) after rebasing onto the current mainline.

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

- With both the foundation and full companion prerequisites present, including
  the signature-key identity catalog, the migration applied and the
  transactional SQL replay contract passed after `SET CONSTRAINTS ALL
  IMMEDIATE` validated the constructed graph.
- Terra's asymmetric nullable-pair regression first failed against the prior
  CHECK, then passed after the populated branch was made explicitly non-null.
- Focused migration source contract passed (6 tests).
- Replay source test passed (8 tests); replay-manifest test passed (15 tests).
- `pnpm turbo lint` passed (existing warnings only) and `pnpm turbo typecheck`
  passed.

## Design-amendment replay hardening

- RED: the new source contract failed against the approved prior head because
  all four named leading-key foreign-key indexes were absent; after adding the
  index DDL it also rejected the missing relation-scoped catalog metadata.
- GREEN: a clean disposable PostgreSQL replay with the foundation and full
  companion applied the amended migration and passed the SQL contract. The
  contract now seals ordered `pg_attribute` type/nullability metadata,
  `pg_attrdef` defaults, relation-scoped `pg_constraint.conrelid` names, exact
  normalized FK definitions (including column order, targets, delete actions,
  and deferrability), critical CHECK/UNIQUE definitions, and the four approved
  FK indexes (key order, uniqueness, and partial predicate).
- The fixture calls `SET CONSTRAINTS ALL IMMEDIATE` before retention assertions
  and, after `ROLLBACK`, proves the identity, generation, inbox, manifest, and
  proof fixtures are gone while the private evidence relations and index remain.
- The pending source count remains 101; both source-hash registry mirrors were
  atomically refreshed for the amended migration.

## Final replay catalog closure

- The relation-scoped index matrix now covers every declared primary-key,
  UNIQUE, and explicit nonunique index on the inbox, manifest, and proof
  relations. It asserts the private index schema and owning relation, exact
  uniqueness, ordered key columns, and the sole partial predicate
  `(inbox_id IS NOT NULL)`.
- The contract also asserts the exact 19-index relation-scoped count, so an
  unexpected index or UNIQUE constraint fails before metadata matching.
- The post-rollback fixture now individually rejects all three manifest
  fixture IDs as well as the identity, generation, inbox, and proof rows, then
  asserts each evidence relation is empty. Relation and retained-index catalog
  checks remain private-schema scoped.
- The migration SHA-256 was recomputed as
  `640f72cd35c32b489409ffce05b76bf71730b9ec365bfb93989181e2ba85c2bc`;
  both registry mirrors still match and the pending-source count remains 101.
- Focused migration/replay Vitest contracts passed (24 tests), and a clean
  foundation-plus-companion disposable PostgreSQL replay passed. The full
  `pnpm turbo test` run passed all five workspace tasks; the web package alone
  completed 3,608 files and 26,519 tests successfully.

## Primary-key and post-rollback oracle closure

- The frozen index matrix now separately asserts `pg_index.indisprimary` for
  all three primary-key indexes. Relation-scoped `pg_constraint` checks require
  their exact `PRIMARY KEY (id)` definitions, preventing a same-named UNIQUE
  index from satisfying the contract.
- After `ROLLBACK`, the fixture replays the complete 19-index metadata matrix
  and verifies every expected constraint name is still attached to its exact
  private relation, with primary-key definitions rechecked.
- The source contract carries the same exact index tuples (name, relation,
  ordered keys, uniqueness, primary flag, and predicate) and requires the
  post-rollback catalog oracle markers. The migration SHA and both registry
  mirrors remain `640f72cd35c32b489409ffce05b76bf71730b9ec365bfb93989181e2ba85c2bc`;
  the pending-source count remains 101.

## Limitations

- Full local Supabase chronological bootstrap is blocked by an unrelated,
  pre-existing syntax error in
  `20260525140048_quiz_authoritative_answer_scoring.sql` at
  `extract(epoch FROM ...)`; it occurs before either prerequisite. It is not
  counted as RED-B or as a migration failure.
- The full `pnpm turbo test` run and the focused webhook-evidence/replay Vitest
  contracts are green.
- This slice intentionally does not enforce digest equality, append-only
  behavior, cross-row child conservation/projection, status transitions,
  review binding, or any order/financial authority. Those remain guarded-writer
  work by the sealed design.
