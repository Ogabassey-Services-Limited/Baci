# OgaBassey P0 Exact Effect-Boundary Recovery Plan

> **Normative contract:** `docs/superpowers/plans/2026-07-13-ogabassey-home-critical-shell-v4.md`
>
> **Frozen inputs:** `CONTRACT_SHA256=3503ca9613b6a511b2e37fb3d35b48830d19e8559e7e3c5df136487fce9efdca`, `CURRENT_MAIN_SHA=2a0dfadb45f03070dd1c294e81902851268fbbb4`, `REPLAY_BASE_SHA=9e3d1b14b1931a5e441fc23f0e5417c188056e47`, `PRODUCTION_EFFECT_PROVENANCE_SHA256=2e1be70f5cb3c2fdc049605343ea6d93b617493962920debaf5493668e4f03b0`, `PRODUCTION_EXCEPTIONAL_RECORD_COUNT=31`, `EFFECT_SCOPE_SHA256=a216397b8fcc2cd0cac6f7a66023582f43b0c5e348501a94d00d771da1084245`, `PHASE=P0-TASK-3.5`, `HEAD_AT_REVIEW=9e36bd690e7a2a874464d2d43b042394396573f3`.
>
> Before the first source or migration edit and before any push, fail unless the
> contract hash and provenance fixture hash/count are unchanged,
> `origin/main == CURRENT_MAIN_SHA`, `CURRENT_MAIN_SHA` is an ancestor of
> `HEAD`, the replay manifest still binds `REPLAY_BASE_SHA`, and the branch is
> zero commits behind. A newer main,
> changed open-migration collision set, or changed production effect requires a
> fresh blocker-only rereview.

## Goal

Replace the schema-wide Supabase replay hash with a strict P0-owned effect
contract, prove exactly which current-tree effects differ from production, and
prepare the smallest append-only recovery release required before the original
P0 plan can resume.

This task is a safety prerequisite for the architecture intended to produce the
large Core Web Vitals gain. It does not change storefront HTML, caching, LCP,
FCP, CLS, INP, routing, or workers.

## Rereview Verdict

The original Task 4 is not executable as written:

1. It hashes almost every object in `eventing`, `private`, and `public`, so
   unrelated database history can block P0.
2. It omits material PGMQ schema/function privilege checks.
3. It does not reject unexpected RPC overloads.
4. A corrected local event-deduplication function cannot equal current
   production until that repair is deployed.
5. Production already has the intended public event-ingress policy roles:
   exactly `[anon]`. These are capability-checked direct-insert fallbacks used
   when an ingress RPC is absent; changing their roles would create risk
   instead of fixing the replay.

The recovery therefore uses two distinct proof modes:

- `classify`: secret-safe comparison that emits only changed
  `{category, identity, sha256}` keys. It can prove the intermediate recovery
  PR contains only the expected drift, but it cannot satisfy final P0
  convergence.
- `enforce`: the default fail-closed mode. It requires chronological replay,
  production-effect replay, and the refreshed production fixture to be equal.

## Non-Negotiable Decisions

- Preserve the immutable V4 document and all existing migration bytes.
- Preserve
  `20260714225501_reconcile_order_fulfillment_timestamps.sql`; V4 already binds
  that path and body.
- Allocate, after a fresh collision check:
  - `20260714225502_reconcile_domain_event_duplicate_jsonb_operator.sql`
  - `20260714225503_reconcile_customer_order_cancellation_reason.sql`
- Do not add a policy migration. Production policy roles already equal
  `[anon]`, matching migrations `20260714000200` and `20260714000300`.
- Treat the `merchant_feature_settings` containment invariant as no direct
  `SELECT` for `PUBLIC` or `anon`; production intentionally retains unrelated
  non-read table privileges, so an empty ACL is not the contract.
- Do not add an extension migration. Hash only the required extension identity
  and schema, not mutable versions or unrelated installed extensions.
- Do not modify `apps/web/src/proxy.ts`.
- Do not deploy, run a browser, run PSI, or run DebugBear in this execution.
- Do not push, open a PR, or deploy the recovery release without explicit user
  authorization after the local gate is green.
- Never stage `supabase/.temp/cli-latest` or
  `apps/web/supabase/.temp/cli-latest`.

## Exact Effect Scope

Create
`apps/web/tools/db/supabase-history-effect-scope.ts` as the single source of
truth for these identities. Its reviewed SHA-256 is
`a216397b8fcc2cd0cac6f7a66023582f43b0c5e348501a94d00d771da1084245`;
the file enumerates every full function signature, trigger, constraint,
merchant grant vector, required extension, and PGMQ access dimension rather
than deferring identity discovery to the SQL query.

### Event-owned relations

- `public.domain_event_producer_config`
- `public.domain_event_ledger`
- `public.domain_event_failures`
- `public.domain_event_failure_replays`
- `public.event_deliveries`
- `public.event_delivery_attempts`
- `public.event_delivery_replays`
- `public.event_pipeline_worker_heartbeats`

Hash complete relation contracts: owner, columns and ordinals, constraints,
indexes, RLS/forced-RLS state, policies, and grants.

### Internal eventing functions

- `eventing.is_event_pipeline_operator_v1`
- `eventing.resolve_domain_event_duplicate_v1`
- `eventing.enqueue_domain_event_v1`
- `eventing.finish_event_delivery_v1`
- `eventing.capture_product_domain_event_v1`
- `eventing.capture_order_domain_event_v1`
- `eventing.capture_transaction_domain_event_v1`

### Public event RPCs

Use the exact nineteen identities already enumerated by the current checked SQL.
Identity arguments are mandatory. Missing or additional overloads fail strict
validation.

### External event contracts

- `public.platform_events.event_id`
- `public.platform_events_type_event_id_uidx`
- policy `Event ingress capability inserts platform events`
- `public.analytics_events_merchant_event_id_type_uidx`
- policy `Event ingress capability inserts analytics events`
- the exact product, order, and transaction domain-event capture triggers

