# Ogabassey BNPL Order Idempotency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop duplicate Ogabassey BNPL orders by making checkout order creation idempotent at the database boundary and by changing BNPL success copy so customers do not think an unpaid financing flow is a fully placed order.

**Architecture:** Keep the existing Ogabassey browser pending-order reuse flow as a convenience layer, but move the durable duplicate guard into `create_storefront_order` and the savings wrapper that can create storefront orders. The web storefront and mobile BNPL checkout both send a stable `Idempotency-Key` for the current commercial checkout fingerprint; `/api/orders` computes a server-side request hash from cart/customer/delivery/amount fields and passes both values into the active non-voucher order RPC. Payment provider is intentionally excluded from the order identity hash: Credit Direct -> Klump should reuse the same pending order and create/update a separate payment attempt/reference, not create a second order. Quiz voucher orders explicitly opt out of this checkout idempotency key because their one-time route-proof and award-claim semantics are already stricter than BNPL retries. Replay handling must still recover wallet/savings amounts through idempotent redemption paths before responding, so `amountDueToGateway` remains the residual payable amount rather than the full order total; stale Credit Direct webhooks must be ignored after a provider switch by comparing the webhook reference against the active Credit Direct transaction reference, not a stale session value.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Vitest, Supabase/Postgres migrations and PL/pgSQL RPCs, pnpm/Turborepo, Biome.

---

## File Structure

- Modify `apps/web/src/app/api/orders/route.ts`: compute a request hash from validated non-voucher order input, pass idempotency args into the selected non-voucher order RPC, recover wallet/savings residuals on replay, and suppress duplicate notification/email side effects.
- Create `apps/web/src/lib/checkout/order-idempotency.ts`: canonicalize commercial order identity data and hash it with SHA-256; exclude payment provider so BNPL provider switches reuse one order.
- Create `apps/web/src/lib/checkout/order-idempotency.test.ts`: regression tests for stable hashing, payment-provider switching, and commercial payload drift detection.
- Modify `apps/web/src/app/api/orders/route.test.ts`: assert idempotency args are sent through base/savings RPCs, voucher orders opt out, replay returns residual gateway amounts, replay suppresses notifications, and same-key/different-payload conflicts map to `409`.
- Create `apps/web/src/components/storefront/ogabassey/pages/checkout/checkout-idempotency.ts`: store/reuse a browser UUID per checkout fingerprint in `localStorage` with a TTL and safe storage fallback.
- Create `apps/web/src/components/storefront/ogabassey/pages/checkout/checkout-idempotency.test.ts`: test stable key reuse, cross-tab persistence, fingerprint rotation, TTL expiry, clearing, and safe storage failure fallback.
- Modify `apps/web/src/components/storefront/ogabassey/pages/checkout-page.tsx`: send `Idempotency-Key` on the order-create POST and preserve the key while the pending BNPL order remains reusable.
- Modify `apps/web/src/components/storefront/ogabassey/pages/checkout-page.test.tsx`: assert the checkout POST includes a stable idempotency key.
- Modify `apps/web/src/components/storefront/ogabassey/pages/checkout/pending-checkout-order.ts`: treat `bnpl_approved`/`refunded` as non-reusable in the client-side pending-order validator.
- Modify `apps/web/src/components/storefront/ogabassey/pages/checkout/pending-checkout-order.test.ts`: cover approved/refunded BNPL reuse rejection.
- Modify `apps/web/src/app/api/orders/reuse/route.test.ts`: cover reuse RPC rejection for approved/refunded BNPL orders.
- Modify `apps/web/src/components/storefront/ogabassey/pages/bnpl-launcher.tsx`: include BNPL `type` on success redirects.
- Modify `apps/web/src/components/storefront/ogabassey/pages/bnpl-launcher.test.tsx`: assert Credit Direct success redirects include `type=credit_direct`.
- Modify `apps/web/src/components/storefront/ogabassey/pages/order-success-page.tsx`: render BNPL-specific pending/approval language.
- Modify `apps/web/src/components/storefront/ogabassey/pages/order-success-page.test.tsx`: cover Credit Direct, CredPal, and Klump messaging.
- Modify `apps/web/src/app/api/payments/credit-direct/webhook/route.ts`: reject stale Credit Direct webhooks when an order has switched to another provider or the session id no longer matches the active Credit Direct session.
- Modify `apps/web/src/app/api/payments/credit-direct/webhook/route.test.ts`: cover stale-session webhook rejection and active-session processing.
- Add a new migration generated by `supabase migration new storefront_order_idempotency`: add order idempotency columns/index, replace the current `create_storefront_order` signature, update `create_storefront_order_with_savings`, update `set_credit_direct_session` to clear stale transaction references, and update `prepare_storefront_order_for_checkout` to reject non-reusable approved/refunded orders.
- Modify migration contract tests under `apps/web/src/lib/agentic/storefront-order-rpc-contract.test.ts` so the base RPC and savings wrapper are validated together.
- Create `apps/mobile-storefront/lib/checkout-order-idempotency.ts`: build a mobile checkout fingerprint that excludes BNPL provider and reuse an in-memory UUID while the fingerprint stays stable.
- Create `apps/mobile-storefront/lib/checkout-order-idempotency.test.ts`: cover provider-switch stability, fingerprint rotation, key clearing, and stable item ordering.
- Modify `apps/mobile-storefront/services/orders.ts`: allow callers to provide an `idempotency_key` and use it for the `Idempotency-Key` header before falling back to a generated UUID.
- Modify `apps/mobile-storefront/services/orders.test.ts`: assert caller-provided idempotency keys are sent as headers and are not serialized into the order body.
- Modify `apps/mobile-storefront/app/checkout.tsx`: pass a stable mobile BNPL idempotency key into `createOrder` so mobile Credit Direct -> Klump attempts reuse the same order.
- Modify `apps/mobile-storefront/__tests__/app/checkout.test-utils.tsx`: expose payment-settings control for the BNPL checkout regression.
- Modify `apps/mobile-storefront/__tests__/app/checkout.test.tsx`: cover stable BNPL idempotency key reuse across payment-provider switches.

## Task 1: Confirm Live Duplicate Shape Read-Only

**Files:**
- No code changes.

- [x] **Step 1: Check current branch and dirty state**

Run:

```bash
git status --short
git branch --show-current
```

Expected: record current branch and avoid overwriting unrelated work.

- [x] **Step 2: Inspect likely Ogabassey duplicate groups**

Use the Supabase connection available in the environment. If using SQL directly, run this read-only query. This uses `lag()` over a 30-minute window instead of same-minute grouping so it catches the real retry/provider-switch shape:

```sql
WITH ogabassey AS (
  SELECT id
  FROM public.merchants
  WHERE slug = 'ogabassey'
  LIMIT 1
),
candidate_orders AS (
  SELECT
    o.id,
    o.order_number,
    o.customer_email,
    o.customer_phone,
    o.total,
    o.payment_method,
    o.payment_status,
    o.shipping_status,
    o.created_at,
    lag(o.id) OVER duplicate_window AS previous_order_id,
    lag(o.order_number) OVER duplicate_window AS previous_order_number,
    lag(o.created_at) OVER duplicate_window AS previous_created_at,
    lag(o.payment_method) OVER duplicate_window AS previous_payment_method
  FROM public.orders o
  JOIN ogabassey m ON m.id = o.merchant_id
  WHERE o.created_at >= now() - interval '30 days'
    AND o.payment_method IN ('credit_direct', 'credpal', 'card')
    AND o.payment_status IN ('unpaid', 'pending', 'bnpl_pending')
  WINDOW duplicate_window AS (
    PARTITION BY
      lower(o.customer_email),
      coalesce(o.customer_phone, ''),
      o.total
    ORDER BY o.created_at, o.id
  )
)
SELECT
  lower(customer_email) AS customer_email,
  coalesce(customer_phone, '') AS customer_phone,
  total,
  previous_payment_method,
  payment_method,
  previous_order_number,
  order_number,
  previous_created_at,
  created_at,
  created_at - previous_created_at AS duplicate_gap
FROM candidate_orders
WHERE previous_order_id IS NOT NULL
  AND created_at - previous_created_at <= interval '30 minutes'
ORDER BY created_at DESC;
```

Expected: a list of likely duplicates or no rows. Do not mutate rows in this task.

- [x] **Step 3: Verify Supabase CLI/docs before schema work**

Run:

```bash
supabase --version
supabase migration --help
curl -fsSL https://supabase.com/changelog.md | rg -i "breaking|postgres|function|rls|migration" -n
```

Expected: CLI is available or a fallback is documented; no relevant breaking change blocks a normal SQL migration.

## Task 2: Add Server-Side Idempotency Hashing

**Files:**
- Create `apps/web/src/lib/checkout/order-idempotency.ts`
- Create `apps/web/src/lib/checkout/order-idempotency.test.ts`

- [x] **Step 1: Write failing hash tests**

Create `apps/web/src/lib/checkout/order-idempotency.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildOrderIdempotencyPayload,
  hashOrderIdempotencyPayload,
} from './order-idempotency';

const baseOrder = {
  merchant_id: '11111111-1111-1111-1111-111111111111',
  customer_email: 'ADA@example.com',
  customer_name: 'Ada Buyer',
  customer_phone: '+2348012345678',
  items: [
    {
      product_id: '22222222-2222-2222-2222-222222222222',
      name: 'iPhone 13',
      quantity: 1,
      price: 500000,
      variant_id: '33333333-3333-3333-3333-333333333333',
      variant_attributes: { Color: 'Blue', Storage: '128GB' },
    },
  ],
  shipping_fee: 2500,
  tax_amount: 37687.5,
  gift_wrapping_fee: 0,
  payment_method: 'credit_direct',
  shipping_address: {
    address: '12 Allen Avenue',
    city: 'Ikeja',
    state: 'Lagos',
  },
  selected_quote_id: '44444444-4444-4444-4444-444444444444',
  shipping_provider: 'GIGL',
  use_wallet_credit: false,
  wallet_amount: 0,
  use_savings_credit: false,
} as const;

describe('order idempotency hashing', () => {
  it('hashes equivalent payloads identically after normalization', () => {
    const left = buildOrderIdempotencyPayload(baseOrder);
    const right = buildOrderIdempotencyPayload({
      ...baseOrder,
      customer_email: 'ada@example.com',
      items: [
        {
          ...baseOrder.items[0],
          variant_attributes: { Storage: '128GB', Color: 'Blue' },
        },
      ],
    });

    expect(hashOrderIdempotencyPayload(left)).toBe(
      hashOrderIdempotencyPayload(right)
    );
  });

  it('changes the hash when the payable checkout payload changes', () => {
    const original = buildOrderIdempotencyPayload(baseOrder);
    const changed = buildOrderIdempotencyPayload({
      ...baseOrder,
      shipping_fee: 5000,
    });

    expect(hashOrderIdempotencyPayload(original)).not.toBe(
      hashOrderIdempotencyPayload(changed)
    );
  });

  it('changes the hash when an item price changes', () => {
    const original = buildOrderIdempotencyPayload(baseOrder);
    const changed = buildOrderIdempotencyPayload({
      ...baseOrder,
      items: [{ ...baseOrder.items[0], price: 525000 }],
    });

    expect(hashOrderIdempotencyPayload(original)).not.toBe(
      hashOrderIdempotencyPayload(changed)
    );
  });

  it('does not change the hash when the customer switches payment provider', () => {
    const creditDirect = buildOrderIdempotencyPayload({
      ...baseOrder,
      payment_method: 'credit_direct',
    });
    const klumpCard = buildOrderIdempotencyPayload({
      ...baseOrder,
      payment_method: 'card',
    });

    expect(hashOrderIdempotencyPayload(creditDirect)).toBe(
      hashOrderIdempotencyPayload(klumpCard)
    );
  });
});
```

