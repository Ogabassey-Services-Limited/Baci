# Functional Storefront Discount Codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **On execution start:** branch off `main` (current branch has unrelated WIP) and copy this plan into the worktree at `docs/superpowers/plans/2026-06-15-storefront-discount-codes.md`.

**Goal:** Make storefront discount codes actually reduce order totals end-to-end (web + mobile), atomically and abuse-resistantly, without editing the VAT-boundary order RPC.

**Architecture:** A new `SECURITY DEFINER` wrapper RPC `create_storefront_order_with_discount_code` locks the `discount_codes` row `FOR UPDATE`, calls the unmodified `create_storefront_order` (which handles idempotency), and — **only for a fresh (non-replay) order** — enforces the FULL policy inside the database: window/active, usage + per-customer limits, minimum purchase, **targeted-code eligibility against the created order's items**, and **two-sided (exact ±1) amount validation against the DB-computed subtotal**. The route resolves the code, computes the amount from the canonical subtotal, and dispatches to the wrapper. The DB is the only trust boundary — the RPC is safe to grant to `anon` because it self-polices completely.

**Tech Stack:** Supabase Postgres (plpgsql), Next.js 16 route handlers, Zod, Vitest (web/shared), Jest (mobile-storefront), React + React Native.

**Scope:** Phase 1 only. Referral program is a separate later plan. Targeted codes (`applies_to <> 'all'`): whole-cart percentage + eligibility gate enforced in the RPC (per-line proration is a follow-up). Discount **+ savings/voucher/auto-negotiation** are mutually exclusive in this PR; discount **+ wallet credit** coexists (wallet redeems post-creation). Discount is applied **post-VAT** (matches `total = subtotal + shipping + gift + tax − discount`).

**Why:** Today discount codes are a non-functional façade — admin CRUD and storefront validate/display work, but `apps/web/src/app/api/orders/route.ts:1168` rejects any non-zero `discount_amount`, `discount_code_usage` is never written, and `orders` has no link to the code. This makes them real and abuse-resistant.

**Review revisions baked in (v2):** RPC is replay-first and self-policing (eligibility + exact amount **in the DB**, P1a); replay is enforced before any quota mutation and the idempotency hash now includes code identity (P1b); `get_storefront_discount_code` extension is mandatory because RLS hides discount rows from anon (P2b); route block is reordered to compile and uses narrowed parsing (P2a); mobile wiring covers screen/builder/totals/BNPL (P2c); the `usage_count` constraint uses a preflight clamp, not a misused `NOT VALID` (P3).

**Review revisions baked in (v3):** the code is detected BEFORE auto-negotiation derivation, which is skipped when a code is present so a net `expected_total` isn't misread as a negotiated discount (P1-negotiation); the earlier route `specific_products` fail-fast idea was later superseded by v9, so targeting is now RPC-only and replay-safe; `get_storefront_discount_code` gains `p_include_inactive` so a retry after deactivation still resolves the row and reaches the replay-aware wrapper (P2-replay); targeting arrays are `COALESCE`d in SQL and null-tolerant in Zod (P3-nullable).

**Review revisions baked in (v4):** the migration normalizes + hardens `discount_codes.usage_count` and `applies_to` to `NOT NULL DEFAULT`, and the wrapper `COALESCE`s them so a legacy NULL can't bypass quota or misroute eligibility (P2-null); the mobile checkout fingerprint now mandatorily includes `discountCode` so equal-amount code swaps don't collide on mobile, threaded through the normal and BNPL paths with a test (P3-mobile).

**Review revisions baked in (v5):** the new CHECK constraint is added inside a `DO`/`IF NOT EXISTS (pg_constraint)` guard and the `get_storefront_discount_code` drop is `DROP FUNCTION IF EXISTS`, so the migration is safe on retry / branch drift (P3-migration-safety).

**Review revisions baked in (v6):** the migration drops the baseline `unique_customer_code` UNIQUE so `usage_limit_per_customer>1` works (per-customer enforced by the in-lock count check, not a rigid constraint) — probe #5 uses limit 2 (P2-unique); the new `orders.discount_code_id` FK gets `idx_orders_discount_code_id` (P3-fk-index); mobile `discount.ts` imports `resolveApiBaseUrl` from `@/lib/api-url` (P3-apiurl).

**Review revisions baked in (v7):** the earlier route product-id eligibility check was later superseded by v9, so no route-side targeting check remains; Task 8 makes the admin delete soft-deactivate USED codes instead of hard-deleting, and v9 adds DB `ON DELETE RESTRICT` + trigger protection for direct writes; the CHECK-constraint guard also matches `conrelid = 'public.discount_codes'::regclass` so a same-named constraint elsewhere can't skip it (P3-conrelid).

**Review revisions baked in (v8):** the idempotency hash for code orders uses stable code identity (`discount_code`) and excludes the recomputed amount, so a merchant editing the code's value/cap/targeting between a checkout and its retry can't trip `checkout_idempotency_conflict` before replay (P2-code-edit); Task 8 also blocks renaming a USED code's `code` string (rename → `discount_code_rename_not_allowed`) so a retry's original string still resolves (P2-rename).

**Review revisions baked in (v9):** the route no longer fast-fails on targeting — eligibility is RPC-only and replay-safe, so a post-checkout targeting edit can't reject a retry (P2-targeting-edit), and the now-unused `cartHasEligibleItem` helper is dropped from Task 2; the used-code invariant is enforced in the DB (usage FK `ON DELETE RESTRICT` + `prevent_used_discount_code_identity_mutation` trigger) so mobile-admin's direct Supabase writes / stale clients can't bypass it (P2-db-invariant); the mobile payload work + test target the ACTIVE `orders.payload.ts` (not the stale `order-payload.ts`, which is deleted) (P2-mobile-module); the per-customer index is the expression index `(discount_code_id, lower(customer_email))` matching the lock-held lookup (P3-index); the shared validate response schema is a strict success/failure union so mobile cannot accept `{ valid: true }` without discount details (P3-schema).

**Review revisions baked in (v10):** Task 3 now names the live `orderCreateSchema` + `validOrder` fixture; Ogabassey keeps `use-order-totals.ts` pre-discount and derives a separate post-VAT `payableTotal` for display/wallet/expected_total while still using server-returned payment amounts after order creation; mobile explicitly suppresses savings-credit fields when a discount is applied but keeps wallet credit allowed, and BNPL fingerprints thread both `discountCode` and `discountAmount` instead of leaving the current `discountAmount: 0` collision path; validate endpoints gain optional product/category arrays for non-authoritative targeted-code UX preflight while the order RPC remains the sole enforcement boundary.

**Review revisions baked in (v11):** web checkout now uses the validate response's `discount_amount` as the UI source of truth instead of recomputing from type/value locally, so maximum caps and rounding stay aligned with the route/helper; `DiscountCodeInput` is upgraded to carry `discount_amount`, `productIds`, and `categoryIds` through tests and call sites.

**Review revisions baked in (v12):** the SQL wrapper now mirrors the helper's whole-unit rounding exactly (`round(..., 0)` semantics) instead of relying on the ±1 tolerance to absorb decimal drift; the wrapper no longer uses `SELECT *` and instead loads only the discount-code columns it enforces; the expanded `SECURITY DEFINER` lookup RPC must use `SET search_path = ''` with schema-qualified references rather than inheriting the baseline `public` search path.

**Test commands (per package):**
- Web: `pnpm --filter @baci/web exec vitest run <path> -t "<name>"`
- Shared: `pnpm --filter @baci/shared exec vitest run <path> -t "<name>"`
- Mobile: `pnpm --filter @baci/mobile-storefront exec jest --runInBand <path> -t "<name>"`
- Gate: `pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test` (delete stale `*.tsbuildinfo` first)

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `packages/shared/src/schemas/storefront-discount.ts` + index | Shared validate request/response contract (web + mobile) | Create / Modify |
| `apps/web/src/lib/checkout/discount-amount.ts` | Pure discount amount logic (single source of truth) | Create |
| `apps/web/src/schemas/orders.ts` | Add `discount_code` to `orderCreateSchemaBase` beside `discount_amount` | Modify |
| `apps/web/src/schemas/storefront-discount.ts` | Extend row schema with targeting fields and validate request with optional cart target arrays | Modify |
| `apps/web/src/lib/checkout/order-idempotency.ts` | Add `discount_code` to the hash payload | Modify |
| `supabase/migrations/<ts>_storefront_discount_code_redemption.sql` | Schema + extend `get_storefront_discount_code` + wrapper RPC + DB identity invariant for used codes | Create |
| `apps/web/src/app/api/orders/route.ts` | Resolve code, compute amount, dispatch, map errors; targeting remains RPC-authoritative | Modify |
| `apps/web/src/app/checkout/page.tsx` + ogabassey `place-order.ts` | Forward `discount_code`; send net `expected_total` only from VAT-aware checkout flows | Modify |
| `apps/mobile-storefront/{services,components/checkout}/…` | Schema, active payload module, validate service, RN input, submit + BNPL wiring; remove stale duplicate payload module | Create / Modify / Delete |
| `…/discount-codes/actions.ts` + `[id]/route.ts`, `apps/mobile-admin/hooks/useDiscounts.ts` | Preserve USED codes: deactivate-not-delete + block rename (replay/audit safety) | Modify |

