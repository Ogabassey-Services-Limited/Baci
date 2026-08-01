# Universal Payment Stage 0 Companion Control-Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the dormant, private Stage 0 companion control plane for ingress-key identities, deployment bindings, parser compatibility proofs, transition/creation receipts, and guarded generation writers without changing any live payment behavior.

**Architecture:** The companion is one append-only transactional migration whose relations and `SECURITY DEFINER` functions are private and unreachable by generic application roles. A dedicated `payment_control_plane` `NOLOGIN` role is the only function executor; a later reviewed credential/activation receipt may grant that role, but this slice creates no active generation and no production caller. Creation derives all generation fields from an immutable deployment binding under a scope advisory lock; transition functions perform locked CAS updates and write retry-stable receipts in the same transaction.

**Tech Stack:** PostgreSQL/Supabase SQL migrations, pgcrypto, Vitest source contracts, chronological disposable-database replay checks, pnpm/Turborepo.

## Global Constraints

- Work only in `/Users/mac/Baci-app/.worktrees/universal-payment-implementation` on `codex/universal-payment-implementation`.
- Read `AGENTS.md` and `docs/superpowers/specs/2026-07-28-universal-payment-attempts-design.md` before editing.
- Use strict RED → GREEN → REFACTOR; every SQL/source contract must fail for the missing companion before the migration is added.
- Do not edit `20260731140000_payment_ingress_contract_generation_foundation.sql`.
- Do not modify routes, webhooks, Svix, checkout, parser code, provider configuration, acknowledgements, orders, transactions, wallets, settlement, inventory, cleanup, generated Supabase types, or deployment activation.
- The companion migration must set `lock_timeout = '5s'` and `statement_timeout = '30s'` before DDL.
- Every companion table is private, forced-RLS, policy-free, and has all table privileges revoked from `PUBLIC`, `anon`, `authenticated`, `service_role`, and `payment_control_plane`.
- Create `payment_control_plane` only as `NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`, with no role memberships; grant it only `USAGE` on `private_payment_control_plane` and `EXECUTE` on the five named wrappers, never `USAGE` on `private`.
- The six companion relations are the identity catalog, deployment-attestation root, deployment binding, parser proof registry, creation receipts, and transition receipts; no relation is seeded by the migration.
- The reviewed deployment migration that later provisions an attestation is the
  only author of identity, binding, and proof rows; this companion adds no
  registration API. Attestation revocation is a write-once privileged migration
  update carrying a non-empty revocation reference, never a runtime mutation.
- No active generation, deployment binding activation, provider credential, secret, ciphertext, raw key, artifact bytes, seed row, or public RPC may be created.
- `postgres`/reviewed DBA history repair is an explicit privileged-migration exception and must not be represented as runtime immutability.
- Migration source registration happens only after the migration bytes are final; on the current mainline replay manifest the pending-source count moves from 76 to 77.
- Every writer serializes the operation UUID before scope discovery, so one
  operation cannot race across scopes; receipt replay returns the recorded
  result control version rather than a later mutable generation version.

---

### Task 1: Add the dormant companion control-plane migration and contract tests

**Files:**

- Create: `supabase/migrations/20260801140000_payment_ingress_contract_companion.sql`
- Create: `supabase/migrations/tests/payment_ingress_contract_companion.sql`
- Create: `apps/web/src/lib/payments/payment-ingress-contract-companion-migration.test.ts`
- Modify: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify: `apps/web/tools/db/expected-pending-sources.test-support.ts`
- Modify: `apps/web/tools/db/verify-supabase-history-replay-manifest.test.ts`

**Interfaces:**

- Consumes the existing `private.payment_ingress_contract_generations` table and its exact four-key scope.
- Produces the six private relations, one dedicated `payment_control_plane` role, and exactly these functions:
  `private.create_payment_ingress_contract_generation(uuid, uuid)`,
  `private.activate_payment_ingress_contract_generation(uuid, uuid, bigint, uuid)`,
  `private.roll_forward_payment_ingress_contract_generation(uuid, uuid, bigint, uuid, uuid)`,
  `private.rollback_payment_ingress_contract_generation(uuid, uuid, bigint, uuid, uuid)`, and
  `private.retire_payment_ingress_contract_generation(uuid, uuid, bigint, uuid)`.
- The five private writers are implementation functions only. The role receives
  `USAGE` on the dedicated `private_payment_control_plane` schema and `EXECUTE`
  only on same-signature `SECURITY DEFINER` wrappers there; it receives no
  `USAGE` on `private`, so unrelated private-schema functions cannot be reached
  through the executor credential.
