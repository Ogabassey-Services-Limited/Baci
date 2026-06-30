# Audit Logging — System-Wide Implementation Plan

**Status:** Proposed (not started)
**Owner:** TBD (handoff)
**Scope:** Whole Baci system — `apps/web` (Next.js API + dashboard), `apps/mobile-storefront` & `apps/mobile-admin` (Expo), `supabase/` (Postgres + RLS).
**Type:** Security / compliance / forensics. Touches money paths and migrations — treat as high-care.

> This is a self-contained handoff. An agent picking this up should be able to execute it without prior context. Read "Current State" first, then work the phases in order. Do NOT batch all phases into one PR — ship phase-by-phase.

**Execution guardrails**
- Stay in this isolated worktree until the PR branch is intentionally created. Do not touch unrelated dirty files.
- Use fail-first tests for every phase: SQL tests for migrations/triggers/RLS and colocated Vitest route/helper tests for app changes.
- Never write raw secrets, full bank account numbers, recovery hashes, invitation tokens, provider responses, or access tokens into `audit_logs.changes`.
- Treat actor attribution as part of the data contract. A high-risk mutation without a resolvable actor must fail closed unless the owner explicitly approves a named system actor fallback.

---

## 1. Why this exists (problem statement)

A merchant's Paystack gateway was found **disabled** (`merchant_feature_settings.paystack_enabled = false`) for the `ogabassey` merchant, which silently broke the storefront payment selector. When we tried to answer **"who turned it off and when?"** we found:

- `merchant_feature_settings` has **only `updated_at`** — no `updated_by`. So the row can't tell us who changed it.
- The central `audit_logs` table **does not record payment-settings changes at all** (a prior production check only saw `branch` and `transaction` rows; rerun the live count before implementation — see below).

So a security/compliance-relevant change to a payment gateway is **completely untraceable**. This is representative of a system-wide gap: most sensitive mutations are not audited, and the few that are use inconsistent mechanisms.

**Goal:** every sensitive mutation (payments config, payouts, staff/roles, auth-sensitive actions, identity, destructive actions) produces a **tamper-resistant, attributable** audit record, and that trail is **readable by authorized admins**.

---

## 2. Current state (evidence)

### 2.1 The `audit_logs` table
Defined in `supabase/migrations/20260418000000_baseline.sql`:
- Columns: `id (uuid)`, `timestamp (timestamptz)`, `user_id (uuid, NOT NULL)`, `merchant_id (uuid, nullable)`, `action (text)`, `resource_type (text)`, `resource_id (text)`, `changes (jsonb)`, `ip_address (text)`, `user_agent (text)`, `status (text)`, `error_message (text)`.
- Table def around `:7433-7446`.
- RLS **enabled** (`:14799`) but weak:
  - **INSERT** policy requires `auth.uid() = user_id` (`:14721`) → a user can only write rows attributed to themselves; cannot be forced to write a truthful log.
  - **SELECT** policy is `auth.uid() = user_id` (`:14753`) → **owners/admins cannot read their merchant's audit trail** (only their own rows). Useless for forensics.
  - `GRANT ALL ... TO anon` and `TO authenticated` (`:16549-16551`) → overly broad; protection relies entirely on RLS.
  - Table is **not insert-only** (UPDATE/DELETE not revoked) → not a true immutable log.
  - `audit_logs.user_id` is `ON DELETE CASCADE` and `audit_logs.merchant_id` is a normal FK to `merchants(id)` with default no-action semantics. Because `merchants.user_id` also cascades from `auth.users`, merchant account deletion can either erase user-linked audit rows or be blocked by retained merchant-linked audit rows unless Phase 0 fixes both FKs.

### 2.2 What IS audited today (only two mechanisms, both tamper-resistant DB-level)
1. **Branch mutations** → `resource_type = 'branch'` (the 31 prod rows).
   - Trigger `audit_branch_mutation()` in `supabase/migrations/20260430120000_branch_scope_foundation.sql:354-409`. Fires on INSERT/UPDATE of branches; actions `branch.create|update|deactivate`; full `before`/`after` jsonb; actor from `auth.uid()` or `app.branch_audit_actor_id` GUC. **This is the reference pattern to copy.**
   - Important caveat: this pattern is safe for branches because branch rows do not contain secrets. It is **not safe to copy full-row `to_jsonb(OLD/NEW)` into audit rows for payment settings, staff invitations, payouts, recovery codes, or provider responses.**