---

## Task 1: Shared discount-validate schema

**Files:** Create `packages/shared/src/schemas/storefront-discount.ts` + `.test.ts`; Modify `packages/shared/src/schemas/index.ts`.

- [ ] **Step 1: Write the failing test** — `packages/shared/src/schemas/storefront-discount.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  StorefrontDiscountValidateRequestSchema,
  StorefrontDiscountValidateResponseSchema,
} from './storefront-discount';

describe('StorefrontDiscountValidateRequestSchema', () => {
  it('accepts a valid request', () => {
    expect(StorefrontDiscountValidateRequestSchema.safeParse({
      merchant_id: '11111111-1111-1111-1111-111111111111', code: 'SAVE10', cart_total: 5000,
    }).success).toBe(true);
  });
  it('accepts optional targeting arrays for UX preflight', () => {
    expect(StorefrontDiscountValidateRequestSchema.safeParse({
      merchant_id: '11111111-1111-1111-1111-111111111111', code: 'SAVE10', cart_total: 5000,
      product_ids: ['prod-1'], category_ids: ['cat-1'],
    }).success).toBe(true);
  });
  it('rejects a blank code', () => {
    expect(StorefrontDiscountValidateRequestSchema.safeParse({
      merchant_id: '11111111-1111-1111-1111-111111111111', code: '   ', cart_total: 5000,
    }).success).toBe(false);
  });
  it('rejects a negative cart_total', () => {
    expect(StorefrontDiscountValidateRequestSchema.safeParse({
      merchant_id: '11111111-1111-1111-1111-111111111111', code: 'SAVE10', cart_total: -1,
    }).success).toBe(false);
  });
});

describe('StorefrontDiscountValidateResponseSchema', () => {
  it('parses a valid applied-discount response', () => {
    expect(StorefrontDiscountValidateResponseSchema.safeParse({
      valid: true, discount_code_id: '22222222-2222-2222-2222-222222222222', code: 'SAVE10',
      discount_type: 'percentage', discount_value: 10, discount_amount: 500, description: null,
    }).success).toBe(true);
  });
  it('parses an invalid-code response', () => {
    expect(StorefrontDiscountValidateResponseSchema.safeParse({ valid: false, error: 'x' }).success).toBe(true);
  });
  it('rejects a malformed valid response with no amount details', () => {
    expect(StorefrontDiscountValidateResponseSchema.safeParse({ valid: true }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @baci/shared exec vitest run src/schemas/storefront-discount.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** — `packages/shared/src/schemas/storefront-discount.ts`:
```ts
import { z } from 'zod';

export const StorefrontDiscountValidateRequestSchema = z.object({
  merchant_id: z.uuid(),
  code: z.string().trim().min(1).max(50),
  cart_total: z.number().nonnegative(),
  product_ids: z.array(z.string().min(1)).optional(),
  category_ids: z.array(z.string().min(1)).optional(),
});

const AppliedDiscountResponseSchema = z.object({
  valid: z.literal(true),
  discount_code_id: z.uuid(),
  code: z.string().trim().min(1),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number(),
  discount_amount: z.number().nonnegative(),
  minimum_order: z.number().nonnegative().optional(),
  description: z.string().nullable().optional(),
});

const RejectedDiscountResponseSchema = z.object({
  valid: z.literal(false),
  error: z.string().min(1),
  details: z.unknown().optional(),
});

export const StorefrontDiscountValidateResponseSchema = z.discriminatedUnion('valid', [
  AppliedDiscountResponseSchema,
  RejectedDiscountResponseSchema,
]);

export type StorefrontDiscountValidateRequest = z.infer<typeof StorefrontDiscountValidateRequestSchema>;
export type StorefrontDiscountValidateResponse = z.infer<typeof StorefrontDiscountValidateResponseSchema>;
```
Add `export * from './storefront-discount';` to `packages/shared/src/schemas/index.ts`.

- [ ] **Step 4: Run** the test → PASS (7).
- [ ] **Step 5: Commit** `feat(shared): add storefront discount-code validate schema`.

---

## Task 2: Discount amount helper (single source of truth)

**Files:** Create `apps/web/src/lib/checkout/discount-amount.ts` + `.test.ts`. This must produce the SAME whole-unit number the RPC re-derives (Task 4), so amount validation is deterministic and the ±1 tolerance is only a guardrail. Enforcement lives ENTIRELY in the order RPC — the order route does not gate on targeting; see Task 5 (d) / P2-targeting-edit — so no order-route TS eligibility helper is needed. The storefront validate endpoint may still do the UX-only preflight from Task 5.

- [ ] **Step 1: Write the failing test** — `apps/web/src/lib/checkout/discount-amount.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeDiscountAmountForSubtotal, type DiscountCodeForAmount } from '@/lib/checkout/discount-amount';

const pct: DiscountCodeForAmount = { discount_type: 'percentage', discount_value: 10, maximum_discount_amount: null };

describe('computeDiscountAmountForSubtotal', () => {
  it('rounds a percentage of the subtotal', () => { expect(computeDiscountAmountForSubtotal(pct, 5005)).toBe(501); });
  it('caps at maximum_discount_amount', () => { expect(computeDiscountAmountForSubtotal({ ...pct, maximum_discount_amount: 300 }, 5000)).toBe(300); });
  it('honors a maximum_discount_amount of 0 (not truthy)', () => { expect(computeDiscountAmountForSubtotal({ ...pct, maximum_discount_amount: 0 }, 5000)).toBe(0); });
  it('clamps a fixed amount to the subtotal', () => { expect(computeDiscountAmountForSubtotal({ discount_type: 'fixed', discount_value: 9000, maximum_discount_amount: null }, 5000)).toBe(5000); });
  it('never exceeds subtotal for a percentage', () => { expect(computeDiscountAmountForSubtotal({ discount_type: 'percentage', discount_value: 150, maximum_discount_amount: null }, 5000)).toBe(5000); });
});
```

- [ ] **Step 2: Run** → FAIL (module missing).

- [ ] **Step 3: Implement** — `apps/web/src/lib/checkout/discount-amount.ts`:
```ts
export interface DiscountCodeForAmount {
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  maximum_discount_amount: number | null;
}

export function computeDiscountAmountForSubtotal(code: DiscountCodeForAmount, subtotal: number): number {
  let amount = code.discount_type === 'percentage'
    ? Math.round((subtotal * code.discount_value) / 100)
    : Math.round(code.discount_value);
  if (code.maximum_discount_amount != null) {
    amount = Math.min(amount, Math.round(code.maximum_discount_amount));
  }
  return Math.max(0, Math.min(amount, Math.round(subtotal)));
}
```

- [ ] **Step 4: Run** → PASS (5).
- [ ] **Step 5: Refactor** the validate route (`apps/web/src/app/api/storefront/discount/validate/route.ts:119-138`) to call `computeDiscountAmountForSubtotal` (map `'fixed_amount'→'fixed'`); re-run `pnpm --filter @baci/web exec vitest run src/app/api/storefront/discount/validate`.
- [ ] **Step 6: Commit** `feat(web): extract discount amount helper`.

---

## Task 3: Add `discount_code` to the order body schema

**Files:** Modify `apps/web/src/schemas/orders.ts` (`orderCreateSchemaBase`, beside `discount_amount`); test `apps/web/src/schemas/orders.test.ts` (`orderCreateSchema` suite, using the existing `validOrder` fixture).

- [ ] **Step 1: Write the failing test**:
```ts
it('accepts an optional discount_code', () => {
  expect(orderCreateSchema.safeParse({ ...validOrder, discount_code: 'SAVE10' }).success).toBe(true);
});
it('rejects an over-long discount_code', () => {
  expect(orderCreateSchema.safeParse({ ...validOrder, discount_code: 'X'.repeat(51) }).success).toBe(false);
});
```
- [ ] **Step 2: Run** `-t "discount_code"` → FAIL.
- [ ] **Step 3: Implement** — add beside `discount_amount`: `discount_code: z.string().trim().min(1).max(50).optional(),`
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(web): accept optional discount_code on order body`.

---

## Task 4: Migration — schema, extend validate RPC, self-policing redemption RPC

**Files:** Create `supabase/migrations/<timestamp>_storefront_discount_code_redemption.sql` (prefix from `date -u +%Y%m%d%H%M%S`). Mirror `supabase/migrations/20260522002607_quiz_voucher_order_rpc.sql`. The redemption RPC return MUST match `create_storefront_order`'s 20-column `RETURNS TABLE` (verified in `20260604132853`), ending `idempotency_replayed BOOLEAN`.

