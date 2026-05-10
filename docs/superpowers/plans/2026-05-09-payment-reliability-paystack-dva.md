# Payment Reliability — Paystack DVA Reconciliation, Customer Upsert, Shipping Persistence (v2)

> **File location note:** Plan mode constrains my edits to this file. The
> intended canonical home is
> `docs/superpowers/plans/2026-05-09-payment-reliability-paystack-dva.md`.
> When we exit plan mode the first action is to copy this content there
> verbatim. All v2 + v3 corrections (Δ-1 through Δ-11 across two review
> rounds) are integrated below — there is no separate delta file.

## Δ corrections changelog (cumulative)

| # | Type | Where it landed |
|---|---|---|
| Δ-1 | per-effect retry semantics | §4 A1 (claim-based outbox table) |
| Δ-2 | line-1698 settlement read | §4 A0 step 2 (source from verified Paystack response) |
| Δ-3 | paid_at match window | §5 B0 (DVA expires_at + 90min grace) |
| Δ-4 | external calls outside DB transaction | §4 A2 (single atomic RPC + external bookends) |
| Δ-5 | no restock assumption | §4 verification + §5 B4 (defer manage_stock=true cancellations) |
| Δ-6 | Paystack channel filter client-side | §5 B4 (status+from+to query, JS-filter dedicated_nuban) |
| Δ-7 | race-prone metadata flags | §4 A1 (replaced with claim-based `payment_side_effects` table) |
| Δ-8 | A2 transaction mechanism unspecified | §4 A2 (single PL/pgSQL RPC) |
| Δ-9 | B2 concurrent inserts still race | §5 B2 (advisory lock + retry-on-23505 loop) |
| Δ-10 | DVA unique constraint missing | §5 B1 (use existing `unique_order_account`) |
| Δ-11 | A2 doesn't cancel duplicate transactions | §4 A2 (RPC also marks duplicates cancelled) |
| Δ-12 | B1/B4 don't atomically flip to paid before side effects | §4 A2 + §5 B1 + B4 — generalize the atomic RPC as `claim_paystack_paid_atomic`, callable from manual/A2 (with cancel list) and webhook/cron (no cancel list). Both call helper after. |
| Δ-13 | `audit_logs.user_id` is NOT NULL | §4 A2 — RPC takes optional `p_operator_user_id UUID`; manual A2 script passes the operator's auth user id and writes audit_logs; B1/B4 pass NULL and skip audit_logs (per Δ-25). Original "create auth.users system row + BACI_SYSTEM_USER_ID env" approach was rejected as fragile and is no longer in the plan. |
| Δ-14 | `record_merchant_settlement` not idempotent — no unique constraint; double-credit on retry | §4 A0 — Phase A migration creates partial unique index on the **existing** columns `(source_type, source_id, gateway_reference) WHERE gateway_reference IS NOT NULL AND status != 'cancelled'` (corrected key per Δ-17/Δ-22); wraps the RPC with `INSERT … ON CONFLICT DO NOTHING` and `IF FOUND THEN credit wallet`. Original sketch using `transaction_id` was wrong because that column doesn't exist on `merchant_settlements`. |
| Δ-15 | RPC continues after zero rows updated | §4 A2 — RPC uses `GET DIAGNOSTICS row_count` after each UPDATE, branches: (a) txn already completed AND linked to canonical order → idempotent no-op, return early; (b) txn linked to a different order → raise `transaction_order_link_mismatch`; (c) txn in unexpected state → raise; (d) duplicates already finalized → log count, continue |
| Δ-16 | Plan contradicted itself on outbox location | §3 ref architecture, §7 sub-decisions, §9 file list — all updated to `payment_side_effects` table; no remaining "orders.metadata flags" references |
| Δ-17 | `merchant_settlements.transaction_id` doesn't exist | §4 A0 — unique index keyed on existing `(source_type, source_id, gateway_reference) WHERE gateway_reference IS NOT NULL AND status != 'cancelled'`. Caller invariant documented: `gateway_reference` here is our `BAC-…` (per A0.5 Option α), not Paystack's numeric ref. |
| Δ-18 | RPC default-after-required syntax error | §4 A2 — reordered: `p_operator_user_id` moved before `p_cancel_order_ids` (defaulted) and `p_operator_label` (defaulted). RPC compiles. |
| Δ-19 | `claim_paystack_paid_atomic` was SECURITY DEFINER without REVOKE | §4 A2 — `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated; GRANT EXECUTE … TO service_role;` (mirrors `20260428071421_advisor_bucket_a_revoke_internal_function_grants.sql`). |
| Δ-20 | New tables missing RLS/grants | §4 A1 (`payment_side_effects`) + §5 B4 (`cron_state`, `reconciliation_review`) — all enable RLS, `REVOKE ALL FROM PUBLIC, anon, authenticated; GRANT ALL TO service_role;` with no policies (so even if a grant slips back, RLS-enabled-no-policy still denies clients). Admin pages access via service-role API routes. |
| Δ-21 | Stale "orders.metadata" / "B-time" lines | §4 A1 line 166 corrected to reference Δ-14/Δ-17 in A0; §7 Q4 corrected to "payment_side_effects table". Only intentional historical references remain in the Δ changelog itself. |
| Δ-22 | Settlement key language was mixed (BAC-* vs Paystack ref vs transaction_id) | §4 A0 — single invariant stated and repeated identically: settlement key is `(source_type, source_id, gateway_reference)` where `gateway_reference = transactions.gateway_reference` (i.e. our `BAC-…`). Paystack numeric ref lives in `merchant_settlements.metadata.paystack_reference` only. |
| Δ-23 | RPC didn't validate canonical order state | §4 A2 — RPC now `SELECT payment_status FROM orders … FOR UPDATE`; allows `pending` (will flip) and `paid` (idempotent replay); raises `canonical_order_not_found` or `canonical_order_in_unexpected_state` for cancelled/refunded/unknown. |
| Δ-24 | Stale-claim takeover was racy | §4 A1 — `payment_side_effects` table gains `claim_token UUID` and `claimed_by TEXT`; claim/takeover is an atomic INSERT…ON CONFLICT DO UPDATE WHERE (failed OR stale) RETURNING `we_won = (claim_token = my_token)`; mark-completed/failed clauses are token-gated. Worst-case duplicate execution caught by per-integration idempotency at the boundary. |
| Δ-25 | `auth.users` direct INSERT was migration-fragile | §4 A2 — removed entirely. RPC's `audit_logs` INSERT is conditional on `p_operator_user_id IS NOT NULL`. Manual reconcile (A2 script) provides the operator's auth.users.id and writes to audit_logs; automated reconciles (B1 webhook, B4 cron) pass NULL and rely on `transactions.metadata` + `payment_side_effects` rows for audit trail. No `BACI_SYSTEM_USER_ID` env var needed. |
| Δ-26 | Verification said "one row for this transaction" | §10 — corrected to "exactly one row matching `(source_type, source_id, gateway_reference)`" (the Δ-17 unique-key columns). |
| Δ-27 | A0's webhook SELECT still omitted `gateway_reference`, and existing line-1711 settlement call passes Paystack's `reference` variable | §4 A0 — added `gateway_reference` to SELECT list; explicit edit at line 1711 to change `p_gateway_reference` from Paystack `reference` to `transaction.gateway_reference`. The Δ-22 BAC-* invariant is now actually implementable. |
| Δ-28 | Atomic RPC didn't move `shipping_status` pending → processing | §4 A2 — RPC's order UPDATE now mirrors the existing webhook (line 1501) and verify (line 271) behavior with `shipping_status = CASE WHEN shipping_status = 'pending' THEN 'processing' ELSE shipping_status END` (guarded so already-progressed shipping stays put). |
| Δ-29 | Plan promised `merchant_settlements.metadata.paystack_reference` but the existing RPC has no metadata param | §4 A0 — wrapped RPC gains `p_metadata jsonb DEFAULT '{}'::jsonb`; webhook TS caller passes plain object `{ paystack_reference: ref, verified_gateway_fee: fee }` (Δ-59 corrected — never `jsonb_build_object` in TS). Column already exists at `baseline.sql:9248`. |
| Δ-30 | Stale "system user provisioning" wording | §9 file list updated to "no system user provisioning"; §3-§4 changelog rows for Δ-13/Δ-14 corrected to reflect the Δ-25 simplified path and the Δ-17 corrected key. |
| Δ-31 | Web checkout VAT/order-total mismatch | §2 Bug 6 + §5 B3.5 — checkout calculates/displays VAT but the active `checkout-page.tsx` POST body and extracted `checkout/handlers/place-order.ts` omit `tax_amount`; `/api/orders` defaults missing VAT to 0; the DB tax trigger later fills `orders.tax_amount` without recomputing `orders.total`. Fix belongs in **web checkout/API/RPC**, not mobile-admin. A1/A2 now guard FIRS side effects on financial consistency. |
| Δ-32 | VAT-inclusive path was under-specified; B4 scan would false-flag inclusive orders | §4 A0 (Δ-40 pull-forward) + §5 B3.5 — added `orders.tax_basis TEXT CHECK ('exclusive'\|'inclusive')`, **nullable, no DEFAULT** during backfill (Δ-37) — corrected from earlier "DEFAULT 'exclusive'" sketch. Backfill heuristic in the same migration; remaining NULL rows ⇒ `reconciliation_review` row (Δ-33). §4 A1's `financialConsistency()` and §5 B4's review predicate branch on `tax_basis` so inclusive orders satisfy `total = subtotal + shipping_fee + gift_wrapping_fee - discount_amount` (tax_amount is informational). NULL `tax_basis` is treated as inconsistent. |
| Δ-33 | `reconciliation_review` was payment-shaped only; B3.5 reuses it for tax | §5 B4 — added `order_id`, `issue_type` enum (`payment_match_ambiguous`, `payment_match_zero_candidates`, `manage_stock_cancellation_held`, `tax_basis_unclassified`, `tax_basis_inconsistent_total`), `metadata jsonb`, and `resolution_notes`. Indexes on `(issue_type, resolved_at) WHERE resolved_at IS NULL` and `(order_id) WHERE order_id IS NOT NULL`. |
| Δ-34 | Gift wrapping referenced but no server-side field/invariant | §5 B3.5 — added `orders.gift_wrapping_fee NUMERIC NOT NULL DEFAULT 0 CHECK (>= 0)` + RPC param + total math. Default 0 = no-op for current orders. If checkout doesn't wire it yet, the column is dormant; once wired, the math is already correct. |
| Δ-35 | Plan said `failed/deferred` but enum only allows `claimed/completed/failed` | §4 A1 — replaced "failed/deferred" with "failed" everywhere; the existing CHECK enum is the single source of truth. |
| Δ-36 | Mobile manual "Record Payment" fails with blank optional notes, and lacks a guard for active processor transactions | §4 A3 — normalize blank optional `notes`/`reference` to `undefined` in the manual record-payment route and mobile caller; add a 409 guard when an order has a pending/processing non-manual gateway transaction (Paystack/Korapay/etc.) so staff use reconciliation instead of creating a parallel manual transaction. (Renumbered from Δ-32 to deduplicate with VAT-inclusive entry per Δ-39 below.) |
| Δ-37 | `tax_basis` was internally contradictory: `NOT NULL DEFAULT 'exclusive'` while plan said unclassified rows should "stay NULL" | §5 B3.5 — column added as **nullable** during backfill phase: `orders.tax_basis TEXT CHECK (tax_basis IN ('exclusive','inclusive'))` (no NOT NULL, no DEFAULT). Backfill UPDATEs classify what we can; remaining NULL rows ⇒ `reconciliation_review` row with `issue_type='tax_basis_unclassified'`. New orders inserted by the updated `create_storefront_order` always set `tax_basis` explicitly (RPC param defaults to `'exclusive'` if caller doesn't specify). A separate follow-up migration enforces NOT NULL after ops resolves the unclassified backlog. |
| Δ-38 | Old financial guard formula contradicted the new branched logic | §4 A1 FIRS bullet + §4 A2 verification — replaced the single `total = subtotal + shipping + tax - discount` formula with a call into the shared `financialConsistency` helper that branches on `tax_basis` (Δ-32 logic) and accounts for `gift_wrapping_fee` (Δ-34). VAT-inclusive orders no longer false-fail; gift-wrap mismatches no longer pass through. |
| Δ-39 | `apps/web/src/schemas/orders.ts` missing from B3.5's file list | §9 file list — added. The Zod `orderCreateSchema` is the API validation layer, so `expected_total`, `client_total`, `gift_wrapping_fee`, and `tax_basis` must all be added there before `/api/orders/route.ts` can enforce the new invariant. Tests in the same file. |
| Δ-40 | Phase A depended on Phase B3.5 columns (`tax_basis`, `gift_wrapping_fee`) | §4 A0 — pulled the column-additions migration forward into Phase A: `<ts>_orders_tax_basis_gift_wrapping_and_reconciliation_review.sql` (final name; expanded by Δ-44 to also create `reconciliation_review`) adds both columns + backfill + filed unclassified rows, ships in PR1 ahead of A1/A2. The wider B3.5 work (RPC params, schema validation, atomic trigger update) stays in Phase B where it belongs. |
| Δ-41 | Settlement RPC overload risk — adding `p_metadata` creates a new function, leaving 4 existing callers on the old non-idempotent one | §4 A0 — migration uses `DROP FUNCTION` then `CREATE OR REPLACE` with the new signature; A0 PR also updates **all 4 callers** in lockstep: `webhook/route.ts:915`, `webhook/route.ts:1705`, `verify/route.ts:447`, `juicyway/webhook/route.ts:478`. REVOKE/GRANT re-issued on the new signature (the prior REVOKE migration named the old, now-dropped sig). |
| Δ-42 | Direct `create_storefront_order` RPC calls bypass `/api/orders` VAT validation (RPC has `GRANT ALL TO anon`) | §5 B3.5 — RPC enforces VAT itself: reads merchant VAT config, recomputes expected_tax for VAT-registered/exclusive merchants, requires `\|p_tax_amount - expected_tax\| ≤ 1` else `RAISE EXCEPTION`; non-registered merchants must pass `p_tax_amount = 0`. We can't revoke anon access (storefront depends on it), so the RPC is the enforcement boundary. Tests must include direct-RPC path bypassing the API. |
| Δ-43 | Stale Δ-32 changelog row claimed `tax_basis NOT NULL DEFAULT 'exclusive'` after Δ-37 corrected to nullable/no-DEFAULT | §3 changelog Δ-32 row rewritten to match the Δ-37 / Δ-40 reality. |
| Δ-44 | `reconciliation_review` was created in B4 but written to from B1 / B3.5 / A0-backfill | §4 A0 — table creation pulled into A0's column-additions migration so rows can be inserted from PR1. B4's migration now only creates `cron_state` and references `reconciliation_review` as already existing. |
| Δ-45 | `record_merchant_settlement` DROP+CREATE body was a sketch that omitted wallet/upcoming-balance/Korapay-instant-credit/wallet_transactions logic | §4 A0 — full body preserved verbatim from `baseline.sql:5105-5206`; changes are (1) **Δ-71 role guard** `IF auth.role() <> 'service_role' THEN RAISE EXCEPTION` at the very top, (2) `p_metadata jsonb` param + `metadata` column on INSERT, (3) ON CONFLICT DO NOTHING on the Δ-14 partial unique index, (4) all wallet/transaction writes gated on `IF v_settlement_id IS NOT NULL` so duplicate retries never double-credit. |
| Δ-46 | §9 file list missed the new A0 column migration and three settlement caller edits | §9 — added `<ts>_orders_tax_basis_gift_wrapping_and_reconciliation_review.sql` migration; added `apps/web/src/app/api/payments/verify/route.ts`, `apps/web/src/app/api/payments/juicyway/webhook/route.ts` and its test to Phase A code; renamed Phase B's `<ts>_reconciliation_review_and_cron_state.sql` to `<ts>_cron_state.sql` since the table moved out. |
| Δ-47 | B3.5 referenced `p_subtotal`, `p_total`, `p_tax_basis` RPC params that don't exist | §5 B3.5 — explicit: the only NEW params added to `create_storefront_order` are `p_tax_basis TEXT DEFAULT 'exclusive'` and `p_gift_wrapping_fee NUMERIC DEFAULT 0`. `subtotal` and `total` stay server-derived (RPC already computes subtotal from `p_items` at `migration:217-219`); `p_tax_amount` is validated against server-recomputed expected_tax. The API surfaces friendly errors; direct RPC callers get raw exceptions. |
| Δ-48 | `merchant_settlements` CHECK constraints reject `gateway='juicyway'` and `source_type='domain_purchase'` — both are passed by live callers and have been silently failing | §4 A0 — new `<ts>_settlement_check_constraints.sql` migration ships **before** the idempotency migration: drops + recreates the gateway and source_type CHECKs to include `juicyway` and `domain_purchase`. Without this, A0's ON CONFLICT path turns silent failures into noisy ones and the webhook test would fail. |
| Δ-49 | `reconciliation_review` had no uniqueness for unresolved rows — every retry/cron/backfill would file a duplicate | §4 A0 — three partial UNIQUE indexes: `(issue_type, order_id) WHERE resolved_at IS NULL AND order_id IS NOT NULL`, same for `txn_id`, same for `paystack_ref`. Resolved rows fall out of the unique check so a recurrence can be re-filed. Callers use `ON CONFLICT … DO NOTHING`. |
| Δ-50 | B3.5 still claimed to add columns A0 already owns | §5 B3.5 — rewritten to explicitly say "columns already exist from A0; this section only updates the RPC signature, the `update_order_tax_totals` trigger, and the Zod schema". The follow-up `SET NOT NULL` migration also lives here. |
| Δ-51 | A1 writes `error='financial_totals_inconsistent'` but verification said `error LIKE 'financial_inconsistency:%'` | §10 verification — corrected to `error='financial_totals_inconsistent'` (exact match). |
| Δ-52 | `ON CONFLICT ON CONSTRAINT <partial-index-name>` is invalid Postgres syntax | §4 A0 reconciliation_review backfill seed — replaced with the valid form: `ON CONFLICT (issue_type, order_id) WHERE resolved_at IS NULL AND order_id IS NOT NULL DO NOTHING`. The earlier inline comment was correct; the actual SQL now matches it. |
| Δ-53 | `<ts>_settlement_check_constraints.sql` was specified in A0 prose but missing from §9 file list (with explicit ordering) | §9 — Phase A migrations now an explicit numbered list (1–5); the new check-constraints migration is item 2, must run **before** the idempotency migration which is item 3. |
| Δ-54 | Settlement duplicate pre-check predicate was stricter than the unique-index predicate (would block on cancelled-status historical duplicates the index intentionally allows) | §4 A0 — pre-check now mirrors the index: `WHERE gateway_reference IS NOT NULL AND status != 'cancelled'`. Cancelled historical rows no longer block the constraint addition. |
| Δ-55 | B0 / B1 / B4 callers said "write `reconciliation_review` row" without specifying ON CONFLICT contract — retry storms would unique-violate | §5 B0/B1/B4 — every callsite now specifies the canonical upsert form `INSERT … ON CONFLICT (issue_type, <key>) WHERE resolved_at IS NULL AND <key> IS NOT NULL DO NOTHING`, with the conflict target column list matching whichever partial unique index covers the row's natural key (`paystack_ref`, `txn_id`, or `order_id`). B1 webhook test asserts the multi-candidate scenario produces exactly one row across two simulated runs. |
| Δ-56 | A0 verification didn't prove the recreated CHECK constraints actually accept `juicyway` and `domain_purchase` | §10 — added a smoke-test SQL block that INSERTs both shapes (with cancelled-status tombstones for cleanup) before relying on the idempotency wrapper. If either fails with `check_violation`, halt and rerun the constraint migration. |
| Δ-57 | B0 said "0 candidates → no-op (probably already paid)" while B4 says "file `payment_match_zero_candidates`" — recreates silent-drop class of bug | §5 B0 — corrected: 0 candidates → look up a completed txn matching the Paystack ref via `metadata.paystack_reference`/`gateway_response.reference` (per A0.5 Option α). Only no-op if a completed match is found (idempotent re-pass). Otherwise upsert `payment_match_zero_candidates` and alert. Paystack-says-success-we-have-nothing now always surfaces. |
| Δ-58 | A1's mark-completed step used PL/pgSQL `GET DIAGNOSTICS row_count`, which can't run from Supabase JS | §4 A1 — rewritten to use the JS pattern `await supabase.from('payment_side_effects').update({...}).eq('claim_token', myToken).select('order_id')` and check `data.length`. Same shape for the failure branch. Concurrent-replay test asserts the boundary side-effect (e.g. ZeptoMail mock) was called exactly once. |
| Δ-59 | Caller bullets used SQL `jsonb_build_object` syntax inside TypeScript routes | §4 A0 caller list — rewritten to plain JS object literals: `p_metadata: { paystack_reference: reference }` etc. PostgREST converts to jsonb at the wire boundary. `jsonb_build_object` is reserved for SQL/RPC bodies. |
| Δ-60 | A1 helper had raw `INSERT … ON CONFLICT … RETURNING` SQL — Supabase JS can't run arbitrary SQL | §4 A1 — claim/takeover moved into a small `claim_payment_side_effect(...) RETURNS (we_won boolean, current_status text)` SECURITY DEFINER RPC with REVOKE/GRANT lockdown. Helper invokes it via `supabase.rpc('claim_payment_side_effect', {...}).single()`. Same pattern available for `complete_payment_side_effect`/`fail_payment_side_effect` if the simple `.update().eq('claim_token', myToken).select()` JS pattern (Δ-58) proves insufficient during implementation. |
| Δ-61 | Plan said pass `Idempotency-Key` to ZeptoMail, but ZeptoMail has no such param (verified at `zeptomail.ts:314`) | §4 A1 email step rewritten — idempotency lives at the DB layer via the `payment_side_effects` claim record (Δ-24/Δ-60). ZeptoMail's `client_reference` is set to `order:<id>:paid_email` for server-side audit, queryable via send-history API if we later need hard dedup. Residual risk (send succeeds, worker crashes before mark-completed within 60s claim TTL) documented in helper JSDoc. |
| Δ-62 | Stale `jsonb_build_object` references in TS prose (Δ-29 changelog row, A1 financialConsistency `result=jsonb_build_object(...)` line) | §3 Δ-29 row + §4 A1 corrected to plain TS object literals. `jsonb_build_object` only remains in actual SQL/RPC bodies. |
| Δ-63 | §9 Phase A migration #4 didn't mention the new `claim_payment_side_effect` RPC | §9 — `<ts>_payment_side_effects.sql` description expanded to include the RPC + REVOKE/GRANT. Both the table and the RPC ship in the same migration so the helper has the function at runtime. |
| Δ-64 | `apps/web/src/lib/zeptomail.ts` not in §9 file list, yet plan tells caller to set `client_reference` (current `sendEmail` doesn't accept that field) | §9 Phase A code — added `apps/web/src/lib/zeptomail.ts`: extend `sendEmail` to accept optional `clientReference?: string`, forward to ZeptoMail's `sendMail` payload as `client_reference`. Test asserts forward-when-supplied + absent-when-not. |
| Δ-65 | One stale `deterministic email Idempotency-Key` comment survived after Δ-61's rewrite | §4 A1 mark-completed comment — replaced with "email DB claim + ZeptoMail client_reference audit (Δ-61)". |
| Δ-66 | `applyPaidOrderSideEffects()` callsites omitted the service-role client; helper would hit RLS/permission failures if wired with an SSR/anon client | §4 A1 — helper signature now requires explicit `supabase: ServiceRoleClient` param. Real defense is the RPC's `auth.role() = 'service_role'` guard (Δ-67); the typed param is a documentation/code-review nudge, not a compile-time proof (per Δ-70 — Supabase-JS clients all share the same TS shape). A2 script, webhook, and B4 cron callsites updated to pass the `createServiceClient()`-built client they already create. (Δ-69/Δ-70 corrected the import path to `@/lib/supabase/service`.) |
| Δ-67 | `claim_payment_side_effect` and `claim_paystack_paid_atomic` are SECURITY DEFINER in `public` schema; per Supabase guidance privileged functions in exposed schemas need defense-in-depth | §4 A1 + §4 A2 — both RPC bodies now begin with `IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden: …'`. The REVOKE/GRANT lockdown is the primary defense; this guard is belt-and-braces against future grant regressions. |
| Δ-68 | B4 cron callsite still showed bare `applyPaidOrderSideEffects()` after Δ-66 required service client + actor | §5 B4 — corrected to `applyPaidOrderSideEffects({ supabase: serviceClient, transactionId, gatewayResponse, actor: 'cron:<run-id>' })`. Cron route creates `createServiceClient()` once at top and reuses. |
| Δ-69 | Helper snippet imported nonexistent `ServiceRoleClient` alias from `@/lib/supabase/admin` | §4 A1 — switched to `type ServiceRoleClient = ReturnType<typeof createServiceClient>` inline. Δ-70 then corrected the import path: `createServiceClient` lives in `@/lib/supabase/service`, NOT `@/lib/supabase/admin`. |
| Δ-70 | Δ-69 left two errors: wrong import path (`createServiceClient` is in `@/lib/supabase/service`, not `admin`) AND overstated TS safety claim ("compile-time error" — Supabase-JS clients all have the same shape, so anon vs service is not type-distinct) | §4 A1 — import path corrected to `@/lib/supabase/service`. Wording softened: typed param is documentation/grep target/test injection point; real runtime safety is the RPC `auth.role() = 'service_role'` guard from Δ-67. |
| Δ-71 | `record_merchant_settlement` had REVOKE/GRANT but no `auth.role()` defense-in-depth guard, unlike its peer privileged RPCs in this plan | §4 A0 — added the same `IF auth.role() <> 'service_role' THEN RAISE EXCEPTION` guard at the top of the recreated body, before any wallet lookup. Parity with `claim_payment_side_effect` (Δ-67) and `claim_paystack_paid_atomic` (Δ-67). Settlement writes wallet balances; this is the most financially sensitive of the three, so the role guard belongs here too. |


**Goal:** No Baci customer pays Paystack and ends up with a stuck "pending" order — and recover the existing stuck DVA payments since the regression landed on 2026-02-20.

**Tech stack:** Next.js 16 API routes, Supabase Postgres + RPC, Paystack DVA, Vitest.

---

## 1. Incident Summary (2026-05-09)

Customer `igbinoviaefosa56@gmail.com` (auth user `a0c4f6dc-…`) on store `ogabassey`:

- **4 orders** between 09:54–10:03 UTC for a Samsung Galaxy S25 (Navy / 256GB).
- **2× `POST /api/orders` 500 errors** at 10:00:45 and 10:00:49 — Postgres `23505` on `idx_customers_merchant_user`.
- **1 successful Paystack payment** at 10:03 UTC: ₦835,000 via Dedicated Nuban to DVA `9812851228 / Wema`. Paystack ref `100026260509110323000058369193`. Net to merchant: ₦834,700.
- **Webhook reached us, signature verified, Paystack verify returned 200 — but the handler 404'd because of `gateway_fee` (a non-existent column) in the transactions SELECT.** Reference mismatch (BAC-* vs Paystack ref) is a downstream issue; the schema bug fires first.
- **All 4 orders still `payment_status='pending'`**.
- **New VAT finding:** Ogabassey is VAT-registered at 7.5%; the four orders now show `tax_amount=₦60,750`, but their `total` values exclude VAT. The three ₦835k orders are `₦810k item + ₦25k shipping`; the one ₦810k duplicate is the same item with `shipping_fee=0`. Treat FIRS/e-invoice submission as blocked until the order financial basis is corrected or explicitly classified as VAT-inclusive.
- **Staff manual-payment attempt hit a separate bug:** mobile-admin sent `notes: ""` for the blank optional Notes field; `/api/orders/[id]/record-payment` rejects present-but-empty `notes`, returning `400 { error: "Invalid request body" }`. This is not Paystack-specific, but the route also needs a pending-gateway guard so Efosa is not "fixed" by creating a manual transaction while the real Paystack transaction remains pending.

## 2. Root Cause Map

| # | Bug | Severity | Site |
|---|---|---|---|
| 0a | `transactions.gateway_fee` does not exist; the webhook's SELECT 400s on every Paystack webhook since 2026-02-20 (PR #308 added it). Card payments survive only because `/checkout/success` calls `/api/payments/verify`. DVA has no fallback. | **P0 production-down for DVA** | [`webhook/route.ts:959`](apps/web/src/app/api/payments/webhook/route.ts#L959) |
| 0b | Even after fixing the SELECT, the settlement section at [`webhook/route.ts:1698`](apps/web/src/app/api/payments/webhook/route.ts#L1698) reads `transaction.gateway_fee`. That becomes `undefined → 0`, silently understating settlement reporting. Must source fee from the verified Paystack response. | **P0 (paired with 0a)** | line 1698 |
| 1 | DVA payments not findable even with a correct SELECT — Paystack webhooks carry their own numeric reference, our `transactions.gateway_reference` stores `BAC-…`. | P0 | webhook + initialize + paystack-dva-webhook.ts |
| 2 | `create_storefront_order` RPC's `ON CONFLICT customers_merchant_id_email_key` doesn't catch the `idx_customers_merchant_user` violation that fires when email match doesn't pick first. | P0 (every retrying authed customer) | migrations 20260508232130_…sql:244 |
| 3 | Shipping fee silently drops to 0 on retry. `selected_quote_id` is null even on orders with non-zero shipping_fee. | P1 | orders/route.ts:314 + cart client |
| 4 | 4 unique indexes on `customers` — 3 are near-duplicates on email. **Defer index drops** out of the same PR as Bug 2. | P2 | live DB |
| 5 | No alert when Paystack `charge.success` fires but no order moves to paid within N minutes. Bug 0 silently happened ~3 months. | P1 | gap |
| 6 | VAT/order-total mismatch on web checkout. Checkout computes VAT through `calculate-commerce`, but the active `/api/orders` POST body omits `tax_amount`; `orderCreateSchema` defaults it to 0, `create_storefront_order` creates `total` without VAT, then `update_order_tax_totals` later populates `tax_amount` without updating `total`. Result: admin/receipts can show VAT that was not collected. | **P1 financial/tax correctness** | checkout-page.tsx:1277, place-order.ts:256, orders/route.ts:239, baseline.sql:6839 |
| 7 | Manual Record Payment route rejects blank optional notes/reference from mobile-admin as "Invalid request body", and does not block staff from recording a manual payment while a Paystack/Korapay/etc. transaction is still pending for the order. | P1 ops/data-integrity | record-payment.ts:17, record-payment/route.ts:69, mobile-admin useOrders.ts:640 |

---

## 3. 2026 Best-Practice Reference

1. **Order ↔ PaymentIntent separation (Stripe pattern).** One order, N intents.
2. **Idempotency keys end-to-end.**
3. **Webhook-first reconciliation, multi-key.** Try our `BAC-…` ref → Paystack ref alias → DVA receiver-account multi-key match → fail-closed manual review.
4. **Paystack-source-of-truth backfill.** List Paystack `/transaction?status=success&from=…&to=…`, page through, **client-side filter** to `channel='dedicated_nuban'`, then match each into our DB. (DB-source scanning misses Bug 0/1 by design.)
5. **Saga / outbox for post-payment side effects via dedicated `payment_side_effects` table** (introduced in Phase A — Δ-7). Each step is claimed via `INSERT ... ON CONFLICT DO NOTHING`; the worker that wins the claim runs the side effect and marks `status='completed'`. Workers losing the race short-circuit. Each integration is also defensively idempotent at its own boundary (FIRS via IRN, loyalty via unique source key, settlement via DB-unique constraint added in A0 — Δ-14). The order-paid flip is the entry guard, not a stop signal.
6. **Server-persisted cart / checkout session.** Hydrate retries from `checkout_sessions`, not React state.
7. **One canonical unique key per identity.** `(merchant_id, user_id)` for authed, `(merchant_id, lower(email))` for guests.
8. **OpenTelemetry trace from cart → fulfillment.**
9. **SLOs.** 99% of webhooks → paid within 60s; alert at <95%.
10. **Stuck-payment dashboard** for ops.

---

## 4. Phase A — Recovery (today)

### A0 — Production hotfix: schema, settlement read, settlement idempotency, financial-consistency columns (~45 min)

**Δ-40 correction:** A1's `financialConsistency()` reads `orders.tax_basis` and `orders.gift_wrapping_fee`. Those were originally in B3.5 — but A2 (Efosa recovery) runs **before** B3.5 ships, so A1 would crash on missing columns. Move just the column additions + backfill into Phase A; keep B3.5's API/RPC/trigger work where it is.

**Δ-14 expansion:** settlement is too dangerous to leave un-protected even one PR longer. We add the unique guard in this same hotfix so retries can never double-credit. Migration is small and safe.

- [ ] Edit [`webhook/route.ts:959`](apps/web/src/app/api/payments/webhook/route.ts#L959): remove `gateway_fee` from the SELECT and **add `gateway_reference`** so settlement can pass the canonical BAC-* key (Δ-27). Final list: `id,amount,currency,merchant_id,metadata,order_id,platform_fee,gateway_reference`.
- [ ] Edit [`webhook/route.ts:1698`](apps/web/src/app/api/payments/webhook/route.ts#L1698): replace `Number(transaction.gateway_fee) || 0` with the verified Paystack response fee (`data.fees` in kobo, divide by 100 for NGN). Korapay branch reads from `verifyKorapayPayment` response shape.
- [ ] Edit [`webhook/route.ts:1711`](apps/web/src/app/api/payments/webhook/route.ts#L1711) — settlement currently passes the Paystack-side `reference` variable as `p_gateway_reference`. **Δ-27 fix:** change to pass `transaction.gateway_reference` (our `BAC-…`). The Paystack numeric ref goes into the new `p_metadata.paystack_reference` field (Δ-29 wrapper change below).
- [ ] If `record_merchant_settlement` RPC accepts `p_gateway_fee`, pass the verified value. Add the verified value to `transactions.metadata.verified_gateway_fee` for audit either way.
- [ ] **Migration `<ts>_orders_tax_basis_gift_wrapping_and_reconciliation_review.sql`** (Δ-40, Δ-44 — pulled from B3.5/B4 because A1/B1 can't write to a table that doesn't exist yet):
  ```sql
  -- ---------- Δ-40: order financial-consistency columns ----------
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_basis TEXT
    CHECK (tax_basis IN ('exclusive','inclusive'));   -- nullable, no DEFAULT (Δ-37)
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_wrapping_fee NUMERIC
    NOT NULL DEFAULT 0 CHECK (gift_wrapping_fee >= 0);

  -- Backfill tax_basis where the data shape is unambiguous.
  UPDATE orders SET tax_basis = 'exclusive'
   WHERE tax_basis IS NULL
     AND ABS(total - (subtotal + shipping_fee + COALESCE(gift_wrapping_fee,0)
              + COALESCE(tax_amount,0) - COALESCE(discount_amount,0))) <= 1;

  UPDATE orders SET tax_basis = 'inclusive'
   WHERE tax_basis IS NULL
     AND tax_inclusive_amount IS NOT NULL
     AND tax_inclusive_amount = total
     AND ABS(total - (subtotal + shipping_fee + COALESCE(gift_wrapping_fee,0)
              - COALESCE(discount_amount,0))) <= 1;

  -- ---------- Δ-44: reconciliation_review table (pulled from B4) ----------
  -- Created in Phase A so B1 (DVA multi-candidate) and B3.5 (tax-basis
  -- backfill of unclassified orders) can both write to it from PR1.
  CREATE TABLE IF NOT EXISTS reconciliation_review (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_type  TEXT NOT NULL CHECK (issue_type IN (
      'payment_match_ambiguous',
      'payment_match_zero_candidates',
      'manage_stock_cancellation_held',
      'tax_basis_unclassified',
      'tax_basis_inconsistent_total'
    )),
    txn_id      UUID,
    paystack_ref TEXT,
    order_id    UUID,
    reason      TEXT,
    candidates  JSONB,
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    resolution_notes TEXT
  );
  CREATE INDEX IF NOT EXISTS reconciliation_review_open_by_type_idx
    ON reconciliation_review (issue_type, resolved_at) WHERE resolved_at IS NULL;
  CREATE INDEX IF NOT EXISTS reconciliation_review_by_order_idx
    ON reconciliation_review (order_id) WHERE order_id IS NOT NULL;

  -- Δ-49: partial UNIQUE indexes for upsert on unresolved rows. Crons,
  -- backfills, and webhook retries all converge on the same logical issue;
  -- without these, every retry creates a duplicate row. WHERE resolved_at
  -- IS NULL means resolved rows fall out of the unique check, so a NEW
  -- review row can be filed if the same issue recurs after closure.
  CREATE UNIQUE INDEX IF NOT EXISTS reconciliation_review_open_by_order_idx
    ON reconciliation_review (issue_type, order_id)
    WHERE resolved_at IS NULL AND order_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS reconciliation_review_open_by_txn_idx
    ON reconciliation_review (issue_type, txn_id)
    WHERE resolved_at IS NULL AND txn_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS reconciliation_review_open_by_paystack_ref_idx
    ON reconciliation_review (issue_type, paystack_ref)
    WHERE resolved_at IS NULL AND paystack_ref IS NOT NULL;

  ALTER TABLE reconciliation_review ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE reconciliation_review FROM PUBLIC, anon, authenticated;
  GRANT  ALL ON TABLE reconciliation_review TO service_role;

  -- File rows for orders the backfill couldn't classify so ops has a queue.
  -- Uses ON CONFLICT DO NOTHING per Δ-49 against the open-by-order index so
  -- repeat runs of this migration (or any other caller) don't create dupes.
  INSERT INTO reconciliation_review (issue_type, order_id, reason, metadata)
  SELECT
    'tax_basis_unclassified',
    o.id,
    'A0 backfill could not match exclusive or inclusive shape',
    jsonb_build_object(
      'subtotal',           o.subtotal,
      'shipping_fee',       o.shipping_fee,
      'gift_wrapping_fee',  o.gift_wrapping_fee,
      'tax_amount',         o.tax_amount,
      'discount_amount',    o.discount_amount,
      'total',              o.total,
      'tax_inclusive_amount', o.tax_inclusive_amount
    )
  FROM orders o
  WHERE o.tax_basis IS NULL
  -- Δ-52: partial unique INDEX is referenced by inferred column list + WHERE,
  -- NOT by `ON CONSTRAINT name`. The latter is invalid syntax for partial
  -- indexes and would error at migration time.
  ON CONFLICT (issue_type, order_id)
    WHERE resolved_at IS NULL AND order_id IS NOT NULL
    DO NOTHING;
  ```
- [ ] **Migration `<ts>_settlement_check_constraints.sql`** (Δ-48 — must ship BEFORE the idempotency migration, since the new ON CONFLICT semantics surface CHECK failures that were previously silent):
  ```sql
  -- Existing (verified in production):
  --   gateway CHECK: paystack | korapay | credit_direct | kuda | manual
  --   source_type CHECK: order | vtu_commission | refund | adjustment
  -- Live callers in webhook/route.ts:1693 pass source_type='domain_purchase';
  -- juicyway/webhook/route.ts:478 passes gateway='juicyway'. Both fail today
  -- and were silently swallowed — we must allow them before A0 ships.
  ALTER TABLE merchant_settlements DROP CONSTRAINT IF EXISTS merchant_settlements_gateway_check;
  ALTER TABLE merchant_settlements ADD CONSTRAINT merchant_settlements_gateway_check
    CHECK (gateway = ANY (ARRAY['paystack','korapay','credit_direct','kuda','manual','juicyway']));

  ALTER TABLE merchant_settlements DROP CONSTRAINT IF EXISTS merchant_settlements_source_type_check;
  ALTER TABLE merchant_settlements ADD CONSTRAINT merchant_settlements_source_type_check
    CHECK (source_type = ANY (ARRAY['order','vtu_commission','refund','adjustment','domain_purchase']));
  ```
  Find the actual constraint names via `\d merchant_settlements` first; the names above are conventional but Postgres may have auto-generated suffixed names. The migration uses `IF EXISTS` for safety.
- [ ] **Migration `<ts>_settlement_idempotency.sql`** (Δ-14, Δ-17, Δ-71 — uses **existing** `(source_type, source_id, gateway_reference)` columns; `merchant_settlements` has NO `transaction_id` column):
  ```sql
  -- Δ-17 corrected key: (source_type, source_id, gateway_reference).
  -- Settlement key invariant (single source of truth):
  --   (source_type, source_id, gateway_reference)
  -- where source_id = order_id (existing webhook behavior at line 1694)
  -- and  gateway_reference = transactions.gateway_reference (i.e. our `BAC-…`,
  -- per A0.5 Option α). Paystack's numeric reference goes into
  -- merchant_settlements.metadata.paystack_reference for traceability only —
  -- it is NEVER used as the unique key.

  -- Pre-check: if duplicates already exist, abort and require a
  -- separate cleanup PR before this migration ships.
  -- Δ-54: pre-check predicate MUST match the partial unique index predicate
  -- below — otherwise we'd block on historical cancelled-status duplicates
  -- that the index intentionally allows.
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM merchant_settlements
       WHERE gateway_reference IS NOT NULL
         AND status != 'cancelled'
       GROUP BY source_type, source_id, gateway_reference
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'merchant_settlements has existing non-cancelled duplicates on (source_type, source_id, gateway_reference); clean up before adding unique index';
    END IF;
  END $$;

  CREATE UNIQUE INDEX IF NOT EXISTS merchant_settlements_unique_source
    ON merchant_settlements (source_type, source_id, gateway_reference)
    WHERE gateway_reference IS NOT NULL AND status != 'cancelled';
  ```
- [ ] **Wrap `record_merchant_settlement`** so the INSERT becomes
  `INSERT ... ON CONFLICT (source_type, source_id, gateway_reference) WHERE gateway_reference IS NOT NULL AND status != 'cancelled' DO NOTHING RETURNING id;`.
  The wallet balance update inside the RPC must be gated by `IF FOUND THEN` so it only runs when a new settlement row was actually created. Replay never double-credits the wallet.
- [ ] **Δ-29 / Δ-41: replace `record_merchant_settlement` atomically with the new metadata-aware signature.** Adding `p_metadata` as a default param creates a Postgres overload — the OLD non-idempotent 9-arg function stays callable, defeating the unique-index guard. Migration must be **drop + recreate**, and all 4 callers update in the **same PR** so no caller is left on the old signature:
  ```sql
  -- Find the exact signature first via pg_get_functiondef; baseline.sql:5105 lists it.
  DROP FUNCTION IF EXISTS public.record_merchant_settlement(
    uuid, text, uuid, text, text, numeric, numeric, numeric, text
  );

  CREATE OR REPLACE FUNCTION public.record_merchant_settlement(
    p_merchant_id       uuid,
    p_source_type       text,
    p_source_id         uuid,
    p_gateway           text,
    p_gateway_reference text,
    p_gross_amount      numeric,
    p_gateway_fee       numeric DEFAULT 0,
    p_platform_fee      numeric DEFAULT 0,
    p_description       text    DEFAULT NULL,
    p_metadata          jsonb   DEFAULT '{}'::jsonb     -- Δ-29 new param
  ) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
  -- Δ-45: this body PRESERVES every behavior from the original
  -- record_merchant_settlement at baseline.sql:5105-5206. The only changes are:
  -- (1) early service_role guard, (2) new `metadata` column on INSERT,
  -- (3) ON CONFLICT DO NOTHING on the (source_type, source_id,
  -- gateway_reference) partial unique index from Δ-14, (4) all
  -- wallet/transaction writes gated on `IF v_settlement_id IS
  -- NOT NULL` so a duplicate suppressed INSERT does NOT double-credit.
  DECLARE
    v_wallet_id      UUID;
    v_net_amount     DECIMAL(12,2);
    v_expected_date  DATE;
    v_settlement_id  UUID;
  BEGIN
    -- Δ-71: defense-in-depth role guard (parity with claim_payment_side_effect
    -- and claim_paystack_paid_atomic). REVOKE/GRANT below restricts to
    -- service_role; the guard is belt-and-braces and writes merchant
    -- settlements / wallet balances, so it must not be reachable by
    -- accidentally-granted anon/authenticated callers.
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'forbidden: record_merchant_settlement requires service_role';
    END IF;

    -- Get or create wallet (preserved)
    v_wallet_id := get_or_create_merchant_wallet(p_merchant_id);

    -- Calculate net amount (preserved)
    v_net_amount := p_gross_amount - p_gateway_fee - p_platform_fee;

    -- Calculate expected settlement date (preserved)
    v_expected_date := calculate_settlement_date(p_gateway);

    -- Create settlement record — INSERT is now idempotent on
    -- (source_type, source_id, gateway_reference) per Δ-14.
    INSERT INTO merchant_settlements (
      merchant_id, wallet_id, source_type, source_id, gateway,
      gateway_reference, gross_amount, gateway_fee, platform_fee, net_amount,
      payment_date, expected_settlement_date, description, status, metadata
    ) VALUES (
      p_merchant_id, v_wallet_id, p_source_type, p_source_id, p_gateway,
      p_gateway_reference, p_gross_amount, p_gateway_fee, p_platform_fee, v_net_amount,
      NOW(), v_expected_date,
      COALESCE(p_description, 'Payment received'),
      CASE
        WHEN p_gateway = 'korapay' THEN 'settled'   -- Korapay settles instantly (preserved)
        ELSE 'pending'
      END,
      p_metadata                                      -- Δ-29
    )
    ON CONFLICT (source_type, source_id, gateway_reference)
      WHERE gateway_reference IS NOT NULL AND status != 'cancelled'
      DO NOTHING
    RETURNING id INTO v_settlement_id;

    -- Δ-45: gate every wallet/transaction write on a fresh INSERT.
    -- If v_settlement_id IS NULL, this is a duplicate retry — return early.
    IF v_settlement_id IS NULL THEN
      RETURN NULL;
    END IF;

    -- Wallet balance updates (preserved, gated)
    IF p_gateway != 'korapay' THEN
      -- Non-instant settlements: bump upcoming balance only
      UPDATE merchant_wallets
        SET upcoming_balance = upcoming_balance + v_net_amount,
            upcoming_count   = upcoming_count + 1,
            updated_at       = NOW()
       WHERE id = v_wallet_id;
    ELSE
      -- Korapay instant credit: bump available balance + total_earned
      UPDATE merchant_wallets
        SET available_balance = available_balance + v_net_amount,
            total_earned      = total_earned + v_net_amount,
            updated_at        = NOW()
       WHERE id = v_wallet_id;

      -- Also write the wallet_transactions audit row (preserved)
      INSERT INTO wallet_transactions (
        wallet_id, merchant_id, type, amount, balance_after,
        source_type, source_id, description, status
      )
      SELECT
        v_wallet_id, p_merchant_id, 'credit', v_net_amount,
        mw.available_balance,
        p_source_type, p_source_id,
        COALESCE(p_description, 'Payment settled'),
        'completed'
      FROM merchant_wallets mw WHERE mw.id = v_wallet_id;
    END IF;

    RETURN v_settlement_id;
  END $$;

  -- Δ-19/Δ-41: re-apply REVOKE/GRANT on the NEW signature (the prior
  -- migration 20260428071421_…sql:87 was on the old signature, which is now dropped).
  REVOKE EXECUTE ON FUNCTION public.record_merchant_settlement(
    uuid, text, uuid, text, text, numeric, numeric, numeric, text, jsonb
  ) FROM PUBLIC, anon, authenticated;
  GRANT  EXECUTE ON FUNCTION public.record_merchant_settlement(
    uuid, text, uuid, text, text, numeric, numeric, numeric, text, jsonb
  ) TO service_role;
  ```
- [ ] **Update all 4 callers in the same A0 PR** (verified by grep — drop+recreate would fail/leave callers broken otherwise):
  - [`apps/web/src/app/api/payments/webhook/route.ts:915`](apps/web/src/app/api/payments/webhook/route.ts#L915) (chat order path) — pass `p_metadata: { paystack_reference: reference }` (Δ-59 — plain TS object; PostgREST converts to jsonb at the wire boundary)
  - [`apps/web/src/app/api/payments/webhook/route.ts:1705`](apps/web/src/app/api/payments/webhook/route.ts#L1705) (main path) — pass `p_metadata: { paystack_reference: reference, verified_gateway_fee: feeNgn }`
  - [`apps/web/src/app/api/payments/verify/route.ts:447`](apps/web/src/app/api/payments/verify/route.ts#L447) — same shape as main path
  - [`apps/web/src/app/api/payments/juicyway/webhook/route.ts:478`](apps/web/src/app/api/payments/juicyway/webhook/route.ts#L478) — `p_metadata: { juicyway_reference: reference }`
  - Reserve `jsonb_build_object(...)` strictly for SQL/RPC bodies; never write it inline in TypeScript callers (Δ-59).
  - The juicyway webhook test ([`route.test.ts:472`](apps/web/src/app/api/payments/juicyway/webhook/route.test.ts#L472)) gets updated assertions to match.
  - **Caller invariant (single source of truth):** every Paystack-driven call to `record_merchant_settlement` MUST pass `p_gateway_reference = transactions.gateway_reference` (i.e. our `BAC-…`). Never pass Paystack's numeric ref into this column. Paystack ref lives in `merchant_settlements.metadata.paystack_reference` for traceability. If callers accidentally pass Paystack's numeric ref, a webhook retry arriving under our `BAC-…` would bypass the unique guard. Document this in the migration header AND in the wrapper's JSDoc.
- [ ] Vitest tests:
  - Simulate a Paystack `charge.success` body, assert (a) the SELECT doesn't throw `column "gateway_fee" does not exist`, (b) settlement receives `p_gateway_reference = transaction.gateway_reference` (BAC-*), not Paystack's numeric `reference`, (c) the settlement RPC receives the verified fee from the Paystack response, not 0, and (d) the settlement metadata contains `paystack_reference`.
  - **Concurrent settlement test**: two parallel calls to settlement for the same `(source_type, source_id, gateway_reference)` triple → exactly one row created, exactly one wallet credit applied.
- [ ] Standalone PR. Ship to production immediately. **Highest-impact change in the whole plan; settlement-double-credit is the highest financial risk in the codebase right now.**

### A0.5 — Aliasing strategy decision (no code, 5 min)

- **Option α (selected default):** Keep `transactions.gateway_reference` as `BAC-*`. Store Paystack's ref in `gateway_response.reference` and `metadata.paystack_reference`. Webhook lookup uses `eq(gateway_reference, ref)` first, then falls back to `eq(metadata->>paystack_reference, ref)` for retries.
- Option β (deferred to Phase C): dedicated `payment_reference_aliases` table.
- Decision needed only if you want β; otherwise α applies.

### A1 — Extract `applyPaidOrderSideEffects()` with claim-based outbox (~60 min)

**Δ-7 correction:** "check flag → run → set flag" on `orders.metadata` is TOCTTOU race-prone — two workers (webhook + cron + manual reconcile) can each see flag unset and double-execute. Settlement double-records via [`record_merchant_settlement`](supabase/migrations/20260418000000_baseline.sql#L5125) wallet writes. **Move the side-effect ledger into Phase A** with claim semantics.

- [ ] Migration `<ts>_payment_side_effects.sql`:
  ```sql
  -- Δ-24: claim_token + claimed_by enable safe takeover of stale claims.
  -- Two workers can both observe a stale `claimed` row, but the conditional
  -- UPDATE in the takeover claim atomically picks exactly one — only the
  -- worker whose claim_token ends up in the row may mark `completed`.
  CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

  CREATE TABLE payment_side_effects (
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    step            TEXT NOT NULL CHECK (step IN ('paid_email','firs_invoice','loyalty_points','ad_tracking_conversion','merchant_settlement')),
    status          TEXT NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed','completed','failed')),
    claim_token     UUID NOT NULL DEFAULT gen_random_uuid(),
    claimed_by      TEXT NOT NULL,        -- e.g. 'webhook:<request_id>', 'cron:<run_id>', 'script:reconcile-paystack-dva'
    claimed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    result          JSONB,                -- { firs_invoice_id, irn } for FIRS, etc.
    error           TEXT,
    attempts        INT NOT NULL DEFAULT 1,
    PRIMARY KEY (order_id, step)
  );
  CREATE INDEX ON payment_side_effects (status, claimed_at) WHERE status != 'completed';

  -- Δ-20: service-only access. No client (anon/authenticated) needs to
  -- read or write this table directly; merchant dashboards see only
  -- aggregated state via existing order/transaction views.
  ALTER TABLE payment_side_effects ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE payment_side_effects FROM PUBLIC, anon, authenticated;
  GRANT  ALL ON TABLE payment_side_effects TO service_role;
  -- Deliberately no FOR SELECT/INSERT policies — RLS is enabled with no
  -- policies so anon/authenticated cannot read or write even if grants
  -- were accidentally re-added.
  ```
- [ ] Create `apps/web/src/lib/payments/apply-paid-order-side-effects.ts`. **Δ-66 / Δ-69 / Δ-70 signature:** the helper REQUIRES a service-role Supabase client because it touches `payment_side_effects` and calls `claim_payment_side_effect`, both of which are RLS-locked / GRANT-locked to `service_role`. The repo's service-role factory is `createServiceClient` from **`@/lib/supabase/service`** (NOT `@/lib/supabase/admin` — that one exports `createAdminClient`). The TS type alone is not enforcement (any anon client has the same Supabase-JS shape); the actual safety net is the RPC's `auth.role() = 'service_role'` guard from Δ-67. The typed param is documentation + grep target + test injection point.
  ```ts
  import { createServiceClient } from '@/lib/supabase/service';
  type ServiceRoleClient = ReturnType<typeof createServiceClient>;

  export async function applyPaidOrderSideEffects(args: {
    supabase: ServiceRoleClient;       // documentation; runtime safety is Δ-67
    transactionId: string;
    gatewayResponse: PaystackVerifyResponse | KorapayVerifyResponse;
    actor: string;                     // 'webhook:<request-id>' | 'cron:<run-id>' | 'script:reconcile-paystack-dva'
  }): Promise<{ ranSteps; skippedSteps; retriedSteps; failedSteps; concurrentTakeoverSteps }> { … }
  ```
  Production callers (webhook, A2 script, B4 cron) construct the client via `createServiceClient()` and pass it. Tests inject a Supabase-JS mock typed the same way. **Real defense lives in the RPC role guard (Δ-67); the param type is a code-review nudge, not a compile-time proof.**
- [ ] Helper logic — **tokened claim-then-execute** (Δ-24):
  1. Read order; if not `paid`, error out (caller must flip first via the atomic RPC).
  2. Precompute `financialConsistency` before FIRS (Δ-31, Δ-32):
     - Read `orders.tax_basis` (added by B3.5 per Δ-37 — `TEXT CHECK (tax_basis IN ('exclusive','inclusive'))`, **nullable during backfill**, no DEFAULT). The B3.5 migration backfills it: `'exclusive'` for orders where `total = subtotal + shipping_fee + tax_amount - discount_amount` (within ₦1), `'inclusive'` for orders where `tax_inclusive_amount = total AND |total - (subtotal + shipping_fee - discount_amount)| ≤ 1`. Orders matching neither stay NULL and are flagged for ops review via `reconciliation_review` (`issue_type='tax_basis_unclassified'`). After ops resolves the backlog, a follow-up migration enforces `NOT NULL`.
     - **Tax-exclusive valid shape** (`tax_basis='exclusive'`): `|total - (subtotal + shipping_fee + (gift_wrapping_fee ?? 0) + tax_amount - discount_amount)| ≤ 1`.
     - **Tax-inclusive valid shape** (`tax_basis='inclusive'`): `|total - (subtotal + shipping_fee + (gift_wrapping_fee ?? 0) - discount_amount)| ≤ 1`. `tax_amount` is informational (the VAT portion already inside `total`).
     - **NULL `tax_basis`**: the order's totals are demonstrably inconsistent (the B3.5 backfill couldn't classify it). Treat as Δ-31 partial-failure shape.
     - If the matched basis predicate fails, the `firs_invoice` step must not call FIRS. Claim the step, then mark it `failed` with `error='financial_totals_inconsistent'` and include `{ tax_basis, subtotal, shipping_fee, gift_wrapping_fee, tax_amount, discount_amount, total }` in `result`. Same guard applies to `loyalty_points`. Other side effects continue normally.
  3. For each step:
     a. **Generate** `myToken = uuid()` and `myActor = '<context>:<request_id>'`.
     b. **Claim or take over** via the `claim_payment_side_effect` RPC (Δ-60 — Supabase JS can't run raw SQL; the claim/takeover lives in a tiny SECURITY DEFINER RPC the helper calls). The RPC body:
        ```sql
        CREATE OR REPLACE FUNCTION public.claim_payment_side_effect(
          p_order_id       uuid,
          p_transaction_id uuid,
          p_step           text,
          p_claim_token    uuid,
          p_claimed_by     text
        ) RETURNS TABLE (we_won boolean, current_status text)
        LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
        -- Δ-67: defense-in-depth role guard. The function is GRANTed only to
        -- service_role (REVOKE/GRANT below), but a SECURITY DEFINER function
        -- in the public schema is an attractive surface — guard regardless
        -- so a future grant slip-up doesn't escalate. Mirrors Supabase
        -- security guidance for privileged public-schema RPCs.
        BEGIN
          IF auth.role() <> 'service_role' THEN
            RAISE EXCEPTION 'forbidden: claim_payment_side_effect requires service_role';
          END IF;
          INSERT INTO payment_side_effects
            (order_id, transaction_id, step, status, claim_token, claimed_by)
          VALUES
            (p_order_id, p_transaction_id, p_step, 'claimed', p_claim_token, p_claimed_by)
          ON CONFLICT (order_id, step) DO UPDATE
            SET claim_token = EXCLUDED.claim_token,
                claimed_by  = EXCLUDED.claimed_by,
                claimed_at  = now(),
                status      = 'claimed',
                attempts    = payment_side_effects.attempts + 1
            WHERE payment_side_effects.status = 'failed'
               OR (payment_side_effects.status = 'claimed'
                   AND payment_side_effects.claimed_at < now() - interval '60 seconds');

          RETURN QUERY
          SELECT (claim_token = p_claim_token) AS we_won, status AS current_status
          FROM payment_side_effects
          WHERE order_id = p_order_id AND step = p_step;
        END $$;

        REVOKE EXECUTE ON FUNCTION public.claim_payment_side_effect(uuid, uuid, text, uuid, text)
          FROM PUBLIC, anon, authenticated;
        GRANT  EXECUTE ON FUNCTION public.claim_payment_side_effect(uuid, uuid, text, uuid, text)
          TO service_role;
        ```
        Helper call:
        ```ts
        const myToken = crypto.randomUUID();
        const { data } = await supabase
          .rpc('claim_payment_side_effect', {
            p_order_id: orderId,
            p_transaction_id: transactionId,
            p_step: step,
            p_claim_token: myToken,
            p_claimed_by: actor,
          })
          .single();
        if (!data?.we_won) {
          // current_status tells us why: 'completed' → skip; 'claimed' (not stale) → defer
          continue;  // next step
        }
        ```
     c. **Execute** the side effect. Each integration must also be idempotent at its own boundary as defense in depth:
        - email (Δ-61): ZeptoMail does **not** support an `Idempotency-Key` header (verified — `apps/web/src/lib/zeptomail.ts:314` has no such param, and the API docs document `client_reference` and `mime_headers` only). Idempotency therefore lives at the DB layer:
          1. The `payment_side_effects (order_id, step='paid_email')` claim (Δ-24/Δ-60) is the dedup record. While a row's `status = 'completed'`, no replay re-sends.
          2. To minimize the residual "we sent the email but crashed before marking completed" window, set ZeptoMail's `client_reference = 'order:<order_id>:paid_email'` so we have a server-side audit trail showing which sends actually went out. If we later need a hard dedup, query ZeptoMail's send-history API by client_reference before sending.
          3. Accept the residual risk: at most one duplicate email if a worker sends successfully then dies before its `mark-completed` UPDATE; the per-step claim takeover only fires after 60s, so this requires a hard crash inside that window. Document in the helper's JSDoc.
        - FIRS: IRN is naturally idempotent (FIRS rejects duplicate IRN). **Δ-31/Δ-38 financial-consistency guard:** call the shared `financialConsistency(order)` helper from §4 A1 step 2 (the same one used by B4's review predicate). Helper logic:
          - Read `tax_basis`, `subtotal`, `shipping_fee`, `gift_wrapping_fee`, `tax_amount`, `discount_amount`, `total`.
          - If `tax_basis IS NULL` ⇒ inconsistent.
          - If `tax_basis = 'exclusive'` and `|total - (subtotal + shipping_fee + (gift_wrapping_fee ?? 0) + tax_amount - discount_amount)| > 1` ⇒ inconsistent.
          - If `tax_basis = 'inclusive'` and `|total - (subtotal + shipping_fee + (gift_wrapping_fee ?? 0) - discount_amount)| > 1` ⇒ inconsistent.
          - Otherwise consistent.
          On `inconsistent`: set `status='failed'`, `error='financial_totals_inconsistent'`, and `result` to a plain TS object `{ tax_basis, subtotal, shipping_fee, gift_wrapping_fee, tax_amount, discount_amount, total }` (Δ-59 — TS callers never use `jsonb_build_object`). Replay after B3.5 backfill picks up the failed claim.
        - loyalty: `points_transactions` has a unique source key (per memory). Loyalty calculation reads `total` — it inherits whatever the order says, so if Δ-31 is in play, the loyalty award is also off. **Same `financialConsistency()` guard as FIRS:** abort with `status='failed'` on inconsistency; re-run after B3.5 backfill.
        - settlement: pass our `gateway_reference` (`BAC-…`) and `source_id` (order_id) to `record_merchant_settlement`. The Δ-14/Δ-17 `(source_type, source_id, gateway_reference)` partial unique index lands in A0 — so the DB itself rejects duplicate settlements at the boundary, even if a stale claim takeover went sideways. **Settlement is allowed to proceed even on Δ-31 inconsistency** — the customer paid `total`, and the merchant gets `total - fees`. The reconciliation_review row tracks the tax-classification follow-up.
        - ad-tracking: deterministic conversion id derived from order_id. Conversion value is `total`; same Δ-31 reasoning as settlement (the ad-tracking pixel reflects what the customer paid).
     d. **Mark completed only if our token still wins** (Δ-58 — `GET DIAGNOSTICS row_count` is PL/pgSQL only and can't run from Supabase JS, so use the JS client's `.update().eq().select()` pattern instead):
        ```ts
        const { data: marked } = await supabase
          .from('payment_side_effects')
          .update({ status: 'completed', completed_at: new Date().toISOString(), result, error: null })
          .eq('order_id', orderId)
          .eq('step', step)
          .eq('claim_token', myToken)
          .select('order_id');   // returned rows = marked rows
        if (!marked || marked.length === 0) {
          // Another worker took over while we were running.
          // Log + surface a concurrent_takeover warning. The per-step
          // boundary idempotency (FIRS via IRN, loyalty unique source,
          // settlement Δ-14 partial unique, email DB claim + ZeptoMail client_reference audit (Δ-61),
          // deterministic ad-tracking conversion id) catches the worst case.
        }
        ```
     e. **On exception** (Δ-58 same pattern): `await supabase.from('payment_side_effects').update({ status: 'failed', error: err.message }).eq('order_id', orderId).eq('step', step).eq('claim_token', myToken)` — still token-gated, replay can take over. For the **concurrent-replay test**, run two parallel calls and assert exactly one observable side-effect call (e.g. ZeptoMail mock invoked exactly once); the loser's UPDATE returns 0 rows and the boundary idempotency kept the side-effect single.
  4. Return `{ ranSteps, skippedSteps, retriedSteps, failedSteps, concurrentTakeoverSteps }`.
- [ ] **Replay is correct by construction:** the claim INSERT either succeeds (we run it) or finds an existing row (we either short-circuit if completed, or take it over if stale).
- [ ] Refactor [`webhook/route.ts:1500-1750`](apps/web/src/app/api/payments/webhook/route.ts#L1500-L1750) to use this helper. Webhook tests must continue to pass.
- [ ] Vitest covering: clean run, replay (idempotent — no duplicate emails/FIRS/points/settlement), FIRS-down (others still complete; FIRS retried on next replay with attempts++), loyalty-error (same), settlement-error (same), **concurrent-replay** (two parallel calls → no double execution).

### A2 — Reconcile Efosa (~30 min after A0+A1 ship)

**Δ-8 correction:** "Atomic DB transaction (BEGIN/COMMIT)" cannot be done from the Supabase JS client across separate calls. Implementation: write a single PL/pgSQL RPC for the atomic block, callable from both the script and (later) B4's cron.
**Δ-11 correction:** Cancel duplicate orders' pending `transactions` rows too — `transactions.status` enum already permits `'cancelled'`.

**Δ-12, Δ-13, Δ-15 corrections:** generalize the RPC so B1 (webhook) and B4 (cron) call it too with empty `cancel_order_ids`. Accept a nullable operator user id: manual A2 passes it and writes `audit_logs`; automated B1/B4 pass NULL and skip `audit_logs`. Use `GET DIAGNOSTICS` to detect already-completed states and either no-op idempotently or raise on mismatch.

- [ ] Migration `<ts>_claim_paystack_paid_atomic_rpc.sql` (Δ-25 — no `auth.users` insert; the RPC's `audit_logs` write is conditional on operator_user_id being non-NULL, so automated paths pass NULL and skip audit_logs):
  ```sql
  -- The generalized atomic claim RPC.
  CREATE OR REPLACE FUNCTION public.claim_paystack_paid_atomic(
    -- Δ-18: required params first, defaulted params last (Postgres syntax requirement).
    p_transaction_id     UUID,
    p_paystack_reference TEXT,
    p_gateway_response   JSONB,
    p_canonical_order_id UUID,
    p_operator_user_id   UUID,
    p_cancel_order_ids   UUID[] DEFAULT '{}'::uuid[],
    p_operator_label     TEXT   DEFAULT 'manual_reconcile'
  ) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
  AS $$
  DECLARE
    v_txn_existing_status     TEXT;
    v_txn_existing_order_id   UUID;
    v_order_existing_status   TEXT;
    v_txn_rows_updated        INT;
    v_order_rows_updated      INT;
    v_dup_orders_cancelled    INT;
    v_dup_txns_cancelled      INT;
    v_already_completed       BOOLEAN := false;
    v_order_already_paid      BOOLEAN := false;
  BEGIN
    -- Δ-67: defense-in-depth role guard (mirrors claim_payment_side_effect).
    -- REVOKE/GRANT below restricts the function to service_role; this guard
    -- is belt-and-braces in case a future grant slip-up exposes the function.
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'forbidden: claim_paystack_paid_atomic requires service_role';
    END IF;

    -- Δ-25: operator user id is OPTIONAL. When non-NULL we write to
    -- audit_logs (which requires user_id NOT NULL); when NULL (B1/B4
    -- automated paths) we skip audit_logs and rely on
    -- transactions.metadata + payment_side_effects for the trail.

    -- Read the current transaction state for invariant checking
    SELECT status, order_id
      INTO v_txn_existing_status, v_txn_existing_order_id
      FROM transactions WHERE id = p_transaction_id FOR UPDATE;

    IF v_txn_existing_status IS NULL THEN
      RAISE EXCEPTION 'transaction_not_found';
    END IF;

    IF v_txn_existing_order_id IS DISTINCT FROM p_canonical_order_id THEN
      RAISE EXCEPTION 'transaction_order_link_mismatch: txn % is for order %, got %',
        p_transaction_id, v_txn_existing_order_id, p_canonical_order_id;
    END IF;

    -- Δ-15: idempotent re-state handling for the transaction
    IF v_txn_existing_status = 'completed' THEN
      v_already_completed := true;       -- continue: ensure order is paid + duplicates cancelled
    ELSIF v_txn_existing_status NOT IN ('pending') THEN
      RAISE EXCEPTION 'transaction_in_unexpected_state: %', v_txn_existing_status;
    END IF;

    -- Δ-23: validate canonical order state under lock. Allow `pending`
    -- (we will flip it) and `paid` (idempotent replay). Anything else
    -- (cancelled, refunded, unknown) means we are about to corrupt
    -- already-finalized state and must abort.
    SELECT payment_status INTO v_order_existing_status
      FROM orders WHERE id = p_canonical_order_id FOR UPDATE;

    IF v_order_existing_status IS NULL THEN
      RAISE EXCEPTION 'canonical_order_not_found: %', p_canonical_order_id;
    ELSIF v_order_existing_status = 'paid' THEN
      v_order_already_paid := true;
    ELSIF v_order_existing_status NOT IN ('pending') THEN
      RAISE EXCEPTION 'canonical_order_in_unexpected_state: % (allowed: pending | paid)',
        v_order_existing_status;
    END IF;

    UPDATE transactions
       SET status = 'completed',
           gateway_response = p_gateway_response,
           metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(
             'paystack_reference', p_paystack_reference,
             'reconciled_at', now(),
             'reconciled_by', p_operator_label
           ),
           updated_at = now()
     WHERE id = p_transaction_id AND status = 'pending';
    GET DIAGNOSTICS v_txn_rows_updated = ROW_COUNT;
    -- v_txn_rows_updated == 0 is acceptable iff already_completed (safe replay)

    -- Δ-28: mirror the existing payment-flow shipping transition
    -- (webhook/route.ts:1501 and verify/route.ts:271 both set
    -- shipping_status='processing' when payment moves to paid).
    UPDATE orders
       SET payment_status  = 'paid',
           shipping_status = CASE
             WHEN shipping_status = 'pending' THEN 'processing'
             ELSE shipping_status   -- preserve already-progressed shipping
           END,
           updated_at = now()
     WHERE id = p_canonical_order_id AND payment_status = 'pending';
    GET DIAGNOSTICS v_order_rows_updated = ROW_COUNT;

    -- Cancel duplicates only if the array is non-empty (B1/B4 pass empty)
    UPDATE orders
       SET payment_status = 'cancelled',
           shipping_status = 'cancelled',
           notes = COALESCE(notes,'') || E'\n[auto] Cancelled — duplicate of canonical paid order',
           updated_at = now()
     WHERE id = ANY(p_cancel_order_ids)
       AND payment_status = 'pending';
    GET DIAGNOSTICS v_dup_orders_cancelled = ROW_COUNT;

    -- Δ-11: cancel pending transactions tied to cancelled duplicates
    UPDATE transactions
       SET status = 'cancelled',
           metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(
             'cancelled_reason', 'duplicate_of_paid_order',
             'canonical_transaction_id', p_transaction_id,
             'cancelled_at', now(),
             'cancelled_by', p_operator_label
           ),
           updated_at = now()
     WHERE order_id = ANY(p_cancel_order_ids)
       AND status = 'pending';
    GET DIAGNOSTICS v_dup_txns_cancelled = ROW_COUNT;

    -- Δ-13/Δ-25: audit_logs.user_id is NOT NULL. Manual reconcile paths
    -- (A2 script) pass the operator's auth.users.id; automated paths
    -- (B1 webhook, B4 cron) pass NULL and rely on
    -- transactions.metadata + payment_side_effects as the audit trail.
    -- We sidestep the brittle "provision a system user in auth.users"
    -- pattern entirely.
    IF p_operator_user_id IS NOT NULL THEN
      INSERT INTO audit_logs (action, resource_type, resource_id, changes, status, user_id)
      VALUES (p_operator_label,
              'transaction', p_transaction_id::text,
              jsonb_build_object(
                'paystack_reference', p_paystack_reference,
                'canonical_order_id', p_canonical_order_id,
                'cancel_order_ids', to_jsonb(p_cancel_order_ids),
                'txn_rows_updated', v_txn_rows_updated,
                'order_rows_updated', v_order_rows_updated,
                'dup_orders_cancelled', v_dup_orders_cancelled,
                'dup_txns_cancelled', v_dup_txns_cancelled,
                'already_completed', v_already_completed,
                'order_already_paid', v_order_already_paid
              ),
              'success', p_operator_user_id);
    END IF;

    RETURN jsonb_build_object(
      'canonical_order_id', p_canonical_order_id,
      'reconciled_at', now(),
      'already_completed', v_already_completed,
      'txn_rows_updated', v_txn_rows_updated,
      'order_rows_updated', v_order_rows_updated,
      'dup_orders_cancelled', v_dup_orders_cancelled,
      'dup_txns_cancelled', v_dup_txns_cancelled
    );
  END $$;

  -- Δ-19: lock down the privileged RPC (mirrors the pattern in
  -- supabase/migrations/20260428071421_advisor_bucket_a_revoke_internal_function_grants.sql).
  -- This function flips order/payment state and cancels transactions —
  -- only service_role may execute it.
  REVOKE EXECUTE ON FUNCTION public.claim_paystack_paid_atomic(
    UUID, TEXT, JSONB, UUID, UUID, UUID[], TEXT
  ) FROM PUBLIC, anon, authenticated;
  GRANT  EXECUTE ON FUNCTION public.claim_paystack_paid_atomic(
    UUID, TEXT, JSONB, UUID, UUID, UUID[], TEXT
  ) TO service_role;
  ```
- [ ] Create `scripts/reconcile-paystack-dva.ts`. Args: `--transaction-id <uuid> --paystack-reference <ref> --canonical-order-id <uuid> --cancel-orders <uuid,...> --operator-user-id <uuid>`.
- [ ] Execution order:
  1. **External:** `verifyPaystackPayment(reference)`. Bail if status != success, or if amount/currency/customer don't match the on-record txn.
 	  2. **Single atomic DB call:** `supabase.rpc('claim_paystack_paid_atomic', {...})`. RPC handles replay idempotency. Inspect returned counts and surface them to the operator.
  3. **Financial consistency guard before FIRS:** canonical Efosa order currently has `subtotal=810000`, `shipping_fee=25000`, `tax_amount=60750`, `total=835000`, which fits NEITHER tax-exclusive (`subtotal + shipping + tax = 895750`) NOR tax-inclusive (`subtotal + shipping = 835000` only if `tax_amount` is decomposed from `subtotal`, which it isn't here — `subtotal` is presumed VAT-exclusive). Operator chooses (a) normalize the order to the approved tax basis before side effects, or (b) let `applyPaidOrderSideEffects` mark only the FIRS step (and loyalty) `failed` with `error='financial_totals_inconsistent'` while email + ad-tracking + settlement proceed. Replay after B3.5 backfill picks up the failed claims.
  4. **External:** call `applyPaidOrderSideEffects({ supabase: serviceClient, transactionId, gatewayResponse, actor: 'script:reconcile-paystack-dva' })` (Δ-66 — service-role client is required; A2 script builds it via `createServiceClient()` once at startup).
- [ ] Run for Efosa: `--transaction-id 427ec4ea-b41d-4058-aaf9-3de57ee5fa35 --paystack-reference 100026260509110323000058369193 --canonical-order-id 211bcf0e-0795-488f-aeeb-52c5b7a8b9ae --cancel-orders 9235a8d5-55fc-4e90-8238-4bb6698679bd,de838a51-d0e9-4438-9f55-135b7677783f,a259300d-aef4-44f2-9506-22b47fab756d --operator-user-id <bassey-auth-user-id>`.

### A3 — Manual record-payment route hardening (~30 min)

**Δ-36 correction** (renumbered from Δ-32 to disambiguate with the VAT-inclusive entry): the staff screenshot is a real manual-route bug, but it must not become the Efosa recovery path. Manual Record Payment is for cash/POS/manual transfers with no active gateway payment in flight. Paystack/Korapay/etc. orders with pending processor transactions must go through reconciliation.

- [ ] Fix [`apps/web/src/schemas/record-payment.ts`](apps/web/src/schemas/record-payment.ts):
  - Normalize optional blank strings before validation:
    - `notes: ""`, `"   "`, and `undefined` all become `undefined`.
    - `reference: ""`, `"   "`, and `undefined` all become `undefined`.
  - Keep `amount` strict: finite, `> 0`, max 2 decimal places.
- [ ] Fix [`apps/mobile-admin/hooks/useOrders.ts:640-645`](apps/mobile-admin/hooks/useOrders.ts#L640-L645):
  - Omit blank optional fields in the JSON body:
    - `notes: notes?.trim() || undefined`
    - `reference: reference?.trim() || undefined`
  - Preserve existing behavior for non-empty notes/reference.
- [ ] Harden [`apps/web/src/app/api/orders/[id]/record-payment/route.ts`](apps/web/src/app/api/orders/[id]/record-payment/route.ts):
  - Before inserting a manual transaction, query active non-manual processor transactions for the order:
    `gateway IN ('paystack','korapay','kuda','credit_direct','juicyway') AND status IN ('pending','processing')`.
  - If one exists, return `409` with:
    `{ error: 'This order has a pending processor payment. Use payment reconciliation instead.', code: 'PENDING_GATEWAY_PAYMENT' }`.
  - Include the gateway name in logs, but do not leak extra processor data to the client.
  - Do **not** block manual payments when there are only failed/cancelled gateway attempts or completed manual transactions.
- [ ] Add tests:
  - API schema accepts blank `notes`/`reference` by normalizing them away.
  - `record-payment/route.test.ts` accepts `{ amount, payment_method, notes: '' }` for a normal manual order.
  - `record-payment/route.test.ts` rejects an order with a pending Paystack transaction with `409 PENDING_GATEWAY_PAYMENT`.
  - `apps/mobile-admin/hooks/createOrderDetailsPaymentActions.test.ts` or `useOrders` tests prove blank notes are not sent as a present empty string.
- [ ] UX copy:
  - Mobile should surface the API message directly so staff see "pending processor payment" instead of a generic validation error.
  - For Efosa specifically: do not tap "Record Payment"; run A2 reconciliation.

---

## 5. Phase B — Close the bleeding (this week, 4 small PRs)

### B0 — Tighten the DVA match key (lives inside B1's PR)

For DVA reconciliation in code AND in B4's backfill, the lookup MUST require ALL of:
- `merchant_id` matches (from the DVA assignment record).
- `receiver_account_number` matches.
- `amount` matches verified Paystack amount (kobo precision).
- `customer_email` matches the txn metadata customer (or `customer_id`).
- `paid_at` falls in the window:
  ```
  paid_at BETWEEN order_payment_account.created_at
            AND   LEAST(
                    order_payment_account.expires_at,
                    order_payment_account.created_at + interval '90 minutes'
                  )
  ```
  Lower bound = DVA assignment time (we don't accept payments predating the DVA — defensive).
  Upper bound respects Paystack's expires_at if returned, else `created_at + 1h DVA countdown + 30min inter-bank settlement grace`.
- `transactions.status = 'pending'`.

If 0 candidates → look up a completed txn matching the Paystack ref (via `gateway_response.reference` or `metadata.paystack_reference` per A0.5 Option α). If a completed match is found, no-op (already reconciled in a prior run — the most common cause of zero candidates after the first cron pass). Otherwise upsert a `payment_match_zero_candidates` review row and alert ops — Paystack says success but our DB has no record at all (Δ-57).
If 1 candidate → reconcile.
If >1 candidates → fail closed and **upsert** a `payment_match_ambiguous` `reconciliation_review` row, alert ops. **Δ-55 — every callsite that writes `reconciliation_review` MUST use the partial-index `ON CONFLICT … DO NOTHING` form**, otherwise retry storms (cron, webhook retries, manual replays) hit unique-violation errors. Canonical insert shape:
```sql
INSERT INTO reconciliation_review (issue_type, txn_id, paystack_ref, order_id, reason, candidates, metadata)
VALUES ('payment_match_ambiguous', :txn_id, :paystack_ref, NULL, :reason, :candidates_jsonb, :metadata_jsonb)
ON CONFLICT (issue_type, paystack_ref)
  WHERE resolved_at IS NULL AND paystack_ref IS NOT NULL
  DO NOTHING;
```
The conflict target column list MUST match the partial-unique index relevant to the row — `(issue_type, paystack_ref)` for payment-side rows that have a Paystack ref but no order_id; `(issue_type, txn_id)` when txn_id is the natural key; `(issue_type, order_id)` for tax/order-shaped rows. Pick exactly one based on which key is non-null at insert time. Same pattern in B1 and B4 below.

### B1 — DVA reconciliation by tightened multi-key

**Δ-10 correction:** `unique_order_account` UNIQUE INDEX on `(order_id, provider)` ALREADY exists in production (`baseline.sql:12152`+). Migration must be idempotent against it — the upsert in `initialize/route.ts` should use `.upsert({...}, { onConflict: 'order_id,provider' })` and rely on the existing constraint, not try to recreate it.

- [ ] Migration `<ts>_persist_paystack_dva_account.sql`: ensure `order_payment_accounts` has `account_number`, `bank_name`, `account_name`, `provider`, `expires_at`, `created_at`. Add `(provider, account_number)` and `(expires_at)` indexes if missing. **Do not** redeclare `unique_order_account` — it exists.
- [ ] Modify [`initialize/route.ts:964-993`](apps/web/src/app/api/payments/initialize/route.ts#L964-L993) DVA branch: upsert one row per assignment (`provider='paystack'`, `expires_at = dvaResult.expires_at ?? created_at + interval '1 hour'`) using `.upsert(..., { onConflict: 'order_id,provider' })`.
- [ ] Generalize `confirmAgenticPaystackDvaPayment` → `confirmPaystackDvaPayment`. Lookup chain:
  1. Existing: `gateway_reference = paystackRef` (handles future α-aliasing matches).
  2. Existing: agentic `checkout_sessions` path.
  3. **New:** join `order_payment_accounts` on `account_number = receiver`, then apply B0's six-key tighten.
  4. **Δ-12: on match, call `claim_paystack_paid_atomic` first** (with `cancel_order_ids='{}'`, `operator_user_id=NULL` per Δ-25, `operator_label='paystack_dva_webhook'`). This atomically flips the txn + canonical order to paid; audit_logs INSERT is skipped (automated path), audit lives in `transactions.metadata` and `payment_side_effects`.
  5. THEN call `applyPaidOrderSideEffects({ supabase: serviceClient, transactionId, gatewayResponse, actor: 'webhook:<request-id>' or 'cron:<run-id>' })` (Δ-66). The webhook handler already creates `createServiceClient()` at the top — pass that. The helper's "must be paid" guard now passes by construction.
- [ ] Webhook test: simulate DVA `charge.success`. Assert order flips to paid via path #3-#4 atomically, side effects then run, and replay is a no-op. Multi-candidate scenario produces a `reconciliation_review` row using the Δ-55 upsert form (test runs the simulation twice and asserts exactly one row, not two).

### B2 — Customer upsert resilient to all conflict paths AND concurrent inserts

**Δ-9 correction:** SELECT-then-INSERT alone has TOCTTOU race — two concurrent calls both see no row, both INSERT, second 23505s. Need either (a) advisory lock to serialize, (b) retry-on-23505 loop, or (c) carefully targeted ON CONFLICT. We'll combine (a) advisory lock + (b) retry loop for defense in depth.

- [ ] Migration `<ts>_fix_storefront_order_customer_upsert.sql` — rewrite the customer block of `create_storefront_order`:
  ```sql
  -- Advisory lock keyed on the identity dimensions to serialize concurrent
  -- INSERTs for the same (merchant, user) or (merchant, email).
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_merchant_id::text || ':' ||
      COALESCE(p_user_id::text, ''), 0)
  );
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_merchant_id::text || ':' ||
      v_normalized_customer_email, 1)
  );

  FOR i IN 1..3 LOOP
    SELECT id INTO v_customer_id FROM customers
     WHERE merchant_id = p_merchant_id
       AND deleted_at IS NULL
       AND (
         (p_user_id IS NOT NULL AND user_id = p_user_id)
         OR lower(email) = v_normalized_customer_email
       )
     ORDER BY (CASE WHEN p_user_id IS NOT NULL AND user_id = p_user_id THEN 0 ELSE 1 END)
     LIMIT 1;

    IF v_customer_id IS NOT NULL THEN
      -- Update with COALESCE'd identity fields
      UPDATE customers
         SET phone      = COALESCE(p_customer_phone, phone),
             user_id    = COALESCE(user_id, p_user_id),
             first_name = COALESCE(first_name, v_first_name),
             last_name  = COALESCE(last_name, v_last_name),
             email      = COALESCE(email, v_normalized_customer_email),
             updated_at = now()
       WHERE id = v_customer_id;
      EXIT;
    END IF;

    BEGIN
      INSERT INTO customers (merchant_id, email, first_name, last_name, phone, user_id)
      VALUES (p_merchant_id, v_normalized_customer_email, v_first_name, v_last_name,
              p_customer_phone, p_user_id)
      RETURNING id INTO v_customer_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- Lost the race; loop and re-SELECT will find the row inserted by the winner.
      v_customer_id := NULL;
    END;
  END LOOP;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'customer_upsert_failed';
  END IF;
  ```
- [ ] **Index drops deferred** — keep all 4 customer unique indexes alive. The new RPC handles them defensively. Index consolidation = separate, audited PR.
- [ ] RPC tests: same email different case → updates existing; same user_id different email → updates existing; new combo → inserts; **concurrent inserts (using `pgbench` or two parallel client calls) → no error, exactly one row created**.

### B3 — Shipping persistence + fail-closed

- [ ] Migration `<ts>_storefront_order_require_quote_id.sql`: `create_storefront_order` raises `shipping_quote_required` when `p_shipping_provider IS NOT NULL AND p_selected_quote_id IS NULL`.
- [ ] Client: read selected quote from server-side `checkout_sessions`. On retry, hydrate. Force re-quote if expired.
- [ ] Tests: `shipping_provider='gigl'` with no quote → 400. Hydrate from session → 200.

### B3.5 — Checkout VAT / total parity (web bug confirmed)

This is a **web** bug, not a mobile-admin display bug. Mobile-admin shows whatever `orders.shipping_fee`, `orders.tax_amount`, and `orders.total` contain; the bad state is created before admin reads it.

- [ ] Add failing regression tests for the Efosa shape:
  - VAT-registered merchant, item subtotal `810000`, airport delivery `25000`, VAT 7.5%.
  - Expected server-created order total is either the approved tax-exclusive total `895750` **or** an explicitly modeled VAT-inclusive total with recomputed tax-exclusive subtotal. It must never persist `tax_amount=60750` with `total=835000`.
- [ ] Fix the active storefront checkout POST in [`checkout-page.tsx:1277-1300`](apps/web/src/components/storefront/ogabassey/pages/checkout-page.tsx#L1277-L1300): include the calculated VAT payload (`tax_amount: orderTotals?.taxAmount ?? 0`), a client-visible `expected_total`/`client_total` for parity checks, AND the explicit `gift_wrapping_fee` per Δ-34 below. No hidden fallback math.
- [ ] Fix the extracted/tested handler [`checkout/handlers/place-order.ts:256-279`](apps/web/src/components/storefront/ogabassey/pages/checkout/handlers/place-order.ts#L256-L279) the same way, even if the inline checkout page is the active path today. Its tests are the best low-level regression harness.
- [ ] Harden [`/api/orders`](apps/web/src/app/api/orders/route.ts) AND [`create_storefront_order` RPC itself](supabase/migrations/20260418000000_baseline.sql#L1223) (Δ-42 — RPC currently has `GRANT ALL TO anon, authenticated` at `baseline.sql:15593`, so direct RPC calls bypass any API-layer hardening):
  - **API layer**: select merchant VAT config (`vat_registration_status`, `vat_rate`) with the merchant row. Treat client `tax_amount` and `expected_total` as assertions, not authority. Recompute/validate VAT server-side with a tolerance of at most ₦1. Reject on mismatch instead of silently defaulting missing VAT to 0.
  - **RPC layer (Δ-42, Δ-47)**: the public anon-callable RPC must enforce VAT itself, because the storefront calls it via PostgREST and we can't revoke anon access without breaking checkout. The current RPC (`baseline.sql:1223`) **already computes `subtotal` from `p_items`** (lines 217-219 of the migration: `SUM((COALESCE(t.price_override, t.base_price) * t.quantity) + t.assurance_fee)`). The B3.5 PR therefore:
    - **Adds two new params** to the RPC signature: `p_tax_basis TEXT DEFAULT 'exclusive'` and `p_gift_wrapping_fee NUMERIC DEFAULT 0`.
    - **Does NOT add** `p_subtotal` or `p_total` params — both stay server-derived, never trusting the client. The existing `p_tax_amount` parameter remains as a client-asserted value that the RPC validates.
    - Adds inside the RPC body:
      1. Read merchant VAT config (`SELECT vat_registration_status, vat_rate FROM merchants WHERE id = p_merchant_id`).
      2. Validate `p_tax_basis IN ('exclusive','inclusive')` (otherwise RAISE).
      3. If merchant VAT-registered AND `p_tax_basis = 'exclusive'`: recompute `v_expected_tax := round(v_subtotal * v_vat_rate / 100, 2)` and require `|p_tax_amount - v_expected_tax| ≤ 1`, else `RAISE EXCEPTION 'tax_amount_mismatch (expected %, got %)', v_expected_tax, p_tax_amount`.
      4. If merchant NOT VAT-registered, require `p_tax_amount = 0`, else `RAISE EXCEPTION 'tax_amount_must_be_zero_for_non_vat_merchant'` (currently silent; this is the new enforcement).
      5. Recompute `v_total` server-side per the matched basis: exclusive ⇒ `v_subtotal + p_shipping_fee + p_gift_wrapping_fee + p_tax_amount - p_discount_amount`; inclusive ⇒ `v_subtotal + p_shipping_fee + p_gift_wrapping_fee - p_discount_amount` (with `p_tax_amount` extracted internally for FIRS reporting). Persist `tax_basis`, `gift_wrapping_fee`, `tax_amount`, `total`, `tax_inclusive_amount`, `tax_exclusive_amount` atomically.
      6. The API `/api/orders` route validates `expected_total` from the client matches the freshly returned `total` (within ₦1) and surfaces a friendly error to the user; mismatches at the RPC boundary produce raw exceptions for any direct caller.
  - Tests must cover both API-layer rejection AND direct-RPC rejection (call the RPC bypassing the API to prove it can't be exploited).
- [ ] **Δ-50: column scope.** `orders.tax_basis` and `orders.gift_wrapping_fee` are **already added** by A0's migration (Δ-40), with the backfill heuristic and `tax_basis_unclassified` `reconciliation_review` rows already filed in PR1. B3.5 does **not** re-add those columns. B3.5 only:
  - Updates `create_storefront_order` RPC signature (Δ-47): adds `p_tax_basis TEXT DEFAULT 'exclusive'` and `p_gift_wrapping_fee NUMERIC DEFAULT 0`. Keeps `subtotal`/`total` server-derived (already so today). Validates `p_tax_amount` against server-recomputed expected tax.
  - Updates the `update_order_tax_totals` trigger so for `tax_basis='exclusive'` orders the trigger recomputes and updates `total` atomically alongside `tax_amount`, `tax_exclusive_amount`, `tax_inclusive_amount`. For `tax_basis='inclusive'` orders `total` is invariant; only the breakdown columns change. Never leave a path where `tax_amount` changes without `total` for exclusive orders.
  - Ships the **follow-up `ALTER TABLE orders ALTER COLUMN tax_basis SET NOT NULL`** migration once `SELECT count(*) FROM orders WHERE tax_basis IS NULL` returns 0 (a separate PR after ops resolves the unclassified backlog).
  - Updates `apps/web/src/schemas/orders.ts` Zod schema (Δ-39) to accept and validate `tax_amount`, `tax_basis`, `gift_wrapping_fee`, and `expected_total`.
- [ ] Add tests:
  - checkout page/handler sends `tax_amount` and `expected_total`.
  - `/api/orders` rejects missing/stale VAT for VAT-registered merchants.
  - RPC/DB test proves `total = subtotal + shipping_fee + tax_amount - discount_amount` for tax-exclusive storefront orders.
  - Existing non-registered merchants still create orders with `tax_amount=0`.
- [ ] Historical remediation: branch the B4 review scan on `tax_basis` (Δ-32):
  - `tax_basis='exclusive'`: `|total - (subtotal + shipping_fee + gift_wrapping_fee + tax_amount - discount_amount)| > 1` ⇒ file `issue_type='tax_basis_inconsistent_total'` (Δ-33).
  - `tax_basis='inclusive'`: `|total - (subtotal + shipping_fee + gift_wrapping_fee - discount_amount)| > 1` ⇒ same `issue_type`.
  - `tax_basis IS NULL`: file `issue_type='tax_basis_unclassified'`.
  Do **not** auto-charge customers. Operator resolves manually.

### B4 — Stuck-payment alerting + Paystack-source backfill

- [ ] Migration (Δ-44 note: `reconciliation_review` itself was created in **A0** so B1 / B3.5 could file rows from PR1; this migration only adds `cron_state`):
  ```sql
  CREATE TABLE IF NOT EXISTS cron_state (
    name TEXT PRIMARY KEY,
    last_processed_at TIMESTAMPTZ,
    cursor JSONB
  );

  -- Δ-20: service-only access pattern (same as reconciliation_review in A0).
  ALTER TABLE cron_state ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE cron_state FROM PUBLIC, anon, authenticated;
  GRANT  ALL ON TABLE cron_state TO service_role;
  ```
- [ ] Cron in `vercel.json` every 5 minutes hitting `/api/admin/cron/reconcile-pending-payments`.
- [ ] **Paystack-source-of-truth scan** (the actual implementation, **NOT** the wrong server-side `channel` filter):
  ```
  GET /transaction?status=success&from=<last_processed_at - 5m>&to=<now>&perPage=100&page=<n>
  ```
  Page through. **Client-side filter** results to `channel === 'dedicated_nuban'`. (Other channels reconcile via the success-page flow.)
- [ ] For each remaining row: B0 multi-key match → **Δ-12: call `claim_paystack_paid_atomic`** (operator_user_id=NULL per Δ-25, operator_label=`'paystack_dva_cron_backfill'`) → call `applyPaidOrderSideEffects({ supabase: serviceClient, transactionId, gatewayResponse, actor: 'cron:<run-id>' })` (Δ-66/Δ-68 — explicit service client + actor; the cron route creates `createServiceClient()` once at the top and passes it). Multi-candidate / zero-candidate / manage_stock-cancellation-held cases all upsert via Δ-55 form: `INSERT INTO reconciliation_review (...) VALUES (...) ON CONFLICT (issue_type, paystack_ref) WHERE resolved_at IS NULL AND paystack_ref IS NOT NULL DO NOTHING` (or `(issue_type, order_id)` clause for the manage_stock case where order_id is the natural key). Cron retries land on the same row.
- [ ] One-shot historical scan from `2026-02-20` (Bug 0 introduction) to now. Run on demand.
  - **Stock caveat:** if duplicate cancellations would involve `manage_stock=true` items, **defer** cancellation, write a `reconciliation_review` row, alert ops. (Restock RPC doesn't exist today — confirmed: `orders/[id]/route.ts:271` only writes status; no migration adds reverse-stock. Don't introduce it in this PR; track separately.)
- [ ] Alerting (Resend email; Slack later):
  - Any `reconciliation_review` row.
  - Any pending Paystack txn > 30 min not seen by the scan.
- [ ] Admin "Stuck Payments" page at `/admin/payments/stuck` — server table with reconcile/cancel buttons. Defer fancy UI.

---

## 6. Phase C — Strategic refactor (separate plan, 4–6 weeks)

Do not start until Phase B is shipped and stable.

- C1 Order ↔ PaymentIntent separation
- C2 Idempotency keys end-to-end (server-generated fallback for backwards compat — Q6 decision)
- C3 OpenTelemetry tracing (vendor pick at this kickoff — Q5 decision)
- C4 SLOs and weekly auto-reports

---

## 7. Decisions made

| Q | Decision |
|---|---|
| Q1 | A2, after **A0 (gateway_fee fix + line-1698 settlement read) and A0.5 (α aliasing)** ship first |
| Q2 | B-then-C |
| Q3 | Fix RPC first (B2). Index cleanup is a separate, audited PR. |
| Q4 | Full side effects, claim-based outbox in dedicated **`payment_side_effects` table** (Phase A — Δ-7 upgrade); replay only retries what failed; defense-in-depth idempotency at each integration boundary |
| Q5 | Not blocking B4. Vercel logs + Resend email/Slack first. Vendor pick at Phase C kickoff. |
| Q6 | Server-generated idempotency-key fallback for backwards compat |
| Q7 | Hardcode 5 min cron cadence |
| Q8 | Both: count first, then **Paystack-side scan with client-side `channel` filter** |

## 8. Sub-decisions (defaulted; push back if you disagree)

- **Outbox location: `payment_side_effects` table** in Phase A (Δ-7 upgrade — was `orders.metadata`). Promotes naturally into Phase C without further refactor.
- B0 lower bound: `order_payment_account.created_at` (not `transaction.created_at`).
- Backfill behavior with `manage_stock=true` items: **defer cancellations**, file `reconciliation_review`, alert ops.
- **Audit operator user id (Δ-25 simplified):** A2 manual script requires `--operator-user-id` (your auth.users.id) and writes to `audit_logs`. B1 (webhook) and B4 (cron) pass `NULL` and the RPC SKIPS the `audit_logs` INSERT — they rely on `transactions.metadata` and `payment_side_effects` rows for audit. **No `auth.users` system row provisioning** required, no `BACI_SYSTEM_USER_ID` env var, no fragile direct-INSERT into Supabase auth schema.

## 9. Files to modify / create

**Phase A migrations (ship in this exact order):**
1. `<ts>_orders_tax_basis_gift_wrapping_and_reconciliation_review.sql` — A0 (Δ-40, Δ-44) adds `orders.tax_basis` (nullable) + `orders.gift_wrapping_fee` + backfills + creates `reconciliation_review` table with `tax_basis_unclassified` rows for the unbackfillable orders. Includes Δ-49 partial unique indexes for upsert.
2. **`<ts>_settlement_check_constraints.sql`** — A0 (Δ-48, **must run before idempotency**) drops + recreates `merchant_settlements` gateway and source_type CHECKs to include `juicyway` and `domain_purchase` so live callers stop silently failing.
3. `<ts>_settlement_idempotency.sql` — A0 (Δ-14, Δ-29, Δ-41, Δ-45, Δ-54, Δ-71) duplicate pre-check predicate matches the index predicate; DROP+CREATE `record_merchant_settlement` with `p_metadata` + ON CONFLICT DO NOTHING + IF FOUND wallet credit (full original body preserved); partial unique index on `(source_type, source_id, gateway_reference) WHERE gateway_reference IS NOT NULL AND status != 'cancelled'`; REVOKE/GRANT plus `auth.role() = 'service_role'` guard on new signature.
4. `<ts>_payment_side_effects.sql` — A1 (Δ-7, Δ-24, Δ-60) outbox table with `claim_token` and tokened claim/takeover semantics, **plus** the `claim_payment_side_effect(p_order_id uuid, p_transaction_id uuid, p_step text, p_claim_token uuid, p_claimed_by text) RETURNS TABLE(we_won boolean, current_status text)` SECURITY DEFINER RPC + REVOKE/GRANT lockdown. Both ship in this migration so the helper has the RPC at runtime.
5. `<ts>_claim_paystack_paid_atomic_rpc.sql` — A2 (Δ-12, Δ-15, Δ-18, Δ-19, Δ-23, Δ-25, Δ-28) generalized RPC with REVOKE/GRANT lockdown; no system user provisioning.

**Phase A code:**
- Modify [`apps/web/src/app/api/payments/webhook/route.ts`](apps/web/src/app/api/payments/webhook/route.ts) — A0 (line-959 SELECT cleanup, line-1698 settlement-fee read, line-1705 main-path settlement caller, line-915 chat-order settlement caller); also B1 wires up the DVA reconciler chain
- Modify [`apps/web/src/app/api/payments/verify/route.ts`](apps/web/src/app/api/payments/verify/route.ts) — A0 line-447 settlement caller updated for the new `p_metadata` param (Δ-41)
- Modify [`apps/web/src/app/api/payments/juicyway/webhook/route.ts`](apps/web/src/app/api/payments/juicyway/webhook/route.ts) — A0 line-478 settlement caller updated for the new `p_metadata` param (Δ-41); test at `route.test.ts:472` updates assertions
- Create `apps/web/src/lib/payments/apply-paid-order-side-effects.ts` + test (A1)
- Modify [`apps/web/src/lib/zeptomail.ts`](apps/web/src/lib/zeptomail.ts) — A1 (Δ-64): extend `sendEmail` params to accept an optional `clientReference?: string`; pass it through to the ZeptoMail `sendMail` payload as `client_reference` (the field ZeptoMail's API actually documents). Add a colocated test asserting the field is forwarded when supplied and absent when not.
- Create `scripts/reconcile-paystack-dva.ts` (A2)
- Modify [`apps/web/src/schemas/record-payment.ts`](apps/web/src/schemas/record-payment.ts), [`apps/web/src/app/api/orders/[id]/record-payment/route.ts`](apps/web/src/app/api/orders/[id]/record-payment/route.ts), and [`apps/mobile-admin/hooks/useOrders.ts`](apps/mobile-admin/hooks/useOrders.ts) + tests — A3 manual record-payment blank optional fields + pending processor guard

**Phase B migrations:**
- Create migration `<ts>_persist_paystack_dva_account.sql` (B1) — uses existing `unique_order_account` index, no redeclare
- Create migration `<ts>_fix_storefront_order_customer_upsert.sql` (B2) — advisory lock + retry-on-23505 loop
- Create migration `<ts>_storefront_order_require_quote_id.sql` (B3)
- Create migration `<ts>_storefront_order_financial_invariants.sql` (B3.5) — VAT/total parity in `create_storefront_order` and/or `update_order_tax_totals`
- Create migration `<ts>_cron_state.sql` (B4) — `reconciliation_review` itself was created in A0 per Δ-44

**Phase B code:**
- Modify [`apps/web/src/app/api/payments/initialize/route.ts`](apps/web/src/app/api/payments/initialize/route.ts) — B1 persist DVA assignment
- Modify [`apps/web/src/lib/agentic/paystack-dva-webhook.ts`](apps/web/src/lib/agentic/paystack-dva-webhook.ts) — rename + extend (B1)
- Create `apps/web/src/app/api/admin/cron/reconcile-pending-payments/route.ts` + tests (B4)
- Create `apps/web/src/lib/payments/paystack-backfill-scan.ts` + tests (B4)
- Create `apps/web/src/app/admin/payments/stuck/page.tsx` (B4)
- Modify `vercel.json` cron entry (B4)
- Cart client + `checkout_sessions` rehydration (B3)
- Modify [`apps/web/src/components/storefront/ogabassey/pages/checkout-page.tsx`](apps/web/src/components/storefront/ogabassey/pages/checkout-page.tsx), [`apps/web/src/components/storefront/ogabassey/pages/checkout/handlers/place-order.ts`](apps/web/src/components/storefront/ogabassey/pages/checkout/handlers/place-order.ts), [`apps/web/src/schemas/orders.ts`](apps/web/src/schemas/orders.ts) **(Δ-39: add `expected_total`, `client_total`, `gift_wrapping_fee`, `tax_basis` to `orderCreateSchema`; the API route can't enforce what the schema doesn't validate)**, [`apps/web/src/app/api/orders/route.ts`](apps/web/src/app/api/orders/route.ts), and the schema's colocated tests — B3.5 VAT/total parity

**Env:**
- (none required for Phase A) — Δ-25 removed the `BACI_SYSTEM_USER_ID` requirement; audit_logs writes are conditional on operator_user_id, automated paths skip them.

**Plan content sync:**
- Move this content from `/Users/mac/.claude/plans/efosa-igbinovia-i-can-snazzy-wigderson.md` to `docs/superpowers/plans/2026-05-09-payment-reliability-paystack-dva.md` (first action after exiting plan mode)

## 10. Verification plan

After A0 ships:
- Vercel logs show 0 webhook 4xxs across normal traffic in 60 min post-deploy.
- New test asserts settlement RPC receives the verified Paystack fee, not 0.
- DB spot-check: a fresh card payment's `transactions` row has the correct `platform_fee` and a non-zero `merchant_settlement` row.
- Non-service-role smoke test: calling `record_merchant_settlement` with an anon/authenticated client raises `forbidden: record_merchant_settlement requires service_role`.
- **Δ-56 CHECK-constraint smoke test** (must run before relying on settlement / idempotency code):
  ```sql
  -- Both inserts must succeed against the recreated CHECK constraints.
  -- Use a real merchant_id and a tombstone source_id so we can DELETE
  -- afterward without polluting wallet balances.
  INSERT INTO merchant_settlements (merchant_id, source_type, source_id, gateway,
    gateway_reference, gross_amount, net_amount, payment_date,
    expected_settlement_date, status)
  VALUES ('<some-merchant>', 'domain_purchase', gen_random_uuid(), 'paystack',
          'BAC-CHECK-DOMAIN', 0, 0, now(), CURRENT_DATE, 'cancelled');

  INSERT INTO merchant_settlements (merchant_id, source_type, source_id, gateway,
    gateway_reference, gross_amount, net_amount, payment_date,
    expected_settlement_date, status)
  VALUES ('<some-merchant>', 'order', gen_random_uuid(), 'juicyway',
          'BAC-CHECK-JUICYWAY', 0, 0, now(), CURRENT_DATE, 'cancelled');

  -- Cleanup
  DELETE FROM merchant_settlements
   WHERE gateway_reference IN ('BAC-CHECK-DOMAIN','BAC-CHECK-JUICYWAY');
  ```
  If either INSERT raises `check_violation`, the constraint migration didn't take and A0's settlement-idempotency layer will surface previously-silent failures as loud errors. Re-run the migration before proceeding.
- **Δ-55 reconciliation_review upsert smoke test**: insert the same `(issue_type, paystack_ref)` row twice via the canonical upsert form; assert exactly one row remains (no `unique_violation` raised, no duplicate row).
- **Δ-71 caller-client smoke test (residual implementation risk):** the new `auth.role() = 'service_role'` guard inside `record_merchant_settlement` will RAISE if any caller is wired with an SSR/anon client. **All 4 callsites must be proven to construct the client via `createServiceClient()` (or `createAdminClient()`) before settlement is invoked.** Verification:
  - Vitest unit test per callsite asserts the supabase variable in scope at the call to `record_merchant_settlement` is the result of `createServiceClient()` / `createAdminClient()`, not `createClient()` from `@/lib/supabase/server`.
  - Integration test: simulate a successful `charge.success` webhook AND the verify endpoint AND a juicyway success webhook against a local DB; assert each writes a `merchant_settlements` row (i.e. the role guard passed). If the test fails with `forbidden: record_merchant_settlement requires service_role`, the offending caller is using the wrong client.
  - Document the same expectation for the chat-order path at webhook line 915.

After A2 runs for Efosa:
- ORD-260509-00NV-R is `paid`; orders 1, 2, 4 are `cancelled` with notes.
- The 3 cancelled orders' pending `transactions` rows are also marked `status='cancelled'` with `metadata.canonical_transaction_id` pointing at `427ec4ea-…`.
- `payment_side_effects` table has rows for the canonical order with `status='completed'` for each step the integration allowed.
  - **Δ-31 prediction for Efosa specifically:** order `211bcf0e-…` has `subtotal=810000, shipping_fee=25000, tax_amount=60750, discount_amount=0, total=835000`. With `tax_basis=NULL` after A0's backfill (the order matches neither shape), `financialConsistency()` returns false. Therefore A1's `firs_invoice` and `loyalty_points` rows for this order MUST be `status='failed'` with `error='financial_totals_inconsistent'` (Δ-51 — exact string match, not a LIKE). `paid_email`, `merchant_settlement`, `ad_tracking_conversion` rows MUST be `status='completed'`. After B3.5 backfills/corrects the order's totals AND ops classifies Efosa's order's `tax_basis`, replaying A1 will retake the failed claims and complete FIRS + loyalty.
- `audit_logs` row exists (with `user_id` populated from `--operator-user-id`) recording the reconcile (paystack_reference, canonical/cancelled order ids, returned ROW_COUNT diagnostics).
- `merchant_settlements` has exactly **one** row matching `(source_type='order', source_id=211bcf0e-…, gateway_reference='BAC-7TUD6N4WJCNM')` (Δ-26: keyed on the post-Δ-17 unique-index columns). **Concurrent settlement test** (run the helper twice in parallel) → still exactly one row, exactly one wallet credit (proven by Δ-14/Δ-17's partial unique index).
- **Replay** of the script with same args is a no-op: RPC returns `already_completed: true`, `txn_rows_updated: 0`, `order_rows_updated: 0`, `dup_orders_cancelled: 0`. The claim-based outbox blocks duplicate side effects.
- **Concurrent replay** test: invoke the script twice in parallel — each side effect runs exactly once (one wins the `payment_side_effects` claim, the other no-ops). No duplicate emails, no duplicate FIRS submission, no duplicate settlement.
- **No extra stock decrement.** RPC decrements at order creation; payment confirmation does not. This product has `manage_stock=false`, so the duplicate cancellations are stock-neutral. For `manage_stock=true` items in future backfills, B4 will defer cancellation pending an explicit restock RPC.

After A3:
- Manual Record Payment with blank Notes succeeds for a normal manual/cash/POS order.
- Manual Record Payment on Efosa while the Paystack transaction is still `pending` returns `409 PENDING_GATEWAY_PAYMENT` and creates no manual transaction.
- Mobile-admin no longer sends blank optional notes/reference as present empty strings.

After B1:
- Test simulating a DVA charge.success for a brand new order reconciles within 60s.
- Multi-candidate ambiguity creates a `reconciliation_review` row and emails ops.

After B3.5:
- New VAT-registered checkout for S25 256GB + ₦25k delivery either charges the approved tax-exclusive total (`₦895,750`) or persists an explicitly VAT-inclusive model. It must not persist `tax_amount=₦60,750` with `total=₦835,000`.
- `/api/orders` rejects a VAT-registered order request missing/stale VAT instead of defaulting to 0.
- `update_order_tax_totals` / `create_storefront_order` cannot change `orders.tax_amount` without keeping `orders.total` consistent.

After B4:
- Backfill scan from 2026-02-20 reconciles all unambiguous stuck DVA payments; ambiguous ones surface for manual review.
- Cron alerts (Resend email) fire on next `reconciliation_review` row.
- `cron_state.last_processed_at` advances correctly across runs.

After Phase C: covered in its own plan.
