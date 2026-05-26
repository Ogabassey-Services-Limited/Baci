# Universal Cart Readiness Implementation Plan

> **For agentic workers:** Execute this plan inline. Do not use subagents. Use the review gates below after each implementation slice, and keep the checkbox (`- [ ]`) syntax current as work proceeds.

**Goal:** Make Baci storefronts, starting with Ogabassey, compatible with Universal Cart style UCP flows: catalog discovery, cart sessions, checkout sessions, payment authorization, order readback, monitoring, and YC-grade proof artifacts.

**Architecture:** Reuse the existing signed agentic checkout backbone instead of creating a parallel commerce stack. Add native UCP cart and catalog REST surfaces in front of the current product and checkout systems, persist cart state in a merchant-scoped table, convert carts into existing checkout sessions, and advertise only capabilities that are live and processor-backed.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod, Supabase PostgreSQL/RLS, Paystack DVA, UCP `2026-04-08`, existing Baci agentic HMAC/idempotency/replay controls, Vitest.

---

## Source References

- UCP cart: `https://ucp.dev/latest/specification/cart/`
- UCP catalog: `https://ucp.dev/latest/specification/catalog/`
- UCP checkout: `https://ucp.dev/latest/specification/checkout/`
- Google Universal Cart announcement: `https://blog.google/products-and-platforms/products/shopping/google-shopping-cart/`
- Google AP2 announcement: `https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol`
- Google Pay API FAQ: `https://developers.google.com/pay/api/faq`
- Paystack payment channels: `https://paystack.com/docs/payments/payment-channels/`

## Current State

- Ogabassey currently exposes `/.well-known/ucp`, checkout, order, feeds, trust, and an agent-commerce manifest.
- `https://ucpchecker.com/api/v1/status/ogabassey.com` reports `status: verified` for UCP `2026-04-08`.
- Existing UCP support is checkout/order focused:
  - `apps/web/src/lib/agentic/ucp-discovery-profile.ts`
  - `apps/web/src/lib/agentic/ucp-request-adapters.ts`
  - `apps/web/src/lib/agentic/ucp-response-adapters.ts`
  - `apps/web/src/app/api/agentic/checkout-sessions/*`
- Missing readiness surfaces:
  - Native `dev.ucp.shopping.cart` capability.
  - Standard `dev.ucp.shopping.catalog.search` and `dev.ucp.shopping.catalog.lookup` capabilities.
  - Cart-to-checkout conversion with persisted cart IDs.
  - Google Pay/AP2 payment handler gating.
  - Baci root platform UCP profile at `https://usebaci.com/.well-known/ucp`.
  - MCP parity for the new cart/catalog tools.
  - Production Universal Cart proof run.

## File Structure

- Create: `supabase/migrations/20260526193000_add_ucp_cart_sessions.sql`
- Create: `apps/web/src/schemas/ucp-cart-request.ts`
- Create: `apps/web/src/schemas/ucp-cart-request.test.ts`
- Create: `apps/web/src/schemas/ucp-catalog-request.ts`
- Create: `apps/web/src/schemas/ucp-catalog-request.test.ts`
- Create: `apps/web/src/lib/agentic/ucp-cart-storage.ts`
- Create: `apps/web/src/lib/agentic/ucp-cart-storage.test.ts`
- Create: `apps/web/src/lib/agentic/ucp-cart-response.ts`
- Create: `apps/web/src/lib/agentic/ucp-cart-response.test.ts`
- Create: `apps/web/src/lib/agentic/ucp-catalog-adapters.ts`
- Create: `apps/web/src/lib/agentic/ucp-catalog-adapters.test.ts`
- Create: `apps/web/src/app/api/agentic/carts/route.ts`
- Create: `apps/web/src/app/api/agentic/carts/route.test.ts`
- Create: `apps/web/src/app/api/agentic/carts/[id]/route.ts`
- Create: `apps/web/src/app/api/agentic/carts/[id]/route.test.ts`
- Create: `apps/web/src/app/api/agentic/carts/[id]/checkout/route.ts`
- Create: `apps/web/src/app/api/agentic/carts/[id]/checkout/route.test.ts`
- Create: `apps/web/src/app/api/agentic/carts/[id]/cancel/route.ts`
- Create: `apps/web/src/app/api/agentic/carts/[id]/cancel/route.test.ts`
- Create: `apps/web/src/app/api/agentic/catalog/search/route.ts`
- Create: `apps/web/src/app/api/agentic/catalog/search/route.test.ts`
- Create: `apps/web/src/app/api/agentic/catalog/lookup/route.ts`
- Create: `apps/web/src/app/api/agentic/catalog/lookup/route.test.ts`
- Create: `apps/web/src/app/api/agentic/catalog/product/route.ts`
- Create: `apps/web/src/app/api/agentic/catalog/product/route.test.ts`
- Create: `apps/web/src/app/api/agentic/catalog/product/route.ts`
- Create: `apps/web/src/app/api/agentic/catalog/product/route.test.ts`
- Modify: `apps/web/src/lib/agentic/ucp-discovery-profile.ts`
- Modify: `apps/web/src/lib/agentic/ucp-discovery-profile.test.ts`
- Modify: `apps/web/src/app/.well-known/ucp/route.ts`
- Modify: `apps/web/src/app/.well-known/ucp/route.test.ts`
- Modify: `apps/web/src/config/agentic-payment-methods.ts`
- Modify: `apps/web/src/env.ts`
- Modify: `apps/web/src/lib/agentic/agent-commerce-manifest.ts`
- Modify: `apps/web/src/lib/agentic/agent-commerce-manifest.test.ts`
- Modify: `apps/web/src/lib/agentic/ucp-request-adapters.ts`
- Modify: `apps/web/src/lib/agentic/ucp-request-adapters.test.ts`
- Modify: `apps/web/mcp-server/server.ts`
- Modify: `apps/web/mcp-server/README.md`
- Modify: `apps/web/src/lib/agentic/agent-commerce-health-monitor.ts`
- Modify: `apps/web/src/lib/agentic/agent-commerce-health-monitor.test.ts`
- Modify: `apps/web/src/app/api/cron/agentic-commerce-health/route.ts`
- Modify: `apps/web/src/app/dashboard/agentic/data.ts`
- Modify: `apps/web/src/app/dashboard/agentic/client-page.tsx`

## Acceptance Gates

- Ogabassey `/.well-known/ucp` advertises UCP cart, catalog search, catalog lookup, checkout, order, and payment handlers only when each route is live.
- UCP cart flow works with signed agent credentials: create cart, read cart, update cart, cancel cart, convert cart to checkout, complete checkout, read order.
- Baci root `https://usebaci.com/.well-known/ucp` returns a platform profile instead of 404.
- Google Pay is not advertised until a supported processor path is configured and tested.
- AP2 is not advertised until Baci can validate a mandate artifact and bind it to the exact cart, checkout, amount, currency, merchant, and buyer.
- `pnpm --filter web exec vitest run ...` targeted tests pass for every new route and adapter.
- Full quality gate passes before shipping: `pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test`.
- Production evidence exists: UCP Checker verified, signed cart-to-paid-order smoke logs, webhook reconciliation, dashboard health screenshot, and MCP tool list screenshot.

## Review Gates

Use these review gates instead of subagent handoffs.

- **Gate 0: Pre-execution baseline** - Confirm branch status, dirty files, current UCP docs links, live Ogabassey UCP status, and current MCP health before editing implementation files.
- **Gate 1: Schema and storage review** - After Tasks 1-3, review Zod schemas, migration RLS, no existing migration edits, no `select('*')`, cart status transitions, and targeted schema/storage tests.
- **Gate 2: Cart route review** - After Tasks 4-5, review auth-first behavior, signed mutation parsing, idempotency/replay handling, cart-to-checkout conversion, and targeted cart route tests.
- **Gate 3: Catalog review** - After Task 6, review explicit product columns, merchant scoping, published-product filtering, stock semantics, result ordering, and targeted catalog route tests.
- **Gate 4: Discovery/profile review** - After Tasks 7-9, review that UCP capabilities are advertised only when backing routes and payment config exist, and verify both Ogabassey and Baci root profile tests.
- **Gate 5: MCP and monitoring review** - After Tasks 10-11, review MCP tool parity, health-check output, dashboard data shape, and cron monitor output.
- **Gate 6: Production proof review** - After Task 12, review live signed flow evidence, Paystack/webhook reconciliation, order readback, UCP Checker result, CodeRabbit output, and full `pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test`.
- **Gate 7: Shipping review** - Before PR, read the final diff end to end, ensure unrelated dirty files are excluded, refresh from `origin/main`, run the required gates again if the branch changed, and write the PR summary from verified evidence only.

### Task 1: Add UCP Cart And Catalog Schemas

**Files:**
- Create: `apps/web/src/schemas/ucp-cart-request.ts`
- Create: `apps/web/src/schemas/ucp-cart-request.test.ts`
- Create: `apps/web/src/schemas/ucp-catalog-request.ts`
- Create: `apps/web/src/schemas/ucp-catalog-request.test.ts`

- [x] **Step 1: Write failing cart schema tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  ucpCartCreateRequestSchema,
  ucpCartUpdateRequestSchema,
} from './ucp-cart-request';