- [ ] **Step 1: Schema changes + constraint (P3 fix: preflight clamp, not misused NOT VALID)**
```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_code_id uuid
    REFERENCES public.discount_codes(id) ON DELETE SET NULL;

-- Index the new FK (repo rule: every FK is indexed).
CREATE INDEX IF NOT EXISTS idx_orders_discount_code_id
  ON public.orders (discount_code_id) WHERE discount_code_id IS NOT NULL;

-- P2-unique: baseline has UNIQUE (discount_code_id, customer_email) on
-- discount_code_usage (`unique_customer_code`, baseline.sql:11644). That caps a
-- customer at ONE usage row per code, which contradicts usage_limit_per_customer>1
-- and would raise 23505 on the 2nd redemption instead of our clean
-- per_customer_limit_reached. Per-customer is now enforced by the wrapper's
-- count check under the FOR UPDATE lock (race-safe), so drop the rigid constraint.
ALTER TABLE public.discount_code_usage DROP CONSTRAINT IF EXISTS unique_customer_code;

CREATE UNIQUE INDEX IF NOT EXISTS uq_discount_code_usage_code_order
  ON public.discount_code_usage (discount_code_id, order_id) WHERE order_id IS NOT NULL;

-- Expression index matching the wrapper's per-customer lookup
-- (WHERE discount_code_id = ? AND lower(customer_email) = ?) so popular codes
-- don't scan many rows while holding the FOR UPDATE lock (P3-index).
CREATE INDEX IF NOT EXISTS idx_discount_code_usage_code_lower_email
  ON public.discount_code_usage (discount_code_id, (pg_catalog.lower((customer_email)::text)));

-- DB-level enforcement of the used-code invariant (P2-db-invariant): mobile-admin
-- and stale clients write discount_codes directly under staff RLS, so app-layer
-- guards in Task 8 are defense-in-depth, not the source of truth.
-- (1) A used code cannot be hard-deleted: flip the usage FK CASCADE -> RESTRICT
--     (unused codes, with no usage rows, still delete normally). The trigger
--     below adds the clearer domain error and also catches usage_count drift.
ALTER TABLE public.discount_code_usage
  DROP CONSTRAINT IF EXISTS discount_code_usage_discount_code_id_fkey;
ALTER TABLE public.discount_code_usage
  ADD CONSTRAINT discount_code_usage_discount_code_id_fkey
  FOREIGN KEY (discount_code_id) REFERENCES public.discount_codes(id) ON DELETE RESTRICT;

-- (2) A used code cannot be renamed or hard-deleted: check usage rows,
--     orders.discount_code_id, and usage_count because historical drift can leave
--     one signal without the others.
-- Drop the earlier draft trigger/function names too, so a dev branch that tested
-- a pre-v9 draft does not keep duplicate trigger behavior.
DROP TRIGGER IF EXISTS trg_prevent_used_discount_code_rename
  ON public.discount_codes;
DROP FUNCTION IF EXISTS public.prevent_used_discount_code_rename();

CREATE OR REPLACE FUNCTION public.prevent_used_discount_code_identity_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_has_usage boolean;
BEGIN
  SELECT
    COALESCE(OLD.usage_count, 0) > 0
    OR EXISTS (
      SELECT 1
      FROM public.discount_code_usage u
      WHERE u.discount_code_id = OLD.id
      LIMIT 1
    )
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.discount_code_id = OLD.id
      LIMIT 1
    )
  INTO v_has_usage;

  IF TG_OP = 'DELETE' THEN
    IF v_has_usage THEN
      RAISE EXCEPTION 'discount_code_delete_not_allowed';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.code IS DISTINCT FROM OLD.code AND v_has_usage THEN
    RAISE EXCEPTION 'discount_code_rename_not_allowed';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS prevent_used_discount_code_identity_mutation
  ON public.discount_codes;
CREATE TRIGGER prevent_used_discount_code_identity_mutation
  BEFORE UPDATE OF code OR DELETE ON public.discount_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_used_discount_code_identity_mutation();

-- Normalize the nullable columns the redemption RPC depends on (P2-null):
-- existing rows may carry NULL usage_count / applies_to, which would silently
-- bypass quota checks and misroute eligibility. Backfill, then harden so future
-- rows can't reintroduce NULLs.
UPDATE public.discount_codes SET usage_count = 0 WHERE usage_count IS NULL;
UPDATE public.discount_codes SET applies_to = 'all' WHERE applies_to IS NULL;
ALTER TABLE public.discount_codes
  ALTER COLUMN usage_count SET DEFAULT 0,
  ALTER COLUMN usage_count SET NOT NULL,
  ALTER COLUMN applies_to  SET DEFAULT 'all',
  ALTER COLUMN applies_to  SET NOT NULL;

-- Preflight: guarantee no row violates the new invariant, THEN add it as a
-- normal (validated) constraint. (A NOT VALID + immediate VALIDATE still scans
-- and would fail on dirty data — clamping first is what actually makes it safe.)
UPDATE public.discount_codes
SET usage_count = usage_limit
WHERE usage_limit IS NOT NULL AND usage_count > usage_limit;

-- Idempotent ADD (no `ADD CONSTRAINT IF NOT EXISTS` for CHECK in Postgres).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'discount_codes_usage_count_within_limit'
      AND conrelid = 'public.discount_codes'::regclass
  ) THEN
    ALTER TABLE public.discount_codes
      ADD CONSTRAINT discount_codes_usage_count_within_limit
      CHECK (usage_limit IS NULL OR usage_count <= usage_limit);
  END IF;
END $$;
```

- [ ] **Step 2: Extend `get_storefront_discount_code` — targeting fields, an inactive-inclusive mode, and null-safe arrays (P2b mandatory + P2-replay + P3)**