- [x] **Step 2: Run the failing tests**

Run:

```bash
pnpm --filter @baci/web test src/lib/checkout/order-idempotency.test.ts
```

Expected: fail because `order-idempotency.ts` does not exist.

- [x] **Step 3: Implement the helper**

Create `apps/web/src/lib/checkout/order-idempotency.ts`:

```ts
import { createHash } from 'node:crypto';

type IdempotencyItem = {
  assurance_fee?: number;
  condition?: string;
  has_assurance?: boolean;
  price: number;
  product_id?: string;
  productId?: string;
  quantity: number;
  variant_id?: string;
  variantId?: string;
  variant_attributes?: Record<string, string>;
  variantAttributes?: Record<string, string>;
};

export type OrderIdempotencyPayloadInput = {
  customer_email: string;
  customer_name: string;
  customer_phone?: string | null;
  discount_amount?: number;
  gift_wrapping_fee?: number;
  items: IdempotencyItem[];
  merchant_id: string;
  savings_amount?: number | null;
  savings_goal_id?: string | null;
  selected_quote_id?: string | null;
  shipping_address?: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  shipping_fee?: number;
  shipping_provider?: string | null;
  tax_amount?: number;
  use_savings_credit?: boolean;
  use_wallet_credit?: boolean;
  wallet_amount?: number;
};

function normalizeText(value: string | null | undefined) {
  return (value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeAttributes(
  attributes: Record<string, string> | null | undefined
) {
  if (!attributes) return {};
  return Object.fromEntries(
    Object.entries(attributes)
      .map(([key, value]) => [normalizeText(key), normalizeText(value)])
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function normalizeItems(items: IdempotencyItem[]) {
  return items
    .map((item) => ({
      assurance_fee: item.assurance_fee || 0,
      condition: normalizeText(item.condition),
      has_assurance: Boolean(item.has_assurance),
      product_id: item.product_id || item.productId || '',
      price: Number(item.price || 0),
      quantity: Number(item.quantity),
      variant_attributes: normalizeAttributes(
        item.variant_attributes || item.variantAttributes
      ),
      variant_id: item.variant_id || item.variantId || '',
    }))
    .sort((left, right) =>
      `${left.product_id}:${left.variant_id}`.localeCompare(
        `${right.product_id}:${right.variant_id}`
      )
    );
}

export function buildOrderIdempotencyPayload(
  input: OrderIdempotencyPayloadInput
) {
  return {
    customer_email: normalizeText(input.customer_email),
    customer_name: normalizeText(input.customer_name),
    customer_phone: normalizeText(input.customer_phone),
    discount_amount: Number(input.discount_amount || 0),
    gift_wrapping_fee: Number(input.gift_wrapping_fee || 0),
    items: normalizeItems(input.items),
    merchant_id: input.merchant_id,
    savings_amount: Number(input.savings_amount || 0),
    savings_goal_id: input.savings_goal_id || null,
    selected_quote_id: input.selected_quote_id || null,
    shipping_address: {
      address: normalizeText(input.shipping_address?.address),
      city: normalizeText(input.shipping_address?.city),
      state: normalizeText(input.shipping_address?.state),
    },
    shipping_fee: Number(input.shipping_fee || 0),
    shipping_provider: normalizeText(input.shipping_provider),
    tax_amount: Number(input.tax_amount || 0),
    use_savings_credit: Boolean(input.use_savings_credit),
    use_wallet_credit: Boolean(input.use_wallet_credit),
    wallet_amount: Number(input.wallet_amount || 0),
  };
}

export function hashOrderIdempotencyPayload(
  payload: ReturnType<typeof buildOrderIdempotencyPayload>
) {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}
```

- [x] **Step 4: Verify helper tests pass**

Run:

```bash
pnpm --filter @baci/web test src/lib/checkout/order-idempotency.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/src/lib/checkout/order-idempotency.ts apps/web/src/lib/checkout/order-idempotency.test.ts
git commit -m "test: add order idempotency hash helper"
```

## Task 3: Add Database Idempotency Boundary

**Files:**
- Add migration generated by `supabase migration new storefront_order_idempotency`
- Modify `apps/web/src/lib/agentic/storefront-order-rpc-contract.test.ts`

- [x] **Step 1: Generate the migration file**

Run:

```bash
supabase migration new storefront_order_idempotency
```

Expected: Supabase creates a file matching `supabase/migrations/*_storefront_order_idempotency.sql`. Use the generated path for the SQL in the next step.

- [x] **Step 2: Add the schema and RPC SQL**

In the generated migration, add this structure. Preserve the current body of `public.create_storefront_order` from the latest migration, then apply the marked idempotency changes:

```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS checkout_idempotency_key text,
  ADD COLUMN IF NOT EXISTS checkout_request_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_idempotency_key_idx
  ON public.orders (merchant_id, checkout_idempotency_key)
  WHERE checkout_idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.orders.checkout_idempotency_key IS
  'Stable client-supplied checkout mutation key used to replay pending storefront order creation without creating duplicates.';

COMMENT ON COLUMN public.orders.checkout_request_hash IS
  'Server-computed SHA-256 hash of the commercial checkout payload; payment provider is excluded so provider switches reuse one pending order.';
```

Drop stale RPC overloads before recreating the functions. Adding parameters changes the Postgres function identity; `CREATE OR REPLACE` alone would leave the old callable signatures in place. Keep the existing 19-arg and 21-arg drops from the VAT enforcement pattern, and add the current 22-arg storefront order signature plus the current 25-arg savings wrapper signature:

```sql
DROP FUNCTION IF EXISTS public.create_storefront_order(
  UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT,
  TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID
);

DROP FUNCTION IF EXISTS public.create_storefront_order(
  UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT,
  TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC
);

DROP FUNCTION IF EXISTS public.create_storefront_order(
  UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT,
  TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC, NUMERIC
);

DROP FUNCTION IF EXISTS public.create_storefront_order_with_savings(
  UUID, TEXT, TEXT, JSONB, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT,
  TEXT, JSONB, TEXT, TEXT, JSONB, UUID, TEXT, TEXT, UUID, TEXT, NUMERIC,
  NUMERIC, UUID, NUMERIC, TEXT
);
```

In `CREATE OR REPLACE FUNCTION public.create_storefront_order(...)`:

```sql
-- Add params after p_expected_total:
p_checkout_idempotency_key TEXT DEFAULT NULL,
p_checkout_request_hash TEXT DEFAULT NULL

-- Add return column at the end:
idempotency_replayed BOOLEAN

-- Add declarations:
v_checkout_idempotency_key TEXT := NULLIF(trim(COALESCE(p_checkout_idempotency_key, '')), '');
v_checkout_request_hash TEXT := NULLIF(trim(COALESCE(p_checkout_request_hash, '')), '');
v_existing_order RECORD;
v_idempotency_replayed BOOLEAN := false;
```

Add this block after merchant validation and before any customer/order/stock side effects:

```sql
IF v_checkout_idempotency_key IS NOT NULL THEN
  IF v_checkout_request_hash IS NULL THEN
    RAISE EXCEPTION 'checkout_request_hash_required';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_merchant_id::text || ':checkout:' || v_checkout_idempotency_key,
      0
    )
  );

  SELECT
    o.id,
    o.order_number,
    o.tracking_token,
    o.subtotal,
    o.shipping_fee,
    o.discount_amount,
    o.tax_amount,
    o.total,
    o.customer_id,
    o.customer_email,
    o.customer_name,
    o.customer_phone,
    o.payment_status,
    o.shipping_status,
    o.payment_method,
    o.shipping_address,
    o.merchant_id,
    o.tax_basis,
    o.gift_wrapping_fee,
    o.checkout_request_hash
  INTO v_existing_order
  FROM public.orders o
  WHERE o.merchant_id = p_merchant_id
    AND o.checkout_idempotency_key = v_checkout_idempotency_key
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_order.checkout_request_hash IS DISTINCT FROM v_checkout_request_hash THEN
      RAISE EXCEPTION 'checkout_idempotency_conflict';
    END IF;

    IF v_existing_order.payment_status IN ('paid', 'bnpl_approved', 'refunded')
      OR COALESCE(v_existing_order.shipping_status, '') IN (
        'processing',
        'shipped',
        'out_for_delivery',
        'delivered',
        'completed',
        'cancelled'
      )
    THEN
      RAISE EXCEPTION 'order_not_reusable';
    END IF;

    -- Same commercial order, different provider attempt. Reopen the
    -- existing pending order for the currently selected payment method
    -- instead of creating a duplicate order row.
    UPDATE public.orders o
    SET
      payment_method = trim(p_payment_method),
      payment_status = v_payment_status,
      shipping_status = 'pending',
      payment_reference = NULL,
      updated_at = now()
    WHERE o.id = v_existing_order.id
    RETURNING
      o.id,
      o.order_number,
      o.tracking_token,
      o.subtotal,
      o.shipping_fee,
      o.discount_amount,
      o.tax_amount,
      o.total,
      o.customer_id,
      o.customer_email,
      o.customer_name,
      o.customer_phone,
      o.payment_status,
      o.shipping_status,
      o.payment_method,
      o.shipping_address,
      o.merchant_id,
      o.tax_basis,
      o.gift_wrapping_fee,
      o.checkout_request_hash
    INTO v_existing_order;

    RETURN QUERY
    SELECT
      v_existing_order.id,
      v_existing_order.order_number,
      v_existing_order.tracking_token,
      v_existing_order.subtotal,
      v_existing_order.shipping_fee,
      v_existing_order.discount_amount,
      v_existing_order.tax_amount,
      v_existing_order.total,
      v_existing_order.customer_id,
      v_existing_order.customer_email,
      v_existing_order.customer_name,
      v_existing_order.customer_phone,
      v_existing_order.payment_status,
      v_existing_order.shipping_status,
      v_existing_order.payment_method,
      v_existing_order.shipping_address,
      v_existing_order.merchant_id,
      v_existing_order.tax_basis,
      v_existing_order.gift_wrapping_fee,
      true;
    RETURN;
  END IF;
END IF;
```

Add the two new columns to the `INSERT INTO orders (...)` list and values:

```sql
checkout_idempotency_key,
checkout_request_hash
```

```sql
v_checkout_idempotency_key,
v_checkout_request_hash
```

Add `v_idempotency_replayed` to the final `RETURN QUERY SELECT`:

```sql
v_idempotency_replayed
```

Revoke/grant the new 24-arg `create_storefront_order` signature to `anon`, `authenticated`, and `service_role`, matching the existing grants.

Update `public.create_storefront_order_with_savings(...)` in the same migration. Add these params after `p_savings_idempotency_key`:

```sql
p_checkout_idempotency_key text DEFAULT NULL,
p_checkout_request_hash text DEFAULT NULL
```

Add this return column at the end:

```sql
idempotency_replayed boolean
```

When it calls `public.create_storefront_order`, pass the params by name so future positional drift cannot break the wrapper:

```sql
p_checkout_idempotency_key => p_checkout_idempotency_key,
p_checkout_request_hash => p_checkout_request_hash
```

Also select and return `created.idempotency_replayed` as `v_order.idempotency_replayed`. Do not skip `redeem_savings_for_order` on replay; that RPC is idempotent by order and idempotency key, and rerunning it is how the route receives the already-redeemed savings amount for the residual gateway calculation.