External selected-column ordinals are not material. Type, nullability, default,
constraint, index, policy, and trigger semantics remain material.

### Fulfillment and cancellation contracts

- `public.orders.shipped_at`
- `public.orders.delivered_at`
- `public.orders.cancelled_at`
- `public.orders.cancellation_reason`
- `public.orders.cancelled_by`
- `public.orders_cancelled_by_check`
- `private.restock_order_items(uuid)`
- `private.order_customer_cancellable(uuid)`
- `public.customer_order_can_cancel(uuid)`
- `public.cancel_order_as_customer(uuid,text)`
- `public.prevent_cancelled_order_reopen()`
- trigger `public.prevent_cancelled_order_reopen`
- `public.reconciliation_review_issue_type_check`

### Duplicate-history and containment contracts

- `public.register_push_token(text,uuid,text,text,text,integer)`
- `public.storefront_merchant_has_paystack_subaccount(uuid)`
- exact final quiz functions:
  `mint_quiz_event_ranked_awards`, `finalize_due_quiz_events`, and
  `close_due_product_quiz_events`
- exact `PUBLIC` and `anon` table/column grant vector on `public.merchants`
- policy `Anon can view merchants`
- `public.merchants` RLS/forced-RLS state
- absence of `PUBLIC` or `anon` base-table/column read authority on
  `public.merchant_feature_settings`

### Required extensions and PGMQ

- extension `pgcrypto` in schema `extensions`
- extension `pgmq` in schema `pgmq`
- queue `domain_events`, its queue/archive/meta relation contract, and queue
  configuration
- absence of schema `pgmq_public`
- schema, table, and function privileges for `PUBLIC`, `anon`,
  `authenticated`, and `service_role`

Remove cron/network and storage-policy projections from this P0 hash.

## Snapshot Envelope and Categories

The read-only SQL emits:

```ts
{
  scopeVersion: 'baci-p0-effects-v3';
  serverVersionNum: 170006;
  components: Array<{
    category: string;
    identity: string;
    value: unknown;
  }>;
  diagnostics: {
    extensionVersions: Array<{
      name: string;
      schema: string;
      version: string;
    }>;
  };
}
```

`diagnostics` is never included in a component digest or the overall effect
hash. Component categories are exact:

- `event-relation`: the eight complete `public` event relation contracts;
- `function`: the seven internal eventing functions, nineteen public event
  RPCs, five fulfillment/cancellation functions, and five duplicate-history
  functions;
- `selected-column`: the selected external/order columns, with no ordinal;
- `constraint`, `index`, `policy`, and `trigger`: the exact named external
  contracts;
- `producer-config`: one component for each of the three producer keys;
- `relation-security`: `public.merchants` RLS and forced-RLS state;
- `grant-vector`: exact `PUBLIC`/`anon` table and column grants for
  `public.merchants` and `public.merchant_feature_settings`;
- `extension`: `extensions.pgcrypto` and `pgmq.pgmq`;
- `pgmq-queue`: structural queue/meta/archive contract with mutable row data,
  counters, and timestamps excluded;
- `pgmq-access`: one component per protected role with schema, relation, and
  function privileges;
- `schema-presence`: whether `pgmq_public` exists.

The SQL discovers functions by exact schema plus allowlisted name and emits
every overload. TypeScript manifest validation compares the complete
`category + identity` set, so a missing or additional overload fails.

## Canonicalization Rules

Safe normalization:

- recursively sort object keys;
- sort collections by their complete stable identity;
- sort/deduplicate roles, grants, and function GUC rows;
- omit OIDs, mutable counters/timestamps, and extension versions;
- omit ordinals only for the individually selected columns of external tables.

Never normalize:

- policy role membership;
- `PUBLIC` into `anon` or `authenticated`;
- owners;
- extension schemas;
- function bodies or deparser output with regex rewriting;
- `search_path` value ordering;
- RLS, forced-RLS, policy qualifiers/check expressions, or ACLs.

## Task 1: Refresh and Freeze the Recovery Receipt

**Files:**

- Modify:
  `docs/superpowers/plans/2026-07-14-ogabassey-home-p0-post-3077-recovery.md`
- Modify:
  `docs/superpowers/plans/2026-07-16-ogabassey-h0-parallel-readiness-receipt.md`
- Create this plan.

- [x] Record #3130:
  `origin/main=2a0dfadb45f03070dd1c294e81902851268fbbb4`,
  merge `9e36bd690e7a2a874464d2d43b042394396573f3`, branch `ahead=10`,
  `behind=0`.
- [x] Record deployment run `29530977388`: database job `87730933200`
  success, changes job `87730933194` success, and production deploy job
  `87731008611` failed during `Build for Vercel`; this is not a coherent
  application release.
- [x] Record CI run `29530977474` as terminal-success. Its lint, typecheck,
  test shards, Build, and aggregate Quality Gate jobs completed green.
- [x] Mark the old Task 4 and fixed final-graph portions as superseded until
  this recovery plan completes.
- [x] Correct the H0 receipt: H0-RUNNER can begin after the P0 exact-head gate
  is green and owner/admin authority exists; coherent P0 deployment is required
  before H0 measurement.
- [x] Fix every package-script invocation to pass replay arguments directly
  after `pnpm --filter @baci/web run db:replay:*`.

Verification:

```bash
test "$(shasum -a 256 docs/superpowers/plans/2026-07-13-ogabassey-home-critical-shell-v4.md | awk '{print $1}')" = \
  "3503ca9613b6a511b2e37fb3d35b48830d19e8559e7e3c5df136487fce9efdca"
test "$(shasum -a 256 apps/web/tools/db/fixtures/production-effect-provenance.json | awk '{print $1}')" = \
  "2e1be70f5cb3c2fdc049605343ea6d93b617493962920debaf5493668e4f03b0"
test "$(shasum -a 256 apps/web/tools/db/supabase-history-effect-scope.ts | awk '{print $1}')" = \
  "a216397b8fcc2cd0cac6f7a66023582f43b0c5e348501a94d00d771da1084245"
jq -e '.baseSha == "9e3d1b14b1931a5e441fc23f0e5417c188056e47" and
  .exceptionalRecordCount == 31 and
  (.exceptionalRecords | length) == 31' \
  apps/web/tools/db/fixtures/production-effect-provenance.json
git diff --check
```