`DROP FUNCTION IF EXISTS public.get_storefront_discount_code(uuid, text);` then recreate it from the baseline definition (`20260418000000_baseline.sql:3669`) with four changes:
1. **New optional param** `p_include_inactive boolean DEFAULT false` (new arg goes LAST so it's additive). The `is_active` filter becomes `AND (p_include_inactive OR dc.is_active = true)`. The public validate route keeps calling it WITHOUT the flag (active-only); the order route passes `true` so a retry after deactivation can still resolve the row and reach the replay-aware wrapper (P2-replay).
2. **Add to `RETURNS TABLE` + `SELECT`**, null-coalesced so legacy nullable rows parse cleanly (P3): `applies_to text` → `COALESCE(dc.applies_to, 'all')`; `product_ids jsonb` → `COALESCE(dc.product_ids, '[]'::jsonb)`; `category_ids jsonb` → `COALESCE(dc.category_ids, '[]'::jsonb)`; `usage_limit_per_customer integer` (nullable, as-is).
3. Keep `SECURITY DEFINER`, but harden it with `SET search_path = ''` and fully qualify references (`public.discount_codes`, `pg_catalog.upper`, `pg_catalog.btrim`, etc.) instead of copying the baseline function's `SET search_path TO 'public'`.
4. Re-`GRANT EXECUTE … TO anon, authenticated, service_role` on the new 3-argument signature.

(Adding columns/params is backward-compatible: callers that omit `p_include_inactive` get the old behavior, and the existing validate route's Zod parse strips unknown keys. Minor info note: `p_include_inactive=true` lets a caller learn an inactive code's rules — the same details visible while active; not sensitive.)

- [ ] **Step 3: The self-policing, replay-first redemption RPC**
```sql
DROP FUNCTION IF EXISTS public.create_storefront_order_with_discount_code(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text, text, jsonb,
  text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, text, text, uuid);

CREATE OR REPLACE FUNCTION public.create_storefront_order_with_discount_code(
  p_merchant_id uuid, p_customer_email text, p_customer_name text, p_items jsonb,
  p_customer_phone text DEFAULT NULL, p_shipping_fee numeric DEFAULT 0,
  p_discount_amount numeric DEFAULT 0, p_tax_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT 'card', p_payment_status text DEFAULT 'unpaid',
  p_shipping_status text DEFAULT 'pending', p_shipping_address jsonb DEFAULT NULL,
  p_source text DEFAULT 'online_store', p_notes text DEFAULT NULL, p_ad_tracking jsonb DEFAULT NULL,
  p_selected_quote_id uuid DEFAULT NULL, p_shipping_provider text DEFAULT NULL,
  p_tracking_number text DEFAULT NULL, p_user_id uuid DEFAULT NULL, p_tax_basis text DEFAULT 'exclusive',
  p_gift_wrapping_fee numeric DEFAULT 0, p_expected_total numeric DEFAULT NULL,
  p_checkout_idempotency_key text DEFAULT NULL, p_checkout_request_hash text DEFAULT NULL,
  p_discount_code_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid, order_number text, tracking_token text, subtotal numeric, shipping_fee numeric,
  discount_amount numeric, tax_amount numeric, total numeric, customer_id uuid, customer_email text,
  customer_name text, customer_phone text, payment_status text, shipping_status text,
  payment_method text, shipping_address jsonb, merchant_id uuid, tax_basis text,
  gift_wrapping_fee numeric, idempotency_replayed boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_code        record;
  v_order       record;
  v_now         timestamptz := pg_catalog.now();
  v_norm_email  text := pg_catalog.lower(pg_catalog.btrim(p_customer_email));
  v_per_cust    integer;
  v_expected    numeric;
  v_eligible    boolean;
  v_inserted_id uuid;
BEGIN
  IF p_discount_code_id IS NULL THEN
    RAISE EXCEPTION 'discount_code_required';
  END IF;

  -- Lock the code row up front (ownership + existence). Held through commit so
  -- concurrent first-time redemptions of a limited code are serialized.
  SELECT
    dc.id,
    dc.code,
    dc.discount_type,
    dc.discount_value,
    dc.minimum_purchase_amount,
    dc.maximum_discount_amount,
    dc.usage_limit,
    dc.usage_count,
    dc.starts_at,
    dc.expires_at,
    dc.is_active,
    dc.applies_to,
    dc.product_ids,
    dc.category_ids,
    dc.usage_limit_per_customer
  INTO v_code
  FROM public.discount_codes dc
  WHERE dc.id = p_discount_code_id AND dc.merchant_id = p_merchant_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'discount_code_not_found'; END IF;

  -- Create (or idempotently replay) the order via the unmodified trust-boundary RPC.
  SELECT
    created.id,
    created.order_number,
    created.tracking_token,
    created.subtotal,
    created.shipping_fee,
    created.discount_amount,
    created.tax_amount,
    created.total,
    created.customer_id,
    created.customer_email,
    created.customer_name,
    created.customer_phone,
    created.payment_status,
    created.shipping_status,
    created.payment_method,
    created.shipping_address,
    created.merchant_id,
    created.tax_basis,
    created.gift_wrapping_fee,
    created.idempotency_replayed
  INTO v_order
  FROM public.create_storefront_order(
    p_merchant_id => p_merchant_id, p_customer_email => p_customer_email,
    p_customer_name => p_customer_name, p_items => p_items, p_customer_phone => p_customer_phone,
    p_shipping_fee => p_shipping_fee,
    p_discount_amount => GREATEST(COALESCE(p_discount_amount, 0), 0),
    p_tax_amount => p_tax_amount, p_payment_method => p_payment_method,
    p_payment_status => p_payment_status, p_shipping_status => p_shipping_status,
    p_shipping_address => p_shipping_address, p_source => p_source, p_notes => p_notes,
    p_ad_tracking => p_ad_tracking, p_selected_quote_id => p_selected_quote_id,
    p_shipping_provider => p_shipping_provider, p_tracking_number => p_tracking_number,
    p_user_id => p_user_id, p_tax_basis => p_tax_basis, p_gift_wrapping_fee => p_gift_wrapping_fee,
    p_expected_total => p_expected_total, p_checkout_idempotency_key => p_checkout_idempotency_key,
    p_checkout_request_hash => p_checkout_request_hash
  ) AS created;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'discount_order_creation_failed'; END IF;

  -- REPLAY (P1b): the order already existed; the first call already enforced
  -- policy and recorded usage. Return as-is WITHOUT re-checking limits or
  -- re-recording usage, so a legitimate retry is never rejected once quota is
  -- consumed (usage_limit_per_customer defaults to 1).
  IF v_order.idempotency_replayed THEN
    RETURN QUERY SELECT
      v_order.id, v_order.order_number, v_order.tracking_token, v_order.subtotal,
      v_order.shipping_fee, v_order.discount_amount, v_order.tax_amount, v_order.total,
      v_order.customer_id, v_order.customer_email, v_order.customer_name, v_order.customer_phone,
      v_order.payment_status, v_order.shipping_status, v_order.payment_method, v_order.shipping_address,
      v_order.merchant_id, v_order.tax_basis, v_order.gift_wrapping_fee, v_order.idempotency_replayed;
    RETURN;
  END IF;

  -- FRESH redemption: enforce the FULL policy in-DB (P1a). Any RAISE rolls the
  -- order back atomically (no orphan order, no stock leak).
  IF v_code.is_active IS NOT TRUE THEN RAISE EXCEPTION 'code_inactive'; END IF;
  IF v_code.starts_at IS NOT NULL AND v_code.starts_at > v_now THEN RAISE EXCEPTION 'code_not_started'; END IF;
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < v_now THEN RAISE EXCEPTION 'code_expired'; END IF;
  IF v_code.usage_limit IS NOT NULL AND COALESCE(v_code.usage_count, 0) >= v_code.usage_limit THEN
    RAISE EXCEPTION 'usage_limit_reached'; END IF;

  SELECT pg_catalog.count(*) INTO v_per_cust FROM public.discount_code_usage u
  WHERE u.discount_code_id = v_code.id
    AND pg_catalog.lower((u.customer_email)::text) = v_norm_email;
  IF v_per_cust >= COALESCE(v_code.usage_limit_per_customer, 1) THEN
    RAISE EXCEPTION 'per_customer_limit_reached'; END IF;

  IF v_code.minimum_purchase_amount IS NOT NULL AND v_order.subtotal < v_code.minimum_purchase_amount THEN
    RAISE EXCEPTION 'minimum_purchase_not_met'; END IF;

  -- Eligibility against the ACTUAL created order items (P1a — not route-only).
  -- COALESCE applies_to so a legacy NULL routes to 'all', never the category branch (P2-null).
  IF COALESCE(v_code.applies_to, 'all') = 'all' THEN
    v_eligible := true;
  ELSIF COALESCE(v_code.applies_to, 'all') = 'specific_products' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.order_items oi
      WHERE oi.order_id = v_order.id
        AND oi.product_id::text IN (
          SELECT pg_catalog.jsonb_array_elements_text(COALESCE(v_code.product_ids, '[]'::jsonb)))
    ) INTO v_eligible;
  ELSE  -- specific_categories (`products.category_id` exists in baseline.sql:8433)
    SELECT EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = v_order.id
        AND p.category_id::text IN (
          SELECT pg_catalog.jsonb_array_elements_text(COALESCE(v_code.category_ids, '[]'::jsonb)))
    ) INTO v_eligible;
  END IF;
  IF NOT v_eligible THEN RAISE EXCEPTION 'discount_code_not_eligible'; END IF;

  -- Two-sided amount validation against the AUTHORITATIVE subtotal (P1a): the
  -- applied discount must EQUAL what the code grants (±1), so a direct anon
  -- caller can neither over-claim NOR under-apply (e.g. 0) to burn quota.
  -- Use the same whole-unit rounding as computeDiscountAmountForSubtotal()
  -- (Task 2), so TS validate/UI, route dispatch, and SQL enforcement agree.
  IF v_code.discount_type = 'percentage' THEN
    v_expected := pg_catalog.round(v_order.subtotal * v_code.discount_value / 100.0, 0);
    IF v_code.maximum_discount_amount IS NOT NULL THEN
      v_expected := LEAST(v_expected, pg_catalog.round(v_code.maximum_discount_amount, 0));
    END IF;
  ELSE
    v_expected := pg_catalog.round(v_code.discount_value, 0);
  END IF;
  v_expected := GREATEST(0, LEAST(v_expected, pg_catalog.round(v_order.subtotal, 0)));

  IF pg_catalog.abs(v_order.discount_amount - v_expected) > 1 THEN
    RAISE EXCEPTION 'discount_amount_mismatch'
      USING DETAIL = pg_catalog.format('applied=%s expected=%s subtotal=%s',
        v_order.discount_amount, v_expected, v_order.subtotal);
  END IF;

  -- Record usage (ON CONFLICT is belt-and-suspenders; on a fresh order it inserts).
  INSERT INTO public.discount_code_usage (discount_code_id, customer_email, order_id, discount_amount, used_at)
  VALUES (v_code.id, v_norm_email, v_order.id, v_order.discount_amount, v_now)
  ON CONFLICT (discount_code_id, order_id) WHERE order_id IS NOT NULL DO NOTHING
  RETURNING discount_code_usage.id INTO v_inserted_id;

  IF v_inserted_id IS NOT NULL THEN
    UPDATE public.discount_codes SET usage_count = COALESCE(usage_count, 0) + 1, updated_at = v_now
    WHERE discount_codes.id = v_code.id
      AND (discount_codes.usage_limit IS NULL OR COALESCE(discount_codes.usage_count, 0) < discount_codes.usage_limit);
    UPDATE public.orders SET discount_code_id = v_code.id
    WHERE orders.id = v_order.id AND orders.discount_code_id IS NULL;
  END IF;

  RETURN QUERY SELECT
    v_order.id, v_order.order_number, v_order.tracking_token, v_order.subtotal,
    v_order.shipping_fee, v_order.discount_amount, v_order.tax_amount, v_order.total,
    v_order.customer_id, v_order.customer_email, v_order.customer_name, v_order.customer_phone,
    v_order.payment_status, v_order.shipping_status, v_order.payment_method, v_order.shipping_address,
    v_order.merchant_id, v_order.tax_basis, v_order.gift_wrapping_fee, v_order.idempotency_replayed;
END;
$$;

REVOKE ALL ON FUNCTION public.create_storefront_order_with_discount_code(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text, text, jsonb,
  text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_storefront_order_with_discount_code(
  uuid, text, text, jsonb, text, numeric, numeric, numeric, text, text, text, jsonb,
  text, text, jsonb, uuid, text, text, uuid, text, numeric, numeric, text, text, uuid)
  TO anon, authenticated, service_role;
```

> **Grant rationale (keep anon):** discount codes apply to anon guest checkout, and calling via service role would null `auth.uid()` inside `create_storefront_order` and break user linkage / trip `cannot_set_user_id_anonymously`. Because the RPC now self-polices eligibility + exact amount + all limits in-DB, anon grant is safe — matching the base RPC.

- [ ] **Step 4: Apply to a Supabase dev branch (NOT prod) via `mcp__supabase__apply_migration`; verify objects** with `execute_sql`: the redemption function exists; `discount_codes_usage_count_within_limit` exists; `unique_customer_code` is GONE; `idx_orders_discount_code_id`, `uq_discount_code_usage_code_order`, and `idx_discount_code_usage_code_lower_email` exist; `orders.discount_code_id` exists; `usage_count`/`applies_to` are now `NOT NULL`; the usage FK `discount_code_usage_discount_code_id_fkey` is now `ON DELETE RESTRICT`; function + trigger `prevent_used_discount_code_identity_mutation` exist; `get_storefront_discount_code` returns the 4 new columns.

- [ ] **Step 5: Behavior probes (seed merchant + product + a `SAVE10` 10% code), each asserting the documented outcome:**
  1. Happy path → order created; `usage_count=1`; one usage row; `orders.discount_code_id` set.
  2. **Idempotent replay** (same `p_checkout_idempotency_key` + hash) → `usage_count` still 1; one usage row; returned `idempotency_replayed=true`; **NOT rejected** even with `usage_limit_per_customer=1` (P1b).
  3. `usage_limit_reached` (limit 1, fresh key) → raises; no order persists.
  4. Concurrent last-slot (two parallel, limit 1) → exactly one succeeds, other raises `usage_limit_reached`, no orphan/stock leak.
  5. `per_customer_limit_reached` with **`usage_limit_per_customer=2`** (P2-unique): the same email completes TWO distinct orders successfully (no `23505` — confirms `unique_customer_code` is dropped), and a THIRD raises `per_customer_limit_reached`.
  6. `code_expired` / `code_inactive` / `minimum_purchase_not_met` → raise + full rollback.
  7. **Under-applied** (`p_discount_amount=0` for a 10% code) → `discount_amount_mismatch`, no quota burned (P1a).
  8. **Over-claim** (inflated amount) → `discount_amount_mismatch`.
  9. **Ineligible targeted cart** (`specific_products` code, cart has none) → `discount_code_not_eligible`, rollback (P1a).
  10. **Retry after deactivation** (P2-replay): redeem with key K; set the code `is_active=false`; call the wrapper again with key K → returns `idempotency_replayed=true`, no error, `usage_count` unchanged.
  11. **Null columns** (P2-null): on a branch seeded BEFORE this migration's normalization (or via a direct `UPDATE … SET usage_count=NULL, applies_to=NULL` on a fresh test row), confirm the migration backfills them to `0`/`'all'`; then a redemption increments `usage_count` to 1 (not NULL) and treats the code as `applies_to='all'` (not the category branch).
  12. **Rounding parity** (P3-rounding): subtotal `5005` + 10% code yields `501` in `computeDiscountAmountForSubtotal`, the validate endpoint, the route's `p_discount_amount`, and the SQL wrapper's `v_expected`; capped percentage and fixed amount both round the cap/value before clamping.
  13. **DB-enforced used-code invariant** (P2-db-invariant): after redeeming a code, a direct `UPDATE discount_codes SET code='NEW' WHERE id=…` raises `discount_code_rename_not_allowed`; a direct `DELETE FROM discount_codes WHERE id=…` raises `discount_code_delete_not_allowed`; editing only `discount_value`/`maximum_discount_amount`/`is_active`/window/targeting succeeds; deleting an UNUSED code still works. Also verify the trigger treats `orders.discount_code_id` as usage evidence even if a fixture manually zeroes `usage_count` and removes usage rows.
  14. **Subtotal-base parity with assurance** (P3-subtotal-parity): a cart that includes `assurance_fee` on a line item + a 10% code → the route's `computeCanonicalOrderSubtotal`-derived `p_discount_amount` and the wrapper's `v_expected` (from `v_order.subtotal`) agree within ±1 and the order succeeds. This locks in that BOTH bases include assurance (verified: `canonical-order-subtotal.ts:155` adds `assuranceFee`; `create_storefront_order` `v_subtotal` = `SUM(price*qty + assurance_fee)`), so a future change to either can't silently start rejecting assurance carts as `discount_amount_mismatch`.
  Record probe SQL + output in the PR (the repo has no pgTAP harness).

- [ ] **Step 6: Commit** `feat(db): add self-policing discount-code redemption RPC + extend storefront lookup`.

---

## Task 5: Orders route — resolve, compute, dispatch, idempotency identity, error mapping

**Files:** Modify `apps/web/src/app/api/orders/route.ts`, `apps/web/src/schemas/storefront-discount.ts`, `apps/web/src/lib/checkout/order-idempotency.ts`; tests `route.test.ts`, `order-idempotency.test.ts`.

- [ ] **Step 1: Extend the row schema + idempotency payload (write failing tests first)**

`storefrontDiscountCodeRowSchema` (in `apps/web/src/schemas/storefront-discount.ts`) — add the new RPC columns so the expanded lookup contract is typed consistently. The route intentionally does **not** gate on targeting, but tests should prove these columns parse cleanly. The RPC already `COALESCE`s these (Task 4 Step 2), but keep the arrays null-tolerant for defense (P3 — `.default()` only fills `undefined`, not `null`):
```ts
  applies_to: z.enum(['all', 'specific_products', 'specific_categories']).catch('all'),
  product_ids: z.array(z.string()).nullish().transform((v) => v ?? []),
  category_ids: z.array(z.string()).nullish().transform((v) => v ?? []),
  usage_limit_per_customer: z.coerce.number().nullable(),
```
`storefrontDiscountValidateSchema` — add optional `product_ids` and `category_ids` arrays matching the shared schema. In `apps/web/src/app/api/storefront/discount/validate/route.ts`, use those arrays for **UX-only** targeting preflight: if `applies_to='specific_products'` and `product_ids` is present/non-empty with no intersection, return `{ valid:false }`; if `applies_to='specific_categories'` and `category_ids` is present/non-empty with no intersection, return `{ valid:false }`. If the arrays are absent, skip the preflight so older clients are not broken; the order RPC still enforces targeting authoritatively for fresh orders.

`order-idempotency.ts` (P1b): add `discount_code?: string | null` to `OrderIdempotencyPayloadInput` and include `discount_code: normalizeText(input.discount_code) || null` in `buildOrderIdempotencyPayload`. Add an `order-idempotency.test.ts` case asserting two payloads identical except `discount_code` hash to DIFFERENT values.

- [ ] **Step 2: Write the failing route tests** in `apps/web/src/app/api/orders/route.test.ts` (extend the existing savings/voucher-style RPC mocks: capture `supabase.rpc` name + args, return `get_storefront_discount_code`, and mock `computeCanonicalOrderSubtotal`):
  - valid `discount_code` → dispatches `create_storefront_order_with_discount_code` with `p_discount_code_id` set and `p_discount_amount===500`;
  - raw `discount_amount!=0` (no code) → still `discount_amount_not_supported` 400;
  - unknown code → 400 `discount_code_invalid`;
  - fresh `applies_to='specific_products'` code with no matching cart item → the WRAPPER raises `discount_code_not_eligible`, route maps to 400 (no route-side gate — assert the rpc is dispatched and the error is mapped);
  - code + savings → `DISCOUNT_CODE_SAVINGS_COMBINATION_UNSUPPORTED` 400; code + voucher item → unsupported 400;
  - RPC error `usage_limit_reached` → 409; `discount_amount_mismatch` → 400;
  - **(P1)** price-negotiation-entitled merchant (`hasPriceNegotiationEntitlement` mocked true) + valid code + net `expected_total` → succeeds, dispatches `create_storefront_order_with_discount_code` (NOT rejected as negotiation, `serverDerivedDiscountAmount` stays 0);
  - **(P2-replay)** retry after deactivation: `get_storefront_discount_code(..., p_include_inactive: true)` returns the now-inactive row and the wrapper returns `idempotency_replayed: true` → route returns the existing order 200, NOT `discount_code_invalid`.
  - **(P2-code-edit)** retry after the merchant edits the code's value/cap: same idempotency key + same cart + same code → the hash is identical (amount excluded) → wrapper returns the replayed order 200, NOT `CHECKOUT_IDEMPOTENCY_CONFLICT`.
  - **(P2-targeting-edit)** retry after the merchant edits the code's targeting to exclude the original product: same key + same cart → route does NOT gate eligibility → wrapper returns `idempotency_replayed: true` → 200, NOT `discount_code_not_eligible`.

- [ ] **Step 3: Run** `-t "discount code path"` → FAIL.

- [ ] **Step 4: Implement the route changes**

(a) Keep the raw-amount rejection at L1168.

(b) **P1 fix — detect the code early and suppress auto-negotiation.** Right after the raw-amount rejection (~L1176) add `const requestedDiscountCode = typeof body.discount_code === 'string' && body.discount_code.trim().length > 0 ? body.discount_code.trim() : null;`. Then guard the auto-negotiation derivation at L1251 with `&& !requestedDiscountCode` so a code-bearing net `expected_total` is NOT misread as a negotiated discount (`serverDerivedDiscountAmount` stays 0 → the negotiation/code conflict guard below never falsely fires; if a client tries to combine both, the inner RPC's `order_total_mismatch` parity guard fail-closes).

(c) **P2a fix — move the savings boolean up.** Relocate `const requestedSavingsRedemption = …` (currently L1360) and `savingsRedemptionIdempotencyKey` to BEFORE the `checkoutRequestHash` block (L1347).

(d) Insert the resolve + amount block **before** `checkoutRequestHash` (so the hash reflects the discount) and after `serverDerivedDiscountAmount`/`hasVoucherItem`/`requestedSavingsRedemption` are all in scope:
```ts
let discountCodeId: string | null = null;
let discountCodeAmount = 0;

if (requestedDiscountCode) {
  if (hasVoucherItem) {
    return NextResponse.json({ code: 'DISCOUNT_CODE_VOUCHER_COMBINATION_UNSUPPORTED', error: 'Failed to create order' }, { status: 400 });
  }
  if (requestedSavingsRedemption) {
    return NextResponse.json({ code: 'DISCOUNT_CODE_SAVINGS_COMBINATION_UNSUPPORTED', error: 'Failed to create order' }, { status: 400 });
  }

  // include_inactive=true (P2-replay): resolve even a deactivated code so a
  // retry can reach the replay-aware wrapper. The wrapper decides replay vs
  // a fresh `code_inactive` rejection — the route never fast-fails on inactive.
  const { data: codeRows } = await supabase.rpc('get_storefront_discount_code', {
    p_merchant_id: merchant_id, p_code: requestedDiscountCode, p_include_inactive: true,
  });
  // Narrowed parse (P2a) — mirror the validate route's style.
  const parsedArray = storefrontDiscountCodeRowSchema.array().safeParse(codeRows);
  const parsedSingle = parsedArray.success ? null : storefrontDiscountCodeRowSchema.safeParse(codeRows);
  const row = parsedArray.success ? (parsedArray.data[0] ?? null) : (parsedSingle?.success ? parsedSingle.data : null);
  if (!row) {
    return NextResponse.json({ code: 'discount_code_invalid', error: 'Invalid discount code' }, { status: 400 });
  }
  discountCodeId = row.id;

  // NOTE: the route does NOT fast-fail on targeting (applies_to/product_ids/
  // category_ids). Eligibility is enforced AUTHORITATIVELY and replay-safely in the
  // wrapper RPC (P1a): on a fresh order it raises `discount_code_not_eligible`
  // (rollback); on a replay it returns the existing order before checking. A
  // route-side gate would wrongly reject a legitimate retry of an order whose code
  // targeting was edited after checkout (P2-targeting-edit).

  const canonicalSubtotal = await computeCanonicalOrderSubtotal({ items: orderItemsPayload, merchantId: merchant_id, supabase });
  if (canonicalSubtotal == null) {
    return NextResponse.json({ error: 'Failed to create order', details: 'invalid_items' }, { status: 400 });
  }
  discountCodeAmount = computeDiscountAmountForSubtotal(
    { discount_type: row.discount_type === 'fixed_amount' ? 'fixed' : 'percentage',
      discount_value: Number(row.discount_value), maximum_discount_amount: row.maximum_discount_amount },
    canonicalSubtotal
  );
}
```
Imports: `computeDiscountAmountForSubtotal` from `@/lib/checkout/discount-amount`; `storefrontDiscountCodeRowSchema` from `@/schemas/storefront-discount`.

(e) **Idempotency hash uses STABLE code identity, NOT the mutable amount** (P1b + P2-code-edit): in the `checkoutRequestHash` payload (L1351) pass `discount_code: requestedDiscountCode` and `discount_amount: discountCodeId ? 0 : serverDerivedDiscountAmount`. The recomputed `discountCodeAmount` MUST NOT enter the hash — a merchant editing the code's value/cap/targeting between a checkout and its retry would otherwise change the hash and trip `checkout_idempotency_conflict` before the wrapper's replay path runs. Code identity (`discount_code`) + cart (`items`, already hashed) fully key the request; the amount is derived and so is excluded. (Non-code orders keep `serverDerivedDiscountAmount`, which is stable across retries since it derives from the client's `expected_total`.)

(f) Dispatch (L1445):
```ts
const orderCreateRpcName = requestedSavingsRedemption ? 'create_storefront_order_with_savings'
  : hasVoucherItem ? 'create_storefront_order_with_quiz_voucher'
  : discountCodeId ? 'create_storefront_order_with_discount_code'
  : 'create_storefront_order';
```
When `discountCodeId` is set, call `supabase.rpc(orderCreateRpcName, { ...orderRpcArgs, p_discount_amount: discountCodeAmount, p_discount_code_id: discountCodeId })`.

(g) Error mapping (L1508): add a branch BEFORE the generic block returning **409** for `usage_limit_reached` / `per_customer_limit_reached`; add to `clientErrorCodes` (→400): `discount_code_required`, `discount_code_not_found`, `discount_code_invalid`, `discount_code_not_eligible`, `code_inactive`, `code_not_started`, `code_expired`, `minimum_purchase_not_met`, `discount_amount_mismatch`. Leave `discount_order_creation_failed` on the generic 500 path; it means the wrapper's base-order call violated an internal invariant, not that the shopper sent bad input.

- [ ] **Step 5: Run** the new tests + the whole `route.test.ts` + `order-idempotency.test.ts` → PASS.
- [ ] **Step 6: Commit** `feat(web): apply self-policed discount codes during order creation`.

---

## Task 6: Web checkout wiring (forward code + VAT-aware totals)

**Files:** Modify `apps/web/src/app/checkout/page.tsx`; `apps/web/src/components/storefront/ogabassey/pages/checkout/handlers/place-order.ts` (+ summary/state); extend `discount-code-input.test.tsx`.

- [ ] **Step 1: Failing tests** — Legacy checkout: assert the `/api/orders` POST body includes `discount_code` when `appliedDiscount` exists, does **not** include a non-zero `discount_amount`, and does **not** invent `expected_total` because that flow has no VAT-aware total object today; assert the displayed discount amount comes from the validate response's `discount_amount` (not local type/value recomputation). `DiscountCodeInput`/validate tests: assert the validate POST includes `product_ids` (and `category_ids` when present on cart items), `onApply` receives `discount_amount`, and an ineligible targeted response is shown without applying a discount. Ogabassey checkout: assert `discount_code` is included and `expected_total === subtotal + shipping + gift + tax − discountAmount` because that flow already uses calculate-commerce totals.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — Legacy `checkout/page.tsx` POST (~L1201): add `...(appliedDiscount ? { discount_code: appliedDiscount.code } : {})`; do not send `discount_amount`, and do not add `expected_total` in the legacy flow. Extend the checkout/`DiscountCodeInput` `DiscountResult` shape with `discount_amount: number` (or use the shared response type) and replace the local percentage/fixed recomputation with `const discountAmount = appliedDiscount?.discount_amount ?? 0` so max caps and rounding match the validate route. The route/wrapper computes and validates the code discount from the canonical subtotal, and the payment flow must use the returned `order.total`.

  Update `DiscountCodeInput` props to accept optional `productIds` / `categoryIds` and include them in `/api/storefront/discount/validate` requests. Derive product IDs explicitly from the checkout item shape: legacy `CartItem` extends `Product`, so `item.id` is the product ID; Ogabassey/resumed items should prefer `item.product_id ?? item.id`. Never send `cartItemId` or `variantId` as a targeted-code product ID. For category IDs, send only known product category IDs from the item shape; if a flow lacks category data, omit `categoryIds` so UX preflight is skipped and the RPC remains the authority.

  Ogabassey: add applied-discount state to `apps/web/src/components/storefront/ogabassey/pages/checkout-page.tsx`, render `DiscountCodeInput` in the checkout summary/contact area, show a discount row in `OrderSummarySidebar.tsx`, and pass `{ code, amount }` into both the inline `/api/orders` body and `checkout/handlers/place-order.ts`. Keep `use-order-totals.ts` unchanged for tax: it must calculate VAT from the pre-discount taxable subtotal + shipping. Derive a separate payable snapshot:
  ```ts
  const discountAmount = appliedDiscount?.discount_amount ?? 0;
  const grossTotal =
    checkoutCartTotal + deliveryCost + giftWrappingCost + (orderTotals?.taxAmount ?? 0);
  const payableTotal = Math.max(0, grossTotal - discountAmount);
  ```
  Use `payableTotal` for displayed total, pre-order wallet math, `expected_total`, and `client_total`; include `discount_code: appliedDiscount.code` when set. After `/api/orders` returns, continue using the server-returned `amountDueToGateway` / `order.total` for payment initialization. This keeps the RPC parity formula `subtotal + shipping + gift + tax - discount` exact without treating discounts as pre-tax.
- [ ] **Step 4: Run** `src/components/storefront/checkout` → PASS.
- [ ] **Step 5: Commit** `feat(web): forward applied discount code at checkout`.

---

## Task 7: Mobile-storefront (schema, payload, service, component, submit + BNPL wiring)

**Files (P2c — full wiring, not just leaf files):**
- `apps/mobile-storefront/services/orders.schemas.ts` — add `discount_code` to `CreateOrderRequestSchema` (after L41).
- `apps/mobile-storefront/services/orders.payload.ts` — **the ACTIVE payload** (`orders.ts:15` imports `buildOrderPayload` from here). Add `discount_code` when set; stop forwarding request-derived `discount_amount` for code checkout (hard-code `discount_amount: 0` or omit it; tests must prove a stale `request.discount_amount` does not send a non-zero amount). Add a new `orders.payload.test.ts`.
- `apps/mobile-storefront/services/order-payload.ts` + `order-payload.test.ts` — **stale duplicate** (`buildMobileOrderPayload`, imported only by its own test, NOT by `orders.ts`). First run `rg -n "order-payload|buildMobileOrderPayload" apps/mobile-storefront` and confirm only the stale module + its test match, then delete both so the implementation cannot accidentally test the wrong payload path.
- `apps/mobile-storefront/services/discount.ts` (+ `.test.ts`) — `validateDiscountCode({merchantId,code,cartTotal,productIds,categoryIds})` → POST `/api/storefront/discount/validate`, parse with `@baci/shared`'s `StorefrontDiscountValidateResponseSchema`.
- `apps/mobile-storefront/components/checkout/DiscountCodeInput.tsx` (+ `.test.tsx`) — RN apply/remove UX.
- `apps/mobile-storefront/components/checkout/CheckoutScreenView.tsx` — render `DiscountCodeInput`, hold applied-discount state, surface it in the order summary/totals, and enforce the scope rule: applying a discount clears/disables savings-credit selection, while wallet credit remains allowed.
- `apps/mobile-storefront/components/checkout/checkout-order-builders.ts` — thread the discount into BOTH `buildCheckoutOrderRequest` (add `discount_code` to the order body) and `createCheckoutSnapshot` (subtract the discount from displayed totals).
- `apps/mobile-storefront/components/checkout/use-checkout-submit.ts` — add the applied discount to `UseCheckoutSubmitParams`, pass it into `createCheckoutSnapshot` and `buildCheckoutOrderRequest`, and do not build savings order fields when a discount is applied (route rejects the combination; wallet fields are still allowed).
- `apps/mobile-storefront/components/checkout/checkout-bnpl-submit.ts` — thread both `discount_code` and `discountAmount` through the BNPL path (replace the current fingerprint `discountAmount: 0`), and keep savings fields out of the BNPL order request when a discount is applied.
- `apps/mobile-storefront/lib/checkout-order-idempotency.ts` (+ test) — **mandatory (P3-mobile)**: the fingerprint already hashes `discountAmount` but no code identity, so equal-amount codes collide. Add `discountCode?: string | null` to `MobileCheckoutIdempotencyInput`, include a normalized `discountCode` in the fingerprint, and thread `{ discountCode, discountAmount }` from `use-checkout-submit.ts` into BOTH the normal idempotency-state build and `checkout-bnpl-submit.ts`.

- [ ] **Step 1: Failing tests** — `services/discount.test.ts` (POST + parse, including `product_ids` from cart items); a payload test on the ACTIVE module (`orders.payload.test.ts`) asserting `discount_code` is present only when set and `discount_amount` is omitted or exactly 0 even if `request.discount_amount` is stale/non-zero; a `use-checkout-submit`/builder test asserting the code flows into both the normal and BNPL order requests and into the snapshot total; a mobile checkout test proving applying a discount suppresses savings fields but still allows wallet fields; and a **`checkout-order-idempotency.test.ts`** case asserting two fingerprints identical except `discountCode` (same `discountAmount`) hash to DIFFERENT values (P3-mobile equal-amount code swap).
- [ ] **Step 2: Run** the jest files → FAIL (module missing).
- [ ] **Step 3: Implement** the files above. `services/discount.ts`:
```ts
import { StorefrontDiscountValidateResponseSchema, type StorefrontDiscountValidateResponse } from '@baci/shared';
import { resolveApiBaseUrl } from '@/lib/api-url'; // exported from lib/api-url.ts (NOT services/orders.ts)

export async function validateDiscountCode(input: { merchantId: string; code: string; cartTotal: number; productIds?: string[]; categoryIds?: string[]; }): Promise<StorefrontDiscountValidateResponse> {
  const res = await fetch(`${resolveApiBaseUrl()}/api/storefront/discount/validate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchant_id: input.merchantId, code: input.code.trim().toUpperCase(), cart_total: input.cartTotal,
      ...(input.productIds?.length ? { product_ids: input.productIds } : {}),
      ...(input.categoryIds?.length ? { category_ids: input.categoryIds } : {}),
    }),
  });
  return StorefrontDiscountValidateResponseSchema.parse(await res.json());
}
```
`orders.schemas.ts`: `discount_code: z.string().trim().min(1).max(50).optional(),`. `orders.payload.ts`: `discount_amount: 0` (or omit the field) plus `...(request.discount_code ? { discount_code: request.discount_code } : {})`; do not forward a request-derived discount amount for code checkout.
- [ ] **Step 4: Run** the jest files → PASS.
- [ ] **Step 5: Commit** `feat(mobile): add discount-code entry + checkout/BNPL wiring`.

---

## Task 8: Preserve USED discount codes — no hard delete, no rename (replay + audit safety, P2-replay-delete + P2-rename)

**Why:** a used code's identity must stay resolvable so an in-flight checkout can retry/replay, and so usage history is auditable. Two current behaviors break that: (1) the usage FK is `ON DELETE CASCADE` (baseline.sql:13082) and the admin delete hard-deletes (`actions.ts:233`) — deleting a used code wipes its `discount_code_usage` rows and nulls `orders.discount_code_id`; (2) the update paths (`actions.ts:131`, PATCH `[id]/route.ts:113`, mobile `useDiscounts`) allow changing the `code` string — renaming a used code means a customer's retry (which sends the original string) no longer resolves. Fix: a used code can be deactivated and have its value/cap/targeting/window edited, but it can be **neither hard-deleted nor renamed**.

**Files:** `apps/web/src/app/dashboard/marketing/discount-codes/actions.ts` (`deleteDiscountCode` + `upsertDiscountCode`/update); `apps/web/src/app/api/discount-codes/[id]/route.ts` (DELETE + PATCH); `apps/mobile-admin/hooks/useDiscounts.ts` (delete + update mutations). Add colocated tests for the changed web action/route behavior and a mobile hook test for direct Supabase update/delete guards.

- [ ] **Step 1: Failing tests** — (a) deleting a code with usage (`usage_count > 0`, any `discount_code_usage` row, or any `orders.discount_code_id` link) sets `is_active=false`, KEEPS the row (`{ deactivated: true }`); deleting an unused code removes it. (b) PATCH/update that changes `code` on a used code → rejected (e.g. 409 `discount_code_rename_not_allowed`); the same PATCH changing only value/cap/`is_active` → succeeds; renaming an UNUSED code → succeeds.
- [ ] **Step 2: Run** the web action/route tests → FAIL.
- [ ] **Step 3: Implement** — a small shared `discountCodeHasUsage(supabase, id, merchantId)` helper that checks ALL durable signals, not either/or: read the scoped code row's `usage_count`, run a head/count query on `discount_code_usage.eq('discount_code_id', id)`, and run a head/count query on `orders.eq('discount_code_id', id).eq('merchant_id', merchantId)`. Treat the code as used when `(usage_count ?? 0) > 0 || usageRowCount > 0 || linkedOrderCount > 0`; if any usage-signal query errors, fail closed by treating the code as used and surface a logged warning/error rather than hard-deleting. DELETE paths: if used → `update({ is_active: false })` scoped by `merchant_id`, return a "deactivated" result; else the existing hard `delete()`. UPDATE/PATCH paths: if the payload changes `code` AND the code is used → reject with `discount_code_rename_not_allowed`; otherwise apply the update normally. Keep the `merchant_id` ownership scope on every branch. Surface the "deactivated / rename blocked — create a new code" copy in admin UI.
- [ ] **Step 4: Run** → PASS. The invariant is ALSO enforced in the DB (Task 4 Step 1: usage FK `ON DELETE RESTRICT` + the `prevent_used_discount_code_identity_mutation` trigger), so mobile-admin's direct Supabase writes and stale clients can't bypass it (P2-db-invariant). This app-layer task provides the clean UX (soft-deactivate + friendly error copy) on top of that backstop; both the DELETE and PATCH paths should surface the DB's `discount_code_delete_not_allowed` / `discount_code_rename_not_allowed` errors gracefully if they ever fire.
- [ ] **Step 5: Commit** `feat(admin): preserve used discount codes (deactivate not delete; block rename)`.

---

## Final verification
- [ ] `pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test` green (delete `*.tsbuildinfo` first).
- [ ] Web E2E on the migrated branch: apply a valid % code → total drops; usage row written; `orders.discount_code_id` set; `usage_count` +1; resubmit same idempotency key → no double count and NOT rejected.
- [ ] Negative paths return correct status: expired/inactive (400), usage-exhausted/per-customer (409), below-minimum (400), ineligible targeted cart (400), under-applied/over-claim `discount_amount_mismatch` (400), raw `discount_amount` injection (400).
- [ ] Targeted-code UX: apply-code validation rejects a clearly ineligible `specific_products` cart when `product_ids` are supplied; omitting the arrays still reaches the order RPC, which rejects fresh ineligible orders and replays old eligible orders safely.
- [ ] Two different codes with equal amounts under the same idempotency key → `CHECKOUT_IDEMPOTENCY_CONFLICT` (409), not a silent cross-code replay.
- [ ] 100%-discount code → order total 0, gateway init skipped (existing `amountDueToGateway <= 0` path, route.ts ~L1700).
- [ ] Mobile: enter a code on both the normal and a BNPL payment path → reduced total, order created via `/api/orders`; two equal-amount codes produce different mobile idempotency fingerprints; savings-credit fields are absent when a code is applied, while wallet-credit fields still work.
- [ ] Admin: deleting a USED code deactivates it (row + usage preserved, `is_active=false`); deleting an unused code removes it; renaming a USED code is rejected (`discount_code_rename_not_allowed`) while editing its value/cap/targeting/`is_active` succeeds. A retry of an order whose code was just deactivated OR had its value/cap/targeting edited still replays (200).
- [ ] `coderabbit review --prompt-only -t uncommitted` → fix critical/high before PR.

## Out of scope (follow-ups)
Referral program; per-line proration for targeted codes; discount **+ savings** stacking; pre-tax discount semantics; per-customer abuse keying by customer_id/user_id; merchant reporting surface for `discount_code_usage` / `orders.discount_code_id`.

**Known Phase-1 trade-off (operational, not a bug):** the wrapper holds `FOR UPDATE` on the `discount_codes` row across the entire `create_storefront_order` call (stock decrement + inserts), so all redemptions of one code serialize. Correct under contention (last-slot races resolve safely) but a throughput ceiling for a single flash-sale code. If that becomes a bottleneck, a follow-up can split into a short pre-claim lock + post-creation reconciliation; out of scope here.

## Self-review / review-response notes
- **P1a** → eligibility + two-sided exact-amount validation moved INTO the RPC, checked against the created order's items + DB subtotal; `discount_amount=0` quota-burn now raises `discount_amount_mismatch`. Probes 7-9 cover it.
- **P1b** → RPC is replay-first: it calls `create_storefront_order`, and on `idempotency_replayed` returns immediately before ANY quota check or usage write. The web idempotency hash now includes `discount_code` so equal-amount codes don't collide. Probe 2 + the conflict E2E cover it.
- **P2a** → savings boolean relocated above the hash block; the discount block compiles in order; parsing uses the narrowed `parsedArray.success ? … : …` style.
- **P2b** → extending `get_storefront_discount_code` to return `applies_to`/`product_ids`/`category_ids`/`usage_limit_per_customer` is a mandatory migration step (Task 4 Step 2); no anon SELECT on `discount_codes`.
- **P2c** → Task 7 enumerates `CheckoutScreenView`, `checkout-order-builders` (request + snapshot), `use-checkout-submit` params, and `checkout-bnpl-submit`, with tests on both submit paths, the totals snapshot, and the discount+savings mutual-exclusion UX (wallet remains allowed).
- **P3** → preflight `UPDATE … clamp` guarantees clean data, then a normal (validated) CHECK; no misuse of `NOT VALID`.
- **P1-negotiation** → `requestedDiscountCode` is detected right after the raw-amount rejection; the auto-negotiation derivation at L1251 is guarded with `&& !requestedDiscountCode` so `serverDerivedDiscountAmount` stays 0 for code orders. New route test covers an entitled merchant + valid code + net `expected_total`.
- **P2-compile** → SUPERSEDED by P2-targeting-edit (v9): the route does no eligibility check at all now, so there's nothing to mis-type. The RPC is the sole eligibility authority.
- **P2-replay** → `get_storefront_discount_code(p_include_inactive => true)` lets the order route resolve a deactivated code; the route never fast-fails on inactive; the wrapper returns the replayed order or raises `code_inactive` on a fresh attempt. New retry-after-deactivation route test.
- **P3-nullable** → SQL `COALESCE(applies_to/product_ids/category_ids)` in the lookup RPC + the redemption RPC's eligibility; Zod arrays use `.nullish().transform(v => v ?? [])`.
- **P2-null** → migration backfills + hardens `usage_count`/`applies_to` to `NOT NULL DEFAULT`; the wrapper still `COALESCE`s both (quota check, increment, eligibility branch) as defense. Probe #11 covers it.
- **P3-mobile** → `MobileCheckoutIdempotencyInput` gains `discountCode`, included in the fingerprint with `discountAmount` and threaded through the normal + BNPL paths; a `checkout-order-idempotency.test.ts` case proves equal-amount code swaps differ.
- **P2-unique** → migration drops baseline `unique_customer_code UNIQUE (discount_code_id, customer_email)`; per-customer is enforced by the wrapper's count check under the lock, so `usage_limit_per_customer>1` works without a `23505`. Probe #5 uses limit 2.
- **P3-fk-index** → `idx_orders_discount_code_id` added for the new `orders.discount_code_id` FK (repo rule).
- **P3-apiurl** → mobile `discount.ts` imports `resolveApiBaseUrl` from `@/lib/api-url` (verified export), not `services/orders.ts`.
- **P2-compile-id** → SUPERSEDED by P2-targeting-edit (v9): route eligibility removed entirely; no `product_id`/`productId`/`id` access remains in the route discount block.
- **P2-replay-delete** → Task 8 deactivates used codes instead of hard-deleting, and Task 4 changes the usage FK to `ON DELETE RESTRICT` plus a DB trigger that raises `discount_code_delete_not_allowed`. Usage rows + the `orders.discount_code_id` link are preserved so a retry resolves via `p_include_inactive`.
- **P3-conrelid** → the CHECK-constraint guard matches `conname` AND `conrelid = 'public.discount_codes'::regclass`.
- **P2-code-edit** → the idempotency hash for code orders carries `discount_code` identity and `discount_amount: 0` (excludes the recomputed amount), so post-checkout edits to the code don't break replay. Route test covers retry-after-edit.
- **P2-rename** → Task 8 rejects changing a used code's `code` string (`discount_code_rename_not_allowed`); other fields stay editable. The retry's original string therefore always resolves.
- **P2-targeting-edit** → route eligibility fast-fail removed; the RPC enforces eligibility (fresh) and skips it (replay), so a targeting edit can't reject a retry. `cartHasEligibleItem` dropped from Task 2 (now dead). Route + probe tests cover it.
- **P2-db-invariant** → used-code invariant moved into the DB (Task 4): usage FK `ON DELETE RESTRICT` + `prevent_used_discount_code_identity_mutation` trigger checking usage rows, `orders.discount_code_id`, and `usage_count`. App-layer Task 8 stays for UX (soft-deactivate + friendly errors). Closes the mobile-admin direct-write / stale-client gap. Probe #13.
- **P2-mobile-module** → mobile payload changes + test target the ACTIVE `orders.payload.ts` (imported by `orders.ts:15`); the stale `order-payload.ts` + its test are deleted.
- **P3-index** → per-customer lookup is backed by the expression index `(discount_code_id, lower(customer_email))`.
- **P3-schema** → shared validate response schema is a strict success/failure union; mobile cannot parse `{ valid: true }` without `discount_code_id`, type, value, and amount.
- **P3-targeted-ux** → validate endpoints accept optional `product_ids`/`category_ids` for non-authoritative targeting preflight. Missing arrays skip preflight for older clients; the order RPC remains the only enforcement boundary.
- **P3-rounding** → the TS helper, validate endpoint, route-dispatched `p_discount_amount`, and SQL wrapper all use whole-unit rounding for percentage, fixed value, maximum cap, and subtotal clamp; probe #12 covers a 5005/10% edge.
- **P3-sql-standards** → the wrapper SQL uses explicit projections for both `discount_codes` and `create_storefront_order(...)` output (no `SELECT *`), and the expanded `SECURITY DEFINER` lookup RPC uses `SET search_path = ''` with schema-qualified references.
- **P3-subtotal-parity** (re-review v13) → the two-sided ±1 amount check silently depends on the route's `computeCanonicalOrderSubtotal` and the RPC's `v_order.subtotal` sharing one base. VERIFIED both include `assurance_fee` (`canonical-order-subtotal.ts:155`; `create_storefront_order` `v_subtotal = SUM(price*qty + assurance_fee)` at the latest migration), so percentage codes on assurance carts are NOT wrongly rejected. Probe #14 locks this invariant in so a future edit to either subtotal can't regress it.