Revoke/grant the new 27-arg `create_storefront_order_with_savings` signature to `authenticated` and `service_role`, matching the current wrapper grants.

Do not modify `public.create_storefront_order_with_quiz_voucher(...)` in this migration. Quiz voucher orders use route proof plus award claiming and should not replay through the BNPL checkout idempotency key.

Update `public.prepare_storefront_order_for_checkout(...)` in the same migration so the existing browser pending-order reuse path cannot reopen an approved/refunded BNPL order. Replace the paid-only check with:

```sql
IF v_order.payment_status IN ('paid', 'bnpl_approved', 'refunded') THEN
  RAISE EXCEPTION 'order_not_reusable';
END IF;
```

Replace `public.set_credit_direct_session(...)` in the same migration so a new Credit Direct checkout session clears stale popup transaction references before writing the new session. This belongs in this first migration task because migrations are append-only after they are committed:

```sql
CREATE OR REPLACE FUNCTION public.set_credit_direct_session(
  p_order_id uuid,
  p_email text,
  p_merchant_id uuid,
  p_session_id text,
  p_signed_amount numeric
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_raw_notes text;
  v_notes jsonb := '{}'::jsonb;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id_required';
  END IF;

  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  SELECT notes
    INTO v_raw_notes
  FROM orders
  WHERE id = p_order_id
    AND merchant_id = p_merchant_id
    AND lower(customer_email) = lower(trim(p_email))
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_raw_notes IS NOT NULL AND trim(v_raw_notes) <> '' THEN
    BEGIN
      v_notes := v_raw_notes::jsonb;
    EXCEPTION WHEN invalid_text_representation THEN
      v_notes := '{}'::jsonb;
    END;
  END IF;

  v_notes :=
    (v_notes - 'creditDirectTransactionId' - 'credit_directTransactionId') ||
    jsonb_build_object(
      'creditDirectSessionId',
      p_session_id,
      'creditDirectSignedAmount',
      p_signed_amount
    );

  UPDATE orders
  SET
    payment_method = 'credit_direct',
    payment_status = 'bnpl_pending',
    notes = v_notes::text
  WHERE id = p_order_id;

  RETURN true;
END;
$$;
```

- [x] **Step 3: Update SQL contract tests**

In `apps/web/src/lib/agentic/storefront-order-rpc-contract.test.ts`, add this standalone contract test in the same `describe` block:

```ts
it('covers storefront checkout idempotency SQL contract', () => {
  const sql = readLatestStorefrontOrderRpcMigrationSql();

  expect(sql).toMatch(/checkout_idempotency_key\s+text/i);
  expect(sql).toMatch(/checkout_request_hash\s+text/i);
  expect(sql).toMatch(/idempotency_replayed\s+boolean/i);
  const orderDropMatches = sql.match(/DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.create_storefront_order/gi);
  expect(orderDropMatches).not.toBeNull();
  expect(orderDropMatches?.length).toBeGreaterThanOrEqual(3);
  expect(sql).toMatch(/DROP\s+FUNCTION\s+IF\s+EXISTS\s+public\.create_storefront_order_with_savings/i);
  expect(sql).toMatch(/checkout_idempotency_conflict/i);
  expect(sql).toMatch(/order_not_reusable/i);
  expect(sql).toMatch(/IF\s+FOUND\s+THEN/i);
  expect(sql).toMatch(/payment_method\s*=\s*trim\(p_payment_method\)/i);
  expect(sql).toMatch(/payment_reference\s*=\s*NULL/i);
  expect(sql).toMatch(/pg_advisory_xact_lock/i);
  expect(sql).toMatch(/create_storefront_order_with_savings[\s\S]*p_checkout_idempotency_key\s+text/i);
  expect(sql).toMatch(/create_storefront_order_with_savings[\s\S]*p_checkout_request_hash\s+text/i);
  expect(sql).toMatch(/create_storefront_order_with_savings[\s\S]*idempotency_replayed\s+boolean/i);
  expect(sql).toMatch(/prepare_storefront_order_for_checkout[\s\S]*bnpl_approved[\s\S]*refunded/i);
});
```

Add this standalone contract test in the same `describe` block:

```ts
it('clears stale Credit Direct transaction references when a new session starts', () => {
  const sql = readLatestStorefrontOrderRpcMigrationSql();

  expect(sql).toMatch(
    /CREATE OR REPLACE FUNCTION public\.set_credit_direct_session/i
  );
  expect(sql).toContain(
    "v_notes - 'creditDirectTransactionId' - 'credit_directTransactionId'"
  );
});
```

- [x] **Step 4: Run migration contract tests**

Run:

```bash
pnpm --filter @baci/web test src/lib/agentic/storefront-order-rpc-contract.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add supabase/migrations apps/web/src/lib/agentic/storefront-order-rpc-contract.test.ts
git commit -m "feat: add storefront order idempotency boundary"
```

## Task 4: Wire Idempotency Through `/api/orders`

**Files:**
- Modify `apps/web/src/app/api/orders/route.ts`
- Modify `apps/web/src/app/api/orders/route.test.ts`

- [x] **Step 1: Write route tests first**

Add tests to `apps/web/src/app/api/orders/route.test.ts`:

```ts
const baseOrderRow = {
  id: 'order-id',
  order_number: 'ORD-123',
  total: 1000,
  subtotal: 1000,
  shipping_fee: 0,
  customer_id: CUSTOMER_ID,
};

it('passes checkout idempotency params to the storefront order RPC', async () => {
  const rpcSpy = vi.fn();
  const supabaseMod = await import('@/lib/supabase/server');
  vi.mocked(supabaseMod.createClient).mockImplementation((() => {
    const sb = buildMockSupabase();
    const originalRpc = sb.rpc;
    sb.rpc = vi.fn((name: string, params?: unknown) => {
      if (name === 'create_storefront_order') {
        rpcSpy(params);
      }
      return originalRpc(name);
    });
    return sb;
  }) as unknown as never);

  const response = await POST(
    new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'checkout-key-1' },
      body: JSON.stringify({
        ...baseOrderPayload,
        payment_method: 'credit_direct',
      }),
    })
  );

  expect(response.status).toBe(201);
  expect(rpcSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      p_checkout_idempotency_key: 'checkout-key-1',
      p_checkout_request_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
  );
});

it('returns replay metadata, residual gateway amount, and skips duplicate wallet-paid notifications', async () => {
  const supabaseMod = await import('@/lib/supabase/server');
  vi.mocked(supabaseMod.createClient).mockImplementation((() => {
    const sb = buildMockSupabase({
      create_storefront_order: {
        data: [
          {
            ...baseOrderRow,
            total: 300,
            idempotency_replayed: true,
            payment_method: 'credit_direct',
            payment_status: 'bnpl_pending',
          },
        ],
        error: null,
      },
      redeem_wallet_for_order: {
        data: [
          {
            success: true,
            redeemed_amount: 300,
            new_balance: 200,
            transaction_id: '99999999-aaaa-bbbb-cccc-dddddddddddd',
          },
        ],
        error: null,
      },
    });
    return sb;
  }) as unknown as never);

  const response = await POST(
    new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'checkout-key-1' },
      body: JSON.stringify({
        ...baseOrderPayload,
        payment_method: 'credit_direct',
        use_wallet_credit: true,
        wallet_amount: 300,
      }),
    })
  );
  const body = await readJson(response);

  expect(response.status).toBe(200);
  expect(response.headers.get('x-idempotency-replayed')).toBe('true');
  expect(body.idempotency).toEqual({ replayed: true });
  expect(body.wallet).toEqual({
    amountUsed: 300,
    newBalance: 200,
    transactionId: '99999999-aaaa-bbbb-cccc-dddddddddddd',
  });
  expect(body.amountDueToGateway).toBe(0);
  expect(mockSendEmail).not.toHaveBeenCalled();
  expect(mockNotifyNewOrder).not.toHaveBeenCalled();
  expect(mockNotifyPaymentReceived).not.toHaveBeenCalled();
});

it('passes checkout idempotency params through the savings wrapper RPC', async () => {
  const rpcSpy = vi.fn();
  const supabaseMod = await import('@/lib/supabase/server');
  vi.mocked(supabaseMod.createClient).mockImplementation((() => {
    const sb = buildMockSupabase({
      create_storefront_order_with_savings: {
        data: [
          {
            ...baseOrderRow,
            savings_redemption_success: true,
            savings_redeemed_amount: 500,
            savings_goal_id: '123e4567-e89b-12d3-a456-426614174555',
            savings_redemption_id: '77777777-aaaa-bbbb-cccc-dddddddddddd',
            savings_goal_status: 'paused',
            idempotency_replayed: true,
          },
        ],
        error: null,
      },
    });
    const originalRpc = sb.rpc;
    sb.rpc = vi.fn((name: string, params?: unknown) => {
      rpcSpy(name, params);
      return originalRpc(name);
    });
    return sb;
  }) as unknown as never);

  const response = await POST(
    new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'checkout-key-1' },
      body: JSON.stringify({
        ...baseOrderPayload,
        use_savings_credit: true,
        savings_amount: 500,
        savings_goal_id: '123e4567-e89b-12d3-a456-426614174555',
      }),
    })
  );

  expect(response.status).toBe(200);
  expect(rpcSpy).toHaveBeenCalledWith(
    'create_storefront_order_with_savings',
    expect.objectContaining({
      p_checkout_idempotency_key: 'checkout-key-1',
      p_checkout_request_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_savings_idempotency_key: 'order:checkout-key-1:savings',
    })
  );
});

it('does not pass checkout idempotency params through the quiz voucher wrapper RPC', async () => {
  vi.stubEnv('QUIZ_PHASE', 'production');
  vi.stubEnv('QUIZ_PRODUCTION_APPROVED', 'yes');
  vi.stubEnv('QUIZ_RPC_SERVER_SECRET', 'voucher-secret');
  const supabase = buildMockSupabase();
  const supabaseMod = await import('@/lib/supabase/server');
  vi.mocked(supabaseMod.createClient).mockImplementation(
    () => supabase as unknown as never
  );
  vi.mocked(authenticateApiRequest).mockResolvedValue({
    user: mockAuthUser(AUTH_USER_ID),
    error: null,
    supabase: supabase as unknown as never,
  });
  const awardId = '11111111-1111-4111-8111-111111111111';
  const productId = '22222222-2222-4222-8222-222222222222';
  const token = createQuizVoucherToken({
    payload: {
      awardId,
      condition: 'new',
      expiresAt: '2099-05-22T12:00:00.000Z',
      productId,
      userId: AUTH_USER_ID,
      variantId: null,
    },
    secret: 'voucher-secret',
  });

  const response = await POST(
    new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'checkout-key-1' },
      body: JSON.stringify({
        ...baseOrderPayload,
        items: [
          {
            ...baseOrderPayload.items[0],
            condition: 'new',
            product_id: productId,
            price: 0,
            voucher_token: token,
          },
        ],
      }),
    })
  );

  expect(response.status).toBe(201);
  const [, quizRpcParams] = vi.mocked(supabase.rpc).mock.calls.find(
    ([name]) => name === 'create_storefront_order_with_quiz_voucher'
  )!;
  expect(quizRpcParams).not.toHaveProperty('p_checkout_idempotency_key');
  expect(quizRpcParams).not.toHaveProperty('p_checkout_request_hash');
  expect(supabase.rpc).toHaveBeenCalledWith(
    'create_storefront_order_with_quiz_voucher',
    expect.objectContaining({
      p_route_proof: expect.objectContaining({
        action: 'create_storefront_order_with_quiz_voucher',
        subject_id: awardId,
        user_id: AUTH_USER_ID,
      }),
    })
  );
});

it('treats a BNPL provider switch as an order replay, not a new order', async () => {
  const supabaseMod = await import('@/lib/supabase/server');
  vi.mocked(supabaseMod.createClient).mockImplementation(
    () =>
      buildMockSupabase({
        create_storefront_order: {
          data: [
            {
              ...baseOrderRow,
              idempotency_replayed: true,
              payment_method: 'card',
              payment_status: 'unpaid',
            },
          ],
          error: null,
        },
      }) as unknown as never
  );

  const response = await POST(
    new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'checkout-key-1' },
      body: JSON.stringify({
        ...baseOrderPayload,
        payment_method: 'card',
      }),
    })
  );
  const body = await readJson(response);

  expect(response.status).toBe(200);
  expect(body.order.id).toBe('order-id');
  expect(body.order.payment_method).toBe('card');
  expect(body.idempotency).toEqual({ replayed: true });
});

it('maps checkout idempotency conflicts to 409', async () => {
  const supabaseMod = await import('@/lib/supabase/server');
  vi.mocked(supabaseMod.createClient).mockImplementation(
    () =>
      buildMockSupabase({
        create_storefront_order: {
          data: null,
          error: { code: 'P0001', message: 'checkout_idempotency_conflict' },
        },
      }) as unknown as never
  );

  const response = await POST(
    new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'checkout-key-1' },
      body: JSON.stringify({
        ...baseOrderPayload,
        payment_method: 'credit_direct',
      }),
    })
  );

  expect(response.status).toBe(409);
  await expect(readJson(response)).resolves.toMatchObject({
    code: 'CHECKOUT_IDEMPOTENCY_CONFLICT',
    error: 'This checkout request was already used for a different cart, customer, or delivery payload.',
  });
});
```

