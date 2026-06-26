# Mobile Admin Order Edit, Audit, and Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **On execution start:** create an isolated worktree or branch from current `main`. The root checkout was dirty when this plan was written. Do not implement this feature in the dirty root unless the owner explicitly asks for that.

**Goal:** Let mobile-admin users edit existing orders after creation, persist the edit atomically with an audit trail, and optionally notify the customer by email for customer-visible or financial changes.

**Architecture:** Add a dedicated authenticated order-edit API route in the web app instead of expanding the existing status-only `PATCH /api/orders/[id]` route. Persist the order header, line-item replacement, and audit event through one Supabase RPC transaction that runs as a narrowly checked `SECURITY DEFINER` function with `search_path = ''`, explicit `auth.uid()` and merchant/staff permission checks, and no service-role client in the user-facing path. Reuse the mobile-admin new-order form surface in edit mode, with a shared form controller contract and a separate submit/update hook.

**Tech Stack:** Next.js 16 App Router route handlers, TypeScript, Zod, Supabase Postgres/RLS/PLpgSQL, React Native/Expo mobile-admin, TanStack Query, ZeptoMail, Vitest.

**Scope decisions for v1:**
- Persisted edit support covers customer identity fields, shipping contact/address, notes, source/channel, branch, shipping fee, discount, tax, and line items.
- Existing status, shipment, payment-recording, ship-on-credit, and receipt flows remain in their current routes and UI.
- Financial edits and item replacement are allowed only before fulfillment and only when the order has no successful/completed transaction amount, no wallet credit applied, and no paid-like `payment_status` (`paid`, `partially_paid`, `bnpl_approved`, or `refunded`). Paid-order adjustments/refunds are a separate ledger feature.
- Non-financial customer/shipping/notes edits are allowed for non-cancelled, non-returned orders, including shipped/delivered, because those edits do not rewrite the payment ledger.
- Existing hidden financial components such as `gift_wrapping_fee` and `tax_basis` must be preserved and included in total calculations. The edit UI does not need to expose them in v1, and `tax_basis` must be read from the locked `orders` row instead of trusted from the edit payload.
- Customer email notification is opt-in via a "Notify customer" toggle and only sends when customer-visible or financial fields changed.
- Audit history is stored in a new `order_audit_events` table instead of overloading the existing generic `audit_logs`, because the existing table is own-user scoped and not shaped for merchant-visible order history.
- The order form product picker must not show dense SKU-combination rows for variant products. It should show the parent product first, then let the user tap attribute chips such as condition, color, RAM, and storage until one valid variant is resolved.
- The edit payload is a full replacement payload, not a sparse patch. Required fields must be present so omitted keys cannot accidentally clear `branch_id`, `customer_id`, totals, or address fields.
- Item replacement must validate every `product_id` and `variant_id` against the order merchant before inserting rows. A variant must belong to the submitted product.
- Item replacement must preserve item snapshot fields needed by current orders, including `image_url` and `variant_attributes`. In v1, block item replacement for orders that already have item-level fulfillment data, assurance flags, or other historical item state that cannot be safely reconstructed by a simple delete/reinsert. Existing serialized-inventory triggers remain the final guard for historical unit events.

**Known evidence from investigation:**
- Mobile order details currently expose share/status/payment/shipment actions, but no edit entry point.
- Mobile order creation writes directly to `orders` and `order_items`; edit must not repeat multi-write client persistence.
- `apps/web/src/app/api/orders/[id]/route.ts` is status/note/address oriented and should not become the full order-edit route.
- `order_items` has select/insert/update policies and no delete policy. Keep direct deletes closed; item replacement should happen only inside the checked RPC.
- `replace_order_items` exists but is service-role/import oriented; do not reuse it for mobile-admin user edits.
- `useOrderDetails` derives `amount_paid` from successful transactions plus wallet amount, but existing order flows can also set `payment_status` to paid-like states. Editing totals must be blocked from both signals in v1.
- Current mobile-admin variant picking already has a two-step state, but the second step renders every SKU combination as a long "Choose Variant" list. Dense products need a product-first variant selector instead.
- Serialized inventory is linked to `order_items.id`. `private.on_order_item_deleted()` releases temporary reservations and rejects historical serialized units/events, so the edit RPC must preflight obvious historical item state and the route must map serialized trigger rejections to a 409 edit-lock response.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `apps/web/src/schemas/admin-order-edit.ts` | Zod request schema, editability helpers, typed payload | Create |
| `apps/web/src/schemas/admin-order-edit.test.ts` | Schema and helper boundary tests | Create |
| `supabase/migrations/<generated>_mobile_admin_order_edit_audit.sql` | `order_audit_events`, read RLS policies, `product_variants` staff-aware select policy, checked `update_admin_order` RPC | Create with `supabase migration new mobile_admin_order_edit_audit` |
| `supabase/migrations/tests/admin_order_edit_audit.sql` | SQL regression test for RPC auth, paid/fulfilled financial lock, item replacement, and audit insert | Create |
| `apps/web/src/app/api/orders/[id]/edit/route.ts` | Auth-first protected order-edit endpoint | Create |
| `apps/web/src/app/api/orders/[id]/edit/route.test.ts` | Route auth, validation, permission, RPC, audit/email scheduling tests | Create |
| `apps/web/src/lib/email-templates.ts` | Order-updated HTML/text template exports | Modify |
| `apps/web/src/lib/email-templates.test.ts` | Template tests for changed fields and text fallback | Modify |
| `apps/web/src/lib/order-update-email.ts` | Build and send order-updated email with ZeptoMail audit context | Create |
| `apps/web/src/lib/order-update-email.test.ts` | Email helper tests | Create |
| `packages/shared/src/contracts/orders.ts` | Add edit-needed item columns to mobile detail query if missing | Modify |
| `packages/shared/src/contracts/orders.test.ts` | Contract regression for explicit order item columns | Create if no colocated test exists |
| `packages/shared/src/types/order.ts` | Add nullable/edit-required item snapshot fields returned to mobile | Modify |
| `apps/mobile-admin/hooks/orders/useUpdateOrder.ts` | Authenticated mobile mutation for `PATCH /api/orders/[id]/edit` | Create |
| `apps/mobile-admin/hooks/orders/useUpdateOrder.test.ts` | Mutation URL, auth, invalidation, error handling tests | Create |
| `apps/mobile-admin/hooks/orders/useOrderDetails.ts` | Select and map edit-required item snapshot fields into `items` | Modify |
| `apps/mobile-admin/hooks/orders/useOrderDetails.test.ts` | Regression for mapped variant/image/detail/product-match fields | Modify |
| `apps/mobile-admin/hooks/useEditOrderController.ts` | Prefill order detail into editable form state and submit update | Create |
| `apps/mobile-admin/hooks/useEditOrderController.test.ts` | Prefill, paid/fulfilled financial lock, payload, notify toggle tests | Create |
| `apps/mobile-admin/components/orders/order-details.types.ts` | Add edit-mode item fields to order detail item types | Modify |
| `apps/mobile-admin/components/orders/order-form-controller.types.ts` | Shared form controller interface used by new/edit screens | Create |
| `apps/mobile-admin/lib/product-variant-option-selector.ts` | Convert variant rows into tappable option groups and resolve the matching variant | Create |
| `apps/mobile-admin/lib/product-variant-option-selector.test.ts` | Option grouping, availability, ambiguous match, and fallback tests | Create |
| `apps/mobile-admin/lib/manual-order-line-item.ts` | Preserve selected variant attributes when adding product rows to order state | Modify |
| `apps/mobile-admin/lib/manual-order-line-item.test.ts` | Regression for variant attribute preservation on added order items | Modify |
| `apps/mobile-admin/lib/manual-order-persistence.ts` | Allow `variant_attributes` in manual order item insert rows | Modify |
| `apps/mobile-admin/lib/manual-order-persistence.test.ts` | Regression that item insert rows keep `variant_attributes` | Modify |
| `apps/mobile-admin/hooks/submitNewOrder.ts` | Persist selected variant attributes when creating manual orders | Modify |
| `apps/mobile-admin/hooks/submitNewOrder.test.ts` | Regression for `variant_attributes` in `buildItems()` output | Modify |
| `apps/mobile-admin/components/orders/ProductVariantOptionSelector.tsx` | Product-first variant selection UI for order forms | Create |
| `apps/mobile-admin/components/orders/ProductVariantOptionSelector.test.tsx` | Product card, chip tapping, disabled/enabled add button tests | Create |
| `apps/mobile-admin/components/orders/NewOrder*.tsx` | Replace narrow `ReturnType<typeof useNewOrderController>` props with shared form interface where needed | Modify |
| `apps/mobile-admin/components/orders/new-order.types.ts` | Add edit-required item snapshot fields such as `variant_attributes` | Modify |
| `apps/mobile-admin/components/orders/NewOrderProductSheet.tsx` | Replace dense variant list with product-first option selector | Modify |
| `apps/mobile-admin/components/orders/NewOrderProductSheet.variant.test.tsx` | Existing variant-mode regression updated for product-first structured variants and fallback list behavior | Modify |
| `apps/mobile-admin/components/orders/EditOrderScreenContent.tsx` | Edit-mode screen wrapper, save footer, notify toggle, success modal | Create |
| `apps/mobile-admin/components/orders/EditOrderScreenContent.test.tsx` | Render and save-state tests | Create |
| `apps/mobile-admin/app/(admin)/order/edit.tsx` | Expo route for `/(admin)/order/edit` with an `id` search param | Create |
| `apps/mobile-admin/components/orders/OrderDetailsScreenContent.tsx` | Add edit header button if order is editable | Modify |
| `apps/mobile-admin/components/orders/OrderAuditTrailCard.tsx` | Display latest audit events on details | Create |
| `apps/mobile-admin/components/orders/OrderAuditTrailCard.test.tsx` | Audit history rendering tests | Create |
| `apps/mobile-admin/hooks/orders/useOrderAuditEvents.ts` | Fetch merchant-scoped audit events for an order | Create |
| `apps/mobile-admin/hooks/orders/useOrderAuditEvents.test.ts` | Query key, order scoping, error tests | Create |

---

## Task 0: Execution Setup and Supabase Refresh

**Files:** No source changes.

- [ ] **Step 1: Create isolated worktree or branch**

Run:

```bash
git fetch origin
git worktree add ../Baci-app-order-edit -b codex/mobile-admin-order-edit origin/main
cd ../Baci-app-order-edit
```

Expected: clean worktree on `codex/mobile-admin-order-edit`.

- [ ] **Step 2: Verify current Supabase CLI and migration command**

Run:

```bash
supabase --version
supabase migration --help
```

Expected: CLI is available. If the command shape differs, use `supabase migration --help` output rather than guessing.

- [ ] **Step 3: Check Supabase changelog for relevant breaking changes**

Run:

```bash
curl -fsSL https://supabase.com/changelog.md | rg -i "breaking|rls|policy|function|migration|security definer|security invoker"
```

Expected: no relevant breaking change blocks normal Postgres/RLS/function work. If one appears, read the linked Supabase docs before touching the migration.

- [ ] **Step 4: Confirm live/local policy shape before writing SQL**

Run a read-only policy check against the intended database:

```sql
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('orders', 'order_items', 'audit_logs', 'product_variants')
order by tablename, policyname;
```

Expected: `order_items` has select/insert/update policies and still lacks a delete policy. Keep it that way; Task 2 uses the checked RPC for item replacement instead of broadening direct client deletes. `product_variants` may still have an owner-only select policy; Task 2 rewrites only the select policy to `public.has_merchant_access(merchant_id)` so active staff can resolve variants without broadening writes.

---

## Task 1: Web API Contract and Validation

**Files:**
- Create `apps/web/src/schemas/admin-order-edit.ts`
- Create `apps/web/src/schemas/admin-order-edit.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `apps/web/src/schemas/admin-order-edit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  adminOrderEditSchema,
  canEditFinancialOrderFields,
  getOrderEditChangeCategory,
} from './admin-order-edit';

const validPayload = {
  branch_id: '11111111-1111-1111-1111-111111111111',
  customer: {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Ada Buyer',
    email: 'ada@example.com',
    phone: '+2348012345678',
  },
  discount_amount: 500,
  gift_wrapping_fee: 0,
  items: [
    {
      image_url: 'https://cdn.example.test/iphone-13.jpg',
      name: 'iPhone 13',
      price: 500000,
      product_id: '33333333-3333-3333-3333-333333333333',
      product_match_status: 'linked',
      quantity: 1,
      variant_id: null,
      variant_attributes: { storage: '128GB', color: 'Black' },
      variant_name: null,
    },
  ],
  notes: 'Customer requested pickup.',
  notify_customer: true,
  shipping_address: {
    address: '12 Allen Avenue',
    city: 'Ikeja',
    name: 'Ada Buyer',
    phone: '+2348012345678',
    state: 'Lagos',
  },
  shipping_fee: 2500,
  source: 'physical',
  tax_amount: 37462.5,
};

