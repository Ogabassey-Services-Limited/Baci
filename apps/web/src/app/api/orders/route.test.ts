import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateApiRequest } from '@/lib/api-auth';
import { POST } from './route';

// Hoisted mocks for fire-and-forget side effects so tests don't await emails / push.
const {
  mockNotifyNewOrder,
  mockNotifyPaymentReceived,
  mockSendEmail,
  mockAfter,
} = vi.hoisted(() => ({
  mockNotifyNewOrder: vi.fn(() =>
    Promise.resolve({ sent: 1, failed: 0, errors: [] })
  ),
  mockNotifyPaymentReceived: vi.fn(() =>
    Promise.resolve({ sent: 1, failed: 0, errors: [] })
  ),
  mockSendEmail: vi.fn(() => Promise.resolve({ success: true })),
  mockAfter: vi.fn((cb: () => unknown) => cb()),
}));

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://mock.supabase.co',
  getSupabaseAnonKey: () => 'mock-key',
  getSupabaseServiceRoleKey: () => 'mock-service-key',
  getRootDomain: () => 'localhost:3000',
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
  hasPermission: vi.fn(() => true),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn() }),
}));

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, after: mockAfter };
});

vi.mock('@/lib/email-templates', () => ({
  generateOrderConfirmationEmail: vi.fn(() => '<html />'),
  generateOrderConfirmationText: vi.fn(() => 'text'),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyNewOrder: mockNotifyNewOrder,
  notifyPaymentReceived: mockNotifyPaymentReceived,
}));

vi.mock('@/lib/zeptomail', () => ({ sendEmail: mockSendEmail }));

vi.mock('@/lib/geo-privacy', () => ({
  detectPrivacyRegion: vi.fn().mockResolvedValue({
    country: 'NG',
    region: 'Lagos',
    shouldApplyLDU: false,
  }),
}));