Repeat these provenance assertions before every replay task.

## Task 2: Add the Exact Scope Manifest and Digest Contract

**Files:**

- Create: `apps/web/tools/db/supabase-history-effect-scope.ts`
- Create: `apps/web/tools/db/supabase-history-effect-scope.test.ts`
- Create: `apps/web/tools/db/build-supabase-history-effect-digests.ts`
- Create: `apps/web/tools/db/build-supabase-history-effect-digests.test.ts`
- Create:
  `apps/web/tools/db/validate-supabase-history-effect-components.ts`
- Create:
  `apps/web/tools/db/validate-supabase-history-effect-components.test.ts`
- Create:
  `apps/web/tools/db/schemas/supabase-history-effect-component-schema.ts`
- Create:
  `apps/web/tools/db/schemas/supabase-history-effect-component-schema.test.ts`
- Split:
  `apps/web/tools/db/schemas/supabase-history-effect-snapshot-schema.ts`
  into focused schema files so every touched source remains at most 300 lines.

- [x] Write failing tests proving the exact allowlists, identities, scope version
  `baci-p0-effects-v3`, and stable sorted digest vector.
- [x] Implement a digest vector containing only:

```ts
type SupabaseHistoryEffectDigest = {
  category: string;
  identity: string;
  sha256: string;
};
```

- [x] Compute the overall effect hash from the canonical sorted digest vector.
- [x] Reject duplicate `{category, identity}` entries.
- [x] Keep raw function/policy definitions out of comparison diagnostics and
  receipts.

Focused gate:

```bash
pnpm --filter @baci/web exec vitest run \
  tools/db/supabase-history-effect-scope.test.ts \
  tools/db/build-supabase-history-effect-digests.test.ts \
  tools/db/schemas/supabase-history-effect-snapshot-schema.test.ts
git diff --check
```

## Task 3: Replace the Broad SQL Projection

**Files:**

- Modify: `apps/web/tools/db/supabase-history-effects.sql`
- Modify: `apps/web/tools/db/supabase-history-effects.test.ts`

- [x] Write failing tests proving unrelated public objects, unrelated
  extensions, cron/network functions, and storage policies do not change the
  query contract.
- [x] Prove every required object missing or every unexpected overload fails.
- [x] Prove event-owned ordinals are material and selected external-column
  ordinals are not.
- [x] Prove function signature, result, language, volatility, owner,
  security-definer state, body, GUCs, and ACL are material.
- [x] Prove policy command, permissiveness, roles, qualifier, and check are
  material.
- [x] Prove PGMQ schema/table/function exposure and `pgmq_public` appearance are
  detected.
- [x] Emit only the exact scope above.

Focused gate:

```bash
pnpm --filter @baci/web exec vitest run \
  tools/db/supabase-history-effects.test.ts
git diff --check
```

## Task 4: Bind Reader, Fixtures, and Comparison Modes

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/web/tools/db/read-supabase-history-effects.ts`
- Modify: `apps/web/tools/db/read-supabase-history-effects.test.ts`
- Create:
  `apps/web/tools/db/read-supabase-history-effects-comparison.test.ts`
- Create:
  `apps/web/tools/db/compare-supabase-history-effect-digests.ts`
- Create:
  `apps/web/tools/db/compare-supabase-history-effect-digests.test.ts`
- Create:
  `apps/web/tools/db/summarize-supabase-history-effects.ts`
- Create:
  `apps/web/tools/db/summarize-supabase-history-effects.test.ts`
- Create:
  `apps/web/tools/db/supabase-history-effect-query-contract.ts`
- Create:
  `apps/web/tools/db/supabase-history-effect-query-contract.test.ts`
- Create:
  `apps/web/tools/db/supabase-history-effect-test-fixture.ts`
- Create:
  `apps/web/tools/db/supabase-history-effect-test-fixture.test.ts`
- Modify: `apps/web/tools/db/schemas/production-history-effects-schema.ts`
- Modify: `apps/web/tools/db/schemas/production-history-effects-schema.test.ts`
- Modify: `apps/web/tools/db/capture-supabase-history-ledger.ts`
- Modify: `apps/web/tools/db/capture-supabase-history-ledger.test.ts`
- Create:
  `apps/web/tools/db/capture-supabase-history-ledger-boundaries.test.ts`
- Create:
  `apps/web/tools/db/parse-supabase-history-capture-arguments.ts`
- Create:
  `apps/web/tools/db/parse-supabase-history-capture-arguments.test.ts`
- Create:
  `apps/web/tools/db/persist-supabase-history-fixtures.ts`
- Create:
  `apps/web/tools/db/persist-supabase-history-fixtures.test.ts`
- Modify: `apps/web/tools/db/run-replay-command.ts`
- Modify: `apps/web/tools/db/run-replay-command.test.ts`
- Create:
  `apps/web/tools/db/run-replay-command-effects.test.ts`
- Modify: `apps/web/tools/db/run-supabase-history-replay.ts`
- Modify: `apps/web/tools/db/run-supabase-history-replay.test.ts`
- Create:
  `apps/web/tools/db/run-supabase-history-replay-effects.test.ts`
- Create:
  `apps/web/tools/db/run-supabase-history-replay-test-runtime.ts`
- Create:
  `apps/web/tools/db/run-supabase-history-replay-test-runtime.test.ts`
- Create:
  `apps/web/tools/db/execute-supabase-history-replay-verification.ts`
- Create:
  `apps/web/tools/db/execute-supabase-history-replay-verification.test.ts`
- Modify: `apps/web/tools/db/supabase-replay-contract.ts`
- Modify: `apps/web/tools/db/supabase-replay-contract.test.ts`
- Modify: `apps/web/tools/db/supabase-history-replay-types.ts`
- Modify: `apps/web/tools/db/fixtures/production-history-effects.json`
- Create:
  `apps/web/tools/db/task4-replay-effect-boundaries.test.ts`

- [x] Write failing tests for `comparisonMode: 'enforce' | 'classify'`.
- [x] Extract summary, digest comparison, and replay-effect orchestration before
  adding behavior. Keep every touched source and test file at or below 300
  lines; the current reader/orchestrator test suites must be split rather than
  extended in place.
- [x] Keep `enforce` as the package-script and CLI default.
- [x] Make `classify` emit only changed digest identities and before/after
  hashes; it must stamp receipts as non-converged and cannot satisfy final P0.
- [x] Add this secret-safe receipt field:

```ts
comparison: {
  mode: 'classify' | 'enforce';
  converged: boolean;
  productionEffectSha256: string;
  changedComponents: Array<{
    category: string;
    identity: string;
    localSha256: string | null;
    productionSha256: string | null;
  }>;
}
```

  `enforce` rejects any nonempty `changedComponents`; `classify` may return
  them but never makes a non-converged receipt acceptable to the final P0 gate.
- [x] Store the digest vector in the production fixture so drift can be
  classified without raw definitions.
- [x] Update every checked query SHA and scope-version binding.
- [x] Add a fail-closed `--refresh-effects-fixture` capture option. It must
  verify the linked ledger fixture unchanged, validate the new v3 effects
  fixture completely, and atomically replace only
  `production-history-effects.json`; ordinary capture remains create-only and
  `--verify-only` remains non-mutating.
- [x] Recapture the production fixture through the existing read-only
  Management API path.
- [x] Assert production event-policy roles remain exactly `[anon]`; if local
  replay differs, fix replay
  materialization or the scoped query rather than production.

Focused gate:

```bash
pnpm --filter @baci/web exec vitest run tools/db
pnpm --filter @baci/web run db:replay:capture-ledger \
  --refresh-effects-fixture