describe('ucp cart request schemas', () => {
  it('accepts a valid cart create request', () => {
    const parsed = ucpCartCreateRequestSchema.parse({
      currency: 'ngn',
      line_items: [{ item: { id: 'product-1' }, quantity: 2 }],
      buyer: { email: 'buyer@example.com' },
    });

    expect(parsed.currency).toBe('NGN');
    expect(parsed.line_items).toHaveLength(1);
  });

  it('rejects empty cart line items', () => {
    const parsed = ucpCartCreateRequestSchema.safeParse({ line_items: [] });

    expect(parsed.success).toBe(false);
  });

  it('accepts cart update with fulfillment context', () => {
    const parsed = ucpCartUpdateRequestSchema.parse({
      line_items: [{ item: { id: 'product-1' }, quantity: 1 }],
      shipping_address: {
        street_address: '1 Baci Road',
        address_locality: 'Lagos',
        address_country: 'NG',
      },
    });

    expect(parsed.shipping_address?.address_country).toBe('NG');
  });
});
```

- [x] **Step 2: Run cart schema tests to verify failure**

Run:

```bash
pnpm --filter web exec vitest run src/schemas/ucp-cart-request.test.ts
```

Expected: fail because `apps/web/src/schemas/ucp-cart-request.ts` does not exist.

- [x] **Step 3: Implement cart schemas**

```ts
import { z } from 'zod';

const ucpCurrencySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, 'Currency must be a 3-letter ISO code')
  .transform((value) => value.toUpperCase());

const ucpCartLineItemSchema = z
  .object({
    item: z
      .object({
        id: z.string().trim().min(1),
      })
      .passthrough(),
    quantity: z.number().int().positive(),
  })
  .passthrough();

const ucpPostalAddressSchema = z
  .object({
    address_country: z.string().trim().min(1).optional(),
    address_locality: z.string().trim().min(1).optional(),
    address_region: z.string().trim().min(1).optional(),
    extended_address: z.string().trim().min(1).optional(),
    first_name: z.string().trim().min(1).optional(),
    last_name: z.string().trim().min(1).optional(),
    phone_number: z.string().trim().min(1).optional(),
    postal_code: z.string().trim().min(1).optional(),
    street_address: z.string().trim().min(1).optional(),
  })
  .passthrough();

const ucpBuyerSchema = z
  .object({
    email: z.string().trim().email().optional(),
    name: z.string().trim().min(1).optional(),
    phone_number: z.string().trim().min(1).optional(),
  })
  .passthrough();

export const ucpCartCreateRequestSchema = z
  .object({
    buyer: ucpBuyerSchema.optional(),
    currency: ucpCurrencySchema.optional(),
    line_items: z.array(ucpCartLineItemSchema).min(1),
    shipping_address: ucpPostalAddressSchema.nullable().optional(),
  })
  .passthrough();

export const ucpCartUpdateRequestSchema = z
  .object({
    buyer: ucpBuyerSchema.optional(),
    currency: ucpCurrencySchema.optional(),
    line_items: z.array(ucpCartLineItemSchema).min(1),
    shipping_address: ucpPostalAddressSchema.nullable().optional(),
  })
  .passthrough();

export type UcpCartCreateRequest = z.infer<
  typeof ucpCartCreateRequestSchema
>;
export type UcpCartUpdateRequest = z.infer<
  typeof ucpCartUpdateRequestSchema
>;
```

- [x] **Step 4: Write failing catalog schema tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  ucpCatalogLookupRequestSchema,
  ucpCatalogSearchRequestSchema,
} from './ucp-catalog-request';

describe('ucp catalog request schemas', () => {
  it('accepts a text search request', () => {
    const parsed = ucpCatalogSearchRequestSchema.parse({
      query: 'iphone 15',
      pagination: { limit: 12 },
    });

    expect(parsed.query).toBe('iphone 15');
    expect(parsed.pagination?.limit).toBe(12);
  });

  it('accepts a filter-only browse request', () => {
    const parsed = ucpCatalogSearchRequestSchema.parse({
      filters: { categories: ['phones'] },
    });

    expect(parsed.filters).toEqual({ categories: ['phones'] });
  });

  it('caps the search limit', () => {
    const parsed = ucpCatalogSearchRequestSchema.parse({
      query: 'laptop',
      pagination: { limit: 1000 },
    });

    expect(parsed.pagination?.limit).toBe(50);
  });

  it('accepts lookup ids', () => {
    const parsed = ucpCatalogLookupRequestSchema.parse({
      ids: ['product-1', 'product-2'],
    });

    expect(parsed.ids).toEqual(['product-1', 'product-2']);
  });

  it('accepts a single product detail request', () => {
    const parsed = ucpCatalogProductRequestSchema.parse({
      id: 'product-1',
      selected: [{ name: 'Storage', label: '256GB' }],
      preferences: ['Storage', 'Color'],
    });

    expect(parsed.id).toBe('product-1');
    expect(parsed.selected).toHaveLength(1);
  });
});
```

- [x] **Step 5: Implement catalog schemas**

```ts
import { z } from 'zod';

const ucpPaginationRequestSchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z
    .number()
    .int()
    .positive()
    .catch(20)
    .transform((value) => Math.min(value, 50)),
});

const ucpSelectedOptionSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    label: z.string().trim().min(1),
    name: z.string().trim().min(1),
  })
  .passthrough();

export const ucpCatalogSearchRequestSchema = z
  .object({
    filters: z.record(z.string(), z.unknown()).optional(),
    pagination: ucpPaginationRequestSchema.optional(),
    query: z.string().trim().min(1).optional(),
  })
  .passthrough()
  .refine(
    (payload) =>
      Boolean(payload.query) ||
      (payload.filters !== undefined && Object.keys(payload.filters).length > 0),
    { message: 'Search requires query or filters' }
  );

export const ucpCatalogLookupRequestSchema = z
  .object({
    ids: z.array(z.string().trim().min(1)).min(1).max(50),
    filters: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const ucpCatalogProductRequestSchema = z
  .object({
    filters: z.record(z.string(), z.unknown()).optional(),
    id: z.string().trim().min(1),
    preferences: z.array(z.string().trim().min(1)).optional(),
    selected: z.array(ucpSelectedOptionSchema).optional(),
  })
  .passthrough();

export type UcpCatalogSearchRequest = z.infer<
  typeof ucpCatalogSearchRequestSchema
>;
export type UcpCatalogLookupRequest = z.infer<
  typeof ucpCatalogLookupRequestSchema
>;
export type UcpCatalogProductRequest = z.infer<
  typeof ucpCatalogProductRequestSchema
>;
```

- [x] **Step 6: Run schema tests**

Run:

```bash
pnpm --filter web exec vitest run \
  src/schemas/ucp-cart-request.test.ts \
  src/schemas/ucp-catalog-request.test.ts
```

Expected: pass.

- [x] **Step 7: Commit**

```bash
git add apps/web/src/schemas/ucp-cart-request.ts \
  apps/web/src/schemas/ucp-cart-request.test.ts \
  apps/web/src/schemas/ucp-catalog-request.ts \
  apps/web/src/schemas/ucp-catalog-request.test.ts
git commit -m "feat: add ucp cart and catalog schemas"
```

### Task 2: Persist Merchant-Scoped UCP Cart Sessions

**Files:**
- Create: `supabase/migrations/20260526193000_add_ucp_cart_sessions.sql`
- Create: `apps/web/src/lib/agentic/ucp-cart-storage.ts`
- Create: `apps/web/src/lib/agentic/ucp-cart-storage.test.ts`

- [x] **Step 1: Write failing storage utility tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  buildUcpCartInsert,
  buildUcpCartUpdate,
  mapUcpCartStatus,
} from './ucp-cart-storage';

describe('ucp cart storage', () => {
  it('builds a merchant-scoped cart insert', () => {
    expect(
      buildUcpCartInsert({
        cartId: 'cart_123',
        currency: 'ngn',
        items: [{ id: 'product-1', quantity: 2 }],
        merchantId: 'merchant-1',
        metadata: { source: 'ucp' },
      })
    ).toMatchObject({
      cart_id: 'cart_123',
      cart_items: [{ id: 'product-1', quantity: 2 }],
      currency: 'NGN',
      merchant_id: 'merchant-1',
      status: 'active',
    });
  });

  it('does not clear buyer context on line item updates', () => {
    expect(
      buildUcpCartUpdate({
        existingBuyer: { email: 'buyer@example.com' },
        items: [{ id: 'product-2', quantity: 1 }],
      })
    ).toMatchObject({
      buyer: { email: 'buyer@example.com' },
      cart_items: [{ id: 'product-2', quantity: 1 }],
      status: 'active',
    });
  });

  it('maps internal statuses to UCP statuses', () => {
    expect(mapUcpCartStatus('active')).toBe('active');
    expect(mapUcpCartStatus('converted')).toBe('converted');
    expect(mapUcpCartStatus('canceled')).toBe('canceled');
    expect(mapUcpCartStatus('expired')).toBe('expired');
  });
});
```

- [x] **Step 2: Run storage tests to verify failure**

Run:

```bash
pnpm --filter web exec vitest run src/lib/agentic/ucp-cart-storage.test.ts
```

Expected: fail because the storage utility does not exist.

- [x] **Step 3: Add append-only migration**

```sql
CREATE TABLE IF NOT EXISTS public.agentic_cart_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id text NOT NULL UNIQUE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  checkout_session_id uuid REFERENCES public.checkout_sessions(id) ON DELETE SET NULL,
  agent_id text,
  buyer jsonb NOT NULL DEFAULT '{}'::jsonb,
  cart_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  currency text NOT NULL DEFAULT 'NGN',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  shipping_address jsonb,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agentic_cart_sessions_status_check
    CHECK (status IN ('active', 'converted', 'canceled', 'expired')),
  CONSTRAINT agentic_cart_sessions_currency_check
    CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX IF NOT EXISTS idx_agentic_cart_sessions_merchant_updated
  ON public.agentic_cart_sessions (merchant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_agentic_cart_sessions_checkout_session_id
  ON public.agentic_cart_sessions (checkout_session_id);

ALTER TABLE public.agentic_cart_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agentic cart sessions are readable by scoped client"
  ON public.agentic_cart_sessions;
CREATE POLICY "Agentic cart sessions are readable by scoped client"
  ON public.agentic_cart_sessions
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  );

