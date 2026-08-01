# Universal Payment Stage 0 — Ingress Generation Registry Plan

> Execution model: strict RED → GREEN → REFACTOR with one fresh Terra implementer,
> followed by one fresh Terra reviewer. The implementer must read `AGENTS.md` and
> the complete sealed design at
> `docs/superpowers/specs/2026-07-28-universal-payment-attempts-design.md` before
> changing files.

## Goal

Create the first behavior-neutral Stage 0 foundation: one empty private
`payment_ingress_contract_generations` registry. It must provide only dormant
schema and declarative invariants. No provider, checkout, webhook, cleanup,
inventory, order, transaction, wallet, settlement, or money behavior changes.

## Task 1 — Empty ingress-generation registry

### Owned files

- Add `supabase/migrations/20260731140000_payment_ingress_contract_generation_foundation.sql`.
- Add `supabase/migrations/tests/payment_ingress_contract_generation_foundation.sql`.
- Add `apps/web/src/lib/payments/payment-ingress-contract-generations-migration.test.ts`.
- Update `apps/web/tools/db/supabase-history-replay-sources.ts`.
- Update `apps/web/tools/db/expected-pending-sources.test-support.ts`.
- Update the pending-source count in
  `apps/web/tools/db/verify-supabase-history-replay-manifest.test.ts`.

Do not edit any other file without stopping and reporting why the task cannot be
completed within this ownership boundary.

### Exact RED sequence

1. Add the Vitest migration-source contract and SQL replay contract before the
   migration exists.
2. Run the focused Vitest file and capture the expected failure because the exact
   migration is absent.
3. Run chronological replay with the contract SQL check and capture the expected
   failure because `private.payment_ingress_contract_generations` is absent.
4. Only after both failures are observed may the migration be added.

Commands:

```bash
pnpm --filter @baci/web exec vitest run src/lib/payments/payment-ingress-contract-generations-migration.test.ts
pnpm --filter @baci/web db:replay:chronological --sql-check supabase/migrations/tests/payment_ingress_contract_generation_foundation.sql
```

The RED failures must be the missing migration/relation, not syntax, import,
fixture, Docker, credential, or unrelated baseline failures.

### Exact migration contract

Create `private.payment_ingress_contract_generations` with:

- `SET LOCAL lock_timeout = '5s'` and `SET LOCAL statement_timeout = '30s'` at
  migration start; these bounded DDL guards are part of the Stage 0 contract.

- `id uuid primary key default gen_random_uuid()`;
- `provider text not null`;
- `endpoint_key text not null`;
- `signature_key_scope text not null`;
- `signature_key_identity_id uuid not null`;
- `authority_key text not null`;
- `generation bigint not null`;
- `parser_contract_version text not null`;
- `parser_artifact_sha256 text not null`;
- `normalized_envelope_schema_version text not null`;
- `replay_identity_contract_version text not null`;
- `status text not null default 'staged'`;
- `control_version bigint not null default 1`;
- nullable `activated_at`, `draining_at`, and `retired_at` timestamptz;
- nullable `successor_generation_id uuid`; and
- `created_at timestamptz not null default now()`.

Freeze these constraint/index names:

- `payment_ingress_contract_generations_provider_check`;
- `payment_ingress_contract_generations_endpoint_key_check`;
- `payment_ingress_contract_generations_signature_scope_check`;
- `payment_ingress_contract_generations_authority_key_check`;
- `payment_ingress_contract_generations_generation_check`;
- `payment_ingress_contract_generations_control_version_check`;
- `payment_ingress_contract_generations_parser_contract_check`;
- `payment_ingress_contract_generations_parser_artifact_check`;
- `payment_ingress_contract_generations_envelope_schema_check`;
- `payment_ingress_contract_generations_replay_identity_check`;
- `payment_ingress_contract_generations_status_check`;
- `payment_ingress_contract_generations_lifecycle_check`;
- `payment_ingress_contract_generations_timestamps_check`;
- `payment_ingress_contract_generations_successor_not_self_check`;
- `payment_ingress_contract_generations_scope_generation_key`;
- `payment_ingress_contract_generations_identity_scope_key`;
- `payment_ingress_contract_generations_identity_artifact_scope_uq`;
- `payment_ingress_contract_generations_successor_fkey`;
- `payment_ingress_contract_generations_successor_uidx`;
- `payment_ingress_contract_generations_one_active_uidx`; and
- `payment_ingress_contract_generations_scope_status_idx`.