git diff --check
```

The capture command is read-only against production. It must not print raw
definitions or credentials.

## Task 5: Add the Red Proof Harness for the Three Proven Repairs

Task 5 deliberately ends red at the real forward-repair boundary. It adds the
SQL assertions, production-old cancellation overlay, bounded proof state
machine, CLI contract, and runner integration, but it does **not** create
`25502` or `25503`. Unit and injected-runner tests must be green. A real replay
with `--production-old-cancellation-proof required` must fail closed with the
sanitized classification
`Production-old cancellation proof failed: repair-not-materialized`. Task 6
creates the two forward repairs and owns the first successful two-mode proof
receipt.

The red states are intentionally precise:

- the event semantic behavior may already pass;
- the event structural assertion stays red until `25502` adds explicit
  `::text` subtraction;
- the standalone cancellation assertion may pass against chronological replay,
  because the repository body is already repaired;
- the cancellation red state is proved only after installing the exact
  production-old overlay in the owned proof transaction;
- fulfillment is already green because the preserved `25501` is materialized.

**Files:**

- Create:
  `supabase/migrations/tests/reconcile_domain_event_duplicate_semantics.sql`
- Create:
  `supabase/migrations/tests/reconcile_domain_event_duplicate_jsonb_operator.sql`
- Create:
  `supabase/migrations/tests/reconcile_customer_order_cancellation_reason.sql`
- Create:
  `supabase/tests/migration_history_overlays/production_old_cancel_order_as_customer.sql`
- Create:
  `supabase/tests/migration_history_overlays/assert_production_old_cancel_order_as_customer.sql`
- Create:
  `supabase/tests/migration_history_overlays/assert_repaired_cancel_order_as_customer.sql`
- Create:
  `apps/web/tools/db/fixtures/production-old-cancellation-proof.json`
- Create:
  `apps/web/tools/db/schemas/production-old-cancellation-proof-schema.ts`
- Create:
  `apps/web/tools/db/schemas/production-old-cancellation-proof-schema.test.ts`
- Create:
  `apps/web/tools/db/verify-production-old-cancellation-source.ts`
- Create:
  `apps/web/tools/db/verify-production-old-cancellation-source.test.ts`
- Create:
  `apps/web/tools/db/run-production-old-cancellation-proof.ts`
- Create:
  `apps/web/tools/db/run-production-old-cancellation-proof.test.ts`
- Create:
  `apps/web/tools/db/production-old-cancellation-proof-session.ts`
- Create:
  `apps/web/tools/db/production-old-cancellation-proof-session.test.ts`
- Create:
  `apps/web/tools/db/supabase-history-replay-runtime.ts`
- Create:
  `apps/web/tools/db/supabase-history-replay-runtime.test.ts`
- Create:
  `apps/web/tools/db/verify-supabase-replay-bootstrap-history.ts`
- Create:
  `apps/web/tools/db/verify-supabase-replay-bootstrap-history.test.ts`
- Modify:
  `apps/web/tools/db/run-supabase-history-replay.ts`
- Modify:
  `apps/web/tools/db/run-supabase-history-replay.test.ts`
- Modify:
  `apps/web/tools/db/replay-project-ownership.ts`
- Modify:
  `apps/web/tools/db/replay-project-ownership.test.ts`
- Modify:
  `apps/web/tools/db/execute-supabase-history-replay-verification.ts`
- Modify:
  `apps/web/tools/db/execute-supabase-history-replay-verification.test.ts`
- Modify:
  `apps/web/tools/db/supabase-replay-contract.ts`
- Modify:
  `apps/web/tools/db/supabase-replay-contract.test.ts`
- Modify:
  `apps/web/tools/db/supabase-history-replay-types.ts`
- Modify:
  `apps/web/tools/db/supabase-replay-expected-resources.ts`
- Modify:
  `apps/web/tools/db/supabase-replay-expected-resources.test.ts`
- Strengthen:
  `supabase/migrations/tests/reconcile_order_fulfillment_timestamps.sql`

- [x] Event duplicate: same semantic payload with different
  `delivery_user_data` deduplicates.
- [x] Event duplicate: a semantic payload difference still raises
  `domain_event_idempotency_conflict`.
- [x] Event function: exact identity, owner `postgres`, language `plpgsql`,
  exactly two explicit `-'delivery_user_data'::text` subtraction operators,
  zero uncast occurrences, `SECURITY DEFINER`, empty `search_path`,
  `statement_timeout=2s`, and no direct execution by `PUBLIC`, `anon`,
  `authenticated`, or `service_role`.
- [x] Cancellation: 501 characters raises `reason_too_long` with SQLSTATE
  `22001`; stored input is trimmed; blank input stores `NULL`; execution
  authority has `authenticated` as the only non-owner role with direct
  `EXECUTE`; `PUBLIC`, `anon`, and `service_role` have none.
- [x] Freeze immutable production-old cancellation evidence in
  `production-old-cancellation-proof.json`. It must bind:
  - identity
    `public.cancel_order_as_customer(p_order_id uuid, p_reason text)`;
  - component SHA-256
    `6155b28720d0f4a8a20746aa1a2365e631249e940fa7339e0e19b66c28fa1e62`;
  - production `pg_get_functiondef` SHA-256
    `fa0ae7bf676a6c14b71aa217e8368ccd71be7a750ff5a1661f26102f72f33fd7`
    and byte count `1420`;
  - source production-effects fixture SHA-256
    `7e396eed09ccfc0d18e5b746e832d7aac9cbba0aabbe0432e1e600c9d8af3381`;
  - query SHA, scope-manifest SHA, linked row count `439`, tail
  `20260714225500`, and the final overlay SHA.
  This historical fixture is never refreshed in Task 8.
- [x] The production-old overlay contains the exact captured
  `pg_get_functiondef`, then deterministically sets owner `postgres`, revokes
  from `PUBLIC`, `anon`, `authenticated`, `service_role`, and `postgres`, and
  grants direct execution only to `postgres`, `authenticated`, and
  `service_role`. This reproduces the captured old ACL before digesting.
- [x] Cancellation repair proof is independent of the already-correct
  chronological body: inside a transaction, install the exact production-old
  function fixture, compute its canonical `function` component digest with the
  v3 component reader, and require that digest to equal the immutable old
  component SHA above. Before the recovery release, separately cross-check that
  immutable SHA against the cancellation digest in the freshly captured
  production-v3 fixture; do not make the long-lived proof depend on the
  refreshable fixture.
- [x] Make that one-time pre-deploy cross-check executable in
  `verify-production-old-cancellation-source.ts`: validate the immutable
  evidence, exact mutable production-fixture byte SHA, query SHA, scope SHA,
  ledger row/tail, and exactly one matching cancellation digest. Unit tests
  use injected safe summaries; the explicit pre-deploy command reads the
  checked production fixture. Task 8 refreshes the mutable fixture and never
  adds this one-time cross-check to the long-lived proof path.
- [x] Implement that proof as one bounded interactive `psql` session owned by
  `run-production-old-cancellation-proof.ts`. Launch the exact frozen `psql`
  binary with `shell:false`, `-X -w -q -A -t -v ON_ERROR_STOP=1
  --no-readline` and no positional database URL. Connection credentials live
  only in the bounded replay `PG*` environment. Bound `PGOPTIONS`,
  stdin/stdout/stderr, and the overall timeout; timeout or any terminal failure
  sends `SIGTERM` and escalates to `SIGKILL` after a short fixed grace period if
  the child has not closed. Send `BEGIN`, include the exact old overlay through
  an absolute validated `\ir`, and execute the reviewed v3 query between random
  marker lines. Parse exactly one JSON snapshot with the strict snapshot schema
  and exact-scope validator, then compute digests with
  `buildSupabaseHistoryEffectDigests`; do not call the ordinary read-only reader
  because this transaction is intentionally writable. If the old digest does
  not match, send only `ROLLBACK`/quit and fail before probes or migration
  bytes. On match, run the transaction-neutral old-state assertions inside a
  savepoint. In Task 5, require the absent `25503` path to produce only the
  sanitized `repair-not-materialized` failure, then roll back. Once Task 6
  creates the exact path, include it in the same transaction, run
  transaction-neutral repaired assertions in a savepoint, and take a second
  marked v3 snapshot. Require the repaired cancellation digest to differ from
  the old digest, then roll back and return only the safe receipt. Standalone
  SQL wrappers may use `BEGIN`/`ROLLBACK`; files included by the interactive
  proof must be transaction-neutral. An arbitrary old body, separate `psql`
  processes, or a static SHA/body assertion is not a substitute for this
  production-bound red/green proof.
- [x] Add an explicit replay CLI flag for the production-old cancellation
  proof. `run-supabase-history-replay.ts` must invoke the proof after the replay
  database URL is known and while that owned database is still live, but before
  effect comparison and cleanup. The replay receipt must include a bounded
  `productionOldCancellationProof` result containing `verified: true` and only
  the production/repaired component SHA-256 values. When the flag is present,
  a missing or failed proof aborts the replay and no successful receipt may be
  emitted. Task 5 runner-integration tests must pass this flag in both replay
  modes and prove a missing/failed proof aborts before effect comparison and
  before receipt creation; merely unit-testing the helper is insufficient.
  Task 6's green gate must pass the flag in both real replay modes and assert
  the receipt field.
- [x] Effect verification consumes the local digest vector without copying it
  into the receipt. It always requires
  `productionOldCancellationProof.repairedSha256` to equal the local
  cancellation component digest. In pre-deployment `classify`, it also
  requires the proof's frozen production SHA to equal the cancellation drift
  row's `productionSha256`. Post-deployment `enforce` uses normal convergence
  against the refreshed production fixture and does not compare that refreshed
  fixture to the frozen old SHA.
- [x] Run the disposable replay with PostgreSQL only. Use the pinned CLI's
  dedicated `supabase db start --workdir ...` command and bind ownership to
  exactly the database container, network, and volume. Follow it with
  `supabase migration up --local --workdir ...` **without** `--include-all`;
  `supabase db reset` and full-stack `supabase start`, even with exclusions,
  are forbidden because they repeat or expand the system-schema bootstrap
  boundary. After reading the owned loopback database URL and before source 126,
  query `supabase_migrations.schema_migrations` read-only and require its exact
  ordered `(version,name)` rows to equal the 125 hash-bound bootstrap sources.
  Missing, extra, duplicate, renamed, malformed, or reordered rows abort and
  clean up. This is a DB-only **steady-state** contract: bounded,
  exact-project-label schema-bootstrap jobs for Auth, Storage, or Realtime may
  appear transiently only during the initial `db start`; they may never become
  expected steady-state resources or survive cleanup.
- [x] Keep cleanup strict without masking the primary replay failure. Supabase
  may still create random-name, exact-project-label migration containers while
  starting the database even when every non-DB steady-state service is
  excluded. A pre-stop readiness anomaly must be retained only as a sanitized
  secondary diagnostic when `supabase stop` succeeds and the post-stop
  inspection is empty; the original timeout or command failure remains the
  thrown error. An invalid ownership marker/config, failed stop, or any
  post-stop resource remains a hard cleanup failure. Cover the exact
  DB-plus-random-Gotrue-transient lifecycle and the runner-level primary-error
  precedence with deterministic tests.
- [x] Fulfillment: both columns are nullable `timestamptz` with no defaults.
- [x] Run chronological replay in the explicit pre-repair state and record the
  sanitized failures.

Focused red gate:

```bash
pnpm --filter @baci/web exec vitest run \
  tools/db/run-production-old-cancellation-proof.test.ts \
  tools/db/production-old-cancellation-proof-session.test.ts \
  tools/db/verify-production-old-cancellation-source.test.ts \
  tools/db/verify-supabase-replay-bootstrap-history.test.ts \
  tools/db/run-supabase-history-replay.test.ts \
  tools/db/run-supabase-history-replay-effects.test.ts \
  tools/db/execute-supabase-history-replay-verification.test.ts \
  tools/db/supabase-replay-expected-resources.test.ts \
  tools/db/replay-project-ownership.test.ts \
  tools/db/supabase-replay-contract.test.ts