DROP POLICY IF EXISTS "Agentic cart sessions are writable by scoped client"
  ON public.agentic_cart_sessions;
CREATE POLICY "Agentic cart sessions are writable by scoped client"
  ON public.agentic_cart_sessions
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  )
  WITH CHECK (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  );

GRANT SELECT, INSERT, UPDATE ON public.agentic_cart_sessions TO authenticated;
```

- [x] **Step 4: Implement storage utility**

```ts
import type { CheckoutItem } from '@/lib/agentic/checkout';

export type UcpCartInternalStatus =
  | 'active'
  | 'converted'
  | 'canceled'
  | 'expired';

type JsonRecord = Record<string, unknown>;

export function buildUcpCartInsert({
  agentId,
  buyer = {},
  cartId,
  currency = 'NGN',
  items,
  merchantId,
  metadata = {},
  shippingAddress = null,
}: {
  agentId?: string | null;
  buyer?: JsonRecord;
  cartId: string;
  currency?: string;
  items: CheckoutItem[];
  merchantId: string;
  metadata?: JsonRecord;
  shippingAddress?: JsonRecord | null;
}) {
  return {
    agent_id: agentId ?? null,
    buyer,
    cart_id: cartId,
    cart_items: items,
    currency: currency.toUpperCase(),
    merchant_id: merchantId,
    metadata,
    shipping_address: shippingAddress,
    status: 'active',
  };
}

export function buildUcpCartUpdate({
  buyer,
  existingBuyer = {},
  items,
  metadata,
  shippingAddress,
}: {
  buyer?: JsonRecord;
  existingBuyer?: JsonRecord;
  items: CheckoutItem[];
  metadata?: JsonRecord;
  shippingAddress?: JsonRecord | null;
}) {
  return {
    buyer: buyer ?? existingBuyer,
    cart_items: items,
    ...(metadata ? { metadata } : {}),
    ...(shippingAddress !== undefined ? { shipping_address: shippingAddress } : {}),
    status: 'active',
    updated_at: new Date().toISOString(),
  };
}

export function mapUcpCartStatus(status: UcpCartInternalStatus) {
  return status;
}
```

- [x] **Step 5: Run migration and storage tests locally**

Run:

```bash
pnpm --filter web exec vitest run src/lib/agentic/ucp-cart-storage.test.ts
```

Expected: pass.

- [x] **Step 6: Commit**

```bash
git add supabase/migrations/20260526193000_add_ucp_cart_sessions.sql \
  apps/web/src/lib/agentic/ucp-cart-storage.ts \
  apps/web/src/lib/agentic/ucp-cart-storage.test.ts
git commit -m "feat: persist ucp cart sessions"
```

### Task 3: Build UCP Cart Response Shape

**Files:**
- Create: `apps/web/src/lib/agentic/ucp-cart-response.ts`
- Create: `apps/web/src/lib/agentic/ucp-cart-response.test.ts`

- [x] **Step 1: Write failing response tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildUcpCartResponse } from './ucp-cart-response';

describe('buildUcpCartResponse', () => {
  it('returns a stable cart resource', () => {
    expect(
      buildUcpCartResponse({
        cartId: 'cart_123',
        continueUrl: 'https://ogabassey.com/ogabassey/cart?agentic_cart_id=cart_123',
        currency: 'NGN',
        lineItems: [
          {
            base_amount: 2000,
            discount: 0,
            id: 'line_product_1',
            item: {
              id: 'product-1',
              product_id: 'product-1',
              quantity: 2,
              title: 'iPhone 15',
            },
            subtotal: 2000,
            tax: 0,
            total: 2000,
          },
        ],
        status: 'active',
        totals: [{ amount: 2000, display_text: 'Total', type: 'total' }],
      })
    ).toMatchObject({
      id: 'cart_123',
      line_items: [
        {
          id: 'line_product_1',
          item: { id: 'product-1', title: 'iPhone 15' },
          quantity: 2,
          totals: [{ amount: 2000, display_text: 'Total', type: 'total' }],
        },
      ],
      status: 'active',
      continue_url: 'https://ogabassey.com/ogabassey/cart?agentic_cart_id=cart_123',
      totals: [{ amount: 2000, display_text: 'Total', type: 'total' }],
      ucp: {
        version: '2026-04-08',
        capabilities: {
          'dev.ucp.shopping.cart': [{ version: '2026-04-08' }],
        },
      },
    });
  });
});
```

- [x] **Step 2: Implement response builder**

```ts
import type { GPTLineItem, GPTTotal } from '@/lib/agentic/checkout';
import { UCP_PROFILE_VERSION } from '@/lib/agentic/ucp-discovery-profile';
import type { UcpCartInternalStatus } from '@/lib/agentic/ucp-cart-storage';

const UCP_CART_CAPABILITY = 'dev.ucp.shopping.cart';

export function buildUcpCartResponse({
  cartId,
  continueUrl,
  currency,
  lineItems,
  status,
  totals,
}: {
  cartId: string;
  continueUrl: string;
  currency: string;
  lineItems: GPTLineItem[];
  status: UcpCartInternalStatus;
  totals: GPTTotal[];
}) {
  return {
    id: cartId,
    continue_url: continueUrl,
    currency: currency.toUpperCase(),
    line_items: lineItems.map((lineItem) => ({
      id: lineItem.id,
      item: {
        id: lineItem.item.id,
        title: lineItem.item.title ?? lineItem.item.id,
      },
      quantity: lineItem.item.quantity,
      totals: [
        { amount: lineItem.subtotal, display_text: 'Subtotal', type: 'subtotal' },
        { amount: lineItem.total, display_text: 'Total', type: 'total' },
      ],
    })),
    status,
    totals,
    ucp: {
      version: UCP_PROFILE_VERSION,
      status: 'success',
      capabilities: {
        [UCP_CART_CAPABILITY]: [{ version: UCP_PROFILE_VERSION }],
      },
    },
  };
}
```

- [x] **Step 3: Run response tests**

Run:

```bash
pnpm --filter web exec vitest run src/lib/agentic/ucp-cart-response.test.ts
```

Expected: pass.

- [x] **Step 4: Commit**

```bash
git add apps/web/src/lib/agentic/ucp-cart-response.ts \
  apps/web/src/lib/agentic/ucp-cart-response.test.ts
git commit -m "feat: add ucp cart response builder"
```

### Task 4: Add UCP Cart REST Routes

**Files:**
- Create: `apps/web/src/app/api/agentic/carts/route.ts`
- Create: `apps/web/src/app/api/agentic/carts/route.test.ts`
- Create: `apps/web/src/app/api/agentic/carts/[id]/route.ts`
- Create: `apps/web/src/app/api/agentic/carts/[id]/route.test.ts`
- Create: `apps/web/src/app/api/agentic/carts/[id]/cancel/route.ts`
- Create: `apps/web/src/app/api/agentic/carts/[id]/cancel/route.test.ts`

- [x] **Step 1: Write failing create route tests**

```ts
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/agentic/auth', () => ({
  verifyAgenticApiKey: vi.fn(() => true),
}));
vi.mock('@/lib/agentic/mutation-request', () => ({
  readAgenticMutationRequest: vi.fn(async () => ({
    agentId: 'openai-agent',
    apiVersion: '2026-04-30',
    body: { line_items: [] },
    idempotencyKey: 'idem-1',
    method: 'POST',
    ok: true,
    pathname: '/api/agentic/carts',
    rawBody: JSON.stringify({ line_items: [] }),
    requestId: 'req-1',
  })),
}));

describe('POST /api/agentic/carts', () => {
  it('returns 400 for invalid cart bodies', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/agentic/carts', {
        body: JSON.stringify({ line_items: [] }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    );

    expect(response.status).toBe(400);
  });
});
```

- [x] **Step 2: Implement create route around existing controls**