- [x] **Step 2: Run route tests and confirm failure**

Run:

```bash
pnpm --filter @baci/web test src/app/api/orders/route.test.ts
```

Expected: new idempotency assertions fail.

- [x] **Step 3: Implement API route changes**

In `apps/web/src/app/api/orders/route.ts`, import the helper:

```ts
import {
  buildOrderIdempotencyPayload,
  hashOrderIdempotencyPayload,
} from '@/lib/checkout/order-idempotency';
```

After `const hasVoucherItem = hasQuizVoucherItem(items);`, capture only the request key. Voucher orders intentionally skip this path because their route proof and award claim are one-time controls:

```ts
const requestIdempotencyKey = hasVoucherItem
  ? null
  : getRequestIdempotencyKey(request);
```

After `serverDerivedDiscountAmount` has been finalized and before `const requestedSavingsRedemption = ...`, compute the request hash from the same canonical values the route will pass into the RPC. Do not hash raw `body` before `orderItemsPayload`, `serverComputedTaxAmount`, and `serverDerivedDiscountAmount` exist:

```ts
const checkoutRequestHash = requestIdempotencyKey
  ? hashOrderIdempotencyPayload(
      buildOrderIdempotencyPayload({
        ...body,
        discount_amount: serverDerivedDiscountAmount,
        gift_wrapping_fee: giftWrappingFeeValue,
        items: orderItemsPayload,
        shipping_fee: shippingFeeValue,
        tax_amount: serverComputedTaxAmount,
      })
    )
  : null;
```

In `orderRpcArgs`, add the idempotency params as a conditional spread so quiz voucher wrapper calls do not receive null idempotency keys:

```ts
...(requestIdempotencyKey && checkoutRequestHash
  ? {
      p_checkout_idempotency_key: requestIdempotencyKey,
      p_checkout_request_hash: checkoutRequestHash,
    }
  : {}),
```

Add idempotency error mapping before the generic client error response:

```ts
if (message === 'checkout_idempotency_conflict') {
  return NextResponse.json(
    {
      code: 'CHECKOUT_IDEMPOTENCY_CONFLICT',
      error:
        'This checkout request was already used for a different cart, customer, or delivery payload.',
    },
    { status: 409 }
  );
}

if (message === 'order_not_reusable') {
  return NextResponse.json(
    {
      code: 'CHECKOUT_ORDER_NOT_REUSABLE',
      error:
        'This checkout order can no longer be reused. Refresh checkout and start a new order.',
    },
    { status: 409 }
  );
}
```

After `const order = Array.isArray(orderRows) ? orderRows[0] : orderRows;`, normalize replay:

```ts
const idempotencyReplayed =
  typeof order === 'object' &&
  order !== null &&
  'idempotency_replayed' in order &&
  order.idempotency_replayed === true;
```

Do not return immediately on replay. Wallet and savings redemptions are already idempotent by order/idempotency key, so the route must still run the existing redemption-recovery path to compute the correct residual `amountDueToGateway`. Instead, use the replay flag to change response status/headers and suppress non-idempotent notifications:

```ts
const shouldSendImmediateOrderNotifications =
  !idempotencyReplayed &&
  (payOnDelivery || payment_method === 'invoice' || isWalletFullyPaid);

if (shouldSendImmediateOrderNotifications) {
  // Move the current immediate email/push block under this condition.
  // The block starts at the existing
  // `if (payOnDelivery || payment_method === 'invoice' || isWalletFullyPaid)`.
}
```

Then update the final response:

```ts
const responseBody = {
  order: responseOrder,
  wallet: walletRedemptionResult
    ? {
        amountUsed: walletRedemptionResult.amountRedeemed,
        newBalance: walletRedemptionResult.newBalance,
        transactionId: walletRedemptionResult.transactionId,
      }
    : null,
  savings: savingsRedemptionResult
    ? {
        amountUsed: savingsRedemptionResult.amountRedeemed,
        goalId: savingsRedemptionResult.goalId,
        redemptionId: savingsRedemptionResult.redemptionId,
      }
    : null,
  amountDueToGateway: Math.max(amountDueToGateway, 0),
  ...(idempotencyReplayed ? { idempotency: { replayed: true } } : {}),
};

return NextResponse.json(responseBody, {
  headers: idempotencyReplayed
    ? { 'x-idempotency-replayed': 'true' }
    : undefined,
  status: idempotencyReplayed ? 200 : 201,
});
```

- [x] **Step 4: Verify route tests pass**

Run:

```bash
pnpm --filter @baci/web test src/app/api/orders/route.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/src/app/api/orders/route.ts apps/web/src/app/api/orders/route.test.ts
git commit -m "feat: make storefront order creation idempotent"
```

## Task 5: Add Stable Ogabassey Checkout Idempotency Keys

**Files:**
- Create `apps/web/src/components/storefront/ogabassey/pages/checkout/checkout-idempotency.ts`
- Create `apps/web/src/components/storefront/ogabassey/pages/checkout/checkout-idempotency.test.ts`
- Modify `apps/web/src/components/storefront/ogabassey/pages/checkout-page.tsx`
- Modify `apps/web/src/components/storefront/ogabassey/pages/checkout-page.test.tsx`

- [x] **Step 1: Write checkout key tests**

Create `apps/web/src/components/storefront/ogabassey/pages/checkout/checkout-idempotency.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHECKOUT_IDEMPOTENCY_STORAGE_KEY,
  CHECKOUT_IDEMPOTENCY_TTL_MS,
  clearCheckoutIdempotencyKey,
  getCheckoutIdempotencyKey,
} from './checkout-idempotency';

describe('checkout idempotency key storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(1_000);
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
  });

  it('reuses the key for the same checkout fingerprint', () => {
    expect(getCheckoutIdempotencyKey('fingerprint-a')).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
    expect(getCheckoutIdempotencyKey('fingerprint-a')).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
  });

  it('rotates the key when the checkout fingerprint changes', () => {
    expect(getCheckoutIdempotencyKey('fingerprint-a')).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
    expect(getCheckoutIdempotencyKey('fingerprint-b')).toBe(
      '22222222-2222-4222-8222-222222222222'
    );
  });

  it('stores the fingerprint, key, and createdAt in local storage', () => {
    getCheckoutIdempotencyKey('fingerprint-a');

    expect(
      JSON.parse(
        window.localStorage.getItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY) || '{}'
      )
    ).toEqual({
      checkoutFingerprint: 'fingerprint-a',
      createdAt: 1_000,
      key: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('rotates the key after the TTL expires', () => {
    expect(getCheckoutIdempotencyKey('fingerprint-a')).toBe(
      '11111111-1111-4111-8111-111111111111'
    );

    vi.mocked(Date.now).mockReturnValue(1_000 + CHECKOUT_IDEMPOTENCY_TTL_MS + 1);

    expect(getCheckoutIdempotencyKey('fingerprint-a')).toBe(
      '22222222-2222-4222-8222-222222222222'
    );
  });

  it('clears only the matching stored fingerprint', () => {
    getCheckoutIdempotencyKey('fingerprint-a');
    clearCheckoutIdempotencyKey('fingerprint-b');
    expect(window.localStorage.getItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY)).not.toBeNull();

    clearCheckoutIdempotencyKey('fingerprint-a');
    expect(window.localStorage.getItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY)).toBeNull();
  });
});
```

- [x] **Step 2: Implement checkout key helper**

Create `apps/web/src/components/storefront/ogabassey/pages/checkout/checkout-idempotency.ts`:

```ts
export const CHECKOUT_IDEMPOTENCY_STORAGE_KEY =
  'storefront-checkout-idempotency';
export const CHECKOUT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

type StoredCheckoutIdempotency = {
  createdAt: number;
  checkoutFingerprint: string;
  key: string;
};

function readStoredKey(): StoredCheckoutIdempotency | null {
  try {
    const raw = window.localStorage.getItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCheckoutIdempotency>;
    if (
      !parsed.checkoutFingerprint ||
      !parsed.key ||
      typeof parsed.createdAt !== 'number'
    ) {
      return null;
    }
    return {
      createdAt: parsed.createdAt,
      checkoutFingerprint: parsed.checkoutFingerprint,
      key: parsed.key,
    };
  } catch {
    return null;
  }
}

export function getCheckoutIdempotencyKey(checkoutFingerprint: string) {
  const stored = readStoredKey();
  const now = Date.now();
  if (
    stored?.checkoutFingerprint === checkoutFingerprint &&
    now - stored.createdAt <= CHECKOUT_IDEMPOTENCY_TTL_MS
  ) {
    return stored.key;
  }

  const key = crypto.randomUUID();
  try {
    window.localStorage.setItem(
      CHECKOUT_IDEMPOTENCY_STORAGE_KEY,
      JSON.stringify({ checkoutFingerprint, createdAt: now, key })
    );
  } catch {
    return key;
  }

  return key;
}

export function clearCheckoutIdempotencyKey(checkoutFingerprint?: string) {
  try {
    if (checkoutFingerprint) {
      const stored = readStoredKey();
      if (stored?.checkoutFingerprint !== checkoutFingerprint) {
        return;
      }
    }
    window.localStorage.removeItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY);
  } catch {
    // Storage access failed; there is nothing to clear.
  }
}
```

- [x] **Step 3: Wire key into the order POST**

In `apps/web/src/components/storefront/ogabassey/pages/checkout-page.tsx`, import:

```ts
import {
  clearCheckoutIdempotencyKey,
  getCheckoutIdempotencyKey,
} from './checkout/checkout-idempotency';
```

Just before `fetch('/api/orders', ...)`, compute:

```ts
const checkoutIdempotencyKey =
  getCheckoutIdempotencyKey(checkoutFingerprint);
```