pnpm --filter @baci/web exec tsx \
  tools/db/verify-production-old-cancellation-source.ts
pnpm --filter @baci/web typecheck:tools-workers
structural_red_output="$(mktemp)"
red_output="$(mktemp)"
trap 'rm -f "$structural_red_output" "$red_output"' EXIT
if pnpm --silent --filter @baci/web exec tsx \
  tools/db/run-supabase-history-replay.ts \
  --mode chronological \
  --pending-repair-state materialized \
  --comparison-mode classify \
  --production-old-cancellation-proof skip \
  --sql-check supabase/migrations/tests/reconcile_domain_event_duplicate_jsonb_operator.sql \
  > /dev/null 2>"$structural_red_output"; then
  echo 'expected duplicate jsonb structural assertion to remain red' >&2
  exit 1
fi
rg -qx \
  'Replay SQL check failed at ordinal 1: non-zero-exit' \
  "$structural_red_output"
if pnpm --silent --filter @baci/web exec tsx \
  tools/db/run-supabase-history-replay.ts \
  --mode chronological \
  --pending-repair-state materialized \
  --comparison-mode classify \
  --production-old-cancellation-proof required \
  --sql-check supabase/migrations/tests/reconcile_order_fulfillment_timestamps.sql \
  > /dev/null 2>"$red_output"; then
  echo 'expected production-old cancellation proof to remain red' >&2
  exit 1