```ts
import { randomUUID } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { verifyAgenticApiKey } from '@/lib/agentic/auth';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import { verifyAgenticRequestAccess } from '@/lib/agentic/agent-request-controls';
import { reserveAgenticIdempotencyKey } from '@/lib/agentic/idempotency';
import { getAgenticIdempotencyErrorStatus } from '@/lib/agentic/idempotency-response';
import { buildStoredAgenticIdempotencyResponse } from '@/lib/agentic/idempotency-response-storage';
import { readAgenticMutationRequest } from '@/lib/agentic/mutation-request';
import { reserveAgenticRequestId } from '@/lib/agentic/request-replay';
import { getAgenticReplayErrorStatus } from '@/lib/agentic/request-replay-response';
import { buildUcpCartInsert } from '@/lib/agentic/ucp-cart-storage';
import { buildUcpCartResponse } from '@/lib/agentic/ucp-cart-response';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import { resolveAgenticMerchantContext } from '@/lib/agentic/merchant-context';
import { buildStoreUrl } from '@/lib/store-url';
import { createAdminClient } from '@/lib/supabase/admin';
import { ucpCartCreateRequestSchema } from '@/schemas/ucp-cart-request';

const CREATE_CART_ROUTE = 'carts.create';

export async function POST(request: NextRequest) {
  if (!verifyAgenticApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mutation = await readAgenticMutationRequest({ request });
  if (!mutation.ok) {
    return mutation.response;
  }

  const parsed = ucpCartCreateRequestSchema.safeParse(mutation.body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const merchant = await resolveAgenticMerchantContext(createAdminClient());
  if (!merchant) {
    return NextResponse.json({ error: 'Agentic merchant not found' }, { status: 500 });
  }
  const agentAccess = verifyAgenticRequestAccess({
    controls: {
      allowlist: merchant.agent_user_agent_allowlist ?? [],
      denylist: merchant.agent_user_agent_denylist ?? [],
    },
    headers: request.headers,
  });
  if (!agentAccess.ok) {
    return NextResponse.json({ error: agentAccess.error }, { status: 403 });
  }

  const items = parsed.data.line_items.map((lineItem) => ({
    id: lineItem.item.id,
    quantity: lineItem.quantity,
  }));
  const currency = parsed.data.currency ?? 'NGN';
  const supabase = createAgenticScopedSupabaseClient({
    merchantId: merchant.id,
    merchantSlug: merchant.slug,
  });
  const idempotency = await reserveAgenticIdempotencyKey({
    apiVersion: mutation.apiVersion,
    body: mutation.rawBody,
    key: mutation.idempotencyKey,
    merchantId: merchant.id,
    method: mutation.method,
    pathname: mutation.pathname,
    route: CREATE_CART_ROUTE,
    supabase,
  });
  if (!idempotency.ok) {
    return NextResponse.json(
      { error: idempotency.error },
      { status: getAgenticIdempotencyErrorStatus(idempotency.error) }
    );
  }
  if (idempotency.state === 'replay') {
    return NextResponse.json(idempotency.response, {
      status: idempotency.status,
      headers: {
        'idempotency-key': mutation.idempotencyKey,
        'request-id': mutation.requestId,
      },
    });
  }
  const replayReservation = await reserveAgenticRequestId({
    agentId: mutation.agentId,
    apiVersion: mutation.apiVersion,
    idempotencyKey: mutation.idempotencyKey,
    merchantId: merchant.id,
    requestId: mutation.requestId,
    route: CREATE_CART_ROUTE,
    supabase,
  });
  if (!replayReservation.ok) {
    return NextResponse.json(
      { error: replayReservation.error },
      { status: getAgenticReplayErrorStatus(replayReservation.error) }
    );
  }
  const respond = (
    response: Record<string, unknown>,
    status: number
  ): Promise<NextResponse> =>
    buildStoredAgenticIdempotencyResponse({
      idempotencyKey: mutation.idempotencyKey,
      merchantId: merchant.id,
      requestId: mutation.requestId,
      response,
      route: CREATE_CART_ROUTE,
      status,
      supabase,
    });
  const calculation = await calculateCheckoutSession(
    supabase,
    items,
    null,
    currency,
    merchant.id
  );

  const cartId = `cart_${randomUUID().replace(/-/g, '')}`;
  const { error } = await supabase.from('agentic_cart_sessions').insert(
    buildUcpCartInsert({
      cartId,
      currency,
      items,
      merchantId: merchant.id,
      shippingAddress: null,
    })
  );
  if (error) {
    return NextResponse.json({ error: 'Failed to create cart' }, { status: 500 });
  }

  return await respond(
    buildUcpCartResponse({
      cartId,
      continueUrl: `${buildStoreUrl(merchant)}/cart?agentic_cart_id=${encodeURIComponent(cartId)}`,
      currency,
      lineItems: calculation.lineItems,
      status: 'active',
      totals: calculation.totals,
    }),
    201
  );
}
```

- [x] **Step 3: Write and implement read/update/cancel tests**

Use this pattern for the read route test file:

```ts
it('returns 401 when the agent key is missing', async () => {
  vi.mocked(verifyAgenticApiKey).mockReturnValueOnce(false);

  const response = await GET(
    new NextRequest('http://localhost/api/agentic/carts/cart_123'),
    { params: Promise.resolve({ id: 'cart_123' }) }
  );

  expect(response.status).toBe(401);
});

it('returns 404 when a cart id is unknown', async () => {
  mockCartSelectResult({ data: null, error: null });

  const response = await GET(
    new NextRequest('http://localhost/api/agentic/carts/missing'),
    { params: Promise.resolve({ id: 'missing' }) }
  );

  expect(response.status).toBe(404);
});

it('returns the stored active cart with recalculated totals', async () => {
  mockCartSelectResult({
    data: {
      cart_id: 'cart_123',
      cart_items: [{ id: 'product-1', quantity: 1 }],
      currency: 'NGN',
      status: 'active',
    },
    error: null,
  });
  mockCheckoutCalculation({
    totals: [{ amount: 1200000, display_text: 'Total', type: 'total' }],
  });

  const response = await GET(
    new NextRequest('http://localhost/api/agentic/carts/cart_123'),
    { params: Promise.resolve({ id: 'cart_123' }) }
  );
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body).toMatchObject({
    id: 'cart_123',
    status: 'active',
    totals: [{ amount: 1200000, display_text: 'Total', type: 'total' }],
  });
});

it('updates line items and preserves buyer context', async () => {
  mockCartSelectResult({
    data: {
      buyer: { email: 'buyer@example.com' },
      cart_id: 'cart_123',
      cart_items: [{ id: 'product-1', quantity: 1 }],
      currency: 'NGN',
      status: 'active',
    },
    error: null,
  });

  const response = await POST(
    new NextRequest('http://localhost/api/agentic/carts/cart_123', {
      body: JSON.stringify({
        line_items: [{ item: { id: 'product-2' }, quantity: 2 }],
      }),
      method: 'POST',
    }),
    { params: Promise.resolve({ id: 'cart_123' }) }
  );

  expect(response.status).toBe(200);
  expect(mockUpdatePayload()).toMatchObject({
    buyer: { email: 'buyer@example.com' },
    cart_items: [{ id: 'product-2', quantity: 2 }],
  });
});

it('cancels an active cart', async () => {
  mockCartSelectResult({
    data: { cart_id: 'cart_123', status: 'active' },
    error: null,
  });

  const response = await POST(
    new NextRequest('http://localhost/api/agentic/carts/cart_123/cancel', {
      method: 'POST',
    }),
    { params: Promise.resolve({ id: 'cart_123' }) }
  );

  expect(response.status).toBe(200);
  expect(mockUpdatePayload()).toMatchObject({ status: 'canceled' });
});

it('rejects updates after a cart is converted', async () => {
  mockCartSelectResult({
    data: { cart_id: 'cart_123', status: 'converted' },
    error: null,
  });

  const response = await POST(
    new NextRequest('http://localhost/api/agentic/carts/cart_123', {
      body: JSON.stringify({
        line_items: [{ item: { id: 'product-2' }, quantity: 2 }],
      }),
      method: 'POST',
    }),
    { params: Promise.resolve({ id: 'cart_123' }) }
  );

  expect(response.status).toBe(409);
});
```

- [x] **Step 4: Run cart route tests**

Run:

```bash
pnpm --filter web exec vitest run \
  src/app/api/agentic/carts/route.test.ts \
  src/app/api/agentic/carts/[id]/route.test.ts \
  src/app/api/agentic/carts/[id]/cancel/route.test.ts
```