2. **Payment-claim RPCs** → `resource_type = 'transaction'` (the prior production check saw 2 rows).
   - `supabase/migrations/20260510160000_claim_paystack_paid_atomic_rpc.sql:154-158`
   - `supabase/migrations/20260510170000_payment_rpc_null_safe_role_guards_and_tenant_scope.sql:163-167`
   - `supabase/migrations/20260510180000_atomic_claim_cancel_via_orders_join.sql:148-152`
   - These RPCs also document the current actor-model problem: `audit_logs.user_id` is `NOT NULL`, so automated paths currently skip `audit_logs` instead of inventing a fake `auth.users` row.
3. **Live-count caveat:** the production row counts in this section are drift-prone. Before implementation, rerun:
   `select resource_type, count(*) from public.audit_logs group by resource_type order by resource_type;`
   Then update this evidence block if resource types beyond `branch` / `transaction` now exist.

### 2.3 The app-level helper (exists but barely usable)
- `apps/web/src/lib/audit-logger.ts` — `logAudit()` helper.
  - **`resource_type` union hardcoded to `'domain' | 'dns' | 'email_forwarding' | 'id_protection'`** (`:7`) — cannot log payments/staff/payouts without editing the type.
  - Fire-and-forget; **swallows insert errors** (`:33-38`).
  - Writes via the **caller's RLS-scoped client** → inherently bypassable (omit the call = no record).
- Only 3 call sites (all domain management):
  - `apps/web/src/app/api/domains/[domain]/dns/route.ts:200,227`
  - `apps/web/src/app/api/domains/[domain]/email-forwarding/route.ts:213,236`
  - `apps/web/src/app/api/domains/[domain]/id-protection/route.ts:186,212`
- Unrelated in-memory `logAudit` in `apps/web/mcp-server/server.ts:267-287` (console only).

### 2.4 High-priority UNAUDITED sensitive surfaces

| # | Surface | File / lines | Mutation | Sensitivity |
|---|---------|--------------|----------|-------------|
| 1 | **Payment-gateway toggles & secrets** (`paystack_enabled`, `korapay_enabled`, `credit_direct_*`, `klump_*`, analytics tokens) | `apps/web/src/app/api/merchant/features/route.ts` PATCH `:431-456`, PUT `:556-562` | `merchant_feature_settings` update/upsert | **HIGH** (the original gap; no `updated_by`) |
| 2 | **Payout / withdrawal** (real money out) | `apps/web/src/app/api/payouts/request/route.ts:113-202` | inserts `payout_requests` + `transactions`, calls Korapay `sendPayout` | **HIGH** |
| 3 | **Staff role / permission / status** | `apps/web/src/app/api/staff/[id]/route.ts:217-221, 295, 397` | `staff_members` update | **HIGH** (privilege escalation) |
| 4 | **Staff invite / re-invite** | `apps/web/src/app/api/staff/route.ts:289-300, 223-238` | `staff_members` insert/update + email | **HIGH** |
| 5 | **Merchant identity / social / profile** | `apps/web/src/app/api/merchant/settings/route.ts:109-116` | RPC `update_merchant_social_media` | **MEDIUM-HIGH** |
| 6 | **Auth recovery codes** | `supabase/migrations/20260623191507_merchant_auth_recovery_codes.sql` (header says audit "deferred") | `begin/claim_merchant_auth_recovery_attempt` RPCs | **HIGH** (ATO) |
| 7 | **Account deletion** | `apps/web/src/app/api/merchant/auth/account-deletion/route.ts:35`; `apps/mobile-storefront/stores/auth-store-account.ts:52-54`; baseline SQL `delete_current_storefront_account()` | Web route calls missing/undocumented RPC `delete_current_user`; mobile-storefront calls migrated RPC `delete_current_storefront_account()` directly | **HIGH** (destructive; fix the RPC drift before adding audit) |
| 8 | **Price-negotiation auto-accept** | `apps/web/src/app/api/storefront/negotiate/route.ts:91-120` | negotiation outcome / accepted price | **MEDIUM** (margin override) |
| 9 | **Service-role writes that bypass RLS** | Current source scan: `rg -l "@/lib/supabase/admin" apps/web/src/app/api --glob '!**/*.test.ts' --glob '!**/*.test.tsx' --glob '!**/*test-helpers.ts'` returns 44 production API source/helper files | various | **MEDIUM-HIGH** |