fi
rg -qx \
  'Production-old cancellation proof failed: repair-not-materialized' \
  "$red_output"
git diff --check
```

## Task 6: Add the Ordered Append-Only Repairs

This recovery Task 6 is only the append-only database repair lane below. It is
distinct from the original P0 plan's Task 6 three-edge privileged-authority
exception. Completing this recovery task does not approve, weaken, or bypass
that later owner/security gate and does not authorize any proxy or request
authority change.

**Files:**

- Preserve:
  `supabase/migrations/20260714225501_reconcile_order_fulfillment_timestamps.sql`
- Create:
  `supabase/migrations/20260714225502_reconcile_domain_event_duplicate_jsonb_operator.sql`
- Create:
  `supabase/migrations/20260714225503_reconcile_customer_order_cancellation_reason.sql`
- Modify: `apps/web/tools/db/supabase-history-replay-manifest.ts`
- Modify: `apps/web/tools/db/supabase-history-replay-manifest.test.ts`
- Modify: `apps/web/tools/db/supabase-history-replay-types.ts`
- Modify: `apps/web/tools/db/verify-supabase-history-replay-manifest.ts`
- Modify: `apps/web/tools/db/verify-supabase-history-replay-manifest.test.ts`
- Modify: `apps/web/tools/db/materialize-supabase-history-replay.ts`
- Modify: `apps/web/tools/db/materialize-supabase-history-replay.test.ts`
- Modify: `apps/web/tools/db/build-verified-replay-source-hashes.ts`
- Modify: `apps/web/tools/db/build-verified-replay-source-hashes.test.ts`
- Modify:
  `apps/web/tools/db/verify-supabase-history-replay-receipts.test.ts`
- Create: `apps/web/tools/db/stable-replay-topological-sort.ts`
- Create: `apps/web/tools/db/stable-replay-topological-sort.test.ts`
- Create: `apps/web/tools/db/resolve-safe-replay-path.ts`
- Create: `apps/web/tools/db/resolve-safe-replay-path.test.ts`
- Create: `apps/web/tools/db/verify-supabase-forward-repairs.ts`
- Create: `apps/web/tools/db/verify-supabase-forward-repairs.test.ts`

- [x] Refresh all open PR migration paths and the linked ledger.
- [x] Treat the exact V4-bound
  `20260714225501_reconcile_order_fulfillment_timestamps.sql` path and SHA as
  the sole permitted `25501` entry. Stop if another repository/open-PR entry
  uses `25501`, or if any pre-existing entry uses `25502` or `25503`.
- [x] Copy the complete current function contracts; change only the proven
  semantic drift.
- [x] Use explicit:

```sql
(v_ledger.envelope -> 'data') - 'delivery_user_data'::text
COALESCE(p_data, '{}'::jsonb) - 'delivery_user_data'::text
```

- [x] Reassert cancellation with `NULLIF(btrim(p_reason), '')`, the 500
  character guard, and `v_reason`.
- [x] Revoke cancellation execution broadly, then grant only
  `authenticated`.
- [x] Preserve the existing V4-bound `repair` entry for `25501`. Add a separate
  ordered `forwardRepairs` manifest array for `25502` and `25503`, each with
  path, SHA-256, reason, and expected changed digest identity. Both replay modes
  append them after the frozen historical replay. Do not add them to the
  production-effect provenance fixture before deployment: they have no
  production ledger or job evidence yet.
- [x] Keep the modified runtime utilities below 300 lines. Extract the stable
  topological sorter and safe replay-path resolver into the listed single-export
  utilities with colocated tests rather than compressing new forward-repair
  verification into the already-near-limit materializer and manifest verifier.
- [x] Do not add a policy or extension migration.

Focused gate:

```bash
pnpm --filter @baci/web exec vitest run \
  tools/db/supabase-history-replay-manifest.test.ts \
  tools/db/verify-supabase-history-replay-manifest.test.ts \
  tools/db/materialize-supabase-history-replay.test.ts \
  tools/db/build-verified-replay-source-hashes.test.ts \
  tools/db/verify-supabase-history-replay-receipts.test.ts \
  tools/db/stable-replay-topological-sort.test.ts \
  tools/db/resolve-safe-replay-path.test.ts \
  tools/db/verify-supabase-forward-repairs.test.ts