Expected: pass.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/app/api/agentic/carts
git commit -m "feat: add signed ucp cart routes"
```

### Task 5: Convert UCP Carts Into Existing Checkout Sessions

**Files:**
- Create: `apps/web/src/lib/agentic/ucp-cart-checkout-conversion.ts`
- Create: `apps/web/src/lib/agentic/ucp-cart-checkout-conversion.test.ts`
- Create: `apps/web/src/app/api/agentic/carts/[id]/checkout/route.ts`
- Create: `apps/web/src/app/api/agentic/carts/[id]/checkout/route.test.ts`
- Modify: `apps/web/src/app/api/agentic/checkout-sessions/route.ts`
- Modify: `apps/web/src/app/api/agentic/checkout-sessions/route.test.ts`
- Modify: `apps/web/src/schemas/agentic-checkout.ts`
- Modify: `apps/web/src/schemas/agentic-checkout.test.ts`
- Modify: `apps/web/src/lib/agentic/ucp-request-adapters.ts`
- Modify: `apps/web/src/lib/agentic/ucp-request-adapters.test.ts`

- [x] **Step 1: Write failing cart-to-checkout route tests**

```ts
describe('POST /api/agentic/carts/[id]/checkout', () => {
  it('creates a checkout session from an active cart', async () => {
    mockCartSelectResult({
      data: {
        cart_id: 'cart_123',
        cart_items: [{ id: 'product-1', quantity: 1 }],
        currency: 'NGN',
        shipping_address: { city: 'Lagos' },
        status: 'active',
      },
      error: null,
    });
    mockCheckoutCreateResponse({
      id: 'agentic_session_1',
      status: 'ready_for_complete',
    });

    const response = await POST(
      new NextRequest('http://localhost/api/agentic/carts/cart_123/checkout', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'cart_123' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe('agentic_session_1');
  });

  it('returns the existing checkout session when the cart was already converted', async () => {
    mockCartSelectResult({
      data: {
        cart_id: 'cart_123',
        checkout_session_id: 'checkout-row-1',
        status: 'converted',
      },
      error: null,
    });
    mockCheckoutReadResult({
      data: { session_id: 'agentic_session_1', status: 'processing' },
      error: null,
    });

    const response = await POST(
      new NextRequest('http://localhost/api/agentic/carts/cart_123/checkout', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'cart_123' }) }
    );

    expect(response.status).toBe(200);
    expect(mockCheckoutCreateHandler).not.toHaveBeenCalled();
  });

  it('returns 409 when the cart is canceled or expired', async () => {
    mockCartSelectResult({
      data: { cart_id: 'cart_123', status: 'canceled' },
      error: null,
    });

    const response = await POST(
      new NextRequest('http://localhost/api/agentic/carts/cart_123/checkout', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'cart_123' }) }
    );

    expect(response.status).toBe(409);
  });

  it('stores checkout_session_id back on the cart row', async () => {
    mockCartSelectResult({
      data: {
        cart_id: 'cart_123',
        cart_items: [{ id: 'product-1', quantity: 1 }],
        currency: 'NGN',
        status: 'active',
      },
      error: null,
    });
    mockCheckoutCreateResponse({
      id: 'agentic_session_1',
    });
    mockCheckoutRowLookup({
      data: { id: 'checkout-row-1', session_id: 'agentic_session_1' },
      error: null,
    });

    await POST(
      new NextRequest('http://localhost/api/agentic/carts/cart_123/checkout', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'cart_123' }) }
    );

    expect(mockUpdatePayload()).toMatchObject({
      checkout_session_id: 'checkout-row-1',
      status: 'converted',
    });
  });
});
```

- [x] **Step 2: Implement the conversion contract**

Create `apps/web/src/lib/agentic/ucp-cart-checkout-conversion.ts`. It must not call `handleAgenticCheckoutSessionCreate`, because that handler returns the public `session_id` but not the internal `checkout_sessions.id` needed for the cart link. Instead, extract the shared primitives from `apps/web/src/app/api/agentic/checkout_sessions/route.ts`:

```ts
const CART_TO_CHECKOUT_ROUTE = 'carts.checkout';

