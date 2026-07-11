import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFreshNgnPerUsdt } from '@/lib/juicyway/rates';
import {
  getDecryptedMerchantCredential,
  markMerchantCredentialInvalid,
} from '@/lib/payments/merchant-credentials';
import { createOrder } from '@/lib/paypal';
import { createAdminClient } from '@/lib/supabase/admin';
import { POST } from './route';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/paypal', () => ({
  createOrder: vi.fn(),
}));

vi.mock('@/lib/payments/merchant-credentials', () => ({
  getDecryptedMerchantCredential: vi.fn(),
  markMerchantCredentialInvalid: vi.fn(),
}));

vi.mock('@/lib/juicyway/rates', () => ({
  getFreshNgnPerUsdt: vi.fn(),
  RATE_CACHE_TTL_MS: 5 * 60 * 1000,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';
const ORDER_ID = '123e4567-e89b-12d3-a456-426614174111';

function createRequest(bodyOverrides: Record<string, unknown> = {}) {
  return new NextRequest(
    'https://example.com/api/payments/paypal/create-order',
    {
      method: 'POST',
      body: JSON.stringify({
        order_id: ORDER_ID,
        customer_email: 'customer@example.com',
        merchant_id: MERCHANT_ID,
        ...bodyOverrides,
      }),
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

function buildSupabaseMock({
  snapshot = {
    merchant_id: MERCHANT_ID,
    total: 130000,
    currency: 'NGN',
    tracking_token: 'track-123',
  } as Record<string, unknown>,
  custom = { paypal_enabled: true, paypal_mode: 'sandbox' } as Record<
    string,
    unknown
  >,
  existingTxn = null as Record<string, unknown> | null,
  createTxnResult = { data: 'txn-uuid', error: null } as {
    data: unknown;
    error: unknown;
  },
} = {}) {
  const mock = {
    rpc: vi.fn((name: string) => {
      if (name === 'get_order_payment_snapshot') {
        return Promise.resolve({ data: [snapshot], error: null });
      }
      if (name === 'create_payment_transaction') {
        return Promise.resolve(createTxnResult);
      }
      return Promise.resolve({ data: null, error: null });
    }),
    from: vi.fn(() => mock),
    select: vi.fn(() => mock),
    eq: vi.fn(() => mock),
    maybeSingle: vi.fn(() =>
      Promise.resolve({ data: existingTxn, error: null })
    ),
    single: vi.fn(() =>
      Promise.resolve({ data: { custom_settings: custom }, error: null })
    ),
    insert: vi.fn(() => Promise.resolve({ error: null })),
  };
  return mock;
}

function mockVaultOk() {
  vi.mocked(getDecryptedMerchantCredential).mockImplementation(
    async (_merchant, _provider, role) =>
      role === 'client_id' ? 'mock-client-id' : 'mock-secret-key'
  );
}

describe('POST /api/payments/paypal/create-order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFreshNgnPerUsdt).mockResolvedValue(1300);
    vi.mocked(createOrder).mockResolvedValue({
      success: true,
      data: { id: 'PP-ORD-123', approveUrl: 'https://paypal.com/approve' },
    });
  });

  it('returns 400 for an invalid payload', async () => {
    const response = await POST(
      new NextRequest('https://example.com', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid input parameters');
  });

  it('returns 403 when the order snapshot merchant does not match', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      buildSupabaseMock({
        snapshot: {
          merchant_id: 'other',
          total: 130000,
          currency: 'NGN',
          tracking_token: 't',
        },
      }) as never
    );
    mockVaultOk();

    const response = await POST(createRequest());
    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe(
      'Merchant mismatch for this order'
    );
  });

  it('reuses an existing pending PayPal order when the presentment matches', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      buildSupabaseMock({
        existingTxn: {
          gateway_reference: 'PP-EXISTING',
          metadata: {
            paypal_presentment_amount: 100,
            paypal_presentment_currency: 'USD',
          },
        },
      }) as never
    );
    mockVaultOk();

    const response = await POST(createRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'PP-EXISTING', reused: true });
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('converts NGN to USD, records a fee-waived transaction, and files a zero-fee accrual', async () => {
    const supabase = buildSupabaseMock();
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    mockVaultOk();

    const response = await POST(createRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 'PP-ORD-123',
      approveUrl: 'https://paypal.com/approve',
    });

    expect(createOrder).toHaveBeenCalledWith(
      'mock-client-id',
      'mock-secret-key',
      100,
      'USD',
      'track-123',
      'sandbox',
      { returnUrl: undefined, cancelUrl: undefined }
    );

    expect(supabase.rpc).toHaveBeenCalledWith(
      'create_payment_transaction',
      expect.objectContaining({
        p_gateway: 'paypal',
        p_reference: 'PP-ORD-123',
        p_platform_fee: 0,
        p_merchant_amount: 130000,
        p_amount: 130000,
        p_metadata: expect.objectContaining({
          paypal_presentment_amount: 100,
          paypal_presentment_currency: 'USD',
          paypal_fx_rate: 1300,
        }),
      })
    );

    expect(supabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'paypal',
        currency: 'NGN',
        order_amount: 130000,
        fee_amount: 0,
        waived: true,
      })
    );
  });

  it('passes same-origin return and cancel URLs through to PayPal', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildSupabaseMock() as never);
    mockVaultOk();

    await POST(
      createRequest({
        return_url: 'https://example.com/store/checkout?paypal_return=1',
        cancel_url: 'https://example.com/store/checkout?paypal_cancel=1',
      })
    );

    expect(createOrder).toHaveBeenCalledWith(
      'mock-client-id',
      'mock-secret-key',
      100,
      'USD',
      'track-123',
      'sandbox',
      {
        returnUrl: 'https://example.com/store/checkout?paypal_return=1',
        cancelUrl: 'https://example.com/store/checkout?paypal_cancel=1',
      }
    );
  });

  it('rejects a cross-origin return URL', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildSupabaseMock() as never);
    mockVaultOk();

    const response = await POST(
      createRequest({ return_url: 'https://evil.example/steal' })
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVALID_RETURN_URL');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('returns 400 paypal_not_configured when the vault has no credentials', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildSupabaseMock() as never);
    vi.mocked(getDecryptedMerchantCredential).mockRejectedValue(
      new Error('no active client_id credential')
    );

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('PAYPAL_NOT_CONFIGURED');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('marks credentials invalid and returns 400 on a PayPal 401', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildSupabaseMock() as never);
    mockVaultOk();
    vi.mocked(createOrder).mockResolvedValue({
      success: false,
      error: 'invalid_client',
      code: 'HTTP_401',
    });

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVALID_PROVIDER_CREDENTIALS');
    expect(markMerchantCredentialInvalid).toHaveBeenCalledWith(
      MERCHANT_ID,
      'paypal',
      'secret_key',
      'test',
      'invalid_client'
    );
  });

  it('returns 400 paypal_unsupported_currency for a currency PayPal cannot present', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      buildSupabaseMock({
        snapshot: {
          merchant_id: MERCHANT_ID,
          total: 4200,
          currency: 'KES',
          tracking_token: 'track-123',
        },
      }) as never
    );
    mockVaultOk();

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('PAYPAL_UNSUPPORTED_CURRENCY');
    expect(getFreshNgnPerUsdt).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('returns 503 fx_rate_unavailable when a fresh live rate cannot be fetched', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildSupabaseMock() as never);
    mockVaultOk();
    // getFreshNgnPerUsdt throws when it cannot obtain a rate within the
    // freshness window (stale cache is NOT served on the PayPal lane).
    vi.mocked(getFreshNgnPerUsdt).mockRejectedValue(
      new Error('coingecko down')
    );

    const response = await POST(createRequest());
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('FX_RATE_UNAVAILABLE');
    expect(createOrder).not.toHaveBeenCalled();
  });
});