- Every function returns `(operation_id uuid, generation_id uuid, generation bigint, control_version bigint, replayed boolean, result_code text)`.

- [ ] **Step 1: Write the failing source and SQL contracts**

  The source contract must assert the exact migration filename, timeout settings,
  relation/function names, dedicated role flags, RLS/ACL statements, comments,
  no seed/active row, and no runtime/provider imports or route edits. The SQL
  contract must first assert that the companion relations/functions are absent,
  then exercise the cases below after the migration is applied.

  Required SQL cases:

  - `payment_ingress_signature_key_identities` has exactly `id`, `provider`,
    `endpoint_key`, `signature_key_scope`, `identity_revision`, `identity_kind`,
    `material_fingerprint`, `provenance_reference`, and `created_at`; rejects
    malformed scope/revision/kind/fingerprint/reference; stores no secret-like
    column; rejects duplicate revision and cross-scope generation references;
    direct reads/writes/deletes fail for all five denied roles.
  - `payment_ingress_deployment_attestations` has the exact root fields in the
    amendment, including write-once revocation metadata, and is the only
    active-attestation predicate. It is not writable by runtime roles; SQL
    fixtures insert and roll it back as the `migration` actor. The named check
    enforces the null-paired revocation fields and no-clear/no-rewrite fixture.
  - `payment_ingress_deployment_manifest_bindings` has the exact fields in the
    amendment, including `attestation_id` and a composite identity-revision FK,
    lower-case 64-hex hashes, bounded versions/references, immutable metadata,
    duplicate-binding rejection, an active-root FK, retention checks for both
    root and binding, and no artifact/secret bytes.
  - `payment_ingress_parser_compatibility_proofs` enforces scope/artifact FKs,
    distinct and ascending basis/candidate generations, bounded equivalence
    versions, compatible-only result, unique proof identity, and direct-access
    denial. Proof hash shape is checked while canonicalization authority remains
    the pinned external verifier named by its deployment binding.
  - `payment_ingress_contract_creation_receipts` enforces operation-id and
    request-fingerprint idempotency, scope/binding/generation FKs, immutable
    replay evidence including the result control version, and direct-access
    denial.
  - `payment_ingress_contract_transition_receipts` enforces the complete outgoing
    and incoming CAS image columns, deployment binding for incoming operations,
    proof for `roll_forward`/`rollback`, no proof for `initial_activate`/`retire`,
    branch status/timestamp shapes, positive result versions exactly expected+1,
    same-scope FKs, unique claimed row versions, actor/hash/JSON/reason checks,
    and direct-access denial.
  - All five functions reject callers whose `current_setting('role', true)` is
    not exactly `payment_control_plane`, caller-
    selected identity/generation/artifact/actor authority, changed replay input,
    stale versions, cross-scope rows, non-monotonic/overflowed generations,
    `draining -> active`, timestamp clearing, successor replacement, proof or
    binding mismatch, reopened retired scopes, and all retire calls before the
    later inbox/redelivery/retention gates are available.
  - The migration creates no active row, no attestation or binding, no proof, no
    receipt, and no production route/provider object.

- [ ] **Step 2: Run RED and verify the failures are contract-shaped**

  Run:

  ```bash
  pnpm --filter @baci/web exec vitest run \
    src/lib/payments/payment-ingress-contract-companion-migration.test.ts

  pnpm --filter @baci/web db:replay:chronological \
    --sql-check supabase/migrations/tests/payment_ingress_contract_companion.sql
  ```

  Both failures must be caused only by the missing companion migration/relation.
  Stop for Docker, credentials, import, syntax, or unrelated baseline failures.