// Read agentic_cart_sessions by cart_id and merchant_id.
// Reject canceled or expired carts with 409.
// If checkout_session_id exists, read and return the existing checkout session.
// Otherwise calculate the cart with calculateCheckoutSession, insert a
// checkout_sessions row with buildCheckoutSessionInsert, then update the cart
// row to status converted with checkout_session_id = inserted checkout row id.
// Persist idempotency before returning the response, matching the existing
// checkout_sessions.create flow.
```

The helper should expose:

```ts
export async function convertUcpCartToCheckout({
  cartId,
  merchant,
  mutation,
  requestUrl,
  supabase,
}: {
  cartId: string;
  merchant: AgenticMerchantContext;
  mutation: Extract<AgenticMutationRequest, { ok: true }>;
  requestUrl: string;
  supabase: SupabaseClient;
}): Promise<NextResponse> {
  // Implementation follows the contract above.
}
```

The route `apps/web/src/app/api/agentic/carts/[id]/checkout/route.ts` is then a thin signed wrapper:

```ts
export async function POST(request: NextRequest, props: RouteProps) {
  if (!verifyAgenticApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mutation = await readAgenticMutationRequest({ request });
  if (!mutation.ok) return mutation.response;

  const merchant = await resolveAgenticMerchantContext(createAdminClient());
  if (!merchant) {
    return NextResponse.json({ error: 'Agentic merchant not found' }, { status: 500 });
  }

  const supabase = createAgenticScopedSupabaseClient({
    merchantId: merchant.id,
    merchantSlug: merchant.slug,
  });
  const { id: cartId } = await props.params;

  return convertUcpCartToCheckout({
    cartId,
    merchant,
    mutation,
    requestUrl: request.url,
    supabase,
  });
}
```

- [x] **Step 3: Extend checkout create to accept UCP cart references**

Update `apps/web/src/schemas/agentic-checkout.ts` so `checkoutSessionSchema` accepts either direct `items` or a UCP `cart_id`:

```ts
const checkoutSessionCartSchema = z.object({
  cart_id: z.string().trim().min(1),
  currency: z
    .string()
    .trim()
    .length(3, 'Currency must be a 3-letter ISO code')
    .transform((value) => value.toUpperCase())
    .optional()
    .default('NGN'),
});

export const checkoutSessionSchema = z.preprocess(
  normalizeCheckoutAcpAliases,
  z.union([checkoutSessionBaseSchema, checkoutSessionCartSchema])
);
```

Add schema tests:

```ts
it('accepts a UCP cart id checkout creation payload', () => {
  const result = checkoutSessionSchema.safeParse({ cart_id: 'cart_123' });

  expect(result.success).toBe(true);
  expect(result.success && result.data).toMatchObject({ cart_id: 'cart_123' });
});
```

Update `apps/web/src/app/api/agentic/checkout-sessions/route.ts`: after `checkoutSessionSchema.safeParse(requestBody)`, if the parsed data contains `cart_id`, call `convertUcpCartToCheckout` and return. This makes standard `POST /api/agentic/checkout-sessions` with `{ "cart_id": "..." }` behave like UCP requires.

Then keep the request adapter cart-reference mapping:

```ts
export function adaptUcpCheckoutCreateRequestBody(body: unknown): unknown {
  if (hasLegacyItems(body)) return body;
  if (isRecord(body) && typeof body.cart_id === 'string') {
    return {
      cart_id: body.cart_id,
      currency: typeof body.currency === 'string' ? body.currency : undefined,
    };
  }

  const parsed = ucpCheckoutCreateRequestSchema.safeParse(body);
  if (!parsed.success) return body;

  const adapted: Record<string, unknown> = {
    items: parsed.data.line_items.map(toAgenticCheckoutItem),
  };

  if (parsed.data.currency) adapted.currency = parsed.data.currency;
  if (isRecord(body) && Object.hasOwn(body, 'shipping_address')) {
    adapted.shipping_address = toAgenticShippingAddress(parsed.data.shipping_address);
  }

  return adapted;
}
```

- [x] **Step 4: Run route and adapter tests**

Run:

```bash
pnpm --filter web exec vitest run \
  src/lib/agentic/ucp-cart-checkout-conversion.test.ts \
  src/app/api/agentic/carts/[id]/checkout/route.test.ts \
  src/app/api/agentic/checkout-sessions/route.test.ts \
  src/schemas/agentic-checkout.test.ts \
  src/lib/agentic/ucp-request-adapters.test.ts
```

Expected: pass.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/lib/agentic/ucp-cart-checkout-conversion.ts \
  apps/web/src/lib/agentic/ucp-cart-checkout-conversion.test.ts \
  apps/web/src/app/api/agentic/carts/[id]/checkout \
  apps/web/src/app/api/agentic/checkout-sessions/route.ts \
  apps/web/src/app/api/agentic/checkout-sessions/route.test.ts \
  apps/web/src/schemas/agentic-checkout.ts \
  apps/web/src/schemas/agentic-checkout.test.ts \
  apps/web/src/lib/agentic/ucp-request-adapters.ts \
  apps/web/src/lib/agentic/ucp-request-adapters.test.ts
git commit -m "feat: convert ucp carts to checkout sessions"
```

### Task 6: Add Standard UCP Catalog Search And Lookup

**Files:**
- Create: `apps/web/src/lib/agentic/ucp-catalog-adapters.ts`
- Create: `apps/web/src/lib/agentic/ucp-catalog-adapters.test.ts`
- Create: `apps/web/src/app/api/agentic/catalog/search/route.ts`
- Create: `apps/web/src/app/api/agentic/catalog/search/route.test.ts`
- Create: `apps/web/src/app/api/agentic/catalog/lookup/route.ts`
- Create: `apps/web/src/app/api/agentic/catalog/lookup/route.test.ts`

- [x] **Step 1: Write failing adapter tests**

```ts
import { describe, expect, it } from 'vitest';
import { mapStorefrontProductToUcpCatalogProduct } from './ucp-catalog-adapters';

describe('ucp catalog adapters', () => {
  it('maps a storefront product into a UCP catalog product', () => {
    const product = mapStorefrontProductToUcpCatalogProduct({
      currency: 'NGN',
      description: 'A flagship phone',
      id: 'product-1',
      image_url: 'https://cdn.example/p.jpg',
      in_stock: true,
      name: 'iPhone 15',
      price: 1200000,
      product_url: 'https://ogabassey.com/ogabassey/products/iphone-15',
    });

    expect(product).toMatchObject({
      id: 'product-1',
      title: 'iPhone 15',
      description: { plain: 'A flagship phone' },
      price_range: {
        min: { amount: 1200000, currency: 'NGN' },
        max: { amount: 1200000, currency: 'NGN' },
      },
      url: 'https://ogabassey.com/ogabassey/products/iphone-15',
      variants: [
        expect.objectContaining({
          id: 'product-1',
          inputs: [{ id: 'product-1', match: 'featured' }],
          price: { amount: 1200000, currency: 'NGN' },
          availability: { available: true },
        }),
      ],
    });
  });
});
```

- [x] **Step 2: Implement adapter**

```ts
type StorefrontProductForUcp = {
  currency: string;
  description?: string | null;
  id: string;
  image_url?: string | null;
  in_stock: boolean;
  name: string;
  price: number;
  product_url: string;
};

export function mapStorefrontProductToUcpCatalogProduct(
  product: StorefrontProductForUcp
) {
  const price = {
    amount: product.price,
    currency: product.currency.toUpperCase(),
  };
  const media = product.image_url
    ? [{ alt_text: product.name, type: 'image', url: product.image_url }]
    : [];

  return {
    id: product.id,
    title: product.name,
    description: { plain: product.description ?? '' },
    url: product.product_url,
    media,
    price_range: {
      min: price,
      max: price,
    },
    variants: [
      {
        id: product.id,
        inputs: [{ id: product.id, match: 'featured' }],
        title: product.name,
        description: { plain: product.description ?? '' },
        url: product.product_url,
        media,
        price,
        availability: { available: product.in_stock },
      },
    ],
  };
}
```

- [x] **Step 3: Write route tests**

Use this pattern for catalog search and lookup route tests:

```ts
it('returns 401 when the agent key is missing', async () => {
  vi.mocked(verifyAgenticApiKey).mockReturnValueOnce(false);

  const response = await POST(
    new NextRequest('http://localhost/api/agentic/catalog/search', {
      body: JSON.stringify({ query: 'iphone' }),
      method: 'POST',
    })
  );

  expect(response.status).toBe(401);
});

it('returns matching products for a text query', async () => {
  mockProductRows([
    {
      id: 'product-1',
      image_url: 'https://cdn.example/iphone.jpg',
      name: 'iPhone 15',
      price: 1200000,
      slug: 'iphone-15',
      status: 'active',
    },
  ]);

  const response = await POST(
    new NextRequest('http://localhost/api/agentic/catalog/search', {
      body: JSON.stringify({ query: 'iphone', pagination: { limit: 10 } }),
      method: 'POST',
    })
  );
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.products).toEqual([
    expect.objectContaining({ id: 'product-1', title: 'iPhone 15' }),
  ]);
});

it('returns lookup products with variant input correlation', async () => {
  mockProductRows([
    { id: 'product-2', name: 'MacBook', price: 2500000, slug: 'macbook' },
    { id: 'product-1', name: 'iPhone', price: 1200000, slug: 'iphone' },
  ]);

  const response = await POST(
    new NextRequest('http://localhost/api/agentic/catalog/lookup', {
      body: JSON.stringify({ ids: ['product-1', 'product-2'] }),
      method: 'POST',
    })
  );
  const body = await response.json();

  expect(body.products).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        variants: [
          expect.objectContaining({
            inputs: [expect.objectContaining({ id: 'product-1' })],
          }),
        ],
      }),
    ])
  );
});

it('returns a single product detail resource', async () => {
  mockProductRows([
    { id: 'product-1', name: 'iPhone', price: 1200000, slug: 'iphone' },
  ]);

  const response = await POST(
    new NextRequest('http://localhost/api/agentic/catalog/product', {
      body: JSON.stringify({ id: 'product-1' }),
      method: 'POST',
    })
  );
  const body = await response.json();

  expect(body.product).toMatchObject({
    id: 'product-1',
    title: 'iPhone',
  });
});

it('omits unpublished products', async () => {
  mockProductRows([
    { id: 'draft-product', name: 'Draft', status: 'draft' },
    { id: 'product-1', name: 'Live', status: 'active' },
  ]);

  const response = await POST(
    new NextRequest('http://localhost/api/agentic/catalog/search', {
      body: JSON.stringify({ query: 'phone' }),
      method: 'POST',
    })
  );
  const body = await response.json();

  expect(body.products).toEqual([
    expect.objectContaining({ id: 'product-1' }),
  ]);
});

it('does not use select star in Supabase queries', async () => {
  await POST(
    new NextRequest('http://localhost/api/agentic/catalog/search', {
      body: JSON.stringify({ query: 'phone' }),
      method: 'POST',
    })
  );

  expect(mockSelect).not.toHaveBeenCalledWith('*');
});
```

- [x] **Step 4: Implement search, lookup, and product routes**

All catalog routes must:

```ts
// 1. verifyAgenticApiKey(request)
// 2. resolveAgenticMerchantContext(createAdminClient())
// 3. validate body with ucpCatalogSearchRequestSchema,
//    ucpCatalogLookupRequestSchema, or ucpCatalogProductRequestSchema
// 4. query products with explicit columns only
// 5. scope by merchant_id and published/active status
// 6. search/lookup return { products, messages, ucp: { version, status, capabilities } }
// 7. product detail returns { product, messages, ucp: { version, status, capabilities } }
```

Use explicit product columns:

```ts
const PRODUCT_SELECT =
  'id, name, description, price, image_url, slug, stock_quantity, manage_stock, status, merchant_id';
```

Implementation note: the live `products` table stores primary media in `images`
JSON, not an `image_url` column, so the route uses explicit `images` and
`stock` columns instead of the sample `image_url` projection.

- [x] **Step 5: Run catalog tests**

Run:

```bash
pnpm --filter web exec vitest run \
  src/lib/agentic/ucp-catalog-adapters.test.ts \
  src/app/api/agentic/catalog/search/route.test.ts \
  src/app/api/agentic/catalog/lookup/route.test.ts \
  src/app/api/agentic/catalog/product/route.test.ts
```

Expected: pass.

- [x] **Step 6: Commit**

```bash
git add apps/web/src/lib/agentic/ucp-catalog-adapters.ts \
  apps/web/src/lib/agentic/ucp-catalog-adapters.test.ts \
  apps/web/src/app/api/agentic/catalog
git commit -m "feat: add ucp catalog search and lookup"
```

### Task 7: Advertise UCP Cart And Catalog Capabilities

**Files:**
- Modify: `apps/web/src/lib/agentic/ucp-discovery-profile.ts`
- Modify: `apps/web/src/lib/agentic/ucp-discovery-profile.test.ts`
- Modify: `apps/web/src/app/.well-known/ucp/route.test.ts`

- [x] **Step 1: Write failing discovery profile tests**

```ts
it('advertises UCP cart operations when checkout is enabled', () => {
  const profile = buildUcpDiscoveryProfile(baseManifest);

  expect(profile.ucp.capabilities['dev.ucp.shopping.cart']).toEqual([
    expect.objectContaining({
      config: expect.objectContaining({
        rest: expect.objectContaining({
          operations: expect.objectContaining({
            cancel_cart: 'https://ogabassey.com/api/agentic/carts/{id}/cancel',
            convert_cart_to_checkout:
              'https://ogabassey.com/api/agentic/carts/{id}/checkout',
            create_cart: 'https://ogabassey.com/api/agentic/carts',
            get_cart: 'https://ogabassey.com/api/agentic/carts/{id}',
            update_cart: 'https://ogabassey.com/api/agentic/carts/{id}',
          }),
        }),
      }),
    }),
  ]);
});

it('advertises UCP catalog search and lookup operations', () => {
  const profile = buildUcpDiscoveryProfile(baseManifest);

  expect(profile.ucp.capabilities['dev.ucp.shopping.catalog.search']).toBeDefined();
  expect(
    profile.ucp.capabilities['dev.ucp.shopping.catalog.lookup'][0].config.rest
      .operations
  ).toMatchObject({
    get_product: 'https://ogabassey.com/api/agentic/catalog/product',
    lookup_catalog: 'https://ogabassey.com/api/agentic/catalog/lookup',
  });
});
```

- [x] **Step 2: Add UCP operation constants**

```ts
const UCP_CART_CAPABILITY = 'dev.ucp.shopping.cart';
const UCP_CATALOG_SEARCH_CAPABILITY = 'dev.ucp.shopping.catalog.search';
const UCP_CATALOG_LOOKUP_CAPABILITY = 'dev.ucp.shopping.catalog.lookup';
const UCP_CART_SPEC_URL = `${UCP_SPEC_BASE_URL}/cart`;
const UCP_CATALOG_SPEC_URL = `${UCP_SPEC_BASE_URL}/catalog`;
```

- [x] **Step 3: Add cart and catalog builders**

```ts
function buildUcpCartCapability(agenticApiBaseUrl: string) {
  const templateUrl = (path: string) =>
    `${agenticApiBaseUrl.replace(/\/+$/, '')}/${path}`;

  return {
    version: UCP_PROFILE_VERSION,
    spec: UCP_CART_SPEC_URL,
    config: {
      rest: {
        endpoint: agenticApiBaseUrl,
        operations: {
          cancel_cart: templateUrl('carts/{id}/cancel'),
          convert_cart_to_checkout: templateUrl('carts/{id}/checkout'),
          create_cart: templateUrl('carts'),
          get_cart: templateUrl('carts/{id}'),
          update_cart: templateUrl('carts/{id}'),
        },
      },
    },
  };
}

function buildUcpCatalogSearchCapability(agenticApiBaseUrl: string) {
  const templateUrl = (path: string) =>
    `${agenticApiBaseUrl.replace(/\/+$/, '')}/${path}`;

  return {
    version: UCP_PROFILE_VERSION,
    spec: UCP_CATALOG_SPEC_URL,
    config: {
      rest: {
        endpoint: agenticApiBaseUrl,
        operations: {
          search_catalog: templateUrl('catalog/search'),
        },
      },
    },
  };
}

function buildUcpCatalogLookupCapability(agenticApiBaseUrl: string) {
  const templateUrl = (path: string) =>
    `${agenticApiBaseUrl.replace(/\/+$/, '')}/${path}`;

  return {
    version: UCP_PROFILE_VERSION,
    spec: UCP_CATALOG_SPEC_URL,
    config: {
      rest: {
        endpoint: agenticApiBaseUrl,
        operations: {
          get_product: templateUrl('catalog/product'),
          lookup_catalog: templateUrl('catalog/lookup'),
        },
      },
    },
  };
}
```

Normalize slashes with the existing `buildUrl` helper before committing; tests must assert final URLs have exactly one slash between `/api/agentic/` and the route.

- [x] **Step 4: Run discovery tests**

Run:

```bash
pnpm --filter web exec vitest run \
  src/lib/agentic/ucp-discovery-profile.test.ts \
  src/app/.well-known/ucp/route.test.ts
```

Expected: pass.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/lib/agentic/ucp-discovery-profile.ts \
  apps/web/src/lib/agentic/ucp-discovery-profile.test.ts \
  apps/web/src/app/.well-known/ucp/route.test.ts
git commit -m "feat: advertise ucp cart and catalog capabilities"
```

### Task 8: Gate Google Pay And AP2 Capability Advertising

**Files:**
- Modify: `apps/web/src/config/agentic-payment-methods.ts`
- Modify: `apps/web/src/env.ts`
- Modify: `apps/web/src/lib/agentic/agent-commerce-manifest.ts`
- Modify: `apps/web/src/lib/agentic/agent-commerce-manifest.test.ts`
- Modify: `apps/web/src/lib/agentic/ucp-discovery-profile.ts`
- Modify: `apps/web/src/lib/agentic/ucp-discovery-profile.test.ts`
- Modify: `apps/web/src/lib/agentic/ucp-request-adapters.ts`
- Modify: `apps/web/src/lib/agentic/ucp-request-adapters.test.ts`

- [x] **Step 1: Write failing payment handler tests**

```ts
it('does not advertise Google Pay when processor config is absent', () => {
  vi.stubEnv('BACI_GOOGLE_PAY_ENABLED', '');

  const manifest = buildAgentCommerceManifest(merchant, 'https://ogabassey.com');
  const profile = buildUcpDiscoveryProfile(manifest);

  expect(profile.ucp.payment_handlers).not.toHaveProperty('com.google.pay');
});

it('advertises Google Pay only when explicitly configured', () => {
  vi.stubEnv('BACI_GOOGLE_PAY_ENABLED', 'true');
  vi.stubEnv('BACI_GOOGLE_PAY_GATEWAY', 'paystack');
  vi.stubEnv('BACI_GOOGLE_PAY_GATEWAY_MERCHANT_ID', 'paystack-merchant-id');
  vi.stubEnv('BACI_GOOGLE_PAY_MERCHANT_ID', 'google-merchant-id');

  const manifest = buildAgentCommerceManifest(merchant, 'https://ogabassey.com');
  const profile = buildUcpDiscoveryProfile(manifest);

  expect(profile.ucp.payment_handlers['com.google.pay']).toEqual([
    expect.objectContaining({
      id: 'google_pay',
      available_instruments: [
        expect.objectContaining({ currency: 'NGN', type: 'google_pay' }),
      ],
    }),
  ]);
});
```

- [x] **Step 2: Add payment constants**

```ts
export const AGENTIC_PAYMENT_METHOD_GOOGLE_PAY = 'google_pay' as const;
export const AGENTIC_PAYMENT_PROVIDER_GOOGLE_PAY = 'google_pay' as const;
```

Extend `AgenticPaymentMethod` and `AgenticPaymentProvider` unions with the new constants.

- [x] **Step 3: Add server env getters**

Add validated optional env vars in `apps/web/src/env.ts`:

```ts
BACI_GOOGLE_PAY_ENABLED: z.string().optional(),
BACI_GOOGLE_PAY_GATEWAY: z.string().optional(),
BACI_GOOGLE_PAY_GATEWAY_MERCHANT_ID: z.string().optional(),
BACI_GOOGLE_PAY_MERCHANT_ID: z.string().optional(),
```

Add helper:

```ts
export const getGooglePayAgenticConfig = () => {
  const enabled =
    (process.env.BACI_GOOGLE_PAY_ENABLED ?? env?.BACI_GOOGLE_PAY_ENABLED) ===
    'true';
  const gateway = trimSecret(
    process.env.BACI_GOOGLE_PAY_GATEWAY ?? env?.BACI_GOOGLE_PAY_GATEWAY
  );
  const gatewayMerchantId = trimSecret(
    process.env.BACI_GOOGLE_PAY_GATEWAY_MERCHANT_ID ??
      env?.BACI_GOOGLE_PAY_GATEWAY_MERCHANT_ID
  );
  const merchantId = trimSecret(
    process.env.BACI_GOOGLE_PAY_MERCHANT_ID ?? env?.BACI_GOOGLE_PAY_MERCHANT_ID
  );

  if (!enabled || !gateway || !gatewayMerchantId || !merchantId) return null;

  return { gateway, gatewayMerchantId, merchantId };
};
```

- [x] **Step 4: Add UCP Google Pay handler only when configured**

```ts
handlers['com.google.pay'] = [
  {
    id: AGENTIC_PAYMENT_METHOD_GOOGLE_PAY,
    version: UCP_PROFILE_VERSION,
    spec: 'https://developers.google.com/pay/api/web/overview',
    available_instruments: [{ type: 'google_pay', currency: 'NGN' }],
    config: {
      gateway: googlePayConfig.gateway,
      gateway_merchant_id: googlePayConfig.gatewayMerchantId,
      merchant_id: googlePayConfig.merchantId,
    },
  },
];
```

- [x] **Step 5: Add AP2 non-advertising guard**

Add a test that proves AP2 is absent until real mandate verification is implemented:

```ts
it('does not advertise AP2 mandate support without an AP2 verifier', () => {
  const profile = buildUcpDiscoveryProfile(baseManifest);

  expect(profile.ucp.capabilities).not.toHaveProperty(
    'dev.ucp.shopping.ap2_mandate'
  );
});
```

- [x] **Step 6: Run payment handler tests**

Run:

```bash
pnpm --filter web exec vitest run \
  src/lib/agentic/agent-commerce-manifest.test.ts \
  src/lib/agentic/ucp-discovery-profile.test.ts \
  src/lib/agentic/ucp-request-adapters.test.ts
```

Expected: pass.

- [x] **Step 7: Commit**

```bash
git add apps/web/src/config/agentic-payment-methods.ts \
  apps/web/src/env.ts \
  apps/web/src/lib/agentic/agent-commerce-manifest.ts \
  apps/web/src/lib/agentic/agent-commerce-manifest.test.ts \
  apps/web/src/lib/agentic/ucp-discovery-profile.ts \
  apps/web/src/lib/agentic/ucp-discovery-profile.test.ts \
  apps/web/src/lib/agentic/ucp-request-adapters.ts \
  apps/web/src/lib/agentic/ucp-request-adapters.test.ts
git commit -m "feat: gate google pay and ap2 ucp advertising"
```

### Task 9: Add Baci Platform UCP Profile

**Files:**
- Modify: `apps/web/src/app/.well-known/ucp/route.ts`
- Modify: `apps/web/src/app/.well-known/ucp/route.test.ts`
- Create: `apps/web/src/lib/agentic/baci-platform-ucp-profile.ts`
- Create: `apps/web/src/lib/agentic/baci-platform-ucp-profile.test.ts`

- [ ] **Step 1: Write failing root-domain test**

```ts
it('returns a Baci platform profile on the root domain', async () => {
  const response = await GET(new Request('https://usebaci.com/.well-known/ucp'));
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.platform).toMatchObject({
    name: 'Baci',
    type: 'merchant_platform',
  });
  expect(body.links).toMatchObject({
    merchant_onboarding: 'https://usebaci.com/onboarding',
  });
});
```

- [ ] **Step 2: Implement platform profile builder**

```ts
export function buildBaciPlatformUcpProfile(baseUrl: string) {
  return {
    platform: {
      name: 'Baci',
      type: 'merchant_platform',
    },
    ucp: {
      version: '2026-04-08',
      services: {},
      capabilities: {
        'com.usebaci.merchant_platform': [
          {
            version: '2026-05-26',
            config: {
              storefront_profile_path: '/.well-known/ucp',
            },
          },
        ],
      },
      payment_handlers: {},
    },
    links: {
      merchant_onboarding: new URL('/onboarding', baseUrl).toString(),
      ogabassey_demo: 'https://ogabassey.com/.well-known/ucp',
    },
  };
}
```

- [ ] **Step 3: Route root domain to platform profile**

In `apps/web/src/app/.well-known/ucp/route.ts`, before storefront merchant resolution:

```ts
const requestUrl = new URL(request.url);
if (requestUrl.hostname === ROOT_DOMAIN) {
  return NextResponse.json(buildBaciPlatformUcpProfile(requestUrl.origin), {
    headers: {
      'Cache-Control': UCP_PROFILE_CACHE_CONTROL,
      'Vercel-CDN-Cache-Control': 'no-store',
    },
  });
}
```

- [ ] **Step 4: Run profile tests**

Run:

```bash
pnpm --filter web exec vitest run \
  src/lib/agentic/baci-platform-ucp-profile.test.ts \
  src/app/.well-known/ucp/route.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/agentic/baci-platform-ucp-profile.ts \
  apps/web/src/lib/agentic/baci-platform-ucp-profile.test.ts \
  apps/web/src/app/.well-known/ucp/route.ts \
  apps/web/src/app/.well-known/ucp/route.test.ts