Keep using `checkoutFingerprint` from `buildPendingCheckoutFingerprint`; do not add `paymentMethod` to that fingerprint. A customer switching from Credit Direct to Klump for the same cart/customer/delivery details must keep the same idempotency key so the backend reopens the same pending order.

Change the order creation headers to:

```ts
headers: {
  'Content-Type': 'application/json',
  'Idempotency-Key': checkoutIdempotencyKey,
},
```

When `/api/orders` returns `CHECKOUT_ORDER_NOT_REUSABLE`, clear both the pending-order snapshot and the matching idempotency key before surfacing the checkout error:

```ts
if (!orderResponse.ok) {
  const errorData = await orderResponse.json();
  if (errorData.code === 'CHECKOUT_ORDER_NOT_REUSABLE') {
    clearPendingCheckoutOrder();
    clearCheckoutIdempotencyKey(checkoutFingerprint);
  }
  throw new Error(errorData.details || errorData.error || 'Failed to create order');
}
```

- [x] **Step 4: Add checkout page regression**

In `apps/web/src/components/storefront/ogabassey/pages/checkout-page.test.tsx`, add an assertion to an existing successful order-create test or add a new test:

```ts
expect(
  fetchMock.mock.calls.find(([url]) => String(url) === '/api/orders')?.[1]
).toEqual(
  expect.objectContaining({
    headers: expect.objectContaining({
      'Idempotency-Key': expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      ),
    }),
  })
);
```

- [x] **Step 5: Run focused tests**

Run:

```bash
pnpm --filter @baci/web test src/components/storefront/ogabassey/pages/checkout/checkout-idempotency.test.ts src/components/storefront/ogabassey/pages/checkout-page.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web/src/components/storefront/ogabassey/pages/checkout/checkout-idempotency.ts apps/web/src/components/storefront/ogabassey/pages/checkout/checkout-idempotency.test.ts apps/web/src/components/storefront/ogabassey/pages/checkout-page.tsx apps/web/src/components/storefront/ogabassey/pages/checkout-page.test.tsx
git commit -m "feat: send stable Ogabassey checkout idempotency keys"
```

## Task 6: Harden Existing Pending-Order Reuse

**Files:**
- Modify `apps/web/src/components/storefront/ogabassey/pages/checkout/pending-checkout-order.ts`
- Modify `apps/web/src/components/storefront/ogabassey/pages/checkout/pending-checkout-order.test.ts`
- Modify `apps/web/src/app/api/orders/reuse/route.test.ts`

- [x] **Step 1: Write pending-order reuse tests**

Add tests to `apps/web/src/components/storefront/ogabassey/pages/checkout/pending-checkout-order.test.ts`:

```ts
it.each(['bnpl_approved', 'refunded'])(
  'clears a locally pending order when payment status is %s',
  async (paymentStatus) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'order-1',
          payment_status: paymentStatus,
          shipping_status: 'pending',
          total: 1000,
        }),
      });

    const result = await resolvePendingCheckoutOrder({
      pendingOrder: {
        orderId: 'order-1',
        orderNumber: 'ORD-1',
        trackingToken: 'track-1',
        merchantId: 'merchant-1',
        customerEmail: 'ada@example.com',
        checkoutFingerprint: 'fingerprint-1',
        amountDueToGateway: 1000,
        createdAt: '2026-05-28T00:00:00.000Z',
      },
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      customerEmail: 'ada@example.com',
      checkoutFingerprint: 'fingerprint-1',
      paymentMethod: 'credit_direct',
      fetchImpl: fetchMock,
    });

    expect(result).toEqual({ reusableOrder: null, clearStoredOrder: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }
);
```

Add a test to `apps/web/src/app/api/orders/reuse/route.test.ts`:

```ts
it('returns 409 when the reuse RPC rejects an approved BNPL order', async () => {
  mockRpc.mockResolvedValueOnce({
    data: null,
    error: { message: 'order_not_reusable', code: 'P0001' },
  });

  const request = new NextRequest('http://localhost/api/orders/reuse', {
    method: 'POST',
    body: JSON.stringify({
      order_id: '11111111-1111-4111-8111-111111111111',
      merchant_id: '22222222-2222-4222-8222-222222222222',
      tracking_token: 'track-1',
      customer_email: 'ada@example.com',
      payment_method: 'credit_direct',
    }),
  });

  const response = await POST(request);
  const body = await response.json();

  expect(response.status).toBe(409);
  expect(body).toEqual({ error: 'Order is no longer reusable' });
});
```

- [x] **Step 2: Run pending-order tests and confirm failure**

Run:

```bash
pnpm --filter @baci/web test src/components/storefront/ogabassey/pages/checkout/pending-checkout-order.test.ts src/app/api/orders/reuse/route.test.ts
```

Expected: the pending-order helper test fails because approved/refunded statuses are not rejected yet; the route test passes once added inside the existing `describe('POST /api/orders/reuse', ...)` block where `mockRpc` is in scope.

- [x] **Step 3: Implement client-side status rejection**

In `apps/web/src/components/storefront/ogabassey/pages/checkout/pending-checkout-order.ts`, add a payment-status set near `NON_REUSABLE_SHIPPING_STATUSES`:

```ts
const NON_REUSABLE_PAYMENT_STATUSES = new Set([
  'paid',
  'bnpl_approved',
  'refunded',
]);
```

Update the existing check:

```ts
if (
  !existingOrder?.id ||
  NON_REUSABLE_PAYMENT_STATUSES.has(existingOrder.payment_status || '') ||
  NON_REUSABLE_SHIPPING_STATUSES.has(existingOrder.shipping_status || '')
) {
  return { reusableOrder: null, clearStoredOrder: true };
}
```

- [x] **Step 4: Verify pending-order tests pass**

Run:

```bash
pnpm --filter @baci/web test src/components/storefront/ogabassey/pages/checkout/pending-checkout-order.test.ts src/app/api/orders/reuse/route.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/src/components/storefront/ogabassey/pages/checkout/pending-checkout-order.ts apps/web/src/components/storefront/ogabassey/pages/checkout/pending-checkout-order.test.ts apps/web/src/app/api/orders/reuse/route.test.ts
git commit -m "fix: reject completed BNPL pending-order reuse"
```

## Task 7: Harden Credit Direct Webhook Session Matching

**Files:**
- Modify `apps/web/src/app/api/payments/credit-direct/webhook/route.ts`
- Modify `apps/web/src/app/api/payments/credit-direct/webhook/route.test.ts`

- [x] **Step 1: Write stale-session webhook tests**

First update the existing `mockOrder` fixture in `apps/web/src/app/api/payments/credit-direct/webhook/route.test.ts` so current happy-path tests remain valid after the active-session guard is added:

```ts
const mockOrder = {
  id: 'order_abc',
  merchant_id: 'merchant_123',
  total: 50000,
  payment_status: 'pending',
  payment_method: 'credit_direct',
  customer_email: 'customer@example.com',
  customer_name: 'John Doe',
  notes: JSON.stringify({
    creditDirectSessionId: 'session_123456789',
    creditDirectTransactionId: 'txn_123456789',
    credit_directTransactionId: 'txn_123456789',
    creditDirectSignedAmount: 50000,
  }),
  order_number: 'ORD-123',
};
```

Add this test under the `Customer Payment Completed Event` describe block before the stale-session test. This pins the real Credit Direct shape where the signed session id and webhook checkout transaction id can differ:

```ts
it('accepts a webhook that matches the active popup transaction even when the signed session differs', async () => {
  vi.mocked(parseWebhookPayload).mockReturnValue(customerPaymentPayload);

  const supabaseMock = createMockSupabaseClient();
  vi.mocked(createServiceClient).mockReturnValue(supabaseMock as never);

  const updateSpy = vi.fn();
  let fromCallCount = 0;
  supabaseMock.from.mockImplementation((table: string) => {
    fromCallCount++;
    if (fromCallCount === 1) {
      const orderLookupChain = {
        ...createMockSupabaseClient().from('orders'),
      };
      orderLookupChain.select = vi.fn().mockReturnValue(orderLookupChain);
      orderLookupChain.eq = vi.fn().mockReturnValue(orderLookupChain);
      orderLookupChain.ilike = vi.fn().mockResolvedValue({
        data: [
          {
            ...mockOrder,
            payment_method: 'credit_direct',
            notes: JSON.stringify({
              creditDirectSessionId: 'session_123456789',
              creditDirectTransactionId: 'txn_123456789',
              credit_directTransactionId: 'txn_123456789',
              creditDirectSignedAmount: 50000,
            }),
          },
        ],
        error: null,
      });
      return orderLookupChain;
    }

    const updateChain = { ...createMockSupabaseClient().from(table) };
    updateChain.update = updateSpy.mockReturnValue(updateChain);
    updateChain.eq = vi.fn().mockResolvedValue({ data: null, error: null });
    return updateChain;
  });

  const request = createMockRequest(customerPaymentPayload);
  const response = await POST(request);

  expect(response.status).toBe(200);
  expect(updateSpy).toHaveBeenCalledWith(
    expect.objectContaining({ payment_status: 'bnpl_approved' })
  );
});
```

Add this test under the `Customer Payment Completed Event` describe block in `apps/web/src/app/api/payments/credit-direct/webhook/route.test.ts`:

```ts
it('ignores a stale Credit Direct webhook for an inactive transaction reference', async () => {
  vi.mocked(parseWebhookPayload).mockReturnValue(customerPaymentPayload);

  const supabaseMock = createMockSupabaseClient();
  vi.mocked(createServiceClient).mockReturnValue(supabaseMock as never);

  const updateSpy = vi.fn();
  let fromCallCount = 0;
  supabaseMock.from.mockImplementation((table: string) => {
    fromCallCount++;
    if (fromCallCount === 1) {
      const orderLookupChain = {
        ...createMockSupabaseClient().from('orders'),
      };
      orderLookupChain.select = vi.fn().mockReturnValue(orderLookupChain);
      orderLookupChain.eq = vi.fn().mockReturnValue(orderLookupChain);
      orderLookupChain.ilike = vi.fn().mockResolvedValue({
        data: [
          {
            ...mockOrder,
            payment_method: 'credit_direct',
            notes: JSON.stringify({
              creditDirectSessionId: 'older_credit_direct_session',
              creditDirectTransactionId: 'older_credit_direct_transaction',
              credit_directTransactionId: 'older_credit_direct_transaction',
              creditDirectSignedAmount: 50000,
            }),
          },
        ],
        error: null,
      });
      return orderLookupChain;
    }

    const updateChain = { ...createMockSupabaseClient().from(table) };
    updateChain.update = updateSpy.mockReturnValue(updateChain);
    updateChain.eq = vi.fn().mockResolvedValue({ data: null, error: null });
    return updateChain;
  });

  const request = createMockRequest(customerPaymentPayload);
  const response = await POST(request);
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data).toEqual({
    received: true,
    warning: 'Stale Credit Direct session',
  });
  expect(updateSpy).not.toHaveBeenCalled();
  expect(logger.warn).toHaveBeenCalledWith({
    message: 'Ignoring stale Credit Direct webhook for inactive session',
    orderId: 'order_abc',
    orderPaymentMethod: 'credit_direct',
    activeReference: 'older_credit_direct_transaction',
    transactionId: 'txn_123456789',
  });
});
```

Add this lookup test near the existing `Order Lookup` tests:

```ts
it('filters metadata fallback lookup to active Credit Direct orders', async () => {
  vi.mocked(parseWebhookPayload).mockReturnValue(customerPaymentPayload);

  const supabaseMock = createMockSupabaseClient();
  vi.mocked(createServiceClient).mockReturnValue(supabaseMock as never);

  const firstLookupChain = {
    ...createMockSupabaseClient().from('orders'),
  };
  firstLookupChain.select = vi.fn().mockReturnValue(firstLookupChain);
  firstLookupChain.eq = vi.fn().mockReturnValue(firstLookupChain);
  firstLookupChain.ilike = vi.fn().mockResolvedValue({ data: [], error: null });

  const metadataLookupChain = {
    ...createMockSupabaseClient().from('orders'),
  };
  metadataLookupChain.select = vi.fn().mockReturnValue(metadataLookupChain);
  metadataLookupChain.eq = vi.fn().mockReturnValue(metadataLookupChain);
  metadataLookupChain.single = vi
    .fn()
    .mockResolvedValue({ data: null, error: null });

  supabaseMock.from
    .mockReturnValueOnce(firstLookupChain)
    .mockReturnValueOnce(metadataLookupChain);

  const request = createMockRequest(customerPaymentPayload);
  const response = await POST(request);

  expect(response.status).toBe(200);
  expect(metadataLookupChain.eq).toHaveBeenCalledWith(
    'payment_method',
    'credit_direct'
  );
  expect(metadataLookupChain.eq).toHaveBeenCalledWith(
    'id',
    customerPaymentPayload.metaData
  );
});
```

Update the existing `returns 400 when expected amount is invalid` test so it reaches amount validation after the active-reference guard. Keep `creditDirectSignedAmount` absent so the route falls back to `order.total`:

```ts
const orderWithInvalidTotal = {
  ...mockOrder,
  total: -100,
  notes: JSON.stringify({
    creditDirectTransactionId: 'txn_123456789',
    credit_directTransactionId: 'txn_123456789',
  }),
};
```

- [x] **Step 2: Run webhook tests and confirm failure**

Run:

```bash
pnpm --filter @baci/web test src/app/api/payments/credit-direct/webhook/route.test.ts
```

Expected: stale-session assertions fail because the webhook currently accepts metadata fallback orders without checking active Credit Direct session state.

- [x] **Step 3: Implement active-session checks**

In `apps/web/src/app/api/payments/credit-direct/webhook/route.ts`, include `payment_method` in both order selects:

```ts
.select(
  'id, merchant_id, total, payment_status, payment_method, customer_email, customer_name, order_number, notes'
)
```

Update the `order` type:

```ts
let order: {
  id: string;
  merchant_id: string;
  total: number;
  payment_status: string;
  payment_method: string | null;
  customer_email: string;
  customer_name: string;
  order_number: string | null;
  notes: string | null;
} | null = orders?.[0] ?? null;
```

Constrain the metadata fallback lookup:

```ts
const { data: orderById } = await supabase
  .from('orders')
  .select(
    'id, merchant_id, total, payment_status, payment_method, customer_email, customer_name, order_number, notes'
  )
  .eq('payment_method', 'credit_direct')
  .eq('id', payload.metaData)
  .single();
```

After `parsedNotes` is built and before any idempotency/payment-status handling, add this active-reference guard. The transaction reference must win over the signed session id because `set_credit_direct_session` stores a generated session id before the popup opens, while the webhook payload uses `checkoutTransactionId`:

```ts
function readNoteString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

const activeTransactionId =
  readNoteString(parsedNotes.creditDirectTransactionId) ??
  readNoteString(parsedNotes.credit_directTransactionId);
const activeSessionId = readNoteString(parsedNotes.creditDirectSessionId);
const activeReference = activeTransactionId ?? activeSessionId;

if (
  order.payment_method !== 'credit_direct' ||
  activeReference !== payload.checkoutTransactionId
) {
  logger.warn({
    message: 'Ignoring stale Credit Direct webhook for inactive session',
    orderId: order.id,
    orderPaymentMethod: order.payment_method,
    activeReference,
    transactionId: payload.checkoutTransactionId,
  });
  return NextResponse.json({
    received: true,
    warning: 'Stale Credit Direct session',
  });
}
```

Do not modify migrations in this task. Task 3 already replaces `set_credit_direct_session` before the migration is committed, which keeps the append-only migration rule intact.

- [x] **Step 4: Verify webhook tests pass**

Run:

```bash
pnpm --filter @baci/web test src/app/api/payments/credit-direct/webhook/route.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/src/app/api/payments/credit-direct/webhook/route.ts apps/web/src/app/api/payments/credit-direct/webhook/route.test.ts
git commit -m "fix: ignore stale credit direct checkout webhooks"
```

## Task 8: Stabilize Mobile BNPL Order Idempotency

**Files:**
- Create `apps/mobile-storefront/lib/checkout-order-idempotency.ts`
- Create `apps/mobile-storefront/lib/checkout-order-idempotency.test.ts`
- Modify `apps/mobile-storefront/services/orders.ts`
- Modify `apps/mobile-storefront/services/orders.test.ts`
- Modify `apps/mobile-storefront/app/checkout.tsx`
- Modify `apps/mobile-storefront/__tests__/app/checkout.test-utils.tsx`
- Modify `apps/mobile-storefront/__tests__/app/checkout.component-mocks.test-utils.tsx`
- Modify `apps/mobile-storefront/__tests__/app/checkout.test.tsx`

- [x] **Step 1: Add mobile checkout idempotency helper tests**

Create `apps/mobile-storefront/lib/checkout-order-idempotency.test.ts`:

```ts
import { jest } from '@jest/globals';
import {
  buildMobileCheckoutFingerprint,
  clearMobileCheckoutIdempotencyKey,
  getMobileCheckoutIdempotencyKey,
  type MobileCheckoutIdempotencyState,
} from './checkout-order-idempotency';

const mockRandomUUID = jest.fn();

jest.mock('expo-crypto', () => ({
  randomUUID: () => mockRandomUUID(),
}));

const baseInput = {
  customerEmail: 'Ada@Example.com ',
  customerName: ' Ada Lovelace ',
  customerPhone: ' 08031234567 ',
  deliveryMethod: 'pickup_station',
  discountAmount: 0,
  items: [
    {
      assuranceFee: 0,
      hasAssurance: false,
      id: 'prod-b',
      price: 2000,
      productId: 'prod-b',
      quantity: 1,
      variantId: null,
    },
    {
      assuranceFee: 100,
      hasAssurance: true,
      id: 'prod-a',
      price: 1000,
      productId: 'prod-a',
      quantity: 2,
      variantId: 'variant-a',
    },
  ],
  savingsAmount: 0,
  savingsGoalId: null,
  selectedQuoteId: null,
  shippingAddress: {
    address: 'No. 5 Example Plaza',
    city: 'Lagos',
    firstName: 'Ada',
    lastName: 'Lovelace',
    notes: '',
    state: 'Lagos',
  },
  shippingFee: 2000,
  shippingProvider: 'pickup_station',
  subtotal: 4000,
  taxAmount: 0,
  walletAmount: 0,
};

describe('checkout-order-idempotency', () => {
  beforeEach(() => {
    mockRandomUUID.mockReset();
    mockRandomUUID
      .mockReturnValueOnce('mobile-key-1')
      .mockReturnValueOnce('mobile-key-2');
  });

  it('builds the same fingerprint when only item order changes', () => {
    const first = buildMobileCheckoutFingerprint(baseInput);
    const second = buildMobileCheckoutFingerprint({
      ...baseInput,
      items: [...baseInput.items].reverse(),
    });

    expect(second).toBe(first);
  });

  it('reuses one key while the checkout fingerprint is stable', () => {
    const ref: { current: MobileCheckoutIdempotencyState | null } = {
      current: null,
    };
    const fingerprint = buildMobileCheckoutFingerprint(baseInput);

    expect(getMobileCheckoutIdempotencyKey(ref, fingerprint)).toBe('mobile-key-1');
    expect(getMobileCheckoutIdempotencyKey(ref, fingerprint)).toBe('mobile-key-1');
    expect(mockRandomUUID).toHaveBeenCalledTimes(1);
  });

  it('rotates the key when commercial checkout details change', () => {
    const ref: { current: MobileCheckoutIdempotencyState | null } = {
      current: null,
    };
    const first = buildMobileCheckoutFingerprint(baseInput);
    const second = buildMobileCheckoutFingerprint({
      ...baseInput,
      shippingFee: 3000,
    });

    expect(getMobileCheckoutIdempotencyKey(ref, first)).toBe('mobile-key-1');
    expect(getMobileCheckoutIdempotencyKey(ref, second)).toBe('mobile-key-2');
  });

  it('clears only the matching checkout key when a fingerprint is supplied', () => {
    const ref: { current: MobileCheckoutIdempotencyState | null } = {
      current: null,
    };
    const fingerprint = buildMobileCheckoutFingerprint(baseInput);

    getMobileCheckoutIdempotencyKey(ref, fingerprint);
    clearMobileCheckoutIdempotencyKey(ref, 'different-fingerprint');
    expect(ref.current?.key).toBe('mobile-key-1');

    clearMobileCheckoutIdempotencyKey(ref, fingerprint);
    expect(ref.current).toBeNull();
  });
});
```

- [x] **Step 2: Implement mobile checkout idempotency helper**

Create `apps/mobile-storefront/lib/checkout-order-idempotency.ts`:

```ts
import * as Crypto from 'expo-crypto';
import type { MutableRefObject } from 'react';

export interface MobileCheckoutIdempotencyState {
  checkoutFingerprint: string;
  key: string;
}

interface MobileCheckoutIdempotencyItem {
  assuranceFee?: number | null;
  hasAssurance?: boolean | null;
  id: string;
  price: number;
  productId?: string | null;
  quantity: number;
  variantId?: string | null;
}

interface MobileCheckoutIdempotencyInput {
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: string;
  discountAmount?: number | null;
  items: readonly MobileCheckoutIdempotencyItem[];
  savingsAmount?: number | null;
  savingsGoalId?: string | null;
  selectedQuoteId?: string | null;
  shippingAddress: {
    address: string;
    city: string;
    firstName: string;
    lastName: string;
    notes?: string | null;
    state: string;
  };
  shippingFee: number;
  shippingProvider?: string | null;
  subtotal: number;
  taxAmount?: number | null;
  walletAmount?: number | null;
}

function normalizeString(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function normalizeNumber(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function buildMobileCheckoutFingerprint(
  input: MobileCheckoutIdempotencyInput
) {
  const items = input.items
    .map((item) => ({
      assuranceFee: normalizeNumber(item.assuranceFee),
      hasAssurance: Boolean(item.hasAssurance),
      id: normalizeString(item.id),
      price: normalizeNumber(item.price),
      productId: normalizeString(item.productId ?? item.id),
      quantity: normalizeNumber(item.quantity),
      variantId: normalizeString(item.variantId),
    }))
    .sort((a, b) =>
      `${a.productId}:${a.variantId}:${a.id}`.localeCompare(
        `${b.productId}:${b.variantId}:${b.id}`
      )
    );

  return JSON.stringify({
    customerEmail: normalizeString(input.customerEmail),
    customerName: normalizeString(input.customerName),
    customerPhone: normalizeString(input.customerPhone),
    deliveryMethod: normalizeString(input.deliveryMethod),
    discountAmount: normalizeNumber(input.discountAmount),
    items,
    savingsAmount: normalizeNumber(input.savingsAmount),
    savingsGoalId: normalizeString(input.savingsGoalId),
    selectedQuoteId: normalizeString(input.selectedQuoteId),
    shippingAddress: {
      address: normalizeString(input.shippingAddress.address),
      city: normalizeString(input.shippingAddress.city),
      firstName: normalizeString(input.shippingAddress.firstName),
      lastName: normalizeString(input.shippingAddress.lastName),
      notes: normalizeString(input.shippingAddress.notes),
      state: normalizeString(input.shippingAddress.state),
    },
    shippingFee: normalizeNumber(input.shippingFee),
    shippingProvider: normalizeString(input.shippingProvider),
    subtotal: normalizeNumber(input.subtotal),
    taxAmount: normalizeNumber(input.taxAmount),
    walletAmount: normalizeNumber(input.walletAmount),
  });
}

export function getMobileCheckoutIdempotencyKey(
  ref: MutableRefObject<MobileCheckoutIdempotencyState | null>,
  checkoutFingerprint: string
) {
  if (ref.current?.checkoutFingerprint === checkoutFingerprint) {
    return ref.current.key;
  }

  const key = Crypto.randomUUID();
  ref.current = { checkoutFingerprint, key };
  return key;
}

export function clearMobileCheckoutIdempotencyKey(
  ref: MutableRefObject<MobileCheckoutIdempotencyState | null>,
  checkoutFingerprint?: string
) {
  if (
    checkoutFingerprint &&
    ref.current?.checkoutFingerprint !== checkoutFingerprint
  ) {
    return;
  }

  ref.current = null;
}
```

