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