git commit -m "feat: expose baci platform ucp profile"
```

### Task 10: Add MCP Parity For Cart And Catalog

**Files:**
- Modify: `apps/web/mcp-server/server.ts`
- Modify: `apps/web/mcp-server/README.md`

- [ ] **Step 1: Add MCP tool registration tests or smoke script**

If the MCP server has no existing unit harness, add a smoke command to `apps/web/mcp-server/README.md` that checks the tool list through the configured MCP client:

```bash
curl -fsS https://mcp.ogabassey.com/health
```

Expected response:

```json
{"status":"healthy","database":"connected"}
```

- [ ] **Step 2: Register tools**

Add MCP tools with names and route mapping:

```ts
[
  'search_ucp_catalog',
  'lookup_ucp_catalog_items',
  'create_ucp_cart',
  'get_ucp_cart',
  'update_ucp_cart',
  'convert_ucp_cart_to_checkout',
  'cancel_ucp_cart',
]
```

Each tool must call the corresponding REST route with the same signed request helper used by the existing signed checkout tools.

- [ ] **Step 3: Update README tool table**

Add rows:

```md
| `search_ucp_catalog` | Search Ogabassey products using the UCP catalog route |
| `lookup_ucp_catalog_items` | Fetch exact product IDs through the UCP catalog lookup route |
| `create_ucp_cart` | Create a persistent UCP cart session |
| `get_ucp_cart` | Read a UCP cart session |
| `update_ucp_cart` | Replace UCP cart line items or fulfillment context |
| `convert_ucp_cart_to_checkout` | Create or reuse a checkout session from a cart |
| `cancel_ucp_cart` | Cancel an active UCP cart |
```

- [ ] **Step 4: Run MCP smoke**

Run:

```bash
curl -fsS https://mcp.ogabassey.com/health
```

Expected: HTTP 200 with `database: connected`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/mcp-server/server.ts apps/web/mcp-server/README.md
git commit -m "feat: add mcp parity for ucp cart"
```