describe('adminOrderEditSchema', () => {
  it('accepts the mobile-admin edit payload', () => {
    expect(adminOrderEditSchema.safeParse(validPayload).success).toBe(true);
  });

  it('accepts legacy edit payloads that omit hidden gift wrapping', () => {
    const legacyPayload: Partial<typeof validPayload> = { ...validPayload };
    delete legacyPayload.gift_wrapping_fee;

    expect(adminOrderEditSchema.safeParse(legacyPayload).success).toBe(true);
  });

  it('rejects blank customer name', () => {
    const result = adminOrderEditSchema.safeParse({
      ...validPayload,
      customer: { ...validPayload.customer, name: '   ' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty item list', () => {
    const result = adminOrderEditSchema.safeParse({
      ...validPayload,
      items: [],
    });

    expect(result.success).toBe(false);
  });

  it('rejects negative money fields', () => {
    const result = adminOrderEditSchema.safeParse({
      ...validPayload,
      shipping_fee: -1,
    });

    expect(result.success).toBe(false);
  });

  it('rejects discounts that would make the total negative', () => {
    const result = adminOrderEditSchema.safeParse({
      ...validPayload,
    discount_amount: 999999999,
    gift_wrapping_fee: 0,
    shipping_fee: 0,
    tax_amount: 0,
    });

    expect(result.success).toBe(false);
  });

  it('accepts a blank shipping address for pickup or physical sales', () => {
    const result = adminOrderEditSchema.safeParse({
      ...validPayload,
      shipping_address: {
        ...validPayload.shipping_address,
        address: '',
      },
    });

    expect(result.success).toBe(true);
  });
});

describe('order edit helpers', () => {
  it('classifies item or money changes as financial', () => {
    expect(
      getOrderEditChangeCategory({
        changedFields: ['items', 'shipping_fee'],
      })
    ).toBe('financial');
  });

  it('classifies notes-only changes as internal', () => {
    expect(getOrderEditChangeCategory({ changedFields: ['notes'] })).toBe(
      'internal'
    );
  });

  it('allows financial edits only before payment and fulfillment', () => {
    expect(
      canEditFinancialOrderFields({
        amountPaid: 0,
        paymentStatus: 'unpaid',
        shippingStatus: 'pending',
        walletAmountUsed: 0,
      })
    ).toBe(true);

    expect(
      canEditFinancialOrderFields({
        amountPaid: 100,
        paymentStatus: 'unpaid',
        shippingStatus: 'pending',
        walletAmountUsed: 0,
      })
    ).toBe(false);

    expect(
      canEditFinancialOrderFields({
        amountPaid: 0,
        paymentStatus: 'unpaid',
        shippingStatus: 'shipped',
        walletAmountUsed: 0,
      })
    ).toBe(false);

    expect(
      canEditFinancialOrderFields({
        amountPaid: 0,
        paymentStatus: 'paid',
        shippingStatus: 'pending',
        walletAmountUsed: 0,
      })
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --filter @baci/web exec vitest run src/schemas/admin-order-edit.test.ts
```

Expected: FAIL because the schema module does not exist.

- [ ] **Step 3: Implement schema and helpers**

Create `apps/web/src/schemas/admin-order-edit.ts`:

```ts
import { z } from 'zod';
import type { PaymentStatus, ShippingStatus } from '@baci/shared';

const moneySchema = z.number().finite().nonnegative();

const editCustomerSchema = z.object({
  email: z.email().nullable().optional(),
  id: z.uuid().nullable(),
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).nullable().optional(),
});

const editShippingAddressSchema = z.object({
  address: z.string().trim().max(500),
  city: z.string().trim().max(100).optional(),
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40),
  state: z.string().trim().max(100).optional(),
});

const editOrderItemSchema = z.object({
  condition: z.string().trim().max(100).nullable().optional(),
  image_url: z.string().trim().max(2000).nullable().optional(),
  item_description: z.string().trim().max(1000).nullable().optional(),
  name: z.string().trim().min(1).max(200),
  price: moneySchema,
  product_id: z.uuid().nullable(),
  product_match_status: z.enum(['custom', 'linked', 'unreviewed']),
  quantity: z.number().int().positive().max(999),
  variant_id: z.uuid().nullable(),
  variant_attributes: z.record(z.string(), z.unknown()).nullable().optional(),
  variant_name: z.string().trim().max(200).nullable(),
});

export const adminOrderEditSchema = z
  .object({
    branch_id: z.uuid().nullable(),
    customer: editCustomerSchema,
    discount_amount: moneySchema,
    gift_wrapping_fee: moneySchema.optional(),
    items: z.array(editOrderItemSchema).min(1).max(200),
    notes: z.string().trim().max(2000).nullable().optional(),
    notify_customer: z.boolean().default(false),
    shipping_address: editShippingAddressSchema,
    shipping_fee: moneySchema,
    source: z.string().trim().min(1).max(50),
    tax_amount: moneySchema,
  })
  .refine(
    (value) => {
      const subtotal = value.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      if (value.gift_wrapping_fee === undefined) {
        return true;
      }
      return (
        subtotal -
          value.discount_amount +
          value.gift_wrapping_fee +
          value.shipping_fee +
          value.tax_amount >=
        0
      );
    },
    {
      message:
        'Discount cannot exceed order subtotal plus fees, gift wrapping, and tax',
      path: ['discount_amount'],
    }
  );

export type AdminOrderEditInput = z.infer<typeof adminOrderEditSchema>;

const FINANCIAL_FIELDS = new Set([
  'discount_amount',
  'gift_wrapping_fee',
  'items',
  'shipping_fee',
  'subtotal',
  'tax_exclusive_amount',
  'tax_inclusive_amount',
  'tax_amount',
  'total',
]);

const CUSTOMER_VISIBLE_FIELDS = new Set([
  'customer_email',
  'customer_name',
  'customer_phone',
  'discount_amount',
  'gift_wrapping_fee',
  'items',
  'shipping_address',
  'shipping_fee',
  'tax_exclusive_amount',
  'tax_inclusive_amount',
  'tax_amount',
  'total',
]);

const PAYMENT_LOCK_STATUSES = new Set<PaymentStatus | string>([
  'paid',
  'partially_paid',
  'bnpl_approved',
  'refunded',
]);

export function getOrderEditChangeCategory(input: {
  changedFields: string[];
}): 'financial' | 'customer_visible' | 'internal' {
  if (input.changedFields.some((field) => FINANCIAL_FIELDS.has(field))) {
    return 'financial';
  }

  if (
    input.changedFields.some((field) => CUSTOMER_VISIBLE_FIELDS.has(field))
  ) {
    return 'customer_visible';
  }

  return 'internal';
}

export function canEditFinancialOrderFields(input: {
  amountPaid: number;
  paymentStatus: PaymentStatus | string | null;
  shippingStatus: ShippingStatus | string | null;
  walletAmountUsed: number;
}): boolean {
  if (
    input.amountPaid > 0 ||
    input.walletAmountUsed > 0 ||
    PAYMENT_LOCK_STATUSES.has(input.paymentStatus ?? '')
  ) {
    return false;
  }

  return !['shipped', 'delivered', 'cancelled', 'returned'].includes(
    input.shippingStatus ?? ''
  );
}
```

- [ ] **Step 4: Run test**

Run:

```bash
pnpm --filter @baci/web exec vitest run src/schemas/admin-order-edit.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/src/schemas/admin-order-edit.ts apps/web/src/schemas/admin-order-edit.test.ts
git commit -m "feat(web): add admin order edit schema"
```

---

## Task 2: Supabase Migration for Atomic Update and Audit History

**Files:**
- Create migration with `supabase migration new mobile_admin_order_edit_audit`

- [ ] **Step 1: Create migration file**

Run:

```bash
supabase migration new mobile_admin_order_edit_audit
```

Expected: one new file under `supabase/migrations/` ending in `_mobile_admin_order_edit_audit.sql`.

- [ ] **Step 2: Add audit table, read RLS, variant select policy, and RPC**

Use this migration structure. Do not use service-role grants for the user-facing route. Use `SECURITY DEFINER` for `public.update_admin_order` because the RPC must atomically replace rows and insert audit events while keeping direct client deletes and direct client audit inserts closed.

```sql
CREATE TABLE IF NOT EXISTS public.order_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('order.update')),
  changed_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  before_snapshot jsonb NOT NULL,
  after_snapshot jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_order_audit_events_order_created_at
  ON public.order_audit_events (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_audit_events_merchant_created_at
  ON public.order_audit_events (merchant_id, created_at DESC);

ALTER TABLE public.order_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.order_audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.order_audit_events TO authenticated;
GRANT ALL ON public.order_audit_events TO service_role;

DROP POLICY IF EXISTS "order_audit_events_select_policy" ON public.order_audit_events;
CREATE POLICY "order_audit_events_select_policy"
  ON public.order_audit_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_audit_events.order_id
        AND o.merchant_id = order_audit_events.merchant_id
        AND (
          o.merchant_id IN (
            SELECT m.id
            FROM public.merchants m
            WHERE m.user_id = (SELECT auth.uid())
          )
          OR public.check_staff_permission(
            (SELECT auth.uid()),
            o.merchant_id,
            'orders',
            'view'
          )
          OR public.check_staff_permission(
            (SELECT auth.uid()),
            o.merchant_id,
            'orders',
            'edit'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Merchants can view their variants" ON public.product_variants;
DROP POLICY IF EXISTS "product_variants_select_by_merchant_access" ON public.product_variants;
CREATE POLICY "product_variants_select_by_merchant_access"
  ON public.product_variants
  FOR SELECT
  TO authenticated
  USING (public.has_merchant_access(merchant_id));
```

Add `public.update_admin_order` after the policies. The function must:
- `RAISE EXCEPTION 'not_authenticated'` when `auth.uid()` is null.
- Lock the target order `FOR UPDATE`.
- Check owner or `check_staff_permission(auth.uid(), merchant_id, 'orders', 'edit')`.
- Validate required top-level money fields and each item `name`, `price`, and `quantity` before subtotal or insert casts. The route schema still rejects normal bad requests first, but direct RPC callers must receive planned validation errors instead of raw numeric/integer cast failures or persisted negative line items.
- Validate required `customer`, `shipping_address`, and `source` fields before building snapshots or updating `orders`. The web route schema catches normal callers, but the RPC is granted to `authenticated`; direct RPC calls must not be able to silently clear `customer_name`, `source`, or the shipping contact name.
- Validate optional `notify_customer` before casting it to boolean. The web route schema catches normal callers, but direct RPC callers must receive a planned `order_notify_customer_invalid` error instead of a raw boolean cast failure.
- Validate syntactic UUID shape for `branch_id`, `customer.id`, `items[].product_id`, and `items[].variant_id` before the first `::uuid` cast in the function body. The web route schema catches normal callers, but the RPC is granted to `authenticated` and must not leak raw `22P02` cast failures to direct RPC callers.
- Validate `branch_id` belongs to the order merchant when provided.
- Validate `customer.id` belongs to the order merchant when provided.
- Validate every non-null `items[].product_id` belongs to the order merchant.
- Validate every non-null `items[].variant_id` belongs to the order merchant and belongs to the same submitted `product_id`.
- Recalculate `subtotal` from `p_items` inside the function.
- Recalculate `total` using the existing order `tax_basis`, preserving the existing `gift_wrapping_fee` when older callers omit it:
  - `exclusive` or `NULL`: `subtotal - discount_amount + gift_wrapping_fee + shipping_fee + tax_amount`
  - `inclusive`: `subtotal - discount_amount + gift_wrapping_fee + shipping_fee`
- Reject the payload when the recalculated total is negative, even though the web schema also checks this. The RPC is the final authority for direct callers and future clients.
- Build normalized existing-item and incoming-item JSON snapshots ordered by stable keys.
- Build normalized existing and incoming `shipping_address` snapshots before diffing. Missing optional keys and blank optional strings must not create false `shipping_address` changes, audit rows, or customer emails.
- Build the candidate after snapshot and compute `changed_fields` before any `UPDATE`, `DELETE`, `INSERT`, or audit write. If the full replacement payload is a no-op, return `change_category = 'none'`, `changed_fields = []`, and `notify_customer = false` without touching `orders.updated_at` or `order_audit_events`.
- Reject item or financial edits when the order is shipped, delivered, cancelled, returned, has successful/completed transactions, has wallet credit, or has a paid-like `payment_status`.
- Reject every edit when the order is already cancelled or returned; those are terminal states in v1.
- Reject item replacement when existing rows have serialized inventory links/events, `fulfillment_data`, `has_assurance = true`, or `assurance_fee > 0`; v1 cannot delete/reinsert those historical item rows safely.
- Delete and reinsert order items only when `v_items_changed` is true and all validations pass. Notes-only or shipping-only edits must preserve existing `order_items.id` values.
- After any item replacement, reload the `orders` row and build the audit `after_snapshot` from persisted values, not the pre-trigger candidate. Existing `order_items` tax triggers can update `tax_amount`, `tax_exclusive_amount`, `tax_inclusive_amount`, and sometimes `total` after item writes.
- Insert one `order_audit_events` row in the same transaction.
- Return `order_id`, `merchant_id`, `customer_email`, `changed_fields`, `change_category`, and `notify_customer`.

Minimum function signature:

```sql
CREATE OR REPLACE FUNCTION public.update_admin_order(
  p_order_id uuid,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_order record;
  v_before jsonb;
  v_after jsonb;
  v_candidate_after jsonb;
  v_items jsonb := COALESCE(p_payload -> 'items', '[]'::jsonb);
  v_subtotal numeric := 0;
  v_shipping_fee numeric := 0;
  v_discount_amount numeric := 0;
  v_gift_wrapping_fee numeric := 0;
  v_tax_basis text := 'exclusive';
  v_tax_amount numeric := 0;
  v_total numeric := 0;
  v_paid_amount numeric := 0;
  v_wallet_amount numeric := 0;
  v_existing_items jsonb := '[]'::jsonb;
  v_new_items jsonb := '[]'::jsonb;
  v_existing_shipping_address jsonb := '{}'::jsonb;
  v_new_shipping_address jsonb := '{}'::jsonb;
  v_items_changed boolean := false;
  v_changed_fields text[] := ARRAY[]::text[];
  v_change_category text := 'internal';
  v_customer_name text;
  v_customer_email text;
  v_customer_phone text;
  v_order_source text;
  v_shipping_address_line text;
  v_shipping_city text;
  v_shipping_name text;
  v_shipping_phone text;
  v_shipping_state text;
  v_notify_customer boolean := false;
  v_uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT
    o.branch_id,
    o.customer_email,
    o.customer_id,
    o.customer_name,
    o.customer_phone,
    o.discount_amount,
    o.gift_wrapping_fee,
    o.merchant_id,
    o.notes,
    o.payment_status,
    o.shipping_address,
    o.shipping_fee,
    o.shipping_status,
    o.source,
    o.subtotal,
    o.tax_basis,
    o.tax_amount,
    o.tax_exclusive_amount,
    o.tax_inclusive_amount,
    o.total,
    o.wallet_amount_used
    INTO v_order
  FROM public.orders AS o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    v_order.merchant_id IN (
      SELECT m.id FROM public.merchants m WHERE m.user_id = v_actor
    )
    OR public.check_staff_permission(v_actor, v_order.merchant_id, 'orders', 'edit')
  ) THEN
    RAISE EXCEPTION 'order_edit_forbidden' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'order_items_required' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_payload -> 'customer') <> 'object'
    OR jsonb_typeof(p_payload -> 'shipping_address') <> 'object'
  THEN
    RAISE EXCEPTION 'order_required_fields_invalid' USING ERRCODE = '22023';
  END IF;

  v_customer_name := NULLIF(btrim(p_payload #>> '{customer,name}'), '');
  v_customer_email := NULLIF(btrim(p_payload #>> '{customer,email}'), '');
  v_customer_phone := NULLIF(btrim(p_payload #>> '{customer,phone}'), '');
  v_order_source := NULLIF(btrim(p_payload ->> 'source'), '');
  v_shipping_address_line := COALESCE(
    NULLIF(btrim(p_payload #>> '{shipping_address,address}'), ''),
    ''
  );
  v_shipping_city := NULLIF(btrim(p_payload #>> '{shipping_address,city}'), '');
  v_shipping_name := NULLIF(btrim(p_payload #>> '{shipping_address,name}'), '');
  v_shipping_phone := COALESCE(
    NULLIF(btrim(p_payload #>> '{shipping_address,phone}'), ''),
    v_customer_phone,
    ''
  );
  v_shipping_state := NULLIF(btrim(p_payload #>> '{shipping_address,state}'), '');

  IF v_customer_name IS NULL
    OR v_order_source IS NULL
    OR v_shipping_name IS NULL
  THEN
    RAISE EXCEPTION 'order_required_fields_invalid' USING ERRCODE = '22023';
  END IF;

  IF p_payload ? 'notify_customer'
    AND p_payload -> 'notify_customer' <> 'null'::jsonb
    AND jsonb_typeof(p_payload -> 'notify_customer') <> 'boolean'
  THEN
    RAISE EXCEPTION 'order_notify_customer_invalid' USING ERRCODE = '22023';
  END IF;

  v_notify_customer := COALESCE((p_payload ->> 'notify_customer')::boolean, false);

  IF CASE
      WHEN jsonb_typeof(p_payload -> 'shipping_fee') = 'number'
        THEN (p_payload ->> 'shipping_fee')::numeric < 0
      ELSE true
    END
    OR CASE
      WHEN jsonb_typeof(p_payload -> 'discount_amount') = 'number'
        THEN (p_payload ->> 'discount_amount')::numeric < 0
      ELSE true
    END
    OR CASE
      WHEN jsonb_typeof(p_payload -> 'tax_amount') = 'number'
        THEN (p_payload ->> 'tax_amount')::numeric < 0
      ELSE true
    END
    OR CASE
      WHEN NOT (p_payload ? 'gift_wrapping_fee')
        OR p_payload -> 'gift_wrapping_fee' = 'null'::jsonb
        THEN false
      WHEN jsonb_typeof(p_payload -> 'gift_wrapping_fee') = 'number'
        THEN (p_payload ->> 'gift_wrapping_fee')::numeric < 0
      ELSE true
    END
  THEN
    RAISE EXCEPTION 'order_money_invalid' USING ERRCODE = '22023';
  END IF;

  v_shipping_fee := (p_payload ->> 'shipping_fee')::numeric;
  v_discount_amount := (p_payload ->> 'discount_amount')::numeric;
  v_tax_amount := (p_payload ->> 'tax_amount')::numeric;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_items) AS item
    WHERE NULLIF(btrim(item ->> 'name'), '') IS NULL
      OR CASE
        WHEN jsonb_typeof(item -> 'price') = 'number'
          THEN (item ->> 'price')::numeric < 0
        ELSE true
      END
      OR CASE
        WHEN jsonb_typeof(item -> 'quantity') = 'number'
          THEN (item ->> 'quantity')::numeric <> trunc((item ->> 'quantity')::numeric)
            OR (item ->> 'quantity')::numeric < 1
            OR (item ->> 'quantity')::numeric > 999
        ELSE true
      END
      OR COALESCE(
        NULLIF(item ->> 'product_match_status', ''),
        CASE
          WHEN NULLIF(item ->> 'product_id', '') IS NULL THEN 'custom'
          ELSE 'linked'
        END
      ) NOT IN ('custom', 'linked', 'unreviewed')
  ) THEN
    RAISE EXCEPTION 'order_item_values_invalid' USING ERRCODE = '22023';
  END IF;

  IF v_order.shipping_status IN ('cancelled', 'returned') THEN
    RAISE EXCEPTION 'order_terminal_not_editable' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM((item ->> 'price')::numeric * (item ->> 'quantity')::integer), 0)
    INTO v_subtotal
  FROM jsonb_array_elements(v_items) AS item;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', oi.product_id,
        'variant_id', oi.variant_id,
        'variant_name', oi.variant_name,
        'name', oi.name,
        'quantity', oi.quantity,
        'price', oi.price,
        'condition', oi.condition,
        'image_url', oi.image_url,
        'item_description', oi.item_description,
        'variant_attributes', COALESCE(oi.variant_attributes, '{}'::jsonb),
        'product_match_status', COALESCE(
          oi.product_match_status,
          CASE WHEN oi.product_id IS NULL THEN 'custom' ELSE 'linked' END
        )
      )
      ORDER BY oi.product_id,
        oi.variant_id,
        oi.name,
        oi.price,
        oi.quantity,
        oi.condition,
        oi.image_url,
        oi.item_description,
        COALESCE(oi.variant_attributes, '{}'::jsonb)::text,
        COALESCE(
          oi.product_match_status,
          CASE WHEN oi.product_id IS NULL THEN 'custom' ELSE 'linked' END
        )
    ),
    '[]'::jsonb
  )
    INTO v_existing_items
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id;

  IF NULLIF(p_payload ->> 'branch_id', '') IS NOT NULL
    AND NOT ((p_payload ->> 'branch_id') ~* v_uuid_pattern)
  THEN
    RAISE EXCEPTION 'branch_id_invalid' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(p_payload #>> '{customer,id}', '') IS NOT NULL
    AND NOT ((p_payload #>> '{customer,id}') ~* v_uuid_pattern)
  THEN
    RAISE EXCEPTION 'customer_id_invalid' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_items) AS item
    WHERE NULLIF(item ->> 'product_id', '') IS NOT NULL
      AND NOT ((item ->> 'product_id') ~* v_uuid_pattern)
  ) THEN
    RAISE EXCEPTION 'order_item_product_invalid' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_items) AS item
    WHERE NULLIF(item ->> 'variant_id', '') IS NOT NULL
      AND NOT ((item ->> 'variant_id') ~* v_uuid_pattern)
  ) THEN
    RAISE EXCEPTION 'order_item_variant_invalid' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', NULLIF(item ->> 'product_id', '')::uuid,
        'variant_id', NULLIF(item ->> 'variant_id', '')::uuid,
        'variant_name', NULLIF(item ->> 'variant_name', ''),
        'name', btrim(item ->> 'name'),
        'quantity', (item ->> 'quantity')::integer,
        'price', (item ->> 'price')::numeric,
        'condition', NULLIF(item ->> 'condition', ''),
        'image_url', NULLIF(item ->> 'image_url', ''),
        'item_description', NULLIF(item ->> 'item_description', ''),
        'variant_attributes', CASE
          WHEN jsonb_typeof(item -> 'variant_attributes') = 'object'
            THEN item -> 'variant_attributes'
          ELSE '{}'::jsonb
        END,
        'product_match_status', COALESCE(
          NULLIF(item ->> 'product_match_status', ''),
          CASE
            WHEN NULLIF(item ->> 'product_id', '') IS NULL THEN 'custom'
            ELSE 'linked'
          END
        )
      )
      ORDER BY NULLIF(item ->> 'product_id', '')::uuid,
        NULLIF(item ->> 'variant_id', '')::uuid,
        btrim(item ->> 'name'),
        (item ->> 'price')::numeric,
        (item ->> 'quantity')::integer,
        NULLIF(item ->> 'condition', ''),
        NULLIF(item ->> 'image_url', ''),
        NULLIF(item ->> 'item_description', ''),
        CASE
          WHEN jsonb_typeof(item -> 'variant_attributes') = 'object'
            THEN (item -> 'variant_attributes')::text
          ELSE '{}'::jsonb::text
        END,
        COALESCE(
          NULLIF(item ->> 'product_match_status', ''),
          CASE
            WHEN NULLIF(item ->> 'product_id', '') IS NULL THEN 'custom'
            ELSE 'linked'
          END
        )
    ),
    '[]'::jsonb
  )
    INTO v_new_items
  FROM jsonb_array_elements(v_items) AS item;

  v_items_changed := v_existing_items IS DISTINCT FROM v_new_items;

  v_gift_wrapping_fee := COALESCE(
    (p_payload ->> 'gift_wrapping_fee')::numeric,
    COALESCE(v_order.gift_wrapping_fee, 0)
  );
  v_tax_basis := COALESCE(NULLIF(v_order.tax_basis, ''), 'exclusive');

  IF v_tax_basis = 'inclusive' THEN
    v_total :=
      v_subtotal -
      v_discount_amount +
      v_gift_wrapping_fee +
      v_shipping_fee;
  ELSE
    v_total :=
      v_subtotal -
      v_discount_amount +
      v_gift_wrapping_fee +
      v_shipping_fee +
      v_tax_amount;
  END IF;

  IF v_total < 0 THEN
    RAISE EXCEPTION 'order_total_negative' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM(t.amount), 0)
    INTO v_paid_amount
  FROM public.transactions t
  WHERE t.order_id = p_order_id
    AND t.status IN ('success', 'completed');

  v_wallet_amount := COALESCE(v_order.wallet_amount_used, 0);

  v_existing_shipping_address := jsonb_strip_nulls(jsonb_build_object(
    'address', COALESCE(
      NULLIF(v_order.shipping_address ->> 'address', ''),
      NULLIF(v_order.shipping_address ->> 'address_line1', ''),
      ''
    ),
    'city', NULLIF(v_order.shipping_address ->> 'city', ''),
    'name', COALESCE(
      NULLIF(v_order.shipping_address ->> 'name', ''),
      v_order.customer_name,
      ''
    ),
    'phone', COALESCE(
      NULLIF(v_order.shipping_address ->> 'phone', ''),
      v_order.customer_phone,
      ''
    ),
    'state', NULLIF(v_order.shipping_address ->> 'state', '')
  ));

  v_new_shipping_address := jsonb_strip_nulls(jsonb_build_object(
    'address', v_shipping_address_line,
    'city', v_shipping_city,
    'name', v_shipping_name,
    'phone', v_shipping_phone,
    'state', v_shipping_state
  ));

  IF v_paid_amount > 0
    OR v_wallet_amount > 0
    OR v_order.payment_status IN ('paid', 'partially_paid', 'bnpl_approved', 'refunded')
  THEN
    IF v_items_changed
      OR v_subtotal IS DISTINCT FROM COALESCE(v_order.subtotal, 0)
      OR v_shipping_fee IS DISTINCT FROM COALESCE(v_order.shipping_fee, 0)
      OR v_gift_wrapping_fee IS DISTINCT FROM COALESCE(v_order.gift_wrapping_fee, 0)
      OR v_discount_amount IS DISTINCT FROM COALESCE(v_order.discount_amount, 0)
      OR v_tax_amount IS DISTINCT FROM COALESCE(v_order.tax_amount, 0)
      OR v_total IS DISTINCT FROM COALESCE(v_order.total, 0)
    THEN
      RAISE EXCEPTION 'order_financial_edit_has_payments' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_order.shipping_status IN ('shipped', 'delivered', 'cancelled', 'returned') THEN
    IF v_items_changed
      OR v_subtotal IS DISTINCT FROM COALESCE(v_order.subtotal, 0)
      OR v_shipping_fee IS DISTINCT FROM COALESCE(v_order.shipping_fee, 0)
      OR v_gift_wrapping_fee IS DISTINCT FROM COALESCE(v_order.gift_wrapping_fee, 0)
      OR v_discount_amount IS DISTINCT FROM COALESCE(v_order.discount_amount, 0)
      OR v_tax_amount IS DISTINCT FROM COALESCE(v_order.tax_amount, 0)
      OR v_total IS DISTINCT FROM COALESCE(v_order.total, 0)
    THEN
      RAISE EXCEPTION 'order_financial_edit_after_fulfillment' USING ERRCODE = '23514';
    END IF;
  END IF;

  v_before := jsonb_build_object(
    'branch_id', v_order.branch_id,
    'customer_id', v_order.customer_id,
    'customer_name', v_order.customer_name,
    'customer_email', v_order.customer_email,
    'customer_phone', v_order.customer_phone,
    'shipping_address', v_existing_shipping_address,
    'source', v_order.source,
    'notes', v_order.notes,
    'subtotal', v_order.subtotal,
    'shipping_fee', v_order.shipping_fee,
    'tax_basis', v_order.tax_basis,
    'tax_amount', v_order.tax_amount,
    'tax_exclusive_amount', v_order.tax_exclusive_amount,
    'tax_inclusive_amount', v_order.tax_inclusive_amount,
    'gift_wrapping_fee', v_order.gift_wrapping_fee,
    'discount_amount', v_order.discount_amount,
    'total', v_order.total,
    'items', v_existing_items
  );

  v_candidate_after := jsonb_build_object(
    'branch_id', NULLIF(p_payload ->> 'branch_id', '')::uuid,
    'customer_id', NULLIF(p_payload #>> '{customer,id}', '')::uuid,
    'customer_name', v_customer_name,
    'customer_email', v_customer_email,
    'customer_phone', v_customer_phone,
    'shipping_address', v_new_shipping_address,
    'source', v_order_source,
    'notes', NULLIF(p_payload ->> 'notes', ''),
    'subtotal', v_subtotal,
    'shipping_fee', v_shipping_fee,
    'tax_basis', v_order.tax_basis,
    'tax_amount', v_tax_amount,
    'tax_exclusive_amount', v_order.tax_exclusive_amount,
    'tax_inclusive_amount', v_order.tax_inclusive_amount,
    'gift_wrapping_fee', v_gift_wrapping_fee,
    'discount_amount', v_discount_amount,
    'total', v_total,
    'items', v_new_items
  );

  SELECT ARRAY_AGG(key ORDER BY key)
    INTO v_changed_fields
  FROM jsonb_each(v_before) before_entry(key, value)
  JOIN jsonb_each(v_candidate_after) after_entry USING (key)
  WHERE before_entry.value IS DISTINCT FROM after_entry.value;

  v_changed_fields := COALESCE(v_changed_fields, ARRAY[]::text[]);

  IF cardinality(v_changed_fields) = 0 THEN
    RETURN jsonb_build_object(
      'order_id', p_order_id,
      'merchant_id', v_order.merchant_id,
      'customer_email', v_order.customer_email,
      'changed_fields', '[]'::jsonb,
      'change_category', 'none',
      'notify_customer', false
    );
  END IF;

  UPDATE public.orders
  SET
    branch_id = NULLIF(p_payload ->> 'branch_id', '')::uuid,
    customer_id = NULLIF(p_payload #>> '{customer,id}', '')::uuid,
    customer_name = v_customer_name,
    customer_email = v_customer_email,
    customer_phone = v_customer_phone,
    shipping_address = v_new_shipping_address,
    source = v_order_source,
    notes = NULLIF(p_payload ->> 'notes', ''),
    subtotal = v_subtotal,
    shipping_fee = v_shipping_fee,
    gift_wrapping_fee = v_gift_wrapping_fee,
    tax_amount = v_tax_amount,
    discount_amount = v_discount_amount,
    total = v_total,
    updated_at = now()
  WHERE id = p_order_id;

  IF v_items_changed THEN
    DELETE FROM public.order_items
    WHERE order_id = p_order_id;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      variant_id,
      variant_name,
      name,
      quantity,
      price,
      condition,
      image_url,
      item_description,
      variant_attributes,
      product_match_status,
      line_extension_amount
    )
    SELECT
      p_order_id,
      NULLIF(item ->> 'product_id', '')::uuid,
      NULLIF(item ->> 'variant_id', '')::uuid,
      NULLIF(item ->> 'variant_name', ''),
      btrim(item ->> 'name'),
      (item ->> 'quantity')::integer,
      (item ->> 'price')::numeric,
      NULLIF(item ->> 'condition', ''),
      NULLIF(item ->> 'image_url', ''),
      NULLIF(item ->> 'item_description', ''),
      CASE
        WHEN jsonb_typeof(item -> 'variant_attributes') = 'object'
          THEN item -> 'variant_attributes'
        ELSE '{}'::jsonb
      END,
      COALESCE(
        NULLIF(item ->> 'product_match_status', ''),
        CASE
          WHEN NULLIF(item ->> 'product_id', '') IS NULL THEN 'custom'
          ELSE 'linked'
        END
      ),
      (item ->> 'price')::numeric * (item ->> 'quantity')::integer
    FROM jsonb_array_elements(v_items) AS item;
  END IF;

  SELECT
    o.branch_id,
    o.customer_email,
    o.customer_id,
    o.customer_name,
    o.customer_phone,
    o.discount_amount,
    o.gift_wrapping_fee,
    o.merchant_id,
    o.notes,
    o.payment_status,
    o.shipping_address,
    o.shipping_fee,
    o.shipping_status,
    o.source,
    o.subtotal,
    o.tax_basis,
    o.tax_amount,
    o.tax_exclusive_amount,
    o.tax_inclusive_amount,
    o.total,
    o.wallet_amount_used
    INTO v_order
  FROM public.orders AS o
  WHERE o.id = p_order_id;

  v_after := jsonb_build_object(
    'branch_id', v_order.branch_id,
    'customer_id', v_order.customer_id,
    'customer_name', v_order.customer_name,
    'customer_email', v_order.customer_email,
    'customer_phone', v_order.customer_phone,
    'shipping_address', v_new_shipping_address,
    'source', v_order.source,
    'notes', v_order.notes,
    'subtotal', v_order.subtotal,
    'shipping_fee', v_order.shipping_fee,
    'tax_basis', v_order.tax_basis,
    'tax_amount', v_order.tax_amount,
    'tax_exclusive_amount', v_order.tax_exclusive_amount,
    'tax_inclusive_amount', v_order.tax_inclusive_amount,
    'gift_wrapping_fee', v_order.gift_wrapping_fee,
    'discount_amount', v_order.discount_amount,
    'total', v_order.total,
    'items', v_new_items
  );

  SELECT ARRAY_AGG(key ORDER BY key)
    INTO v_changed_fields
  FROM jsonb_each(v_before) before_entry(key, value)
  JOIN jsonb_each(v_after) after_entry USING (key)
  WHERE before_entry.value IS DISTINCT FROM after_entry.value;

  v_changed_fields := COALESCE(v_changed_fields, ARRAY[]::text[]);
  v_change_category := 'internal';

  IF v_changed_fields && ARRAY['items', 'subtotal', 'shipping_fee', 'gift_wrapping_fee', 'tax_amount', 'tax_exclusive_amount', 'tax_inclusive_amount', 'discount_amount', 'total']::text[] THEN
    v_change_category := 'financial';
  ELSIF v_changed_fields && ARRAY['customer_id', 'customer_name', 'customer_email', 'customer_phone', 'shipping_address']::text[] THEN
    v_change_category := 'customer_visible';
  END IF;

  INSERT INTO public.order_audit_events (
    merchant_id,
    order_id,
    actor_user_id,
    action,
    changed_fields,
    before_snapshot,
    after_snapshot,
    metadata
  ) VALUES (
    v_order.merchant_id,
    p_order_id,
    v_actor,
    'order.update',
    v_changed_fields,
    v_before,
    v_after,
    jsonb_build_object(
      'change_category', v_change_category,
      'notify_customer', v_notify_customer
    )
  );

  RETURN jsonb_build_object(
    'order_id', p_order_id,
    'merchant_id', v_order.merchant_id,
    'customer_email', v_after ->> 'customer_email',
    'changed_fields', to_jsonb(v_changed_fields),
    'change_category', v_change_category,
    'notify_customer', v_notify_customer
  );
END;
$$;

ALTER FUNCTION public.update_admin_order(uuid, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_admin_order(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_order(uuid, jsonb) TO authenticated;
```

- [ ] **Step 3: Add scope, item-safety, and no-op-adjacent checks**

After `v_new_items` and `v_items_changed` are built, and before `v_candidate_after`, the no-op return, or any `UPDATE` / `DELETE` / `INSERT`, add these checks to the function body:

```sql
IF NULLIF(p_payload ->> 'branch_id', '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.branches b
    WHERE b.id = (p_payload ->> 'branch_id')::uuid
      AND b.merchant_id = v_order.merchant_id
  )
THEN
  RAISE EXCEPTION 'branch_not_found' USING ERRCODE = '23503';
END IF;

IF NULLIF(p_payload #>> '{customer,id}', '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = (p_payload #>> '{customer,id}')::uuid
      AND c.merchant_id = v_order.merchant_id
  )
THEN
  RAISE EXCEPTION 'customer_not_found' USING ERRCODE = '23503';
END IF;

IF EXISTS (
  SELECT 1
  FROM jsonb_array_elements(v_items) AS item
  WHERE NULLIF(item ->> 'product_id', '') IS NULL
    AND COALESCE(NULLIF(item ->> 'product_match_status', ''), 'linked') <> 'custom'
) THEN
  RAISE EXCEPTION 'order_item_product_required' USING ERRCODE = '23503';
END IF;

IF EXISTS (
  SELECT 1
  FROM jsonb_array_elements(v_items) AS item
  WHERE NULLIF(item ->> 'product_id', '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = (item ->> 'product_id')::uuid
        AND p.merchant_id = v_order.merchant_id
    )
) THEN
  RAISE EXCEPTION 'order_item_product_forbidden' USING ERRCODE = '42501';
END IF;

IF EXISTS (
  SELECT 1
  FROM jsonb_array_elements(v_items) AS item
  WHERE NULLIF(item ->> 'variant_id', '') IS NOT NULL
    AND (
      NULLIF(item ->> 'product_id', '') IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.product_variants pv
        WHERE pv.id = (item ->> 'variant_id')::uuid
          AND pv.product_id = (item ->> 'product_id')::uuid
          AND pv.merchant_id = v_order.merchant_id
      )
    )
) THEN
  RAISE EXCEPTION 'order_item_variant_forbidden' USING ERRCODE = '42501';
END IF;

IF v_items_changed
  AND EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
      AND (
        oi.fulfillment_data IS NOT NULL
        OR COALESCE(oi.has_assurance, false)
        OR COALESCE(oi.assurance_fee, 0) > 0
      )
  )
THEN
  RAISE EXCEPTION 'order_item_replacement_has_historical_state' USING ERRCODE = '23514';
END IF;

IF v_items_changed
  AND EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.variant_inventory vi ON vi.order_item_id = oi.id
    WHERE oi.order_id = p_order_id
      AND (
        vi.status <> 'reserved'
        OR vi.reservation_expires_at IS NULL
      )
  )
THEN
  RAISE EXCEPTION 'cannot_delete_order_item_with_historical_serialized_units'
    USING ERRCODE = '23514';
END IF;

IF v_items_changed
  AND EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN private.variant_inventory_events vie ON vie.order_item_id = oi.id
    WHERE oi.order_id = p_order_id
      AND vie.event_type NOT IN (
        'reserved',
        'reservation_released',
        'reservation_expired'
      )
  )
THEN
  RAISE EXCEPTION 'cannot_delete_order_item_with_historical_inventory_events'
    USING ERRCODE = '23514';
END IF;
```

- [ ] **Step 4: Add SQL regression test**

Create `supabase/migrations/tests/admin_order_edit_audit.sql` with the same `BEGIN` / deterministic UUID fixture / `ROLLBACK` style used by `supabase/migrations/tests/transaction_review_cost_overrides.sql`. The test must assert:
- `anon` cannot execute `public.update_admin_order`
- authenticated role without `auth.uid()` raises `not_authenticated`
- direct authenticated `INSERT` into `order_audit_events` is denied
- direct authenticated `DELETE` from `order_items` is denied
- owner edit replaces item rows and inserts one `order_audit_events` row
- active staff with `orders.edit` can update an order that uses a structured `product_variants` row after the select policy rewrite
- item replacement rejects a `product_id` owned by another merchant
- item replacement rejects a `variant_id` that belongs to a different product or merchant
- direct RPC payloads with malformed `branch_id`, `customer.id`, `items[].product_id`, or `items[].variant_id` raise the planned `*_invalid` errors before any raw `22P02` UUID cast failure
- direct RPC payloads that omit `customer`, omit `shipping_address`, blank `customer.name`, blank `shipping_address.name`, or blank `source` raise `order_required_fields_invalid` before any update or delete
- direct RPC payloads with non-boolean `notify_customer` raise `order_notify_customer_invalid` before any audit insert or return cast
- direct RPC payloads with negative/non-numeric `shipping_fee`, `discount_amount`, `tax_amount`, or `gift_wrapping_fee` raise `order_money_invalid`; payloads with blank item names, negative item prices, non-positive/non-integer quantities, or invalid `product_match_status` raise `order_item_values_invalid`
- item replacement preserves `image_url`, `variant_attributes`, `item_description`, and `product_match_status`
- item replacement audit `after_snapshot.tax_amount`, `after_snapshot.tax_exclusive_amount`, `after_snapshot.tax_inclusive_amount`, and `after_snapshot.total` match the persisted `orders` row after `order_items` tax triggers run
- item replacement with existing `fulfillment_data` or assurance state raises `order_item_replacement_has_historical_state`
- item replacement with historical serialized units raises `cannot_delete_order_item_with_historical_serialized_units` before deleting `order_items`
- item replacement with non-temporary serialized inventory events raises `cannot_delete_order_item_with_historical_inventory_events` before deleting `order_items`
- exact no-op payload returns `change_category = 'none'`, preserves `orders.updated_at`, and does not insert an `order_audit_events` row, including legacy rows where `order_items.variant_attributes` is `NULL` but the submitted payload omits it or sends `{}`
- exact no-op payload with two duplicate product/name/price/quantity lines that differ only by `condition`, `image_url`, `item_description`, `variant_attributes`, or `product_match_status` does not false-diff because the snapshot ordering includes those fields
- no-op shipping payloads do not audit or email when existing `shipping_address` omits optional `city`/`state` but the submitted payload sends blank strings, or when legacy `address_line1` matches the submitted `address`
- cancelled or returned order edits raise `order_terminal_not_editable`, including notes-only payloads
- paid order item replacement raises `order_financial_edit_has_payments`, including orders with `payment_status = 'paid'` even when there is no matching transaction row
- shipped or delivered order financial edits raise `order_financial_edit_after_fulfillment`, including offsetting `shipping_fee` / `discount_amount` / `tax_amount` changes where `total` stays unchanged
- payloads where `discount_amount` exceeds the tax-basis-specific total components raise `order_total_negative`: `subtotal + shipping_fee + gift_wrapping_fee + tax_amount` for `exclusive` / `NULL`, and `subtotal + shipping_fee + gift_wrapping_fee` for `inclusive`
- existing orders with `gift_wrapping_fee > 0` preserve that amount and include it in `orders.total` after notes-only, shipping-fee, and item-replacement edits
- existing `tax_basis = 'inclusive'` orders preserve `tax_basis`, calculate `orders.total` without adding `tax_amount`, and audit the unchanged `tax_basis` value without treating it as an edited field
- paid order notes-only edit succeeds without deleting/reinserting `order_items`; assert the original item `id` still exists after the call
- audit snapshots contain `items` but the mobile audit query never selects the snapshots

Use these exact test controls:
- set `SET LOCAL ROLE anon`, call `public.update_admin_order(<order-id>, <jsonb-payload>)`, and assert SQLSTATE `42501` / permission denied because anon has no EXECUTE grant
- set `SET LOCAL ROLE authenticated` without `request.jwt.claim.sub`, call `public.update_admin_order(<order-id>, <jsonb-payload>)`, and assert it raises `not_authenticated`
- set the authenticated owner context with `SET LOCAL ROLE authenticated`, `SELECT set_config('request.jwt.claim.role', 'authenticated', true)`, and `SELECT set_config('request.jwt.claim.sub', '<owner-uuid>', true)`
- create one merchant with `user_id = <owner-uuid>`
- create one customer scoped to that merchant
- create one pending unpaid order with two starting `order_items`
- call `public.update_admin_order(<order-id>, <jsonb-payload>)`
- assert `SELECT count(*) FROM public.order_items WHERE order_id = <order-id>` matches the replacement item count
- assert `SELECT count(*) FROM public.order_audit_events WHERE order_id = <order-id> AND action = 'order.update'` increments by one
- create a second merchant/product/variant and assert payloads referencing those IDs raise `order_item_product_forbidden` or `order_item_variant_forbidden`
- send one payload with `items[0].product_id = 'not-a-uuid'` and one with `items[0].variant_id = 'not-a-uuid'`; assert they raise `order_item_product_invalid` and `order_item_variant_invalid`
- send direct RPC payloads that omit `customer`, omit `shipping_address`, set `customer.name = '   '`, set `shipping_address.name = '   '`, and set `source = '   '`; assert they raise `order_required_fields_invalid` before any update or delete
- send one direct RPC payload with `notify_customer = 'definitely'`; assert it raises `order_notify_customer_invalid` before any audit insert or return cast
- send one direct RPC payload with `shipping_fee = -1`, one with `items[0].price = -1`, one with `items[0].quantity = 0`, and one with `items[0].product_match_status = 'bad'`; assert they raise `order_money_invalid` or `order_item_values_invalid` before any update or delete
- add `fulfillment_data` to an existing item and assert item replacement raises `order_item_replacement_has_historical_state`
- attach a `public.variant_inventory` row with `status <> 'reserved'` or `reservation_expires_at IS NULL` to an existing item and assert item replacement raises `cannot_delete_order_item_with_historical_serialized_units`
- attach a `private.variant_inventory_events` row with an event type outside `reserved`, `reservation_released`, and `reservation_expired` to an existing item and assert item replacement raises `cannot_delete_order_item_with_historical_inventory_events`
- insert one successful payment row in `public.transactions` with `status = 'completed'`, then assert replacing the item array raises `order_financial_edit_has_payments`
- set `orders.payment_status = 'paid'` on an otherwise unpaid order with no completed transaction row, then assert replacing the item array still raises `order_financial_edit_has_payments`
- call the same RPC with only `notes` changed and identical item/totals payload, then assert it succeeds and preserves original `order_items.id` values

- [ ] **Step 5: Run advisors and migration validation**

Run:

```bash
supabase db advisors
supabase migration list --local
psql $DATABASE_URL -v ON_ERROR_STOP=1 -f supabase/migrations/tests/admin_order_edit_audit.sql
```

Expected: no new security/performance advisor issues caused by this migration. If CLI advisors are unavailable, use Supabase MCP `get_advisors`.

- [ ] **Step 6: Commit**

Run:

```bash
git add supabase/migrations/*_mobile_admin_order_edit_audit.sql supabase/migrations/tests/admin_order_edit_audit.sql
git commit -m "feat(db): add atomic order edit audit trail"
```

---

## Task 3: Dedicated Web Order Edit Route

**Files:**
- Create `apps/web/src/app/api/orders/[id]/edit/route.ts`
- Create `apps/web/src/app/api/orders/[id]/edit/route.test.ts`

- [ ] **Step 1: Write failing route tests**

Test these behaviors in `route.test.ts`:
- returns `401` before parsing JSON when `authenticateApiRequest` fails
- returns `403` when CSRF fails
- returns `400` for invalid JSON
- returns `400` for invalid schema
- maps RPC `order_edit_forbidden` / `42501` to `403` when the caller lacks `orders.edit` for the target order merchant
- calls `rpc('update_admin_order', { p_order_id, p_payload })` on success
- maps `order_not_found` to `404`
- maps `order_financial_edit_has_payments` and `order_financial_edit_after_fulfillment` to `409`
- maps `order_total_negative` to `400`
- maps `branch_id_invalid`, `customer_id_invalid`, `order_required_fields_invalid`, `order_notify_customer_invalid`, `order_money_invalid`, `order_item_values_invalid`, `order_item_product_invalid`, and `order_item_variant_invalid` to `400`
- maps `order_terminal_not_editable` to `409`
- maps `order_item_replacement_has_historical_state` to `409`
- maps `cannot_delete_order_item_with_historical_serialized_units` and `cannot_delete_order_item_with_historical_inventory_events` to `409`
- maps `order_item_product_required` to `400`
- maps `order_item_product_forbidden` and `order_item_variant_forbidden` to `403`
- fetches the updated order with explicit columns after the RPC, normalizes Supabase `order_items` to mobile `items`, and returns it as `{ order, edit }`
- returns the RPC edit metadata without customer email scheduling; Task 4 wires `sendOrderUpdatedEmail` into this route after the helper exists

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --filter @baci/web exec vitest run 'src/app/api/orders/[id]/edit/route.test.ts'
```

Expected: FAIL because route does not exist.

- [ ] **Step 3: Implement route**

Create `apps/web/src/app/api/orders/[id]/edit/route.ts` with this structure:

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { MOBILE_ADMIN_ORDER_COLUMNS } from '@baci/shared';
import { z } from 'zod';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { adminOrderEditSchema } from '@/schemas/admin-order-edit';

const paramsSchema = z.object({
  id: z.uuid(),
});

const updatedOrderSelect = `${MOBILE_ADMIN_ORDER_COLUMNS}, order_items(id, product_id, condition, has_assurance, image_url, item_description, product_match_status, variant_id, variant_name, variant_attributes, name, quantity, price)`;

function mapOrderEditError(error: { code?: string; message?: string }) {
  const message = error.message ?? 'Failed to update order';

  if (message.includes('order_not_found')) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (message.includes('order_edit_forbidden') || error.code === '42501') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (
    message.includes('order_financial_edit_has_payments') ||
    message.includes('order_financial_edit_after_fulfillment') ||
    message.includes('order_terminal_not_editable') ||
    message.includes('order_item_replacement_has_historical_state') ||
    message.includes('cannot_delete_order_item_with_historical_serialized_units') ||
    message.includes('cannot_delete_order_item_with_historical_inventory_events')
  ) {
    return NextResponse.json(
      {
        code: 'order_not_editable',
        error:
          'This order has payments or fulfillment history. Financial edits are locked.',
      },
      { status: 409 }
    );
  }

  if (
    message.includes('branch_not_found') ||
    message.includes('customer_not_found') ||
    message.includes('branch_id_invalid') ||
    message.includes('customer_id_invalid') ||
    message.includes('order_required_fields_invalid') ||
    message.includes('order_notify_customer_invalid') ||
    message.includes('order_money_invalid') ||
    message.includes('order_item_values_invalid') ||
    message.includes('order_item_product_invalid') ||
    message.includes('order_item_variant_invalid') ||
    message.includes('order_item_product_required')
  ) {
    return NextResponse.json({ error: 'Invalid order scope' }, { status: 400 });
  }

  if (message.includes('order_total_negative')) {
    return NextResponse.json(
      { error: 'Discount cannot exceed the order total' },
      { status: 400 }
    );
  }

  if (
    message.includes('order_item_product_forbidden') ||
    message.includes('order_item_variant_forbidden')
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const supabase = auth.supabase;

  const { valid, response } = await checkCsrfProtection(request);
  if (!valid) {
    return (
      response ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  const paramsResult = paramsSchema.safeParse(await context.params);
  if (!paramsResult.success) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const parsed = adminOrderEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: z.flattenError(parsed.error) },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc('update_admin_order', {
    p_order_id: paramsResult.data.id,
    p_payload: parsed.data,
  });

  if (error) {
    return mapOrderEditError(error);
  }

  const result = data as {
    change_category?: string;
    changed_fields?: string[];
    customer_email?: string | null;
    merchant_id?: string;
    notify_customer?: boolean;
    order_id?: string;
  };

  const { data: updatedOrder, error: updatedOrderError } = await supabase
    .from('orders')
    .select(updatedOrderSelect)
    .eq('id', paramsResult.data.id)
    .eq('merchant_id', result.merchant_id ?? '')
    .single();

  if (updatedOrderError || !updatedOrder) {
    return NextResponse.json(
      { error: 'Order updated but refresh failed' },
      { status: 500 }
    );
  }

  const normalizedOrder = updatedOrder as Record<string, unknown> & {
    order_items?: unknown[];
  };
  const { order_items: orderItems, ...orderFields } = normalizedOrder;

  return NextResponse.json({
    edit: data,
    order: {
      ...orderFields,
      items: orderItems ?? [],
    },
  });
}
```

- [ ] **Step 4: Run route test**

Run:

```bash
pnpm --filter @baci/web exec vitest run 'src/app/api/orders/[id]/edit/route.test.ts'
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/src/app/api/orders/[id]/edit/route.ts apps/web/src/app/api/orders/[id]/edit/route.test.ts
git commit -m "feat(web): add mobile admin order edit route"
```

---

## Task 4: Order Updated Email

**Files:**
- Modify `apps/web/src/lib/email-templates.ts`
- Modify `apps/web/src/lib/email-templates.test.ts`
- Create `apps/web/src/lib/order-update-email.ts`
- Create `apps/web/src/lib/order-update-email.test.ts`
- Modify `apps/web/src/app/api/orders/[id]/edit/route.ts`
- Modify `apps/web/src/app/api/orders/[id]/edit/route.test.ts`

- [ ] **Step 1: Add failing template tests**

Add tests that assert:
- `generateOrderUpdatedEmail` includes the order number, merchant name, and human-readable changed fields
- `generateOrderUpdatedText` contains no HTML tags
- blank changed fields renders a generic "Your order was updated" message

- [ ] **Step 2: Implement template exports**

Add these exports to `apps/web/src/lib/email-templates.ts`:

```ts
interface OrderUpdatedData extends MerchantRegistrationInfo {
  changedFieldLabels: string[];
  customerName: string;
  merchantName: string;
  orderNumber: string;
}

export function generateOrderUpdatedEmail(data: OrderUpdatedData): string {
  const changedFields =
    data.changedFieldLabels.length > 0
      ? data.changedFieldLabels.map((field) => `<li>${escapeHtml(field)}</li>`).join('')
      : '<li>Order details</li>';

  return `
    <div>
      <h1>Your order was updated</h1>
      <p>Hello ${escapeHtml(data.customerName)},</p>
      <p>${escapeHtml(data.merchantName)} updated order ${escapeHtml(data.orderNumber)}.</p>
      <ul>${changedFields}</ul>
      <p>If you have questions, reply to this email or contact the merchant.</p>
    </div>
  `;
}

export function generateOrderUpdatedText(data: OrderUpdatedData): string {
  const changedFields =
    data.changedFieldLabels.length > 0
      ? data.changedFieldLabels.join(', ')
      : 'Order details';

  return [
    'Your order was updated',
    `Hello ${data.customerName},`,
    `${data.merchantName} updated order ${data.orderNumber}.`,
    `Changed: ${changedFields}.`,
    'If you have questions, reply to this email or contact the merchant.',
  ].join('\n\n');
}
```

Use the existing `escapeHtml` import from `@/lib/sanitize-core`; do not add a second local HTML escaping helper.

- [ ] **Step 3: Create email helper**

Create `apps/web/src/lib/order-update-email.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  generateOrderUpdatedEmail,
  generateOrderUpdatedText,
} from '@/lib/email-templates';
import { sendEmail } from '@/lib/zeptomail';

const FIELD_LABELS: Record<string, string> = {
  customer_email: 'Customer email',
  customer_name: 'Customer name',
  customer_phone: 'Customer phone',
  discount_amount: 'Discount',
  gift_wrapping_fee: 'Gift wrapping',
  items: 'Items',
  shipping_address: 'Delivery address',
  shipping_fee: 'Shipping fee',
  tax_amount: 'Tax',
  tax_exclusive_amount: 'Tax-exclusive amount',
  tax_inclusive_amount: 'Tax-inclusive amount',
  total: 'Order total',
};

export async function sendOrderUpdatedEmail({
  changedFields,
  customerEmail,
  merchantId,
  orderId,
  supabase,
}: {
  changedFields: string[];
  customerEmail: string;
  merchantId: string;
  orderId: string;
  supabase: SupabaseClient;
}) {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, customer_id, customer_name')
    .eq('id', orderId)
    .eq('merchant_id', merchantId)
    .single();

  if (orderError || !order) {
    throw new Error(orderError?.message ?? 'Order not found');
  }

  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('id, business_name')
    .eq('id', merchantId)
    .single();

  if (merchantError || !merchant) {
    throw new Error(merchantError?.message ?? 'Merchant not found');
  }

  const changedFieldLabels = changedFields
    .map((field) => FIELD_LABELS[field])
    .filter((label): label is string => Boolean(label));

  return sendEmail({
    auditContext: {
      customerId: order.customer_id,
      merchantId,
      metadata: {
        changedFields,
        trigger: 'order_updated',
      },
      orderId,
    },
    emailType: 'orders',
    htmlContent: generateOrderUpdatedEmail({
      changedFieldLabels,
      customerName: order.customer_name,
      merchantName: merchant.business_name,
      orderNumber: order.order_number,
    }),
    subject: `Order ${order.order_number} was updated`,
    textContent: generateOrderUpdatedText({
      changedFieldLabels,
      customerName: order.customer_name,
      merchantName: merchant.business_name,
      orderNumber: order.order_number,
    }),
    to: customerEmail,
  });
}
```

- [ ] **Step 4: Wire customer email scheduling into the order edit route**

Update `apps/web/src/app/api/orders/[id]/edit/route.test.ts` to add the email scheduling cases after the route exists:
- schedules customer email only when `notify_customer` is true and the RPC result change category is `financial` or `customer_visible`
- does not schedule customer email for `internal` or `none` edit results
- logs but does not fail the route response when the background email task throws

Update `apps/web/src/app/api/orders/[id]/edit/route.ts` by adding the imports:

```ts
import { after, type NextRequest, NextResponse } from 'next/server';
import { sendOrderUpdatedEmail } from '@/lib/order-update-email';
```

Then insert this block after the `result` object is built and before the updated-order refresh query:

```ts
const shouldNotifyCustomer = Boolean(
  result.notify_customer &&
    (result.change_category === 'financial' ||
      result.change_category === 'customer_visible') &&
    result.customer_email &&
    result.merchant_id &&
    result.order_id
);

if (shouldNotifyCustomer) {
  after(async () => {
    try {
      await sendOrderUpdatedEmail({
        changedFields: result.changed_fields ?? [],
        customerEmail: result.customer_email ?? '',
        merchantId: result.merchant_id ?? '',
        orderId: result.order_id ?? '',
        supabase,
      });
    } catch (error) {
      const { logger } = await import('@/lib/logger');
      logger.error({
        error,
        message: 'Failed to send order updated email',
        orderId: result.order_id,
      });
    }
  });
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @baci/web exec vitest run src/lib/email-templates.test.ts src/lib/order-update-email.test.ts 'src/app/api/orders/[id]/edit/route.test.ts'
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web/src/lib/email-templates.ts apps/web/src/lib/email-templates.test.ts apps/web/src/lib/order-update-email.ts apps/web/src/lib/order-update-email.test.ts apps/web/src/app/api/orders/[id]/edit/route.ts apps/web/src/app/api/orders/[id]/edit/route.test.ts
git commit -m "feat(web): add order updated email"
```

---

## Task 5: Mobile API Hook and Detail Query Columns

**Files:**
- Modify `packages/shared/src/contracts/orders.ts`
- Create or modify `packages/shared/src/contracts/orders.test.ts`
- Modify `packages/shared/src/types/order.ts`
- Modify `apps/mobile-admin/components/orders/order-details.types.ts`
- Modify `apps/mobile-admin/hooks/orders/useOrderDetails.ts`
- Modify `apps/mobile-admin/hooks/orders/useOrderDetails.test.ts`
- Create `apps/mobile-admin/hooks/orders/useUpdateOrder.ts`
- Create `apps/mobile-admin/hooks/orders/useUpdateOrder.test.ts`
- Modify `apps/mobile-admin/hooks/useOrders.ts`

- [ ] **Step 1: Add contract regression**

Ensure `MOBILE_ADMIN_ORDER_COLUMNS` and the order detail item query include edit-required fields:
- `branch_id`
- `customer_id`
- `discount_amount`
- `gift_wrapping_fee`
- `tax_basis`
- `shipping_fee`
- `tax_exclusive_amount`
- `tax_inclusive_amount`
- `tax_amount`
- `source`
- `notes`
- `variant_id`
- `variant_name`
- `image_url`
- `item_description`
- `product_match_status`
- `variant_attributes`

In `apps/mobile-admin/hooks/orders/useOrderDetails.ts`, update the explicit `order_items` select inside `fetchOrderById` from:

```ts
'id, product_id, has_assurance, variant_name, name, quantity, price, products(name, images, condition, category, category_id, categories(name, slug))'
```

to:

```ts
'id, product_id, condition, has_assurance, image_url, item_description, product_match_status, variant_id, variant_name, variant_attributes, name, quantity, price, products(name, images, condition, category, category_id, categories(name, slug))'
```

Update `OrderItemRow` and the returned item mapper so edit mode receives:
- `condition: item.condition ?? product?.condition ?? undefined`
- `details: item.item_description ?? undefined`
- `image_url: item.image_url ?? product?.images?.[0]`
- `is_custom: !item.product_id`
- `product_match_status: item.product_match_status ?? undefined`
- `product_id: item.product_id`
- `variant_attributes: item.variant_attributes ?? undefined`
- `variant_id: item.variant_id ?? null`
- `variant_name: item.variant_name ?? undefined`

Update the consuming type surfaces at the same time:
- In `packages/shared/src/types/order.ts`, allow mobile order items to represent custom lines with `product_id: string | null`, add optional `item_description`, `details`, `is_custom`, `product_match_status`, `variant_id`, and `variant_attributes`, and add optional order-level `gift_wrapping_fee`, `tax_basis`, `tax_exclusive_amount`, and `tax_inclusive_amount`.
- In `apps/mobile-admin/components/orders/order-details.types.ts`, add the same edit-mode item fields to `OrderDetailsItem`, matching the mapper output from `useOrderDetails`, and add order-level `gift_wrapping_fee`, `tax_basis`, `tax_exclusive_amount`, and `tax_inclusive_amount` to `OrderDetailsRecord`.
- In `apps/mobile-admin/hooks/orders/useOrderDetails.test.ts`, assert the mapper preserves database `image_url`, `item_description`, `product_match_status`, `variant_id`, `variant_attributes`, nullable `product_id` for custom items, and the hidden `gift_wrapping_fee` and `tax_basis` values needed to submit an edit without changing existing financial components.

- [ ] **Step 2: Add failing update-hook test**

Test `useUpdateOrder` sends:

```json
{
  "branch_id": null,
  "customer": {
    "email": "ada@example.com",
    "id": "11111111-1111-1111-1111-111111111111",
    "name": "Ada Buyer",
    "phone": "+2348012345678"
  },
  "discount_amount": 0,
  "gift_wrapping_fee": 0,
  "items": [
    {
      "condition": null,
      "image_url": "https://cdn.example.test/iphone-13.jpg",
      "item_description": null,
      "name": "iPhone 13",
      "price": 500000,
      "product_id": "22222222-2222-2222-2222-222222222222",
      "product_match_status": "linked",
      "quantity": 1,
      "variant_id": null,
      "variant_attributes": {
        "color": "Black",
        "storage": "128GB"
      },
      "variant_name": null
    }
  ],
  "notes": null,
  "notify_customer": true,
  "shipping_address": {
    "address": "12 Allen Avenue",
    "city": "Ikeja",
    "name": "Ada Buyer",
    "phone": "+2348012345678",
    "state": "Lagos"
  },
  "shipping_fee": 2500,
  "source": "physical",
  "tax_amount": 0
}
```

to `https://example.test/api/orders/order-1/edit` with `PATCH`, parses `{ order: updatedOrder }`, invalidates `['order', orderId]`, `['orders', merchantId]`, `['order-counts', merchantId]`, and `['dashboard-stats', merchantId]` after a successful update, and does not invalidate when the update request fails. This hook has no optimistic cache writes, so use TanStack Query's current `onSuccess` invalidation pattern rather than `onSettled`.

- [ ] **Step 3: Implement `useUpdateOrder`**

Create `apps/mobile-admin/hooks/orders/useUpdateOrder.ts` following the `useOrderStatusUpdate.ts` pattern:

```ts
import type { Order } from '@baci/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BASE_URL } from '@/lib/api-client';
import { useMerchant } from '../useMerchant';
import { createAuthenticatedFetch } from './authenticated-fetch';
import { parseResponsePayload } from './response-utils';

const ORDER_UPDATE_TIMEOUT_MS = 20000;

export interface UpdateOrderPayload {
  branch_id: string | null;
  customer: {
    email?: string | null;
    id: string | null;
    name: string;
    phone?: string | null;
  };
  discount_amount: number;
  gift_wrapping_fee: number;
  items: Array<{
    condition?: string | null;
    image_url?: string | null;
    item_description?: string | null;
    name: string;
    price: number;
    product_id: string | null;
    product_match_status: 'custom' | 'linked' | 'unreviewed';
    quantity: number;
    variant_id: string | null;
    variant_attributes?: Record<string, unknown> | null;
    variant_name: string | null;
  }>;
  notes?: string | null;
  notify_customer: boolean;
  shipping_address: {
    address: string;
    city?: string;
    name: string;
    phone: string;
    state?: string;
  };
  shipping_fee: number;
  source: string;
  tax_amount: number;
}

async function updateOrder(orderId: string, payload: UpdateOrderPayload) {
  const response = await createAuthenticatedFetch(
    `${BASE_URL}/api/orders/${orderId}/edit`,
    {
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    },
    ORDER_UPDATE_TIMEOUT_MS
  );

  const responseText = await response.text();
  const parsed = parseResponsePayload(responseText);

  if (!response.ok) {
    throw new Error(
      parsed &&
        typeof parsed === 'object' &&
        'error' in parsed &&
        typeof parsed.error === 'string'
        ? parsed.error
        : responseText || `Request failed: ${response.status}`
    );
  }

  if (!parsed || typeof parsed !== 'object' || !('order' in parsed)) {
    throw new Error('Failed to update order');
  }

  return parsed.order as Order;
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();

  return useMutation<
    Order,
    Error,
    { orderId: string; payload: UpdateOrderPayload }
  >({
    mutationFn: ({ orderId, payload }) => updateOrder(orderId, payload),
    mutationKey: ['updateOrder'],
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['order', variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders', merchant?.id] });
      queryClient.invalidateQueries({
        queryKey: ['order-counts', merchant?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['dashboard-stats', merchant?.id],
      });
    },
  });
}
```

- [ ] **Step 4: Export hook**

Add `export { useUpdateOrder } from './orders/useUpdateOrder';` to `apps/mobile-admin/hooks/useOrders.ts`.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter baci-mobile-admin exec vitest run hooks/orders/useUpdateOrder.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add packages/shared/src/contracts/orders.ts packages/shared/src/contracts/orders.test.ts packages/shared/src/types/order.ts apps/mobile-admin/components/orders/order-details.types.ts apps/mobile-admin/hooks/orders/useOrderDetails.ts apps/mobile-admin/hooks/orders/useOrderDetails.test.ts apps/mobile-admin/hooks/orders/useUpdateOrder.ts apps/mobile-admin/hooks/orders/useUpdateOrder.test.ts apps/mobile-admin/hooks/useOrders.ts
git commit -m "feat(mobile-admin): add order update API hook"
```

---

## Task 6: Product-First Variant Picker for Order Forms

**Files:**
- Create `apps/mobile-admin/lib/product-variant-option-selector.ts`
- Create `apps/mobile-admin/lib/product-variant-option-selector.test.ts`
- Modify `apps/mobile-admin/lib/manual-order-line-item.ts`
- Modify `apps/mobile-admin/lib/manual-order-line-item.test.ts`
- Modify `apps/mobile-admin/lib/manual-order-persistence.ts`
- Modify `apps/mobile-admin/lib/manual-order-persistence.test.ts`
- Modify `apps/mobile-admin/hooks/submitNewOrder.ts`
- Modify `apps/mobile-admin/hooks/submitNewOrder.test.ts`
- Create `apps/mobile-admin/components/orders/ProductVariantOptionSelector.tsx`
- Create `apps/mobile-admin/components/orders/ProductVariantOptionSelector.test.tsx`
- Modify `apps/mobile-admin/components/orders/NewOrderProductSheet.tsx`
- Modify `apps/mobile-admin/components/orders/NewOrderProductSheet.test.tsx`
- Modify `apps/mobile-admin/components/orders/NewOrderProductSheet.variant.test.tsx`
- Modify `apps/mobile-admin/hooks/useNewOrderController.ts`
- Modify `apps/mobile-admin/hooks/createNewOrderProductActions.ts`

- [ ] **Step 1: Write failing selector-helper tests**

Create `apps/mobile-admin/lib/product-variant-option-selector.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildVariantOptionGroups,
  findMatchingVariantForOptions,
  getDefaultVariantOptions,
  shouldUseOptionSelector,
  type VariantOptionSelectable,
} from './product-variant-option-selector';

const variants: VariantOptionSelectable[] = [
  {
    condition: 'new',
    id: 'variant-1',
    name: 'Samsung Galaxy S26 12GB / Black / 256GB',
    price: 1100000,
    sku: 'S26-BLK-256',
    variant_attributes: { color: 'Black', ram: '12GB', storage: '256GB' },
  },
  {
    condition: 'new',
    id: 'variant-2',
    name: 'Samsung Galaxy S26 12GB / Black / 512GB',
    price: 1270000,
    sku: 'S26-BLK-512',
    variant_attributes: { color: 'Black', ram: '12GB', storage: '512GB' },
  },
  {
    condition: 'open_box',
    id: 'variant-3',
    name: 'Samsung Galaxy S26 12GB / Silver / 512GB',
    price: 1150000,
    sku: 'S26-SLV-512-OB',
    variant_attributes: { color: 'Silver', ram: '12GB', storage: '512GB' },
  },
];

describe('variant option selector', () => {
  it('builds condition and attribute groups from variant rows', () => {
    const groups = buildVariantOptionGroups({
      selectedOptions: {},
      variants,
    });

    expect(groups.map((group) => group.key)).toEqual([
      'condition',
      'color',
      'ram',
      'storage',
    ]);
    expect(groups.find((group) => group.key === 'color')?.options).toEqual([
      { available: true, label: 'Black', selected: false, value: 'Black' },
      { available: true, label: 'Silver', selected: false, value: 'Silver' },
    ]);
  });

  it('marks incompatible options unavailable after a partial selection', () => {
    const groups = buildVariantOptionGroups({
      selectedOptions: { color: 'Silver' },
      variants,
    });

    expect(groups.find((group) => group.key === 'storage')?.options).toEqual([
      { available: false, label: '256GB', selected: false, value: '256GB' },
      { available: true, label: '512GB', selected: false, value: '512GB' },
    ]);
  });

  it('resolves a matching variant only when every group has a compatible selection', () => {
    expect(
      findMatchingVariantForOptions({
        selectedOptions: {
          color: 'Black',
          condition: 'new',
          ram: '12GB',
          storage: '512GB',
        },
        variants,
      })?.id
    ).toBe('variant-2');

    expect(
      findMatchingVariantForOptions({
        selectedOptions: {
          color: 'Black',
          condition: 'new',
          ram: '12GB',
        },
        variants,
      })
    ).toBeNull();
  });

  it('auto-selects single-value option groups', () => {
    expect(
      getDefaultVariantOptions({
        variants,
      })
    ).toEqual({ ram: '12GB' });
  });

  it('falls back to the old list when variants do not have structured option groups', () => {
    expect(
      shouldUseOptionSelector([
        {
          condition: null,
          id: 'variant-4',
          name: 'Loose accessory bundle',
          price: 1000,
          sku: null,
          variant_attributes: null,
        },
      ])
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
pnpm --filter baci-mobile-admin exec vitest run lib/product-variant-option-selector.test.ts
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement selector helper**

Create `apps/mobile-admin/lib/product-variant-option-selector.ts`:

```ts
export interface VariantOptionSelectable {
  condition?: string | null;
  id: string;
  images?: string[] | null;
  name: string;
  price: number;
  sku: string | null;
  variant_attributes: unknown;
}

export interface VariantOptionState {
  available: boolean;
  label: string;
  selected: boolean;
  value: string;
}

export interface VariantOptionGroup {
  key: string;
  label: string;
  options: VariantOptionState[];
}

export type SelectedVariantOptions = Record<string, string>;

function humanizeOptionKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeOptionValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

export function getVariantOptionRecord(
  variant: VariantOptionSelectable
): Record<string, string> {
  const record: Record<string, string> = {};

  if (variant.condition) {
    record.condition = variant.condition.replace(/_/g, ' ');
  }

  if (
    variant.variant_attributes &&
    typeof variant.variant_attributes === 'object' &&
    !Array.isArray(variant.variant_attributes)
  ) {
    for (const [key, value] of Object.entries(
      variant.variant_attributes as Record<string, unknown>
    )) {
      const normalizedValue = normalizeOptionValue(value);
      if (normalizedValue) {
        record[key] = normalizedValue;
      }
    }
  }

  return record;
}

function variantMatchesSelection(
  variant: VariantOptionSelectable,
  selectedOptions: SelectedVariantOptions,
  ignoredKey?: string
): boolean {
  const variantOptions = getVariantOptionRecord(variant);

  return Object.entries(selectedOptions).every(([key, value]) => {
    if (key === ignoredKey || !value) {
      return true;
    }

    return variantOptions[key] === value;
  });
}

export function buildVariantOptionGroups({
  selectedOptions,
  variants,
}: {
  selectedOptions: SelectedVariantOptions;
  variants: VariantOptionSelectable[];
}): VariantOptionGroup[] {
  const optionValues = new Map<string, string[]>();

  for (const variant of variants) {
    const variantOptions = getVariantOptionRecord(variant);
    for (const [key, value] of Object.entries(variantOptions)) {
      optionValues.set(key, [...(optionValues.get(key) ?? []), value]);
    }
  }

  return Array.from(optionValues.entries()).map(([key, values]) => {
    const uniqueValues = Array.from(new Set(values));

    return {
      key,
      label: humanizeOptionKey(key),
      options: uniqueValues.map((value) => ({
        available: variants.some((variant) => {
          const variantOptions = getVariantOptionRecord(variant);
          return (
            variantOptions[key] === value &&
            variantMatchesSelection(variant, selectedOptions, key)
          );
        }),
        label: value,
        selected: selectedOptions[key] === value,
        value,
      })),
    };
  });
}

export function findMatchingVariantForOptions<
  TVariant extends VariantOptionSelectable,
>({
  selectedOptions,
  variants,
}: {
  selectedOptions: SelectedVariantOptions;
  variants: TVariant[];
}): TVariant | null {
  const groups = buildVariantOptionGroups({ selectedOptions, variants });
  if (groups.some((group) => !selectedOptions[group.key])) {
    return null;
  }

  const matches = variants.filter((variant) =>
    variantMatchesSelection(variant, selectedOptions)
  );

  return matches.length === 1 ? matches[0] : null;
}

export function getDefaultVariantOptions({
  variants,
}: {
  variants: VariantOptionSelectable[];
}): SelectedVariantOptions {
  const groups = buildVariantOptionGroups({ selectedOptions: {}, variants });
  return Object.fromEntries(
    groups
      .filter((group) => group.options.length === 1)
      .map((group) => [group.key, group.options[0].value])
  );
}

export function shouldUseOptionSelector(
  variants: VariantOptionSelectable[]
): boolean {
  const groups = buildVariantOptionGroups({ selectedOptions: {}, variants });
  return groups.length > 0 && variants.length > 1;
}
```

- [ ] **Step 4: Run helper test**

Run:

```bash
pnpm --filter baci-mobile-admin exec vitest run lib/product-variant-option-selector.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing UI tests**

Create `apps/mobile-admin/components/orders/ProductVariantOptionSelector.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ProductVariantOptionSelector } from './ProductVariantOptionSelector';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { disabled?: boolean };
      children?: ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          'aria-disabled': accessibilityState?.disabled ? 'true' : undefined,
          disabled,
          onClick: () => {
            if (!disabled) {
              onPress?.();
            }
          },
          role: accessibilityRole,
          type: 'button',
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
  };
});

const colors = {
  border: '#e2e8f0',
  card: '#ffffff',
  cardHover: '#f1f5f9',
  primary: '#2563eb',
  text: '#0f172a',
  textMuted: '#94a3b8',
  textOnPrimary: '#ffffff',
  textSecondary: '#64748b',
};

const variants = [
  {
    condition: 'new',
    id: 'variant-1',
    images: ['black.jpg'],
    name: 'Samsung Galaxy S26 12GB / Black / 256GB',
    price: 1100000,
    sku: 'S26-BLK-256',
    variant_attributes: { color: 'Black', ram: '12GB', storage: '256GB' },
  },
  {
    condition: 'new',
    id: 'variant-2',
    images: ['black.jpg'],
    name: 'Samsung Galaxy S26 12GB / Black / 512GB',
    price: 1270000,
    sku: 'S26-BLK-512',
    variant_attributes: { color: 'Black', ram: '12GB', storage: '512GB' },
  },
];

describe('ProductVariantOptionSelector', () => {
  it('shows the parent product and lets the user tap options before adding', () => {
    const onSelectOption = vi.fn();
    const onAddSelectedVariant = vi.fn();

    render(
      <ProductVariantOptionSelector
        colors={colors}
        formatPrice={(amount) => `₦${amount}`}
        onAddSelectedVariant={onAddSelectedVariant}
        onSelectOption={onSelectOption}
        parentProductName="Samsung Galaxy S26"
        selectedOptions={{ color: 'Black', condition: 'new', ram: '12GB' }}
        selectedVariant={null}
        variants={variants}
      />
    );

    expect(screen.getByText('Samsung Galaxy S26')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Select Storage 512GB' }));
    expect(onSelectOption).toHaveBeenCalledWith('storage', '512GB');
    expect(screen.getByRole('button', { name: 'Add selected variant' })).toBeDisabled();
  });

  it('enables add when one variant is resolved', () => {
    const onAddSelectedVariant = vi.fn();

    render(
      <ProductVariantOptionSelector
        colors={colors}
        formatPrice={(amount) => `₦${amount}`}
        onAddSelectedVariant={onAddSelectedVariant}
        onSelectOption={vi.fn()}
        parentProductName="Samsung Galaxy S26"
        selectedOptions={{
          color: 'Black',
          condition: 'new',
          ram: '12GB',
          storage: '512GB',
        }}
        selectedVariant={variants[1]}
        variants={variants}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add selected variant' }));
    expect(onAddSelectedVariant).toHaveBeenCalledWith(variants[1]);
  });
});
```

- [ ] **Step 6: Implement product-first variant UI**

Create `apps/mobile-admin/components/orders/ProductVariantOptionSelector.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import {
  buildVariantOptionGroups,
  type SelectedVariantOptions,
  type VariantOptionSelectable,
} from '@/lib/product-variant-option-selector';

interface ProductVariantOptionSelectorProps<
  TVariant extends VariantOptionSelectable,
> {
  colors: Pick<
    ThemeColors,
    | 'border'
    | 'card'
    | 'cardHover'
    | 'primary'
    | 'text'
    | 'textMuted'
    | 'textOnPrimary'
    | 'textSecondary'
  >;
  formatPrice: (amount: number) => string;
  onAddSelectedVariant: (variant: TVariant) => void;
  onSelectOption: (key: string, value: string) => void;
  parentProductName: string;
  selectedOptions: SelectedVariantOptions;
  selectedVariant: TVariant | null;
  variants: TVariant[];
}

export function ProductVariantOptionSelector<
  TVariant extends VariantOptionSelectable,
>({
  colors,
  formatPrice,
  onAddSelectedVariant,
  onSelectOption,
  parentProductName,
  selectedOptions,
  selectedVariant,
  variants,
}: ProductVariantOptionSelectorProps<TVariant>) {
  const groups = buildVariantOptionGroups({ selectedOptions, variants });
  const minPrice = Math.min(...variants.map((variant) => variant.price));
  const maxPrice = Math.max(...variants.map((variant) => variant.price));
  const priceLabel =
    minPrice === maxPrice
      ? formatPrice(minPrice)
      : `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.productCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.productName, { color: colors.text }]}>
          {parentProductName}
        </Text>
        <Text style={[styles.priceRange, { color: colors.textSecondary }]}>
          {priceLabel}
        </Text>
      </View>

      {groups.map((group) => (
        <View key={group.key} style={styles.group}>
          <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>
            {group.label}
          </Text>
          <View style={styles.options}>
            {group.options.map((option) => (
              <Pressable
                accessibilityLabel={`Select ${group.label} ${option.label}`}
                accessibilityRole="button"
                disabled={!option.available}
                key={option.value}
                onPress={() => onSelectOption(group.key, option.value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: option.selected
                      ? colors.primary
                      : colors.cardHover,
                    borderColor: option.selected
                      ? colors.primary
                      : colors.border,
                    opacity: option.available ? 1 : 0.35,
                  },
                ]}
              >
                <Text
                  style={{
                    color: option.selected
                      ? colors.textOnPrimary
                      : colors.text,
                    fontWeight: option.selected ? '700' : '500',
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      <Pressable
        accessibilityLabel="Add selected variant"
        accessibilityRole="button"
        accessibilityState={{ disabled: !selectedVariant }}
        disabled={!selectedVariant}
        onPress={() => {
          if (selectedVariant) {
            onAddSelectedVariant(selectedVariant);
          }
        }}
        style={[
          styles.addButton,
          {
            backgroundColor: selectedVariant ? colors.primary : colors.border,
          },
        ]}
      >
        <Text style={[styles.addButtonText, { color: colors.textOnPrimary }]}>
          Add selected variant
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  container: {
    flex: 1,
    paddingBottom: 24,
  },
  group: {
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priceRange: {
    fontSize: 13,
    marginTop: 4,
  },
  productCard: {
    borderRadius: 12,
    borderWidth: 1,
    margin: 16,
    padding: 14,
  },
  productName: {
    fontSize: 17,
    fontWeight: '700',
  },
});
```

- [ ] **Step 7: Wire selector state into the controller**

Before wiring the UI, update `apps/mobile-admin/lib/manual-order-line-item.ts` so the chosen variant attributes survive into `orderItems` and later into the edit payload:

```ts
export interface ManualOrderLineItem {
  condition?: string;
  id: string;
  image_url?: string;
  name: string;
  price: number;
  product_id: string | null;
  quantity: number;
  variant_attributes?: Record<string, unknown> | null;
  variant_id: string | null;
  variant_name: string | null;
}
```

In `buildManualOrderLineItem`, add:

```ts
const variantAttributes =
  args.product.variant_attributes &&
  typeof args.product.variant_attributes === 'object' &&
  !Array.isArray(args.product.variant_attributes)
    ? (args.product.variant_attributes as Record<string, unknown>)
    : null;
```

Then include it in the returned object without adding a new key for products that do not have attributes, so the existing exact-object tests keep passing:

```ts
...(variantAttributes ? { variant_attributes: variantAttributes } : {}),
```

Add a regression to `apps/mobile-admin/lib/manual-order-line-item.test.ts` asserting a selected product with `variant_attributes: { color: 'Black', storage: '512GB' }` returns the same `variant_attributes` on the built line item. Update the existing variant-row expectation that already passes `variant_attributes: { color: 'Space Gray', condition: 'Used' }` so it expects that object in the result.

Update `apps/mobile-admin/lib/manual-order-persistence.ts` so `OrderItemInsertRow` accepts the snapshot column:

```ts
variant_attributes?: Record<string, unknown> | null;
```

Do not add `variant_attributes` to `OptionalOrderItemInsertColumn`; the migration baseline already has that column, and silently dropping it would recreate the snapshot-loss bug.

Update `apps/mobile-admin/hooks/submitNewOrder.ts` so `buildItems()` passes the field through:

```ts
variant_attributes: item.variant_attributes ?? null,
```

Add regressions:
- `apps/mobile-admin/lib/manual-order-persistence.test.ts` keeps `variant_attributes` in the first insert attempt.
- `apps/mobile-admin/hooks/submitNewOrder.test.ts` asserts `payload.buildItems('order-1')[0].variant_attributes` equals the selected order item's `{ color: 'Black', storage: '512GB' }`.

Modify `apps/mobile-admin/hooks/useNewOrderController.ts`:
- add `const [selectedVariantOptions, setSelectedVariantOptions] = useState<Record<string, string>>({});`
- add `const [currentVariantSourceKey, setCurrentVariantSourceKey] = useState('');`
- import `findMatchingVariantForOptions`, `getDefaultVariantOptions`, and `shouldUseOptionSelector` from `@/lib/product-variant-option-selector`.
- compute `selectedVariantProduct` once, after the option-default reset guard shown below.
- initialize option defaults only when the variant row set changes, using the same guarded render-phase state-reset pattern already used in this controller for VAT:

```ts
const useVariantOptionSelector =
  isPickingVariant && shouldUseOptionSelector(selectableProductRows);
const selectedVariantSourceKey = useVariantOptionSelector
  ? selectableProductRows.map((row) => row.id).join('|')
  : '';
if (selectedVariantSourceKey !== currentVariantSourceKey) {
  setCurrentVariantSourceKey(selectedVariantSourceKey);
  setSelectedVariantOptions(
    useVariantOptionSelector
      ? getDefaultVariantOptions({ variants: selectableProductRows })
      : {}
  );
}

const selectedVariantProduct = useVariantOptionSelector
  ? findMatchingVariantForOptions({
      selectedOptions: selectedVariantOptions,
      variants: selectableProductRows,
    })
  : null;
```

Name the state variable that stores the previous source key `currentVariantSourceKey` to avoid shadowing the computed `selectedVariantSourceKey`.
- return `selectedVariantOptions`, `selectedVariantProduct`, `setSelectedVariantOptions`, and `useVariantOptionSelector`.
- reset `selectedVariantOptions` and `currentVariantSourceKey` in `resetOrderDraft` and when `resetProductPickerState` runs.

Modify `apps/mobile-admin/hooks/createNewOrderProductActions.ts`:
- accept `setSelectedVariantOptions`
- accept `setCurrentVariantSourceKey`
- clear `selectedVariantOptions` inside `resetProductPickerState`
- clear `currentVariantSourceKey` inside `resetProductPickerState`
- add:

```ts
const handleSelectVariantOption = (key: string, value: string) => {
  setSelectedVariantOptions((previous) => ({
    ...previous,
    [key]: value,
  }));
};
```

- return `handleSelectVariantOption`.

- [ ] **Step 8: Replace the dense variant list in `NewOrderProductSheet`**

When `isPickingVariant && selectedParentProduct && useVariantOptionSelector`, render:

```tsx
<ProductVariantOptionSelector
  colors={colors}
  formatPrice={formatPrice}
  onAddSelectedVariant={(variant) =>
    handleAddProduct({
      ...variant,
      images:
        variant.images && variant.images.length > 0
          ? variant.images
          : (selectedParentProduct.images ?? []),
    })
  }
  onSelectOption={handleSelectVariantOption}
  parentProductName={selectedParentProduct.name}
  selectedOptions={selectedVariantOptions}
  selectedVariant={selectedVariantProduct}
  variants={selectableProductRows}
/>
```

Keep the old `FlatList` path only when `useVariantOptionSelector` is false, so unstructured variants still work.

Update the existing dedicated variant-mode test in `apps/mobile-admin/components/orders/NewOrderProductSheet.variant.test.tsx` instead of relying only on `NewOrderProductSheet.test.tsx`:
- keep the current fallback-list regression where `variant_attributes` is an array and `useVariantOptionSelector` is false
- add controller fields `handleSelectVariantOption`, `selectedVariantOptions`, `selectedVariantProduct`, and `useVariantOptionSelector` to the test helper
- add a structured variant regression where `useVariantOptionSelector` is true, tapping `Select Storage 512GB` calls `handleSelectVariantOption('storage', '512GB')`, and tapping `Add selected variant` calls `handleAddProduct` with the selected variant plus fallback parent images

- [ ] **Step 9: Run variant picker tests**

Run:

```bash
pnpm --filter baci-mobile-admin exec vitest run lib/manual-order-line-item.test.ts lib/manual-order-persistence.test.ts hooks/submitNewOrder.test.ts lib/product-variant-option-selector.test.ts components/orders/ProductVariantOptionSelector.test.tsx components/orders/NewOrderProductSheet.test.tsx components/orders/NewOrderProductSheet.variant.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```bash
git add apps/mobile-admin/lib/manual-order-line-item.ts apps/mobile-admin/lib/manual-order-line-item.test.ts apps/mobile-admin/lib/manual-order-persistence.ts apps/mobile-admin/lib/manual-order-persistence.test.ts apps/mobile-admin/hooks/submitNewOrder.ts apps/mobile-admin/hooks/submitNewOrder.test.ts apps/mobile-admin/lib/product-variant-option-selector.ts apps/mobile-admin/lib/product-variant-option-selector.test.ts apps/mobile-admin/components/orders/ProductVariantOptionSelector.tsx apps/mobile-admin/components/orders/ProductVariantOptionSelector.test.tsx apps/mobile-admin/components/orders/NewOrderProductSheet.tsx apps/mobile-admin/components/orders/NewOrderProductSheet.test.tsx apps/mobile-admin/components/orders/NewOrderProductSheet.variant.test.tsx apps/mobile-admin/hooks/useNewOrderController.ts apps/mobile-admin/hooks/createNewOrderProductActions.ts
git commit -m "feat(mobile-admin): simplify order variant selection"
```

---

## Task 7: Shared Mobile Order Form Contract and Edit Controller

**Files:**
- Create `apps/mobile-admin/components/orders/order-form-controller.types.ts`
- Modify `apps/mobile-admin/components/orders/NewOrder*.tsx`
- Modify `apps/mobile-admin/components/orders/new-order.types.ts`
- Create `apps/mobile-admin/hooks/useEditOrderController.ts`
- Create `apps/mobile-admin/hooks/useEditOrderController.test.ts`

- [ ] **Step 1: Introduce shared form controller type**

Create `apps/mobile-admin/components/orders/order-form-controller.types.ts` with a primary interface containing the fields consumed by the existing form components. Start with the components that edit mode needs:
- `NewOrderDetailsSection`
- `NewOrderChannelSection`
- `NewOrderItemsSection`
- `NewOrderNotesSection`
- `NewOrderProductSheet`
- `ProductVariantOptionSelector`
- `NewOrderFinancialSheet`
- `NewOrderEditItemSheet`
- `NewOrderCustomerSheet`

Replace props like:

```ts
controller: ReturnType<typeof useNewOrderController>;
```

with:

```ts
import type { OrderFormController } from './order-form-controller.types';

controller: OrderFormController;
```

Do this only for components shared by new/edit screens. Leave new-order-only success handling in `NewOrderScreenContent`.

In `apps/mobile-admin/components/orders/new-order.types.ts`, add the edit-required snapshot field to `OrderItem`:

```ts
variant_attributes?: Record<string, unknown> | null;
```

- [ ] **Step 2: Add failing edit-controller tests**

Test `useEditOrderController`:
- returns loading state until `useOrder(orderId)` resolves
- returns an invalid-route state and does not fetch when `orderId` is blank
- maps existing order fields into `customer`, `deliveryInfo`, `orderItems`, `discount`, `shippingFee`, `taxes`, `selectedChannel`, `selectedBranchId`, and `notes`
- disables financial and item edits when `amount_paid > 0`, `wallet_amount_used > 0`, `payment_status` is `paid` / `partially_paid` / `bnpl_approved` / `refunded`, or `shipping_status` is `shipped` / `delivered`
- builds `UpdateOrderPayload` with sanitized items and `notify_customer`
- calls `useUpdateOrder().mutateAsync`
- shows a success modal and routes back with `{ pathname: '/(admin)/order/[id]', params: { id: orderId } }` after success

- [ ] **Step 3: Implement controller**

Create `apps/mobile-admin/hooks/useEditOrderController.ts` by reusing the state shape from `useNewOrderController`, but initialize from `useOrder(orderId)`. Keep submit behavior separate:

Expose a controller boolean such as `canEditFinancialFields` and set it to `false` when `amount_paid > 0`, `wallet_amount_used > 0`, `payment_status` is `paid` / `partially_paid` / `bnpl_approved` / `refunded`, or `shipping_status` is `shipped` / `delivered`. Shared form sections must use that boolean to disable item mutations plus discount, shipping fee, and tax controls while leaving customer, shipping contact/address, source, branch, notes, and notify-customer controls editable.

```ts
const handleSubmit = async () => {
  if (!orderId || !order) {
    return;
  }

  const sanitizedCustomerName =
    sanitizeCustomerName(customer.name) || 'Walk-in Customer';
  const sanitizedCustomerEmail = customer.email
    ? sanitizeEmail(customer.email)
    : null;
  const sanitizedCustomerPhone = customer.phone
    ? sanitizePhone(customer.phone)
    : null;
  const sanitizedCustomerAddress = customer.address
    ? sanitizeAddress(customer.address)
    : '';
  const sanitizedDeliveryInfo = {
    address: sanitizeAddress(deliveryInfo.address),
    city: sanitizeText(deliveryInfo.city, 100),
    name: sanitizeCustomerName(deliveryInfo.name) || sanitizedCustomerName,
    phone: sanitizePhone(deliveryInfo.phone),
    state: sanitizeText(deliveryInfo.state, 100),
  };

  await updateOrderMutation.mutateAsync({
    orderId,
    payload: {
      branch_id: selectedBranchId,
      customer: {
        email: sanitizedCustomerEmail,
        id: customer.id,
        name: sanitizedCustomerName,
        phone: sanitizedCustomerPhone,
      },
      discount_amount: discount,
      gift_wrapping_fee: order.gift_wrapping_fee ?? 0,
      items: orderItems.map((item) => ({
        condition: item.condition ?? null,
        image_url: item.image_url ?? null,
        item_description: item.details ? sanitizeText(item.details, 1000) : null,
        name: sanitizeText(item.name, 200),
        price: item.price,
        product_id: item.is_custom || !item.product_id ? null : item.product_id,
        product_match_status:
          item.product_match_status ??
          (item.is_custom || !item.product_id ? 'custom' : 'linked'),
        quantity: item.quantity,
        variant_id: item.is_custom || !item.product_id ? null : item.variant_id,
        variant_attributes: item.variant_attributes ?? null,
        variant_name:
          item.is_custom || !item.product_id ? null : item.variant_name,
      })),
      notes: notes.trim() ? sanitizeNotes(notes) : null,
      notify_customer: notifyCustomer,
      shipping_address: sameAsCustomer
        ? {
            address: sanitizedCustomerAddress,
            name: sanitizedCustomerName,
            phone: sanitizedCustomerPhone || '',
          }
        : sanitizedDeliveryInfo,
      shipping_fee: shippingFee,
      source: selectedChannel,
      tax_amount: taxesToUse,
    },
  });

  setShowSuccessModal(true);
};
```

Import `sanitizeAddress`, `sanitizeCustomerName`, `sanitizeEmail`, `sanitizeNotes`, `sanitizePhone`, and `sanitizeText` from `apps/mobile-admin/lib/sanitize.ts`.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --filter baci-mobile-admin exec vitest run hooks/useEditOrderController.test.ts
pnpm --filter baci-mobile-admin exec vitest run components/orders/NewOrderDetailsSection.test.tsx components/orders/NewOrderItemsSection.test.tsx components/orders/NewOrderFinancialSheet.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/mobile-admin/components/orders/order-form-controller.types.ts apps/mobile-admin/components/orders/NewOrder*.tsx apps/mobile-admin/components/orders/new-order.types.ts apps/mobile-admin/hooks/useEditOrderController.ts apps/mobile-admin/hooks/useEditOrderController.test.ts
git commit -m "feat(mobile-admin): add editable order form controller"
```

---

## Task 8: Mobile Edit Screen and Detail Entry Point

**Files:**
- Create `apps/mobile-admin/components/orders/EditOrderScreenContent.tsx`
- Create `apps/mobile-admin/components/orders/EditOrderScreenContent.test.tsx`
- Create `apps/mobile-admin/app/(admin)/order/edit.tsx`
- Modify `apps/mobile-admin/components/orders/OrderDetailsScreenContent.tsx`
- Modify `apps/mobile-admin/components/orders/OrderDetailsScreenContent.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Assert:
- order details header renders an accessible "Edit order" button when order is not cancelled or returned
- order details header hides "Edit order" for cancelled and returned orders
- pressing "Edit order" routes with `{ pathname: '/(admin)/order/edit', params: { id: orderId } }`
- edit screen renders the shared details/channel/items/notes sections
- edit screen has a "Notify customer" switch defaulted off
- save button is disabled while submitting
- paid or fulfilled orders render financial and item fields read-only with a short lock message, while customer/shipping/notes fields remain editable
- success modal action routes back with the explicit admin route shape `{ pathname: '/(admin)/order/[id]', params: { id: orderId } }`

- [ ] **Step 2: Implement edit screen**

Create `apps/mobile-admin/app/(admin)/order/edit.tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router';
import { EditOrderScreenContent } from '@/components/orders/EditOrderScreenContent';
import { InvalidRouteScreen } from '@/components/ui/InvalidRouteScreen';
import { useEditOrderController } from '@/hooks/useEditOrderController';

export default function EditOrderScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const controller = useEditOrderController(id ?? '');

  if (!id) {
    return (
      <InvalidRouteScreen
        message="The order ID is missing. Please go back and try again."
        title="Invalid Order"
      />
    );
  }

  return <EditOrderScreenContent controller={controller} />;
}
```

Create `EditOrderScreenContent.tsx` using the same visual structure as `NewOrderScreenContent`, but with:
- header title `Edit Sale`
- header left `Cancel`
- footer primary action `Save Changes`
- notify customer switch above footer or near notes
- success modal action returns with `router.replace({ pathname: '/(admin)/order/[id]', params: { id: orderId } })`

- [ ] **Step 3: Add detail header edit button**

In `OrderDetailsScreenContent.tsx`, import `router` from `expo-router` alongside `Stack`, derive editability near `const order = controller.order`, and add an edit icon beside share only for non-terminal orders:

```tsx
const canEditOrder = !['cancelled', 'returned'].includes(
  order.shipping_status
);
```

Replace the existing single-button `headerRight` with:

```tsx
headerRight: () => (
  <View style={{ flexDirection: 'row', gap: 12 }}>
    {canEditOrder ? (
      <Pressable
        accessibilityLabel="Edit order"
        accessibilityRole="button"
        hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
        onPress={() => {
          router.push({ pathname: '/(admin)/order/edit', params: { id: order.id } });
        }}
        style={{ padding: 4 }}
      >
        <Ionicons
          name="create-outline"
          size={24}
          color={controller.colors.primary}
        />
      </Pressable>
    ) : null}
    <Pressable
      accessibilityLabel="Share order"
      accessibilityRole="button"
      hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
      onPress={() => {
        void controller.handleShare();
      }}
      style={{ padding: 4 }}
    >
      <Ionicons
        name="share-outline"
        size={24}
        color={controller.colors.primary}
      />
    </Pressable>
  </View>
)
```

Keep the existing share action.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --filter baci-mobile-admin exec vitest run components/orders/EditOrderScreenContent.test.tsx components/orders/OrderDetailsScreenContent.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add 'apps/mobile-admin/app/(admin)/order/edit.tsx' apps/mobile-admin/components/orders/EditOrderScreenContent.tsx apps/mobile-admin/components/orders/EditOrderScreenContent.test.tsx apps/mobile-admin/components/orders/OrderDetailsScreenContent.tsx apps/mobile-admin/components/orders/OrderDetailsScreenContent.test.tsx
git commit -m "feat(mobile-admin): add order edit screen"
```

---

## Task 9: Audit Trail Display in Mobile Admin

**Files:**
- Create `apps/mobile-admin/hooks/orders/useOrderAuditEvents.ts`
- Create `apps/mobile-admin/hooks/orders/useOrderAuditEvents.test.ts`
- Create `apps/mobile-admin/components/orders/OrderAuditTrailCard.tsx`
- Create `apps/mobile-admin/components/orders/OrderAuditTrailCard.test.tsx`
- Modify `apps/mobile-admin/components/orders/OrderDetailsScreenContent.tsx`

- [ ] **Step 1: Add query hook**

Create a hook that selects explicit columns:

```ts
supabase
  .from('order_audit_events')
  .select('id, created_at, actor_user_id, action, changed_fields, metadata')
  .eq('order_id', orderId)
  .eq('merchant_id', merchantId)
  .order('created_at', { ascending: false })
  .limit(10);
```

Do not use `select('*')`.

- [ ] **Step 2: Add card rendering tests**

Assert:
- empty state renders "No edits yet"
- changed fields are rendered as readable labels
- timestamp renders through existing date formatter
- the card does not expose raw JSON snapshots

- [ ] **Step 3: Render card on details**

Add `<OrderAuditTrailCard />` below shipping or below items/payment on `OrderDetailsScreenContent`. Keep it collapsed or compact if there are more than three rows.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --filter baci-mobile-admin exec vitest run hooks/orders/useOrderAuditEvents.test.ts components/orders/OrderAuditTrailCard.test.tsx components/orders/OrderDetailsScreenContent.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/mobile-admin/hooks/orders/useOrderAuditEvents.ts apps/mobile-admin/hooks/orders/useOrderAuditEvents.test.ts apps/mobile-admin/components/orders/OrderAuditTrailCard.tsx apps/mobile-admin/components/orders/OrderAuditTrailCard.test.tsx apps/mobile-admin/components/orders/OrderDetailsScreenContent.tsx
git commit -m "feat(mobile-admin): show order edit audit trail"
```

---

## Task 10: Final Verification

**Files:** No new files unless fixing defects found by verification.

- [ ] **Step 1: Targeted tests**

Run:

```bash
pnpm --filter @baci/web exec vitest run src/schemas/admin-order-edit.test.ts 'src/app/api/orders/[id]/edit/route.test.ts' src/lib/order-update-email.test.ts src/lib/email-templates.test.ts
pnpm --filter baci-mobile-admin exec vitest run lib/manual-order-line-item.test.ts lib/manual-order-persistence.test.ts lib/product-variant-option-selector.test.ts hooks/submitNewOrder.test.ts hooks/orders/useOrderDetails.test.ts components/orders/ProductVariantOptionSelector.test.tsx components/orders/NewOrderProductSheet.test.tsx components/orders/NewOrderProductSheet.variant.test.tsx hooks/orders/useUpdateOrder.test.ts hooks/useEditOrderController.test.ts components/orders/EditOrderScreenContent.test.tsx components/orders/OrderDetailsScreenContent.test.tsx components/orders/OrderAuditTrailCard.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Monorepo quality gate**

Run:

```bash
pnpm turbo lint && pnpm turbo typecheck
```

Expected: PASS. If unrelated existing failures appear, capture exact failures and run the smallest affected package checks for this feature.

- [ ] **Step 3: Full tests when feasible**

Run:

```bash
pnpm turbo test
```

Expected: PASS or documented unrelated failures.

- [ ] **Step 4: Android emulator QA only after tests pass**

Use the repo-owned path:

```bash
pnpm --filter baci-mobile-admin android:emulator
pnpm --filter baci-mobile-admin android:metro
pnpm --filter baci-mobile-admin android:install
pnpm --filter baci-mobile-admin android:launch
```

Manual QA checklist:
- Open an unpaid pending order.
- Tap edit.
- Change customer phone, shipping address, notes, and one item quantity.
- Add a product with many variants, such as a phone with condition/color/RAM/storage combinations.
- Confirm the picker shows the parent product and tappable option groups instead of a long "Choose Variant" row list.
- Tap condition, color, RAM, and storage options until the matching variant is resolved, then add it.
- Save without notification.
- Confirm details update and audit event appears.
- Repeat with "Notify customer" enabled for a customer-visible change.
- Open a paid order and a shipped/delivered unpaid order and confirm financial and item fields are locked while notes/shipping/customer fields remain editable.
- Confirm status update flow still works from the detail footer.

- [ ] **Step 5: CodeRabbit review**

Run:

```bash
coderabbit review --prompt-only -t uncommitted
```

Fix all critical/high findings before asking for merge.

---

## Self-Review

Spec coverage:
- Edit existing orders: Tasks 3, 5, 7, and 8.
- Product-first variant selection: Task 6.
- Audit trail: Tasks 2 and 9.
- Optional customer email: Tasks 3 and 4.
- Security/no service-role/no direct client audit writes: Tasks 0, 2, and 3.
- Payment/totals risk: Tasks 1 and 2 lock financial edits for paid/fulfilled orders.

Placeholder scan:
- No implementation task uses placeholder wording.
- The only generated filename is the Supabase migration, which must be produced by `supabase migration new` per repo and Supabase rules.

Type consistency:
- Mobile payload names match the web Zod schema.
- RPC return keys match the route email scheduling logic.
- Audit display reads from `order_audit_events`, not generic `audit_logs`.