---

## 3. Goals & non-goals

**Goals**
- Tamper-resistant audit for the highest-sensitivity tables (payments config, payouts, staff) via **DB triggers** (cannot be bypassed by app code or service-role writes).
- Attribution: know **who** + **when** for every sensitive change (`updated_by` columns + audited actor).
- Secret-safe payloads: audit changed keys and redacted summaries, not raw sensitive values.
- A **generalized app-level helper** for surfaces that can't be (or aren't worth) trigger-based, usable from RLS and service-role clients.
- A **readable** audit trail for authorized owners/admins, and an **immutable** `audit_logs` table.

**Non-goals (this plan)**
- Full SIEM/log shipping or external retention. (Note as a follow-up.)
- Auditing read access (we audit mutations, not reads).
- Rewriting the existing branch/transaction audit (keep as-is; they're the model).

---

## 4. Design principles

1. **Prefer DB triggers** for truly sensitive tables — they catch app, dashboard, service-role, and direct-SQL writes alike. Copy `audit_branch_mutation()`.
   - Copy its actor-resolution and `SECURITY DEFINER` shape, **not** its full-row payload shape.
2. **App helper is the fallback** for actions that aren't a single-table write (e.g. "payout requested + Korapay called") or where richer context is needed. Must accept an explicit client (so service-role routes can log) and must NOT silently swallow errors for money-movement events.
3. **Immutable log**: revoke UPDATE/DELETE on `audit_logs`; insert-only.
4. **Attribution at the row** AND in the log: add `updated_by` to sensitive tables; populate from `auth.uid()` or from a same-transaction trusted actor context. Service-role table writes made through supabase-js REST cannot set a DB GUC for a later trigger in a separate request; those writes need an RPC wrapper that sets `set_config('app.audit_actor_id', ..., true)` and performs the mutation in the same transaction, or they need app-level audit after the write.
5. **Append-only migrations** — never edit existing migration files; add new timestamped ones. Use `IF NOT EXISTS`/`IF EXISTS`. Add indexes on `audit_logs (merchant_id, timestamp)` and `(resource_type, timestamp)`.
6. **Least privilege**: drop `GRANT ALL TO anon` on `audit_logs`; scope grants to what RLS needs.
7. **Redaction by default**: allowlist fields per resource type. Secret-like keys (`*_token`, `*_secret`, API keys, invite/recovery hashes, provider responses, bank account numbers) are either omitted, replaced with `[REDACTED]`, or summarized as `changed: true` / `last4`.

---

## 5. Phased implementation

### Phase 0 — Foundations (schema + table hardening)
New migration(s):
- Add `updated_by uuid` (nullable, FK `auth.users(id) ON DELETE SET NULL` where appropriate) to: `merchant_feature_settings`, `payout_requests`, `staff_members`, and `merchants` (the table backing `update_merchant_social_media`).
- Harden `audit_logs`:
  - Add indexes: `(merchant_id, timestamp desc)`, `(resource_type, timestamp desc)`.
  - Fix actor retention before account-deletion audit lands: either make legacy `user_id` nullable and change its FK from `ON DELETE CASCADE` to `ON DELETE SET NULL`, or add `actor_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL`, `actor_type text`, and `actor_label text`, then backfill from `user_id`. Do not let deleting an account erase its audit trail.
  - Fix merchant retention before merchant-account deletion audit lands: do not leave `audit_logs.merchant_id` as a default no-action FK to `merchants(id)` while `merchants.user_id` cascades from `auth.users`. Either drop the FK and treat `merchant_id` as historical denormalized context, or add a separate immutable merchant snapshot column (for example `merchant_id_at_time uuid`, `merchant_slug_at_time text`) and change the FK-backed live merchant reference to `ON DELETE SET NULL`. Test that deleting a merchant owner neither deletes audit rows nor fails because audit rows reference the merchant.
  - Revoke `UPDATE, DELETE` from `anon, authenticated` (insert-only / immutable).
  - Replace the broad `GRANT ALL` with explicit `INSERT` (+ `SELECT` per new read policy).
  - **New SELECT RLS** allowing a merchant **owner/admin** to read rows where `merchant_id` = their merchant (not just `auth.uid() = user_id`). Reuse or mirror the existing `public.check_staff_permission(user_id, merchant_id, resource, action)` helper pattern for owner/staff permission resolution.
  - Keep direct `INSERT` strict. Trigger/helper functions run as `SECURITY DEFINER`; authenticated direct inserts, if still allowed for legacy domain logs, must require the resolved caller to match the actor column and must reject spoofed actor fields.
- Add helper SQL functions in an existing schema, not an uncreated `app` schema:
  - `public.resolve_audit_actor()` (or equivalent private helper) resolves `auth.uid()` first, then `current_setting('app.audit_actor_id', true)`, plus optional `app.audit_actor_type` / `app.audit_actor_label`.
  - `public.write_audit_log(...)` (SECURITY DEFINER, `SET search_path = ''`, fully-qualified references, revoked from PUBLIC unless intentionally exposed) standardizes inserts and rejects high-risk writes with no actor.
  - If the TypeScript helper calls an RPC wrapper, expose only a narrow authenticated wrapper that resolves `auth.uid()` internally and ignores spoofed actor fields. If the TypeScript helper inserts directly into `audit_logs`, keep the RLS INSERT policy strict and test spoof attempts.
  - Redaction/diff helpers for each trigger-covered resource (`public.redact_audit_payload(...)` or resource-specific helpers). These helpers must be tested against known secret fields.

**Acceptance:** migrations validate on a Supabase branch: use normal fresh-branch replay when available, or the prod-like `apply_migration` path if the known baseline replay issue appears; `audit_logs` rejects UPDATE/DELETE; an owner can `SELECT` their merchant's rows; deleting a user or merchant owner cannot cascade-delete audit rows and cannot be blocked by audit FK constraints; new actor/updated_by columns exist; redaction tests prove sensitive keys never appear in `audit_logs.changes`.

### Phase 1 — DB triggers for the top-3 sensitive tables (highest leverage)
Copy the `audit_branch_mutation()` pattern (`20260430120000_branch_scope_foundation.sql:354-409`) for:
- `merchant_feature_settings` → actions `payment_settings.create|update`. Capture changed keys and redacted before/after values only for safe fields. For `facebook_capi_token`, `tiktok_access_token`, `snapchat_capi_token`, `ga4_api_secret`, `credit_direct_public_key`, and nested `custom_settings` secrets, log key changed + `[REDACTED]` only. **This directly closes the original gap without copying secrets into the log.**
- `payout_requests` → `payout.create|status_change`. Capture amount/currency/status/reference and bank `last4`; omit raw `bank_account_number`, full `korapay_response`, and failure payloads that may contain provider PII.
- `staff_members` → `staff.create|update|remove|invite_resend`. Capture role/permission/status deltas; omit `invitation_token`; include email only if owner approves PII in audit logs, otherwise hash or redact it.

Each trigger:
- `BEFORE INSERT OR UPDATE`: resolve actor and populate `updated_by`; reject missing actor for high-risk mutations.
- `AFTER INSERT OR UPDATE`: writes `audit_logs` via `public.write_audit_log`; actor = `auth.uid()` or same-transaction `app.audit_actor_id` GUC.
- For direct SQL/admin console work, require operators to run the mutation inside a transaction with `SELECT set_config('app.audit_actor_id', '<auth.users uuid>', true);` first. Missing actor should fail closed for these tables.

**Acceptance:** toggling `paystack_enabled` through the dashboard/API produces an `audit_logs` row with `resource_type='merchant_feature_settings'`, the changed keys in `changes`, and a non-null actor; direct SQL succeeds only when actor GUC is set; same for payout and staff role changes. SQL tests assert both positive cases and missing-actor failures, and assert no secret field values appear in the audit JSON.

### Phase 2 — Generalize the app helper + cover app-only flows
- Rewrite `apps/web/src/lib/audit-logger.ts`:
  - Widen `resource_type` to a real enum incl. `merchant_feature_settings | payout | staff | merchant_profile | auth_recovery | account | negotiation | domain | dns | email_forwarding | id_protection`.
  - Accept an explicit Supabase client param (support service-role).
  - Do not accept a caller-supplied `user_id` as truth for authenticated clients; resolve from auth/server context or a trusted server-only actor object.
  - Keep safe `before/after` diff support; pass all changes through the same redaction allowlist; **stop swallowing errors** for money/auth events (log via structured `logger`; for money movement, surface failure).
- Add `logAudit` calls to flows that triggers don't fully capture (multi-step / external side effects):
  - `payouts/request/route.ts` — log request + Korapay result/failure (complements the DB trigger with outcome).
  - Account deletion — first reconcile the RPC drift:
    - Existing migrated destructive RPC: `delete_current_storefront_account()` in `20260418000000_baseline.sql`, later grant-hardened in `20260611232254_harden_admin_analytics_rpc_privileges.sql`.
    - Current web API route calls `delete_current_user`, which is not defined in local migrations.
    - Mobile-storefront calls `delete_current_storefront_account()` directly.
    - Decide whether to update the web route to the existing RPC or create a new wrapper migration for `delete_current_user`; audit inside the final RPC so deletion cannot bypass the audit row.
  - Recovery-code RPCs (`20260623191507_...`) — add audit **inside the RPC** (per its own deferred note).
  - `storefront/negotiate/route.ts` — log accepted price / margin override.
  - `merchant/settings` `update_merchant_social_media` — log inside the RPC or the route.

**Acceptance:** each listed flow writes a correctly-typed audit row; helper works from both RLS and service-role clients; no silent error-swallow on money/auth.

### Phase 3 — Service-role coverage sweep
- Enumerate production API files importing `@/lib/supabase/admin` with:
  `rg -l "@/lib/supabase/admin" apps/web/src/app/api --glob '!**/*.test.ts' --glob '!**/*.test.tsx' --glob '!**/*test-helpers.ts'`
  The current scan returns 44 production API source/helper files, not ~30.
- For each sensitive write, mark it as:
  - covered by a Phase-1 trigger with authenticated user actor,
  - covered by an RPC wrapper that sets `app.audit_actor_id` in the same transaction as the mutation,
  - covered by app-level `logAudit` with a trusted server-only actor,
  - or explicitly out of scope with a reason.
- Prioritize: wallet top-up confirm, VTU purchase/confirm, marketplace token storage (`marketplace/jumia/connect/*`), `mobile-onboarding`.

**Acceptance:** a documented list of service-role write routes, each marked "covered by trigger" or "logs via helper", with no HIGH-sensitivity route uncovered.

### Phase 4 — Read surface (optional, follow-up)
- Minimal dashboard "Activity / Audit log" view for owners/admins (read the merchant's `audit_logs`, filter by resource_type/time/actor). Mobile-admin equivalent optional.

---

## 6. Concrete task checklist (for the executing agent)

- [ ] Phase 0 migration: actor-model fix for `audit_logs.user_id` / new actor columns so account deletion cannot erase logs.
- [ ] Phase 0 migration: merchant-retention fix for `audit_logs.merchant_id` / merchant snapshot columns so merchant deletion cannot erase or be blocked by logs.
- [ ] Phase 0 migration: `updated_by` columns + `audit_logs` indexes + immutability + read RLS + `public.write_audit_log()` / actor helper / redaction helpers.
- [ ] Phase 1 migration: triggers for `merchant_feature_settings`, `payout_requests`, `staff_members` (copy `audit_branch_mutation` actor pattern, not full-row payloads).
- [ ] Verify on a Supabase branch: migrations apply through fresh-branch replay or the prod-like `apply_migration` fallback, triggers fire, RLS read works (see notes on branch baseline replay below).
- [ ] Phase 2: rewrite `apps/web/src/lib/audit-logger.ts` (+ colocated test) and wire the app-only flows.
- [ ] Phase 2: reconcile `delete_current_user` vs `delete_current_storefront_account`, then add audit inside the final account-deletion RPC and recovery-code RPCs (new migrations).
- [ ] Phase 3: service-role route sweep + coverage doc using the exact `rg` command above.
- [ ] Tests: SQL trigger tests + redaction tests + actor-missing fail-closed tests + Vitest for the helper + route tests asserting an audit row is written on success.
- [ ] Backfill note: existing rows have no history; document that audit starts from deploy date.
- [ ] Ship per-phase PRs (Phase 0+1 first — they close the original gap).

---

## 7. Reference: trigger template to copy
`supabase/migrations/20260430120000_branch_scope_foundation.sql:354-409` (`audit_branch_mutation`). Mirror its actor resolution (`auth.uid()` -> GUC fallback), fail-closed actor behavior, trigger installation, and function revokes. Do **not** mirror its full-row `before`/`after` jsonb capture for secret-bearing tables. Payment-claim RPC audit inserts: `20260510160000_claim_paystack_paid_atomic_rpc.sql:154-158`.

---

## 8. Risks & rollout

- **Money paths**: `payouts`, `payments/*`, `merchant_feature_settings` are revenue-critical. For the Phase 1 trigger-covered tables, missing actor, redaction failure, or audit insert failure must fail closed so the sensitive mutation does not silently become unaudited. Only lower-risk app-helper surfaces may log-and-continue, and each exception must be documented.
- **Secret spillage**: a naive `to_jsonb(OLD/NEW)` audit row would permanently copy payment/analytics tokens, staff invite tokens, bank details, or provider responses into a broadly-readable audit table. Redaction is a launch blocker.
- **Actor propagation**: service-role mutations through PostgREST cannot set a trigger-visible GUC with a separate client call. Use authenticated clients where possible, same-transaction RPC wrappers where triggers are required, or app-level helper rows for external side effects.
- **Account deletion drift**: local migrations define `delete_current_storefront_account()`; the web route calls `delete_current_user`. Fix or wrap that mismatch before auditing account deletion. Also fix both `audit_logs.user_id` and `audit_logs.merchant_id` retention constraints before adding destructive-account audit rows.
- **Supabase branch baseline replay** can fail on squashed baselines (known issue) — hand-build prod-like state then `apply_migration`; verify objects exist on prod after deploy (a recorded migration version ≠ DDL applied).
- **Service-role inserts** bypass RLS — ensure the SECURITY DEFINER `write_audit_log` sets a trustworthy actor (GUC) rather than a spoofable body field.
- **Volume**: high-frequency tables (transactions/wallet) could grow `audit_logs` fast — index + consider partitioning/retention later (out of scope, note it).
- Append-only migrations only; never edit existing ones.

---

## 9. Acceptance criteria (definition of done for Phases 0–2)

1. Toggling any payment gateway (`merchant_feature_settings`) via dashboard/API yields an `audit_logs` row with actor, timestamp, changed keys, and `merchant_feature_settings.updated_by` is set; direct SQL requires an explicit actor GUC and fails closed without it.
2. Creating a payout and changing a staff role each yield attributable audit rows.
3. No raw secret/token/recovery hash/full bank account number/provider response appears in `audit_logs.changes`.
4. `audit_logs` is insert-only (UPDATE/DELETE denied), deleting a user or merchant cannot delete audit records or be blocked by audit FK constraints, and an owner/admin can read their merchant's trail while the merchant exists; `anon` has no blanket grant.
5. The generalized `logAudit` helper is used by account-deletion, recovery-code, and negotiation flows, works from service-role with a trusted server actor, and does not silently swallow money/auth errors.
6. All new code has colocated tests; `pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test` pass.

---

## 10. Open questions for the owner
- Which lower-risk app-helper surfaces, if any, may log-and-continue on audit failure? Phase 1 trigger-covered money/staff settings are fail-closed by default.
- Retention period for `audit_logs`? (drives partitioning/archival decisions)
- Is a customer-facing/owner-facing audit UI in scope now (Phase 4) or later?
- What actor label should automated cron/webhook/system jobs use when no human `auth.users.id` exists?
- Should staff/customer email and bank-account last4 be visible in owner/admin audit UI, or stored only as hashes/redacted summaries?