- [x] **Step 3: Let mobile order service use caller-provided keys**

In `apps/mobile-storefront/services/orders.ts`, add `idempotency_key` to `CreateOrderRequestSchema`:

```ts
  idempotency_key: z.string().trim().min(1).max(128).optional(),
```

Replace the generated key block with:

```ts
const idempotencyKey = validatedRequest.idempotency_key ?? Crypto.randomUUID();
```

Do not add `idempotency_key` to `orderPayload`; it is a transport header only.

In the HTTP error block, add a `409` branch before the `>= 500` branch so checkout idempotency failures keep their structured server code:

```ts
} else if (response.status === 409) {
  const conflictCode = readResponseString(errorData.code) ?? 'ORDER_CONFLICT';
  throw new OrderError(errorMessage, conflictCode, conflictCode);
} else if (response.status >= 500) {
```

- [x] **Step 4: Cover caller-provided mobile order keys**

Add this test to `apps/mobile-storefront/services/orders.test.ts` near the guest checkout/header tests:

```ts
it('uses a caller-provided idempotency key header without serializing it into the order body', async () => {
  const { createOrder } = require('./orders');

  await createOrder({
    customer_email: 'buyer@example.com',
    customer_name: 'Buyer User',
    customer_phone: '+2348012345678',
    idempotency_key: 'mobile-bnpl-key-1',
    items: [
      {
        id: 'prod-bnpl-1',
        name: 'BNPL Phone',
        quantity: 1,
        price: 120000,
      },
    ],
    payment_method: 'credit_direct',
    shipping_address: {
      address: '123 St',
      city: 'Lagos',
      firstName: 'Buyer',
      lastName: 'User',
      state: 'Lagos',
    },
    shipping_fee: 2000,
    subtotal: 120000,
  });

  expect(getLastFetchOptions().headers?.['Idempotency-Key']).toBe(
    'mobile-bnpl-key-1'
  );
  expect(getLastFetchBody()).not.toHaveProperty('idempotency_key');
});
```

Add this conflict test in the same file so mobile callers can distinguish a reusable-order failure from a generic unknown error:

```ts
it('preserves checkout idempotency conflict codes from the API', async () => {
  const { createOrder } = require('./orders');

  mockFetchResponse.ok = false;
  mockFetchResponse.status = 409;
  mockFetchJson.mockResolvedValueOnce({
    code: 'CHECKOUT_ORDER_NOT_REUSABLE',
    error:
      'This checkout order can no longer be reused. Refresh checkout and start a new order.',
  });

  await expect(
    createOrder({
      customer_email: 'buyer@example.com',
      customer_name: 'Buyer User',
      customer_phone: '+2348012345678',
      idempotency_key: 'mobile-bnpl-key-1',
      items: [
        {
          id: 'prod-bnpl-1',
          name: 'BNPL Phone',
          quantity: 1,
          price: 120000,
        },
      ],
      payment_method: 'credit_direct',
      shipping_address: {
        address: '123 St',
        city: 'Lagos',
        firstName: 'Buyer',
        lastName: 'User',
        state: 'Lagos',
      },
      shipping_fee: 2000,
      subtotal: 120000,
    })
  ).rejects.toMatchObject({
    code: 'CHECKOUT_ORDER_NOT_REUSABLE',
    details: 'CHECKOUT_ORDER_NOT_REUSABLE',
  });
});
```

- [x] **Step 5: Wire stable key into mobile BNPL checkout**

In `apps/mobile-storefront/app/checkout.tsx`, import:

```ts
import {
  buildMobileCheckoutFingerprint,
  clearMobileCheckoutIdempotencyKey,
  getMobileCheckoutIdempotencyKey,
  type MobileCheckoutIdempotencyState,
} from '@/lib/checkout-order-idempotency';
```

Add this ref near the other checkout refs:

```ts
const mobileCheckoutIdempotencyRef =
  useRef<MobileCheckoutIdempotencyState | null>(null);
```

Inside the `if (isBNPL) { ... }` branch, before `createOrder`, extract the order item payload once and derive the key from checkout facts that should survive Credit Direct -> Klump switching:

```ts
const orderItemsPayload = itemsSnapshot.map((item) => {
  const effectivePrice = item.negotiatedPrice ?? item.price;
  return {
    id: item.product_id,
    product_id: item.product_id,
    name: item.name,
    quantity: item.quantity,
    price: effectivePrice,
    image_url: item.image_url,
    variant_id: item.variant_id,
    variant_attributes: item.variant_attributes,
    has_assurance: item.hasAssurance || false,
    assurance_fee: item.hasAssurance
      ? Math.round(
          effectivePrice * item.quantity * (item.assuranceRate ?? 0.05)
        )
      : 0,
  };
});
const selectedQuoteIdForOrder =
  deliveryMethod === 'door' && selectedQuote?.id != null
    ? String(selectedQuote.id)
    : undefined;
const shippingProviderForOrder = getShippingProviderForMethod(
  deliveryMethod,
  selectedQuote
);
const mobileCheckoutFingerprint = buildMobileCheckoutFingerprint({
  customerEmail,
  customerName,
  customerPhone,
  deliveryMethod,
  discountAmount: 0,
  items: orderItemsPayload.map((item) => ({
    assuranceFee: item.assurance_fee,
    hasAssurance: item.has_assurance,
    id: item.id,
    price: item.price,
    productId: item.product_id,
    quantity: item.quantity,
    variantId: item.variant_id,
  })),
  selectedQuoteId: selectedQuoteIdForOrder,
  shippingAddress: {
    address: orderShippingAddress.address,
    city: orderShippingAddress.city,
    firstName: orderShippingAddress.firstName,
    lastName: orderShippingAddress.lastName,
    notes: orderShippingAddress.notes,
    state: orderShippingAddress.state,
  },
  shippingFee: snapshotDeliveryFee,
  shippingProvider: shippingProviderForOrder,
  subtotal: snapshotSubtotal,
  taxAmount: snapshotTaxAmount,
});
const mobileCheckoutIdempotencyKey = getMobileCheckoutIdempotencyKey(
  mobileCheckoutIdempotencyRef,
  mobileCheckoutFingerprint
);
```

Then change the BNPL `createOrder` call so it reuses those values and clears only the matching mobile key when the backend says the order can no longer be reused:

```ts
let orderResponse: OrderResponse;
try {
  orderResponse = await createOrder({
    customer_email: customerEmail,
    customer_name: customerName,
    customer_phone: customerPhone,
    idempotency_key: mobileCheckoutIdempotencyKey,
    items: orderItemsPayload,
    subtotal: snapshotSubtotal,
    shipping_fee: snapshotDeliveryFee,
    tax_amount: snapshotTaxAmount,
    selected_quote_id: selectedQuoteIdForOrder,
    shipping_provider: shippingProviderForOrder,
    payment_method: paymentMethodForOrder,
    shipping_address: orderShippingAddress,
    source: 'mobile_app',
  });
} catch (error) {
  if (
    error instanceof OrderError &&
    (error.code === 'CHECKOUT_ORDER_NOT_REUSABLE' ||
      error.code === 'CHECKOUT_IDEMPOTENCY_CONFLICT')
  ) {
    clearMobileCheckoutIdempotencyKey(
      mobileCheckoutIdempotencyRef,
      mobileCheckoutFingerprint
    );
  }

  throw error;
}
```

After adding the wrapped call above, delete the older direct BNPL `const orderResponse = await createOrder(...)` block so the branch creates the order exactly once.

- [x] **Step 6: Cover mobile BNPL provider-switch reuse**

First expose a payment-settings mock in `apps/mobile-storefront/__tests__/app/checkout.test-utils.tsx` so the test can enable Credit Direct and Klump:

```tsx
export const mockUseMerchantPaymentSettings = jest.fn(() => ({
  data: null,
}));
```

Then replace the current `useMerchantPaymentSettings` mock with:

```tsx
jest.mock('@/hooks/useMerchantPaymentSettings', () => {
  const actual = jest.requireActual('@/hooks/useMerchantPaymentSettings');
  return {
    ...actual,
    useMerchantPaymentSettings: () => mockUseMerchantPaymentSettings(),
  };
});
```

Inside `setupCheckoutTest()`, reset the payment-settings mock after `jest.clearAllMocks()` so the BNPL-enabled return value from this test does not leak into later tests:

```tsx
mockUseMerchantPaymentSettings.mockReturnValue({
  data: null,
});
```

Update the existing `@/services/orders` mock in `apps/mobile-storefront/__tests__/app/checkout.test-utils.tsx` so tests can construct `OrderError` instances with specific codes:

```tsx
jest.mock('@/services/orders', () => ({
  OrderError: class extends Error {
    code: string;
    details?: unknown;

    constructor(message: string, code = 'TEST_ERROR', details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
    }
  },
  createOrder: (...args: unknown[]) => mockCreateOrder(...args),
}));
```

First extend the checkout test payment selector mock in `apps/mobile-storefront/__tests__/app/checkout.component-mocks.test-utils.tsx` so tests can choose BNPL methods:

```tsx
PaymentMethodSelector: (props: {
  onSavingsToggle?: (selection: {
    amount: number;
    goalId: string | null;
    use: boolean;
  }) => void;
  onSelectMethod?: (method: 'credit_direct' | 'klump' | 'paystack') => void;
  onSelectTab?: (tab: 'full' | 'installments' | 'pay_later') => void;
  savingsBalance?: number;
  savingsGoalId?: string | null;
}) => {
  const { Pressable, Text, View } = require('react-native');
  return (
    <View>
      <Text>Payment methods selector</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mock select Credit Direct"
        onPress={() => {
          props.onSelectTab?.('installments');
          props.onSelectMethod?.('credit_direct');
        }}
      >
        <Text>Credit Direct</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mock select Klump"
        onPress={() => {
          props.onSelectTab?.('installments');
          props.onSelectMethod?.('klump');
        }}
      >
        <Text>Klump</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mock use checkout savings"
        onPress={() =>
          props.onSavingsToggle?.({
            amount: props.savingsBalance ?? 0,
            goalId: props.savingsGoalId ?? null,
            use: true,
          })
        }
      >
        <Text>Use savings</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mock remove checkout savings"
        onPress={() =>
          props.onSavingsToggle?.({
            amount: props.savingsBalance ?? 0,
            goalId: props.savingsGoalId ?? null,
            use: false,
          })
        }
      >
        <Text>Remove savings</Text>
      </Pressable>
    </View>
  );
}
```