chronological_receipt="$(pnpm --silent --filter @baci/web exec tsx \
  tools/db/run-supabase-history-replay.ts \
  --mode chronological \
  --pending-repair-state materialized \
  --comparison-mode classify \
  --production-old-cancellation-proof required \
  --sql-check supabase/migrations/tests/reconcile_order_fulfillment_timestamps.sql \
  --sql-check supabase/migrations/tests/reconcile_domain_event_duplicate_semantics.sql \
  --sql-check supabase/migrations/tests/reconcile_domain_event_duplicate_jsonb_operator.sql \
  --sql-check supabase/migrations/tests/reconcile_customer_order_cancellation_reason.sql \
  --sql-check supabase/tests/domain_event_pipeline.sql)"
production_effect_receipt="$(pnpm --silent --filter @baci/web exec tsx \
  tools/db/run-supabase-history-replay.ts \
  --mode production-effect \
  --pending-repair-state materialized \
  --comparison-mode classify \
  --production-old-cancellation-proof required \
  --sql-check supabase/migrations/tests/reconcile_order_fulfillment_timestamps.sql \
  --sql-check supabase/migrations/tests/reconcile_domain_event_duplicate_semantics.sql \
  --sql-check supabase/migrations/tests/reconcile_domain_event_duplicate_jsonb_operator.sql \
  --sql-check supabase/migrations/tests/reconcile_customer_order_cancellation_reason.sql \
  --sql-check supabase/tests/domain_event_pipeline.sql)"
jq -en --argjson chronological "$chronological_receipt" \
  --argjson productionEffect "$production_effect_receipt" '
  ($chronological.comparison.changedComponents |
    map(select(.category == "function" and
      .identity == "public.cancel_order_as_customer(p_order_id uuid, p_reason text)")) |
    if length == 1 then .[0] else null end) as $chronologicalCancellation |
  ($productionEffect.comparison.changedComponents |
    map(select(.category == "function" and
      .identity == "public.cancel_order_as_customer(p_order_id uuid, p_reason text)")) |
    if length == 1 then .[0] else null end) as $productionEffectCancellation |
  $chronological.effectSha256 == $productionEffect.effectSha256 and
  $chronological.comparison.mode == "classify" and
  $productionEffect.comparison.mode == "classify" and
  $chronological.comparison.converged == false and
  $productionEffect.comparison.converged == false and
  $chronological.productionOldCancellationProof.verified == true and
  $productionEffect.productionOldCancellationProof.verified == true and
  $chronological.productionOldCancellationProof.productionSha256 ==
    $productionEffect.productionOldCancellationProof.productionSha256 and
  $chronological.productionOldCancellationProof.repairedSha256 ==
    $productionEffect.productionOldCancellationProof.repairedSha256 and
  $chronological.productionOldCancellationProof.productionSha256 ==
    $chronologicalCancellation.productionSha256 and
  $chronological.productionOldCancellationProof.repairedSha256 ==
    $chronologicalCancellation.localSha256 and
  $productionEffect.productionOldCancellationProof.productionSha256 ==
    $productionEffectCancellation.productionSha256 and
  $productionEffect.productionOldCancellationProof.repairedSha256 ==
    $productionEffectCancellation.localSha256 and
  $chronological.comparison.productionEffectSha256 ==
    $productionEffect.comparison.productionEffectSha256 and
  ($chronological.comparison.changedComponents |
    map([.category,.identity]) | sort) ==
  ($productionEffect.comparison.changedComponents |
    map([.category,.identity]) | sort) and
  ($chronological.comparison.changedComponents |
    map([.category,.identity]) | sort) == [
      ["function","eventing.resolve_domain_event_duplicate_v1(p_producer text, p_trust_level text, p_idempotency_key text, p_external_event_id text, p_event_name text, p_subject_type text, p_subject_id text, p_merchant_id uuid, p_data jsonb)"],
      ["function","public.cancel_order_as_customer(p_order_id uuid, p_reason text)"]
    ]'