vi.mock('@/lib/shipping/providers/gigl', () => ({
  createGiglShipment: vi.fn(),
  giglProvider: { getLocations: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';
const CUSTOMER_ID = '11111111-2222-3333-4444-555555555555';

interface RpcOverrides {
  // Per-RPC return values. Default values mirror a minimal happy path.
  create_storefront_order?: { data: unknown; error: unknown };
  redeem_wallet_for_order?: { data: unknown; error: unknown };
  finalize_wallet_order_payment?: { data: unknown; error: unknown };
}

function buildMockSupabase(overrides: RpcOverrides = {}) {
  const sharedChainable: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    // B3.5 round 7: helper's `merchants.select(...).eq(...).maybeSingle()`
    // call. Default returns the existing merchant fixture; the
    // helper reads `vat_registration_status` which is absent →
    // helper treats merchant as non-registered → returns 0. Existing
    // assertions in this file see no behavior change.
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: MERCHANT_ID,
        business_name: 'Test Merchant',
        country: 'NG',
        slug: 'test-merchant',
        support_email: 'support@example.com',
        email_sender_name: 'Test Store',
        email: 'merchant@example.com',
      },
      error: null,
    }),
    single: vi.fn().mockResolvedValue({
      data: {
        id: MERCHANT_ID,
        business_name: 'Test Merchant',
        country: 'NG',
        slug: 'test-merchant',
        support_email: 'support@example.com',
        email_sender_name: 'Test Store',
        email: 'merchant@example.com',
      },
      error: null,
    }),
    // B3.5 round 7: helper's
    // `products.select(...).eq('merchant_id', ...).in('id', ...).returns()`
    // chain. Default returns [] so helper iterates no items and
    // returns 0.
    in: vi.fn().mockReturnThis(),
    returns: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnThis(),
    // biome-ignore lint/suspicious/noThenProperty: thenable mock
    then: (resolve: any) => Promise.resolve().then(resolve),
  };

  const defaultRpcOutcomes: Record<string, { data: unknown; error: unknown }> =
    {
      create_storefront_order: {
        data: [
          {
            id: 'order-id',
            order_number: 'ORD-123',
            total: 1000,
            subtotal: 1000,
            shipping_fee: 0,
            customer_id: CUSTOMER_ID,
          },
        ],
        error: null,
      },
      redeem_wallet_for_order: { data: null, error: null },
      finalize_wallet_order_payment: { data: null, error: null },
      // B3.5 round 7 (CodeRabbit High): the helper's variant lookup
      // now routes through this SECURITY DEFINER RPC.
      get_order_variant_overrides: { data: [], error: null },
    };

  return {
    auth: { getUser: vi.fn() },
    from: vi.fn(() => sharedChainable),
    rpc: vi.fn((name: string) => {
      const outcome = overrides[name as keyof RpcOverrides] ??
        defaultRpcOutcomes[name] ?? { data: null, error: null };
      return Promise.resolve(outcome);
    }),
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// B3.5 round 7: the route now passes its own scoped supabase
// client into the tax helper (CodeRabbit High — no service-role
// in the Next.js layer). The helper's variant lookup routes
// through `get_order_variant_overrides` (SECURITY DEFINER RPC),
// which is mocked in `buildMockSupabase`'s `defaultRpcOutcomes`.

const baseOrderPayload = {
  merchant_id: MERCHANT_ID,
  customer_email: 'customer@example.com',
  customer_name: 'Test Customer',
  customer_phone: '08012345678',
  items: [{ product_id: 'p-1', quantity: 1, price: 1000, name: 'Widget' }],
  subtotal: 1000,
  shipping_fee: 0,
  discount_amount: 0,
  tax_amount: 0,
  payment_method: 'paystack',
  payment_status: 'unpaid',
  shipping_status: 'pending',
  shipping_address: {
    address: '123 Test St',
    city: 'Lagos',
    state: 'Lagos',
  },
};

async function readJson(response: Response) {
  return JSON.parse(await response.text());
}

describe('POST /api/orders — wallet response shape', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation(
      () => buildMockSupabase() as unknown as never
    );
  });

  it('returns wallet=null and full amountDueToGateway when wallet is not used', async () => {
    // Pin: orders that do not opt into wallet have no wallet block in the
    // response and the gateway is asked for the full order total.
    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify(baseOrderPayload),
    });

    const response = await POST(request);
    const body = await readJson(response);

    expect(response.status).toBe(201);
    expect(body.wallet).toBeNull();
    expect(body.amountDueToGateway).toBe(1000);
    expect(body.order).toEqual(
      expect.objectContaining({
        id: 'order-id',
        order_number: 'ORD-123',
      })
    );
  });

  it('partial wallet redemption surfaces wallet { amountUsed, newBalance, transactionId } and residual amountDueToGateway', async () => {
    // Pin the partial-coverage response shape that the mobile checkout's
    // success screen consumes (wallet.amountUsed + amountDueToGateway).
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation(
      () =>
        buildMockSupabase({
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
        }) as unknown as never
    );

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrderPayload,
        use_wallet_credit: true,
        wallet_amount: 300,
      }),
    });

    const response = await POST(request);
    const body = await readJson(response);

    expect(response.status).toBe(201);
    expect(body.wallet).toEqual({
      amountUsed: 300,
      newBalance: 200,
      transactionId: '99999999-aaaa-bbbb-cccc-dddddddddddd',
    });
    expect(body.amountDueToGateway).toBe(700);
  });

  it('full-coverage wallet redemption returns amountDueToGateway=0 and finalizes payment', async () => {
    // Pin the full-coverage path that the mobile client uses to skip the
    // gateway initialize step entirely. Order is marked paid via
    // finalize_wallet_order_payment.
    const finalizeSpy = vi.fn(() =>
      Promise.resolve({ data: null, error: null })
    );
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation((() => {
      const sb = buildMockSupabase({
        redeem_wallet_for_order: {
          data: [
            {
              success: true,
              redeemed_amount: 1000,
              new_balance: 0,
              transaction_id: '88888888-aaaa-bbbb-cccc-eeeeeeeeeeee',
            },
          ],
          error: null,
        },
      });
      // Wrap rpc so we can spy on finalize_wallet_order_payment specifically.
      const originalRpc = sb.rpc;
      sb.rpc = vi.fn((name: string) => {
        if (name === 'finalize_wallet_order_payment') {
          return finalizeSpy();
        }
        return originalRpc(name);
      });
      return sb;
    }) as unknown as never);

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrderPayload,
        use_wallet_credit: true,
        wallet_amount: 1000,
      }),
    });

    const response = await POST(request);
    const body = await readJson(response);

    expect(response.status).toBe(201);
    expect(body.wallet).toEqual({
      amountUsed: 1000,
      newBalance: 0,
      transactionId: '88888888-aaaa-bbbb-cccc-eeeeeeeeeeee',
    });
    expect(body.amountDueToGateway).toBe(0);
    expect(body.order.payment_status).toBe('paid');
    expect(body.order.payment_method).toBe('wallet');
    expect(finalizeSpy).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/orders — discount guard', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation(
      () => buildMockSupabase() as unknown as never
    );
  });

  it('rejects any non-zero client discount amount', async () => {
    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrderPayload,
        discount_amount: 50,
      }),
    });

    const response = await POST(request);
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: 'discount_amount_not_supported',
      error: 'Failed to create order',
    });
  });
});

