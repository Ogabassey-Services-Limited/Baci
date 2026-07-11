import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFreshNgnPerUsdt } from '@/lib/juicyway/rates';
import { finalizePaypalCaptureOrder } from '@/lib/payments/finalize-paypal-capture-order';
import {
  getDecryptedMerchantCredential,
  markMerchantCredentialInvalid,
} from '@/lib/payments/merchant-credentials';
import { computeOrderResidualAmount } from '@/lib/payments/order-residual-amount';
import { createOrder, getOrder } from '@/lib/paypal';
import { createAdminClient } from '@/lib/supabase/admin';
import { POST } from './route';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/payments/finalize-paypal-capture-order', () => ({
  finalizePaypalCaptureOrder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/paypal', () => ({
  createOrder: vi.fn(),
  getOrder: vi.fn(),
}));

vi.mock('@/lib/payments/merchant-credentials', () => ({
  getDecryptedMerchantCredential: vi.fn(),
  markMerchantCredentialInvalid: vi.fn(),
}));

vi.mock('@/lib/payments/order-residual-amount', () => ({
  computeOrderResidualAmount: vi.fn(),
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
    shipping_status: 'pending',
  } as Record<string, unknown>,
  custom = { paypal_enabled: true, paypal_mode: 'live' } as Record<
    string,
    unknown
  >,
  existingTxn = null as Record<string, unknown> | null,
  // A `completed` PayPal transaction (F-263). Returned only for the
  // status='completed' transactions query; the pending reuse query still gets
  // `existingTxn`.
  completedTxn = null as Record<string, unknown> | null,
  // The `orders.amount_paid` read the F-263 reconcile makes before finalizing.
  orderRow = null as Record<string, unknown> | null,
  createTxnResult = { data: 'txn-uuid', error: null } as {
    data: unknown;
    error: unknown;
  },
} = {}) {
  let lastTable = '';
  let lastStatus = '';
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
    from: vi.fn((table: string) => {
      lastTable = table;
      lastStatus = '';
      return mock;
    }),
    select: vi.fn(() => mock),
    eq: vi.fn((column: string, value: unknown) => {
      if (column === 'status') {
        lastStatus = String(value);
      }
      return mock;
    }),
    update: vi.fn(() => mock),
    maybeSingle: vi.fn(() => {
      if (lastTable === 'transactions') {
        return Promise.resolve({
          data: lastStatus === 'completed' ? completedTxn : existingTxn,
          error: null,
        });
      }
      if (lastTable === 'orders') {
        return Promise.resolve({ data: orderRow, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
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
    vi.mocked(getOrder).mockResolvedValue({
      success: true,
      data: {
        id: 'PP-EXISTING',
        status: 'CREATED',
        links: [
          {
            rel: 'approve',
            href: 'https://paypal.com/approve-existing',
            method: 'GET',
          },
        ],
      },
    });
    // Default: no wallet/savings applied — the residual is the full total.
    vi.mocked(computeOrderResidualAmount).mockResolvedValue({
      ok: true,
      walletAmountUsed: 0,
      savingsAmountUsed: 0,
      residualAmount: 130000,
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
          shipping_status: 'pending',
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

  it('returns 409 ORDER_NOT_PAYABLE for a cancelled order and never touches PayPal', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      buildSupabaseMock({
        snapshot: {
          merchant_id: MERCHANT_ID,
          total: 130000,
          currency: 'NGN',
          tracking_token: 'track-123',
          shipping_status: 'cancelled',
        },
      }) as never
    );
    mockVaultOk();

    const response = await POST(createRequest());
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('ORDER_NOT_PAYABLE');
    expect(getDecryptedMerchantCredential).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it.each([
    'paid',
    'partially_paid',
    'refunded',
  ])('returns 409 ORDER_NOT_PAYABLE for a %s order and never mints a PayPal order', async (paymentStatus) => {
    const supabase = buildSupabaseMock({
      snapshot: {
        merchant_id: MERCHANT_ID,
        total: 130000,
        currency: 'NGN',
        tracking_token: 'track-123',
        shipping_status: 'pending',
        payment_status: paymentStatus,
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    mockVaultOk();

    const response = await POST(createRequest());
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('ORDER_NOT_PAYABLE');
    expect(createOrder).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      'create_payment_transaction',
      expect.anything()
    );
  });

  it('returns 400 PAYPAL_SANDBOX_NOT_ALLOWED for a sandbox-mode store and never touches PayPal', async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      buildSupabaseMock({
        custom: { paypal_enabled: true, paypal_mode: 'sandbox' },
      }) as never
    );
    mockVaultOk();

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('PAYPAL_SANDBOX_NOT_ALLOWED');
    expect(getDecryptedMerchantCredential).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('reuses a still-approvable PayPal order and returns its approval link', async () => {
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
    expect(await response.json()).toEqual({
      id: 'PP-EXISTING',
      approveUrl: 'https://paypal.com/approve-existing',
      reused: true,
    });
    expect(getOrder).toHaveBeenCalledWith(
      'mock-client-id',
      'mock-secret-key',
      'PP-EXISTING',
      'live'
    );
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('creates a fresh order and repoints the pending row when the reusable order is dead', async () => {
    const supabase = buildSupabaseMock({
      existingTxn: {
        gateway_reference: 'PP-DEAD',
        metadata: {
          paypal_presentment_amount: 100,
          paypal_presentment_currency: 'USD',
        },
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    mockVaultOk();
    // The stored order can no longer be approved (VOIDED) → fall through.
    vi.mocked(getOrder).mockResolvedValue({
      success: true,
      data: { id: 'PP-DEAD', status: 'VOIDED', links: [] },
    });

    const response = await POST(createRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 'PP-ORD-123',
      approveUrl: 'https://paypal.com/approve',
    });
    expect(createOrder).toHaveBeenCalled();
    // The existing pending row is repointed at the fresh order, not duplicated.
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        gateway_reference: 'PP-ORD-123',
        amount: 130000,
        merchant_amount: 130000,
      })
    );
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      'create_payment_transaction',
      expect.anything()
    );
  });

  it('blocks with 409 ORDER_ALREADY_CAPTURED when the stored order is COMPLETED (no double-charge)', async () => {
    const supabase = buildSupabaseMock({
      existingTxn: {
        gateway_reference: 'PP-COMPLETED',
        metadata: {
          paypal_presentment_amount: 100,
          paypal_presentment_currency: 'USD',
        },
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    mockVaultOk();
    // PayPal already captured (local transaction update failed) — reusing/
    // creating here would hand the buyer a second approval link for money PayPal
    // already collected.
    vi.mocked(getOrder).mockResolvedValue({
      success: true,
      data: { id: 'PP-COMPLETED', status: 'COMPLETED', links: [] },
    });

    const response = await POST(createRequest());
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('ORDER_ALREADY_CAPTURED');
    // No fresh PayPal order and no repointed pending row.
    expect(createOrder).not.toHaveBeenCalled();
    expect(supabase.update).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      'create_payment_transaction',
      expect.anything()
    );
  });

  it('reconciles and blocks with 409 when a COMPLETED PayPal capture already exists (F-263 double-charge guard)', async () => {
    // A prior capture COMPLETED but its order finalization failed, so the order
    // still reads as payable. Minting a fresh PayPal order here would charge the
    // buyer a SECOND time. The route must reconcile the existing capture and
    // block — never touch PayPal.
    const supabase = buildSupabaseMock({
      completedTxn: {
        id: 'txn-completed',
        amount: 130000,
        gateway_reference: 'PP-DONE',
      },
      orderRow: { amount_paid: 0 },
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    mockVaultOk();

    const response = await POST(createRequest());

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('ORDER_ALREADY_CAPTURED');
    // Reconciled the existing capture instead of minting a fresh order.
    expect(finalizePaypalCaptureOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: MERCHANT_ID,
        orderId: ORDER_ID,
        paypalOrderId: 'PP-DONE',
        transaction: { id: 'txn-completed', amount: 130000 },
        orderSnapshot: expect.objectContaining({
          total: 130000,
          amount_paid: 0,
        }),
      })
    );
    // No second PayPal order, no fresh checkout amount lookup reaches PayPal.
    expect(createOrder).not.toHaveBeenCalled();
    expect(getOrder).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      'create_payment_transaction',
      expect.anything()
    );
  });

  it('does not treat a pending PayPal transaction as a completed capture (no false F-263 block)', async () => {
    // Only a status='completed' transaction triggers the F-263 guard. A pending
    // reuse row must flow to the normal reuse/mint path, never a 409.
    const supabase = buildSupabaseMock({
      existingTxn: {
        gateway_reference: 'PP-EXISTING',
        metadata: {
          paypal_presentment_amount: 100,
          paypal_presentment_currency: 'USD',
        },
      },
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    mockVaultOk();

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect((await response.json()).reused).toBe(true);
    expect(finalizePaypalCaptureOrder).not.toHaveBeenCalled();
  });

  it('converts NGN to USD and records a fee-waived residual transaction (no init-time accrual)', async () => {
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
      'live',
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

    // F8: the BYOK fee-accrual row is written on capture, never at init.
    expect(supabase.insert).not.toHaveBeenCalled();
  });

  it('charges only the residual for a mixed-tender (wallet/savings) order', async () => {
    const supabase = buildSupabaseMock();
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    mockVaultOk();
    // ₦65,000 of the ₦130,000 total was covered by wallet credit.
    vi.mocked(computeOrderResidualAmount).mockResolvedValue({
      ok: true,
      walletAmountUsed: 65000,
      savingsAmountUsed: 0,
      residualAmount: 65000,
    });

    const response = await POST(createRequest());
    expect(response.status).toBe(200);

    // PayPal presents the residual (₦65,000 / 1300 = $50), not the full total.
    expect(createOrder).toHaveBeenCalledWith(
      'mock-client-id',
      'mock-secret-key',
      50,
      'USD',
      'track-123',
      'live',
      { returnUrl: undefined, cancelUrl: undefined }
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      'create_payment_transaction',
      expect.objectContaining({
        p_amount: 65000,
        p_merchant_amount: 65000,
        p_metadata: expect.objectContaining({
          paypal_presentment_amount: 50,
          paypal_presentment_currency: 'USD',
        }),
      })
    );
  });

  it('returns 400 NO_PAYABLE_AMOUNT when wallet + savings cover the whole order', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildSupabaseMock() as never);
    mockVaultOk();
    vi.mocked(computeOrderResidualAmount).mockResolvedValue({
      ok: true,
      walletAmountUsed: 130000,
      savingsAmountUsed: 0,
      residualAmount: 0,
    });

    const response = await POST(createRequest());
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('NO_PAYABLE_AMOUNT');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('returns 500 when the residual lookup fails', async () => {
    vi.mocked(createAdminClient).mockReturnValue(buildSupabaseMock() as never);
    mockVaultOk();
    vi.mocked(computeOrderResidualAmount).mockResolvedValue({
      ok: false,
      reason: 'wallet_lookup_failed',
    });

    const response = await POST(createRequest());
    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe('ORDER_AMOUNT_LOOKUP_FAILED');
    expect(createOrder).not.toHaveBeenCalled();
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
      'live',
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
      'live',
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
          shipping_status: 'pending',
        },
      }) as never
    );
    mockVaultOk();
    vi.mocked(computeOrderResidualAmount).mockResolvedValue({
      ok: true,
      walletAmountUsed: 0,
      savingsAmountUsed: 0,
      residualAmount: 4200,
    });

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