```

Expected classification before deployment: the two replay modes equal each
other; relative to production, changed identities are limited to the two
repaired functions. The fulfillment columns already exist in production.

Verified on 2026-07-16 with the exact five SQL checks and required immutable
cancellation proof: chronological replay applied 427 ordered sources,
production-effect replay applied 426, and both produced local effect SHA-256
`71cba5629959c75352726e26cafcbfec8de99b1b52d10e6ad70fd85f07e4d253`.
Both receipts bound PostgreSQL `170006`, comparison mode `classify`,
`converged:false`, production effect SHA-256
`f00189098aad81160e51a719fed988023733232a450d4b848ad7a8949f5f8d5d`,
and exactly the event-duplicate and customer-cancellation function identities.
The frozen cancellation digest
`6155b28720d0f4a8a20746aa1a2365e631249e940fa7339e0e19b66c28fa1e62`
and repaired digest
`b21dc2134c1aa3df7aed6c8b7a57173b1fed910a04730f901e56622862503556`
matched their corresponding drift rows in both modes. Exact-project cleanup
left zero replay containers, networks, or volumes after each run.

## Task 7: Local Recovery-PR Gate

- [x] Run all `tools/db` tests.
- [x] Run both replay modes in `classify`.
- [x] Require the changed-key allowlist to contain exactly:
  - `eventing.resolve_domain_event_duplicate_v1(...)`
  - `public.cancel_order_as_customer(p_order_id uuid, p_reason text)`
- [x] Require no policy, owner, grant, PGMQ, extension-schema, trigger, or other
  function drift.
- [x] Run:

```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm --filter @baci/web typecheck:tools-workers
pnpm turbo test
git diff --check
```

Reverified on 2026-07-17 after the local review fixes: the combined affected
suite passed 13 files and 78 tests; lint, monorepo typecheck, tools/workers
typecheck, and `git diff --check` passed. The fresh `pnpm turbo test` run passed
all five tasks; web reported 2,859 passing test files, 23,065 passing tests,
one skipped file, and one todo.

- [x] Run local CodeRabbit on the uncommitted recovery diff and fix every valid
  critical/high finding.

The installed CLI no longer accepts the repository-documented
`--prompt-only`; the supported structured equivalent
`coderabbit review --agent -t uncommitted` was run once. It emitted five
findings and then remained heartbeat-only for a bounded 25-minute window
without a terminal event, so the stuck client was interrupted rather than
starting a duplicate review. Independent code-and-test validation classified
four findings as valid: canonical workspace-root resolution, paired fixture
rollback, locale-independent proof ordering, and complete fail-closed summary
coverage. All four were fixed with regressions. The forward-repair hash-binding
finding was rejected as redundant because manifest verification, materialized
source metadata, and the execution boundary already bind and rehash the exact
repair bytes. The combined 78-test affected gate and the full repository gates
above passed after these changes.

- [x] Stop for explicit authorization before staging, committing, pushing,
  opening a PR, or deploying.

Reached on 2026-07-17. Nothing was staged, committed, pushed, opened, or
deployed. The final audit found the branch 10 commits ahead of and zero behind
the recorded current main, all frozen hashes unchanged, no protected-file or
existing-migration edits, and zero `baci_replay_*` Docker resources.

## Task 8: Post-Deployment Continuation

This task is not authorized by local implementation approval alone.

After the intermediate recovery PR is explicitly approved, exact-head green,
merged, and deployed:

1. Record exact PR head, merge SHA, deployment run, database job, migration
   semantic digest, and applied names.
2. Convert `25501`'s pending exceptional record to its exact applied
   run/job/log evidence.
3. Add a separate forward-repair deployment receipt for `25502` and `25503`
   with exact path/SHA, run, database job, log ordinal, and applied name. Do not
   rewrite them as historical production-only mappings.
4. Recapture linked migration and production v3 effect fixtures read-only;
   refresh query SHA, ledger row/tail, fixture hash, replay manifest hashes, and
   provenance/forward-repair receipt bindings. Do not refresh or rewrite
   `production-old-cancellation-proof.json`; it is immutable pre-repair
   evidence.
5. Merge that exact deployed main normally into this branch.
6. Run chronological and production-effect replay in `enforce`, passing
   `--production-old-cancellation-proof required` in both modes. The CLI's
   default `skip` is forbidden for this post-deploy convergence proof:

```bash
pnpm --filter @baci/web exec tsx \
  tools/db/run-supabase-history-replay.ts \
  --mode chronological \
  --pending-repair-state materialized \
  --comparison-mode enforce \
  --production-old-cancellation-proof required
pnpm --filter @baci/web exec tsx \
  tools/db/run-supabase-history-replay.ts \
  --mode production-effect \
  --pending-repair-state materialized \
  --comparison-mode enforce \
  --production-old-cancellation-proof required
pnpm --filter @baci/web typecheck:tools-workers
```

7. Require three-way equality with the refreshed production fixture.
8. Regenerate Supabase types.
9. Regenerate actual file/unique-version/linked-row/provenance counts from the
   deployment evidence; do not reuse speculative counts.
10. Patch the original P0 plan to resume at its next source task.

## Completion Definition

This recovery slice is locally implementation-ready when:

- the V4 contract remains byte-identical;
- the exact v3 scope and digest vector tests are green;
- unrelated database drift cannot affect the P0 hash;
- material policy, grant, owner, function, trigger, extension-schema, and PGMQ
  security drift still changes it;
- the only classified production differences are the two proven function
  repairs;
- the fulfillment repair remains at the V4-bound `25501` path;
- no policy or extension mutation is introduced;
- repository lint, typecheck, tests, and local review are green.

The original P0 plan may resume only after the separately authorized recovery
release deploys and `enforce` proves chronological replay, production-effect
replay, and production are identical.