describe('POST /api/orders — B3.5 client/server total parity', () => {
  // Codex P1 (PR #1622): the parity check moved INTO the RPC so a
  // mismatch rolls back the transaction atomically BEFORE the order
  // is inserted or stock is decremented. The route's job is just to
  // forward `p_expected_total` and map the RAISE to a 400.
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation(
      () => buildMockSupabase() as unknown as never
    );
  });

  it('forwards expected_total as p_expected_total to the RPC', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'order-id',
          order_number: 'ORD-123',
          total: 1000,
          subtotal: 1000,
          shipping_fee: 0,
          customer_id: CUSTOMER_ID,
        },
      ],
      error: null,
    });
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation((() => {
      const sb = buildMockSupabase();
      sb.rpc = ((name: string, args: Record<string, unknown>) => {
        if (name === 'create_storefront_order') {
          return rpcSpy(args);
        }
        return Promise.resolve({ data: null, error: null });
      }) as typeof sb.rpc;
      return sb;
    }) as unknown as never);

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrderPayload,
        expected_total: 1000,
        client_total: 1000,
      }),
    });
    await POST(request);

    expect(rpcSpy).toHaveBeenCalledWith(
      expect.objectContaining({ p_expected_total: 1000 })
    );
  });

  it('passes null p_expected_total when the client omits it (legacy callers)', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'order-id',
          order_number: 'ORD-123',
          total: 1000,
          subtotal: 1000,
          shipping_fee: 0,
          customer_id: CUSTOMER_ID,
        },
      ],
      error: null,
    });
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation((() => {
      const sb = buildMockSupabase();
      sb.rpc = ((name: string, args: Record<string, unknown>) => {
        if (name === 'create_storefront_order') {
          return rpcSpy(args);
        }
        return Promise.resolve({ data: null, error: null });
      }) as typeof sb.rpc;
      return sb;
    }) as unknown as never);

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify(baseOrderPayload),
    });
    await POST(request);

    expect(rpcSpy).toHaveBeenCalledWith(
      expect.objectContaining({ p_expected_total: null })
    );
  });

  it('maps RPC order_total_mismatch to 400 (no orphan order, no stock leak)', async () => {
    // When the RPC RAISES `order_total_mismatch` it does so BEFORE
    // the orders INSERT and stock UPDATEs, so the whole transaction
    // rolls back. Mapping to 400 (instead of the pre-Codex 409
    // returned post-side-effect) lets the storefront treat this as
    // a clean validation failure: re-render the order summary,
    // re-submit. No risk of duplicate orders.
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation(
      () =>
        buildMockSupabase({
          create_storefront_order: {
            data: null,
            error: { code: 'P0001', message: 'order_total_mismatch' },
          },
        }) as unknown as never
    );

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrderPayload,
        expected_total: 1500,
      }),
    });
    const response = await POST(request);
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.details).toContain('order_total_mismatch');
  });
});