Add this test to `apps/mobile-storefront/__tests__/app/checkout.test.tsx`. It uses the mocked selector to submit the same commercial checkout through two BNPL providers and asserts the key is unchanged:

Add `mockUseMerchantPaymentSettings` to the existing import from `./checkout.test-utils` before adding the test:

```ts
  mockUseMerchantPaymentSettings,
```

```tsx
it('reuses the same order idempotency key when mobile BNPL switches providers', async () => {
  mockUseMerchantPaymentSettings.mockReturnValue({
    data: {
      credpal_enabled: false,
      credit_direct_enabled: true,
      juicyway_enabled: false,
      klump_enabled: true,
      klump_max_amount: 5_000_000,
      klump_min_amount: 1_000,
      korapay_enabled: false,
      pay_on_delivery_enabled: false,
      paystack_enabled: true,
      vat_rate: 0,
      vat_registration_status: 'unregistered',
    },
  });
  renderCheckoutScreen();

  fireEvent.press(
    screen.getByRole('button', { name: 'Select pickup station' })
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Continue to payment' })
  );
  await waitFor(() => {
    expect(screen.getByText('Payment Method')).toBeOnTheScreen();
  });

  fireEvent.press(screen.getByRole('button', { name: 'Mock select Credit Direct' }));
  fireEvent.press(screen.getByRole('button', { name: 'Continue to review' }));
  await waitFor(() => {
    expect(screen.getByText('Review Order')).toBeOnTheScreen();
  });
  fireEvent.press(screen.getByRole('button', { name: /Place order for/i }));

  await waitFor(() => {
    expect(mockCreateOrder).toHaveBeenCalledTimes(1);
  });
  const firstKey = mockCreateOrder.mock.calls[0]?.[0]?.idempotency_key;

  fireEvent.press(screen.getByRole('button', { name: 'Edit payment method' }));
  fireEvent.press(screen.getByRole('button', { name: 'Mock select Klump' }));
  fireEvent.press(screen.getByRole('button', { name: 'Continue to review' }));
  fireEvent.press(screen.getByRole('button', { name: /Place order for/i }));

  await waitFor(() => {
    expect(mockCreateOrder).toHaveBeenCalledTimes(2);
  });
  expect(mockCreateOrder.mock.calls[1]?.[0]?.idempotency_key).toBe(firstKey);
});
```

Add this second checkout test to confirm a stale idempotency key is cleared after the API says the order is no longer reusable:

```tsx
it('rotates the mobile BNPL idempotency key after a non-reusable order error', async () => {
  const { OrderError } = require('@/services/orders');
  const staleOrderError = new OrderError(
    'This checkout order can no longer be reused.',
    'CHECKOUT_ORDER_NOT_REUSABLE'
  );

  mockUseMerchantPaymentSettings.mockReturnValue({
    data: {
      credpal_enabled: false,
      credit_direct_enabled: true,
      juicyway_enabled: false,
      klump_enabled: true,
      klump_max_amount: 5_000_000,
      klump_min_amount: 1_000,
      korapay_enabled: false,
      pay_on_delivery_enabled: false,
      paystack_enabled: true,
      vat_rate: 0,
      vat_registration_status: 'unregistered',
    },
  });
  mockCreateOrder.mockRejectedValueOnce(staleOrderError);
  renderCheckoutScreen();

  fireEvent.press(
    screen.getByRole('button', { name: 'Select pickup station' })
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Continue to payment' })
  );
  await waitFor(() => {
    expect(screen.getByText('Payment Method')).toBeOnTheScreen();
  });

  fireEvent.press(screen.getByRole('button', { name: 'Mock select Credit Direct' }));
  fireEvent.press(screen.getByRole('button', { name: 'Continue to review' }));
  await waitFor(() => {
    expect(screen.getByText('Review Order')).toBeOnTheScreen();
  });
  fireEvent.press(screen.getByRole('button', { name: /Place order for/i }));

  await waitFor(() => {
    expect(mockCreateOrder).toHaveBeenCalledTimes(1);
  });
  const firstKey = mockCreateOrder.mock.calls[0]?.[0]?.idempotency_key;

  fireEvent.press(screen.getByRole('button', { name: /Place order for/i }));

  await waitFor(() => {
    expect(mockCreateOrder).toHaveBeenCalledTimes(2);
  });
  expect(mockCreateOrder.mock.calls[1]?.[0]?.idempotency_key).not.toBe(firstKey);
});
```

- [x] **Step 7: Run mobile focused tests**

Run:

```bash
pnpm --filter @baci/mobile-storefront test lib/checkout-order-idempotency.test.ts services/orders.test.ts __tests__/app/checkout.test.tsx
```

Expected: pass.

- [ ] **Step 8: Commit**

Run:

```bash
git add apps/mobile-storefront/lib/checkout-order-idempotency.ts apps/mobile-storefront/lib/checkout-order-idempotency.test.ts apps/mobile-storefront/services/orders.ts apps/mobile-storefront/services/orders.test.ts apps/mobile-storefront/app/checkout.tsx apps/mobile-storefront/__tests__/app/checkout.test-utils.tsx apps/mobile-storefront/__tests__/app/checkout.component-mocks.test-utils.tsx apps/mobile-storefront/__tests__/app/checkout.test.tsx
git commit -m "fix: reuse mobile BNPL order idempotency keys"
```

## Task 9: Fix BNPL Customer Messaging

**Files:**
- Modify `apps/web/src/components/storefront/ogabassey/pages/bnpl-launcher.tsx`
- Modify `apps/web/src/components/storefront/ogabassey/pages/bnpl-launcher.test.tsx`
- Modify `apps/web/src/components/storefront/ogabassey/pages/order-success-page.tsx`
- Modify `apps/web/src/components/storefront/ogabassey/pages/order-success-page.test.tsx`

- [x] **Step 1: Write success-page tests**

Add tests that render `OrderSuccessPage` with `type=credit_direct`, `type=credpal`, and `type=klump`, then assert these strings:

```ts
expect(screen.getByRole('heading', { name: /bnpl checkout submitted/i })).toBeInTheDocument();
expect(screen.getByText(/we will confirm your order after the provider approves the payment/i)).toBeInTheDocument();
```

- [x] **Step 2: Update success page copy**

In `order-success-page.tsx`, update the title/message helpers:

```ts
const isBnplSuccess = ['credit_direct', 'credpal', 'klump'].includes(successType);

const getTitle = () => {
  if (successType === 'invoice') return 'Invoice Generated!';
  if (successType === 'payforme') return 'Request Sent!';
  if (isBnplSuccess) return 'BNPL Checkout Submitted';
  return 'Order Successful!';
};

const getMessage = () => {
  if (successType === 'invoice')
    return 'Your invoice has been generated successfully. Please complete the transfer to process your order.';
  if (successType === 'payforme')
    return `We've sent a payment link to ${payerName}. Your order will be processed once payment is received.`;
  if (isBnplSuccess)
    return 'We will confirm your order after the provider approves the payment. You can track this order while approval is pending.';
  return 'Thank you for shopping with Ogabassey. Your receipt will be available for download after your order has been shipped.';
};
```

- [x] **Step 3: Add type to BNPL launcher redirects**

In `bnpl-launcher.tsx`, update the Credit Direct success query:

```ts
const successQuery = new URLSearchParams({
  orderId: order.id,
  reference: ref,
  type: 'credit_direct',
});
```

For the CredPal success query, include:

```ts
type: 'credpal'
```

For the Klump callback query, include:

```ts
type: 'klump'
```

- [x] **Step 4: Run BNPL UI tests**

Run:

```bash
pnpm --filter @baci/web test src/components/storefront/ogabassey/pages/bnpl-launcher.test.tsx src/components/storefront/ogabassey/pages/order-success-page.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/src/components/storefront/ogabassey/pages/bnpl-launcher.tsx apps/web/src/components/storefront/ogabassey/pages/bnpl-launcher.test.tsx apps/web/src/components/storefront/ogabassey/pages/order-success-page.tsx apps/web/src/components/storefront/ogabassey/pages/order-success-page.test.tsx
git commit -m "fix: clarify BNPL checkout success state"
```

## Task 10: Verification and Cleanup

**Files:**
- No required code changes.

- [x] **Step 1: Run focused test suite**

Run:

```bash
pnpm --filter @baci/web test src/lib/checkout/order-idempotency.test.ts src/app/api/orders/route.test.ts src/app/api/orders/reuse/route.test.ts src/app/api/payments/credit-direct/webhook/route.test.ts src/components/storefront/ogabassey/pages/checkout/checkout-idempotency.test.ts src/components/storefront/ogabassey/pages/checkout/pending-checkout-order.test.ts src/components/storefront/ogabassey/pages/checkout-page.test.tsx src/components/storefront/ogabassey/pages/bnpl-launcher.test.tsx src/components/storefront/ogabassey/pages/order-success-page.test.tsx src/lib/agentic/storefront-order-rpc-contract.test.ts
pnpm --filter @baci/mobile-storefront test lib/checkout-order-idempotency.test.ts services/orders.test.ts __tests__/app/checkout.test.tsx
```

Expected: pass.

- [x] **Step 2: Run required quality gates**

Run:

```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```

Expected: all pass.

- [x] **Step 3: Run CodeRabbit prompt-only review**

Run:

```bash
coderabbit review --prompt-only -t uncommitted
```

Expected: no critical or high severity findings remain.

- [ ] **Step 4: Optional production duplicate cleanup proposal**

After deployment, run the read-only duplicate query from Task 1 again. For each duplicate group, prepare a manual cleanup list that only cancels unpaid/unapproved duplicates:

```sql
-- Review-only template. Do not run without owner approval.
SELECT id, order_number, payment_status, shipping_status, created_at
FROM public.orders
WHERE id = ANY(ARRAY[
  '00000000-0000-0000-0000-000000000000'::uuid
])
ORDER BY created_at;
```

If approved, cancel only duplicates that are all of these:

```sql
payment_status IN ('unpaid', 'pending', 'bnpl_pending')
AND shipping_status = 'pending'
```

Never auto-cancel `paid`, `bnpl_approved`, shipped, delivered, or merchant-processed orders.

## Self-Review

- Spec coverage: The plan covers root-cause evidence, database idempotency, savings wrapper compatibility, voucher idempotency opt-out, API replay residual handling, browser stable keys with TTL, mobile BNPL stable keys, pending-order reuse rejection, Credit Direct stale-webhook rejection with transaction-first matching, BNPL provider switching on the same pending order, BNPL messaging, tests, and cleanup.
- Placeholder scan: No implementation step depends on an unnamed helper or unspecified error path. The only generated path is the Supabase migration file, which must come from `supabase migration new` per repo/Supabase rules.
- Type consistency: The web idempotency helper consumes an explicit `OrderIdempotencyPayloadInput`, deliberately excludes `payment_method`, and is called after route-side canonicalization so it hashes `orderItemsPayload`, `serverComputedTaxAmount`, and `serverDerivedDiscountAmount`; the mobile helper builds a provider-free checkout fingerprint and passes `idempotency_key` only as the order service header source; the API route passes `p_checkout_idempotency_key` and `p_checkout_request_hash` only for non-voucher order RPCs; base and savings RPCs return `idempotency_replayed`; route tests assert the same names.

## Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-05-28-ogabassey-bnpl-order-idempotency.md`.

1. Subagent-Driven (recommended): dispatch one fresh subagent per task, review between tasks, faster parallel progress.
2. Inline Execution: execute tasks in this session using `superpowers:executing-plans`, with checkpoints after backend, frontend, and verification.