- [ ] **Step 3: Implement the minimal migration**

  Add the timeout-guarded migration in this order:

  1. Create the `payment_control_plane` role with the exact no-login/no-create
     flags if absent; create the dedicated `private_payment_control_plane`
     schema, revoke generic schema access, and do not grant the role table
     privileges or `USAGE` on `private`.
  2. Create the identity catalog, deployment-attestation root, and deployment-
     binding tables, then add the deferrable same-scope and identity-revision
     FKs from the existing generation registry/binding.
  3. Create the proof, creation-receipt, and transition-receipt tables with every
     named constraint/index/FK and the exact receipt branch matrix.
  4. Create the five `postgres`-owned private `SECURITY DEFINER SET search_path = ''`
    writers and dedicated-schema wrappers with schema-qualified SQL,
    `current_setting('role', true)` role
    checks, operation-level serialization before advisory-lock derivation from
    the four scope keys, retry fingerprint comparison, checked bigint
    allocation, locked CAS, same-transaction receipt insertion, and unique-key
    race recovery.
  5. Revoke all function execute privileges, then grant `EXECUTE` only to the
     dedicated-schema wrappers for `payment_control_plane`; do not grant
     `service_role` or any user-facing role, and do not expose the private
     implementation writers through `PUBLIC`.
  6. Enable/force RLS, revoke direct table privileges, and add the required
     comments. Do not insert any row.

  Function behavior is exact:

  - Creation derives the identity and all generation fields from the immutable
    deployment binding, allocates `max(generation)+1` under the scope advisory
    lock, rejects overflow, and returns the original staged row and recorded
    control version on identical replay or SQLSTATE `PT409` on divergent replay.
  - Initial activation is staged→active with no outgoing branch.
  - Roll-forward and rollback atomically drain the outgoing active generation and
    activate a strictly higher staged successor; both require an approved proof
    whose basis equals the outgoing generation and an active retained deployment
    binding.
  - Activation, roll-forward, and rollback receipts persist their result control
    versions; identical retries return that immutable receipt snapshot even if a
    later transition has advanced the generation.
  - Retirement always fails closed in this slice because the durable inbox,
    redelivery horizon, unsupported-row census, and retention gates are not yet
    present; it cannot silently reopen a retired scope.

  For every transition receipt, derive `actor_kind = 'service'`,
  `actor_user_id = NULL`, `actor_reference = 'payment_control_plane'`,
  `approval_reference` from the binding, `evidence_reference` and
  `evidence_sha256` from the attestation root, `reason_code` from the lower-case
  operation kind, and `metrics_snapshot = '{}'::jsonb`; callers cannot supply
  any of these values.

- [ ] **Step 4: Run GREEN focused tests**

  ```bash
  pnpm --filter @baci/web exec vitest run \
    src/lib/payments/payment-ingress-contract-companion-migration.test.ts \
    tools/db/supabase-history-replay-sources.test.ts \
    tools/db/supabase-history-replay-manifest.test.ts \
    tools/db/verify-supabase-history-replay-manifest.test.ts
  ```

  Expected: all focused source/replay tests pass and the pending-source count is
  exactly 77.

- [ ] **Step 5: Register the final migration source**

  Compute the SHA-256 of the final migration, add exactly one lexically ordered
  pending source and matching expected-pending object, then update only the
  pending-count assertion from 76 to 77. Do not classify the migration as
  historical or forward-repair.

- [ ] **Step 6: Run replay and repository gates**

The replay verifier keeps `manifest.pendingSources` separate from the
historical `verifiedSources` materialized by the chronological runner. The two
pending migrations are therefore intentionally supplied once as SQL checks;
removing them would run only the fixture against a database where the
companion objects do not exist.

  ```bash
  bash .github/scripts/check-migration-versions.test.sh
  bash .github/scripts/check-migration-versions.sh
  pnpm --filter @baci/web db:replay:chronological \
    --sql-check supabase/migrations/20260731140000_payment_ingress_contract_generation_foundation.sql \
    --sql-check supabase/migrations/20260801140000_payment_ingress_contract_companion.sql \
    --sql-check supabase/migrations/tests/payment_ingress_contract_companion.sql
  pnpm turbo lint
  pnpm turbo typecheck
  pnpm turbo test
  ```

  The disposable replay applies each ordered historical source once and must
  converge with no changed production components. The two pending migrations
  are not in that ordered historical list, so pass each pending migration once
  as an SQL check before the companion fixture; never pass a migration that the
  ordered list already applied a second time. The fixture must roll back all
  rows and leave no active generation/binding.

- [ ] **Step 7: Commit the cohesive companion slice**

  ```bash
  git add \
    supabase/migrations/20260801140000_payment_ingress_contract_companion.sql \
    supabase/migrations/tests/payment_ingress_contract_companion.sql \
    apps/web/src/lib/payments/payment-ingress-contract-companion-migration.test.ts \
    apps/web/tools/db/supabase-history-replay-sources.ts \
    apps/web/tools/db/expected-pending-sources.test-support.ts \
    apps/web/tools/db/verify-supabase-history-replay-manifest.test.ts
  git commit -m "feat: add dormant payment ingress control plane"
  ```

### Review gates

After the commit, generate the SDD review package for the complete task range
and dispatch a fresh Terra reviewer. The reviewer must return both spec
compliance and task-quality verdicts. Any Critical/Important finding enters the
implementer fix/re-review loop; no controller-side fix is permitted. CodeRabbit
remains waived for this task by explicit owner instruction.