### Task 11: Extend Health Monitoring And Dashboard Evidence

**Files:**
- Modify: `apps/web/src/lib/agentic/agent-commerce-health-monitor.ts`
- Modify: `apps/web/src/lib/agentic/agent-commerce-health-monitor.test.ts`
- Modify: `apps/web/src/app/api/cron/agentic-commerce-health/route.ts`
- Modify: `apps/web/src/app/dashboard/agentic/data.ts`
- Modify: `apps/web/src/app/dashboard/agentic/client-page.tsx`

- [ ] **Step 1: Write failing health monitor tests**

```ts
it('marks Universal Cart ready only when cart and catalog capabilities exist', async () => {
  const result = await checkAgentCommerceHealth({
    baseUrl: 'https://ogabassey.com',
    fetcher: async (url) =>
      new Response(
        JSON.stringify({
          ucp: {
            capabilities: {
              'dev.ucp.shopping.cart': [{}],
              'dev.ucp.shopping.catalog.search': [{}],
              'dev.ucp.shopping.catalog.lookup': [{}],
              'dev.ucp.shopping.checkout': [{}],
              'dev.ucp.shopping.order': [{}],
            },
          },
        })
      ),
  });

  expect(result.universal_cart.status).toBe('pass');
});
```

- [ ] **Step 2: Add readiness dimensions**

Track these checks:

```ts
const UNIVERSAL_CART_CHECKS = [
  'ucp_profile_reachable',
  'ucp_cart_capability',
  'ucp_catalog_search_capability',
  'ucp_catalog_lookup_capability',
  'ucp_checkout_capability',
  'ucp_order_capability',
  'payment_handler_configured',
  'google_pay_not_misadvertised',
  'ap2_not_misadvertised',
] as const;
```

- [ ] **Step 3: Add dashboard data**

Expose:

```ts
type UniversalCartReadiness = {
  checks: Array<{
    id: string;
    message: string;
    status: 'pass' | 'warn' | 'fail';
  }>;
  lastCheckedAt: string | null;
  status: 'pass' | 'warn' | 'fail';
};
```

- [ ] **Step 4: Add dashboard tab or section**

Add a compact "Universal Cart" section inside the existing agentic dashboard, next to trust/crawler/action health. It must show:

```txt
Universal Cart readiness
Cart: pass/fail
Catalog: pass/fail
Checkout: pass/fail
Payment: configured/not advertised
Last checked: timestamp
```

- [ ] **Step 5: Run monitoring tests**

Run:

```bash
pnpm --filter web exec vitest run \
  src/lib/agentic/agent-commerce-health-monitor.test.ts \
  src/app/api/cron/agentic-commerce-health/route.test.ts \
  src/app/dashboard/agentic/data.test.ts \
  src/app/dashboard/agentic/client-page.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/agentic/agent-commerce-health-monitor.ts \
  apps/web/src/lib/agentic/agent-commerce-health-monitor.test.ts \
  apps/web/src/app/api/cron/agentic-commerce-health/route.ts \
  apps/web/src/app/dashboard/agentic/data.ts \
  apps/web/src/app/dashboard/agentic/client-page.tsx
git commit -m "feat: monitor universal cart readiness"
```

### Task 12: Production Proof Run

**Files:**
- Create: `docs/superpowers/plans/2026-05-26-universal-cart-readiness-evidence.md`

- [ ] **Step 1: Create evidence document**

```md
# Universal Cart Readiness Evidence

Date: 2026-05-26
Storefront: https://ogabassey.com

## Public Discovery

- /.well-known/ucp:
- UCP Checker:
- agent-commerce.json:
- agent-trust.json:
- MCP health:

## Signed Flow

- Catalog search request id:
- Cart create request id:
- Cart update request id:
- Cart to checkout request id:
- Checkout complete request id:
- Paystack reference:
- Webhook reference:
- Order id:

## Result

- Paid order created:
- Order read endpoint returned:
- Dashboard Universal Cart status:
```

- [ ] **Step 2: Run public discovery commands**

Run:

```bash
curl -fsS https://ogabassey.com/.well-known/ucp | jq '.ucp.version, .ucp.capabilities'
curl -fsS https://ucpchecker.com/api/v1/status/ogabassey.com | jq .
curl -fsS https://ogabassey.com/agent-trust.json | jq '.status'
curl -fsS https://mcp.ogabassey.com/health | jq .
```

Expected:

```txt
UCP version is 2026-04-08
UCP Checker status is verified
agent-trust status is pass
MCP health is healthy
```

- [ ] **Step 3: Run signed cart-to-order smoke**

Use the same signed request helper used by the existing agentic checkout smoke. The flow must record request ids and idempotency keys for:

```txt
POST /api/agentic/catalog/search
POST /api/agentic/carts
POST /api/agentic/carts/{id}
POST /api/agentic/carts/{id}/checkout
POST /api/agentic/checkout-sessions/{id}/complete
GET  /api/agentic/orders/{id}
```

- [ ] **Step 4: Reconcile Paystack and Baci order state**

Confirm:

```txt
checkout_sessions.status = completed
checkout_sessions.payment_reference is present
orders.payment_status = paid
orders.source or metadata identifies agentic checkout
Paystack transaction reference matches checkout_sessions.payment_reference
```

- [ ] **Step 5: Run final gates**

Run:

```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
coderabbit review --prompt-only -t uncommitted
```

Expected:

```txt
Biome lint passes
TypeScript passes
Tests pass
CodeRabbit has no critical or high findings
```

- [ ] **Step 6: Commit evidence**

```bash
git add docs/superpowers/plans/2026-05-26-universal-cart-readiness-evidence.md
git commit -m "docs: capture universal cart readiness evidence"
```

## Execution Notes

- Do not use subagents for this plan; run the task slices inline and stop at each review gate.
- Do not advertise Google Pay or AP2 before the payment processor path is confirmed and tested.
- Do not edit existing Supabase migrations; use the new append-only migration.
- Do not modify `apps/web/src/proxy.ts` for this work.
- Keep Paystack bank transfer as the default live handler until Google Pay configuration exists.
- Keep all agentic mutations behind the existing bearer/HMAC/idempotency/replay controls.
- Prefer Ogabassey as the first production demo merchant, then generalize to other Baci merchants after the proof run passes.