describe('POST /api/orders — B3.5 VAT RPC error mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });
  });

  it('maps tax_amount_mismatch to 400 with structured details', async () => {
    // Surface the RPC's RAISE EXCEPTION 'tax_amount_mismatch' to a
    // 4xx so the storefront can re-render the order summary rather
    // than treating it as a server fault.
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation(
      () =>
        buildMockSupabase({
          create_storefront_order: {
            data: null,
            error: { code: 'P0001', message: 'tax_amount_mismatch' },
          },
        }) as unknown as never
    );

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrderPayload,
        tax_amount: 0,
      }),
    });
    const response = await POST(request);
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe('Failed to create order');
    expect(body.details).toContain('tax_amount_mismatch');
  });

  it('maps tax_amount_must_be_zero_for_non_vat_merchant to 400', async () => {
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation(
      () =>
        buildMockSupabase({
          create_storefront_order: {
            data: null,
            error: {
              code: 'P0001',
              message: 'tax_amount_must_be_zero_for_non_vat_merchant',
            },
          },
        }) as unknown as never
    );

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrderPayload,
        tax_amount: 75,
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('forwards p_gift_wrapping_fee to the RPC', async () => {
    // Defense-in-depth contract test: the body's gift_wrapping_fee
    // must reach the SECURITY DEFINER RPC unchanged so the VAT
    // enforcement boundary (Δ-42) sees what the client actually
    // asked for. (Note: `tax_basis` is NOT in scope for forwarding
    // — Codex P1 round 6 made it server-controlled; see the
    // dedicated `forces p_tax_basis to "exclusive"` test below.)
    const rpcSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'order-id',
          order_number: 'ORD-123',
          total: 1500,
          subtotal: 1000,
          shipping_fee: 0,
          customer_id: CUSTOMER_ID,
        },
      ],
      error: null,
    });
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation((() => {
      const sb = buildMockSupabase();
      sb.rpc = ((name: string, args: Record<string, unknown>) => {
        if (name === 'create_storefront_order') {
          return rpcSpy(args);
        }
        return Promise.resolve({ data: null, error: null });
      }) as typeof sb.rpc;
      return sb;
    }) as unknown as never);

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrderPayload,
        gift_wrapping_fee: 500,
      }),
    });
    await POST(request);

    expect(rpcSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        p_gift_wrapping_fee: 500,
      })
    );
  });

  it('server-computes tax_amount and overrides the client value (Codex P1 round 6)', async () => {
    // Legacy `app/checkout/page.tsx` sends no tax_amount → Zod
    // default 0 → pre-fix the RPC's parity guard would RAISE
    // `tax_amount_mismatch` for VAT-registered merchants and break
    // checkout in production. The route recomputes tax server-side
    // via `computeAgenticOrderTax` (round 7: using the standard
    // scoped client + the `get_order_variant_overrides` SDF for
    // RLS bypass — no admin client in the Next.js layer).
    const rpcSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'order-id',
          order_number: 'ORD-123',
          total: 1075,
          subtotal: 1000,
          shipping_fee: 0,
          customer_id: CUSTOMER_ID,
        },
      ],
      error: null,
    });
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation((() => {
      const sb = buildMockSupabase();
      // Per-table override for this test: the helper needs to see
      // a VAT-registered merchant + one taxable product. The route
      // also reads `merchants` separately for the order-create
      // merchant-existence check (uses `.single()`), which we keep
      // returning the default merchant fixture.
      sb.from = ((table: string) => {
        if (table === 'merchants') {
          return {
            select: () => ({
              eq: () => ({
                // Helper's read.
                maybeSingle: () =>
                  Promise.resolve({
                    data: { vat_registration_status: 'registered' },
                    error: null,
                  }),
                // Route's existence check.
                single: () =>
                  Promise.resolve({
                    data: { id: MERCHANT_ID, business_name: 'Test' },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === 'products') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  returns: () =>
                    Promise.resolve({
                      data: [
                        {
                          id: 'p-1',
                          price: 1000,
                          vat_category_code: 'S',
                          vat_rate: 7.5,
                        },
                      ],
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        // Fall through for any other tables the route may touch.
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
        };
      }) as typeof sb.from;
      sb.rpc = ((name: string, args: Record<string, unknown>) => {
        if (name === 'create_storefront_order') {
          return rpcSpy(args);
        }
        if (name === 'get_order_variant_overrides') {
          return Promise.resolve({ data: [], error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }) as typeof sb.rpc;
      return sb;
    }) as unknown as never);

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      // Mimic legacy checkout: no tax_amount in body.
      body: JSON.stringify({
        ...baseOrderPayload,
        tax_amount: undefined,
      }),
    });
    await POST(request);

    // ROUND(ROUND(1 * 1000, 2) * 7.5 / 100, 2) = 75
    expect(rpcSpy).toHaveBeenCalledWith(
      expect.objectContaining({ p_tax_amount: 75 })
    );
  });

  it('turns an entitled bounded negotiated expected_total drift into a server-derived discount', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'order-id',
          order_number: 'ORD-123',
          total: 1042.75,
          subtotal: 1000,
          shipping_fee: 0,
          customer_id: CUSTOMER_ID,
        },
      ],
      error: null,
    });
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation((() => {
      const sb = buildMockSupabase();
      sb.from = ((table: string) => {
        if (table === 'merchants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { vat_registration_status: 'registered' },
                    error: null,
                  }),
                single: () =>
                  Promise.resolve({
                    data: {
                      id: MERCHANT_ID,
                      business_name: 'Test',
                      plan_tier: 'pro',
                    },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === 'products') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  returns: () =>
                    Promise.resolve({
                      data: [
                        {
                          id: 'p-1',
                          price: 1000,
                          vat_category_code: 'S',
                          vat_rate: 7.5,
                        },
                      ],
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
        };
      }) as typeof sb.from;
      sb.rpc = ((name: string, args: Record<string, unknown>) => {
        if (name === 'create_storefront_order') {
          return rpcSpy(args);
        }
        if (name === 'get_order_variant_overrides') {
          return Promise.resolve({ data: [], error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }) as typeof sb.rpc;
      return sb;
    }) as unknown as never);

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrderPayload,
        items: [
          {
            product_id: 'p-1',
            quantity: 1,
            price: 970,
            name: 'Widget',
          },
        ],
        subtotal: 970,
        tax_amount: 72.75,
        expected_total: 1045,
        client_total: 1045,
      }),
    });
    await POST(request);

    expect(rpcSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        p_discount_amount: 30,
        p_expected_total: 1045,
        p_tax_amount: 75,
      })
    );
  });

  it('preserves legacy negotiation entitlement fallback when plan_tier is missing', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'order-id',
          order_number: 'ORD-123',
          total: 1045,
          subtotal: 1000,
          shipping_fee: 0,
          customer_id: CUSTOMER_ID,
        },
      ],
      error: null,
    });
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation((() => {
      const sb = buildMockSupabase();
      sb.from = ((table: string) => {
        if (table === 'merchants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { vat_registration_status: 'registered' },
                    error: null,
                  }),
                single: () =>
                  Promise.resolve({
                    data: {
                      id: MERCHANT_ID,
                      business_name: 'Test',
                      plan_tier: null,
                      slug: 'ogabassey',
                    },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === 'products') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  returns: () =>
                    Promise.resolve({
                      data: [
                        {
                          id: 'p-1',
                          price: 1000,
                          vat_category_code: 'S',
                          vat_rate: 7.5,
                        },
                      ],
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
        };
      }) as typeof sb.from;
      sb.rpc = ((name: string, args: Record<string, unknown>) => {
        if (name === 'create_storefront_order') {
          return rpcSpy(args);
        }
        if (name === 'get_order_variant_overrides') {
          return Promise.resolve({ data: [], error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }) as typeof sb.rpc;
      return sb;
    }) as unknown as never);

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrderPayload,
        items: [
          {
            product_id: 'p-1',
            quantity: 1,
            price: 970,
            name: 'Widget',
          },
        ],
        subtotal: 970,
        tax_amount: 72.75,
        expected_total: 1045,
        client_total: 1045,
      }),
    });
    await POST(request);

    expect(rpcSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        p_discount_amount: 30,
        p_expected_total: 1045,
        p_tax_amount: 75,
      })
    );
  });

  it('does not derive a discount for merchants without price negotiation entitlement', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'order_total_mismatch',
      },
    });
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation((() => {
      const sb = buildMockSupabase();
      sb.from = ((table: string) => {
        if (table === 'merchants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { vat_registration_status: 'registered' },
                    error: null,
                  }),
                single: () =>
                  Promise.resolve({
                    data: {
                      id: MERCHANT_ID,
                      business_name: 'Test',
                      plan_tier: 'starter',
                    },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === 'products') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  returns: () =>
                    Promise.resolve({
                      data: [
                        {
                          id: 'p-1',
                          price: 1000,
                          vat_category_code: 'S',
                          vat_rate: 7.5,
                        },
                      ],
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
        };
      }) as typeof sb.from;
      sb.rpc = ((name: string, args: Record<string, unknown>) => {
        if (name === 'create_storefront_order') {
          return rpcSpy(args);
        }
        if (name === 'get_order_variant_overrides') {
          return Promise.resolve({ data: [], error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }) as typeof sb.rpc;
      return sb;
    }) as unknown as never);

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrderPayload,
        items: [
          {
            product_id: 'p-1',
            quantity: 1,
            price: 970,
            name: 'Widget',
          },
        ],
        subtotal: 970,
        tax_amount: 72.75,
        expected_total: 1042.75,
        client_total: 1042.75,
      }),
    });

    const response = await POST(request);
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.details).toBe('order_total_mismatch');
    expect(rpcSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        p_discount_amount: 0,
        p_expected_total: 1042.75,
      })
    );
  });

  it('returns 500 when canonical subtotal preload fails during negotiated checkout', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({
      data: null,
      error: {
        message: 'order_total_mismatch',
      },
    });
    let productLoadCount = 0;

    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation((() => {
      const sb = buildMockSupabase();
      sb.from = ((table: string) => {
        if (table === 'merchants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { vat_registration_status: 'registered' },
                    error: null,
                  }),
                single: () =>
                  Promise.resolve({
                    data: {
                      id: MERCHANT_ID,
                      business_name: 'Test',
                      plan_tier: 'pro',
                    },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === 'products') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  returns: () => {
                    productLoadCount += 1;
                    if (productLoadCount === 1) {
                      return Promise.resolve({
                        data: [
                          {
                            id: 'p-1',
                            price: 1000,
                            vat_category_code: 'S',
                            vat_rate: 7.5,
                          },
                        ],
                        error: null,
                      });
                    }

                    return Promise.resolve({
                      data: null,
                      error: { message: 'db unavailable' },
                    });
                  },
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
        };
      }) as typeof sb.from;
      sb.rpc = ((name: string, args: Record<string, unknown>) => {
        if (name === 'create_storefront_order') {
          return rpcSpy(args);
        }
        if (name === 'get_order_variant_overrides') {
          return Promise.resolve({ data: [], error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }) as typeof sb.rpc;
      return sb;
    }) as unknown as never);

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrderPayload,
        items: [
          {
            product_id: 'p-1',
            quantity: 1,
            price: 970,
            name: 'Widget',
          },
        ],
        subtotal: 970,
        tax_amount: 72.75,
        expected_total: 1042.75,
        client_total: 1042.75,
      }),
    });

    const response = await POST(request);
    const body = await readJson(response);

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal server error');
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('maps a 22P02 UUID parse error from the tax helper to 400 INVALID_ITEM_ID (Codex P2 round 7)', async () => {
    // Item ids are only `z.string()` at the schema layer, so a
    // malformed product_id (e.g. a slug) reaches the helper and
    // surfaces as a Postgres 22P02 from `.in('id', productIds)`.
    // The previous RPC path mapped 22P02 as a client error via
    // `clientErrorCodes`; the new server-side tax recompute must
    // preserve that 4xx semantic instead of returning 500.
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation((() => {
      const sb = buildMockSupabase();
      sb.from = ((table: string) => {
        if (table === 'merchants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { vat_registration_status: 'registered' },
                    error: null,
                  }),
                single: () =>
                  Promise.resolve({
                    data: { id: MERCHANT_ID, business_name: 'Test' },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === 'products') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  returns: () =>
                    Promise.resolve({
                      data: null,
                      error: {
                        code: '22P02',
                        message:
                          'invalid input syntax for type uuid: "not-a-uuid"',
                      },
                    }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
        };
      }) as typeof sb.from;
      return sb;
    }) as unknown as never);

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrderPayload,
        items: [
          {
            product_id: 'not-a-uuid',
            name: 'Widget',
            quantity: 1,
            price: 1000,
          },
        ],
      }),
    });
    const response = await POST(request);
    const body = await readJson(response);

    expect(response.status).toBe(400);
    // Round-7 follow-up: error shape unified with the RPC mapping
    // (`{ error: 'Failed to create order', details: 'invalid_items' }`).
    expect(body).toMatchObject({
      error: 'Failed to create order',
      details: 'invalid_items',
    });
  });

  it('maps a 22P02 UUID parse error from canonical subtotal lookup to 400 INVALID_ITEM_ID', async () => {
    const rpcSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'order-id',
          order_number: 'ORD-123',
          total: 1000,
          subtotal: 1000,
          shipping_fee: 0,
          customer_id: CUSTOMER_ID,
        },
      ],
      error: null,
    });
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation((() => {
      const sb = buildMockSupabase();
      sb.from = ((table: string) => {
        if (table === 'merchants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { vat_registration_status: 'not_registered' },
                    error: null,
                  }),
                single: () =>
                  Promise.resolve({
                    data: {
                      id: MERCHANT_ID,
                      business_name: 'Test',
                      plan_tier: 'pro',
                    },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === 'products') {
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  returns: () =>
                    Promise.resolve({
                      data: null,
                      error: {
                        code: '22P02',
                        message:
                          'invalid input syntax for type uuid: "not-a-uuid"',
                      },
                    }),
                }),
              }),
            }),
          };
        }

        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          insert: () => Promise.resolve({ error: null }),
        };
      }) as typeof sb.from;
      sb.rpc = ((name: string, args: Record<string, unknown>) => {
        if (name === 'create_storefront_order') {
          return rpcSpy(args);
        }
        if (name === 'get_order_variant_overrides') {
          return Promise.resolve({ data: [], error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }) as typeof sb.rpc;
      return sb;
    }) as unknown as never);

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrderPayload,
        items: [
          {
            product_id: 'not-a-uuid',
            quantity: 1,
            price: 970,
            name: 'Widget',
          },
        ],
        subtotal: 970,
        tax_amount: 0,
        expected_total: 970,
        client_total: 970,
      }),
    });

    const response = await POST(request);
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: 'Failed to create order',
      details: 'invalid_items',
    });
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('forces p_tax_basis to "exclusive" regardless of client input (Codex P1 round 6)', async () => {
    // tax_basis is SERVER policy, not caller input. A buyer who
    // submits `tax_basis: 'inclusive'` on a VAT-registered merchant
    // would otherwise route through the RPC's inclusive branch,
    // which computes total = subtotal + shipping + gift - discount
    // (no VAT), undercharging by the VAT amount while the merchant
    // is still on the hook for FIRS. The API hardcodes 'exclusive'
    // until per-merchant pricing config exists.
    const rpcSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'order-id',
          order_number: 'ORD-123',
          total: 1000,
          subtotal: 1000,
          shipping_fee: 0,
          customer_id: CUSTOMER_ID,
        },
      ],
      error: null,
    });
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation((() => {
      const sb = buildMockSupabase();
      sb.rpc = ((name: string, args: Record<string, unknown>) => {
        if (name === 'create_storefront_order') {
          return rpcSpy(args);
        }
        return Promise.resolve({ data: null, error: null });
      }) as typeof sb.rpc;
      return sb;
    }) as unknown as never);

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrderPayload,
        tax_basis: 'inclusive',
      }),
    });
    await POST(request);

    expect(rpcSpy).toHaveBeenCalledWith(
      expect.objectContaining({ p_tax_basis: 'exclusive' })
    );
  });

  it('maps gift_wrapping_fee_negative to 400', async () => {
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation(
      () =>
        buildMockSupabase({
          create_storefront_order: {
            data: null,
            error: {
              code: 'P0001',
              message: 'gift_wrapping_fee_negative',
            },
          },
        }) as unknown as never
    );

    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...baseOrderPayload,
        gift_wrapping_fee: 0,
      }),
    });
    const response = await POST(request);
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.details).toContain('gift_wrapping_fee_negative');
  });

  it('maps invalid_tax_basis to 400', async () => {
    const supabaseMod = await import('@/lib/supabase/server');
    vi.mocked(supabaseMod.createClient).mockImplementation(
      () =>
        buildMockSupabase({
          create_storefront_order: {
            data: null,
            error: { code: 'P0001', message: 'invalid_tax_basis' },
          },
        }) as unknown as never
    );

    // Zod would normally catch this before the RPC call — this test
    // pins the route-level mapping in case a future schema change
    // widens the enum and the RPC becomes the only line of defense.
    const request = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify(baseOrderPayload),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