All frozen PostgreSQL identifiers must remain within PostgreSQL's 63-byte
identifier limit; the `_uq` suffix on the artifact target is intentional.

Rules:

- Each of `provider`, `endpoint_key`, `signature_key_scope`, and `authority_key`
  matches `^[a-z][a-z0-9_.:-]{0,254}$`.
- Each contract-version text equals its trimmed value, is non-empty, and is at
  most 255 characters.
- `parser_artifact_sha256` is exactly 64 lowercase hexadecimal characters.
- `generation > 0` and `control_version > 0`.
- Status is exactly `staged | active | draining | retired`.
- `staged`: all lifecycle timestamps and successor are null.
- `active`: only `activated_at` is non-null and successor is null.
- `draining`: activation and drain are non-null, retirement is null, successor is
  non-null.
- `retired`: all lifecycle timestamps and successor are non-null.
- Drain cannot precede activation; retirement cannot precede drain.
- A successor cannot equal its own row ID.
- Scope generation uniqueness is `(provider, endpoint_key,
  signature_key_scope, authority_key, generation)`.
- Add redundant unique targets `(id, provider, endpoint_key,
  signature_key_scope, authority_key)` and the same tuple plus
  `parser_artifact_sha256`.
- The composite self-FK repeats successor ID plus the four scope keys, references
  the identity/scope unique target, and is `DEFERRABLE INITIALLY DEFERRED`.
- The successor partial unique index covers non-null successor IDs.
- The active partial unique index covers the four scope keys where
  `status = 'active'`.
- The lookup index is the four scope keys followed by `status, generation DESC`.

Enable and force RLS. Add no policy. Revoke every table privilege from `PUBLIC`,
`anon`, `authenticated`, and `service_role`. Do not alter schema-level `private`
privileges.

Required comments:

- Table: pre-tenant, endpoint-scoped, non-financial ingress contract registry;
  contains no secrets and grants no completion authority.
- `signature_key_identity_id`: opaque non-secret identity; deliberately unbound
  until the reviewed identity catalog and guarded creator land.
- `authority_key`: classifier only, never a completion-authority grant.
- `successor_generation_id`: forward-only, same-scope successor; no writer exists
  in this slice.

### Exact exclusions

The migration contains no `INSERT`, seed, function/RPC, role, `GRANT`, trigger,
policy, legacy/public-table alteration, active generation, key-identity catalog,
transition receipt, compatibility proof, parser implementation, provider/runtime
wiring, or existing-object privilege change. Do not update generated Supabase
types because this table is private-only.

### GREEN and verification

The SQL contract must prove exact columns/defaults/checks/FKs/index predicates,
comments, zero rows, `relrowsecurity`, `relforcerowsecurity`, no policies, and no
table privileges for all four denied roles. Transactional fixtures must prove
valid stored lifecycle shapes, invalid canonical keys/version/hash/lifecycle/time
shapes, duplicate scope generation, one active generation per scope, self/cross-
scope/forked successor rejection, and separate-scope success. Roll back all data.

After migration bytes are final:

1. Compute the SHA-256.
2. Add exactly one lexically ordered `PENDING_SOURCES` row.
3. Add the matching `EXPECTED_PENDING_SOURCES` object.
4. Increase the pending-source assertion from 55 to 56, after verifying those are
   still the current counts.

Run:

```bash
bash .github/scripts/check-migration-versions.test.sh
bash .github/scripts/check-migration-versions.sh
pnpm --filter @baci/web exec vitest run src/lib/payments/payment-ingress-contract-generations-migration.test.ts tools/db/supabase-history-replay-sources.test.ts tools/db/supabase-history-replay-manifest.test.ts tools/db/verify-supabase-history-replay-manifest.test.ts
pnpm --filter @baci/web db:replay:chronological \
  --sql-check supabase/migrations/20260731140000_payment_ingress_contract_generation_foundation.sql \
  --sql-check supabase/migrations/tests/payment_ingress_contract_generation_foundation.sql
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```

Refactor only test helpers duplicated inside the owned new test files. Commit all
Task 1 files atomically and report the observed RED evidence, GREEN evidence,
commit SHA, and exact changed-file list.
