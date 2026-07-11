import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markPaypalCredentialInvalid } from '@/lib/payments/paypal-checkout-credentials';
import { createOrder } from '@/lib/paypal';
import {
  createAndPersistPaypalOrder,
  persistPaypalPendingTransaction,
} from './paypal-create-order-persistence';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/paypal', () => ({
  createOrder: vi.fn(),
}));

vi.mock('@/lib/payments/paypal-checkout-credentials', () => ({
  isPaypalAuthFailure: (code: string | undefined) => code === 'HTTP_401',
  markPaypalCredentialInvalid: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const MERCHANT_ID = 'merchant-1';
const ORDER_ID = 'order-1';

function buildInsertSupabase(rpcResult: { error: unknown } = { error: null }) {
  return {
    rpc: vi.fn(() => Promise.resolve(rpcResult)),
    from: vi.fn(),
  };
}

function buildUpdateSupabase(
  updateResult: { error: unknown } = { error: null }
) {
  // The update chain is awaited directly; awaiting this non-thenable object
  // resolves to the object itself, so its `error` field carries the result.
  const chain = {
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    error: updateResult.error,
  };
  return {
    from: vi.fn(() => chain),
    rpc: vi.fn(),
    _chain: chain,
  };
}

const persistParams = {
  merchantId: MERCHANT_ID,
  orderId: ORDER_ID,
  customerEmail: 'customer@example.com',
  amount: 65000,
  currency: 'NGN',
  mode: 'sandbox' as const,
  paypalOrderId: 'PP-NEW',
  presentmentAmount: 50,
  presentmentCurrency: 'USD',
  fxRate: 1300,
};

describe('persistPaypalPendingTransaction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a new pending row via create_payment_transaction (residual amount)', async () => {
    const supabase = buildInsertSupabase();

    const { error } = await persistPaypalPendingTransaction(
      supabase as unknown as SupabaseClient,
      { ...persistParams, existingTransaction: null }
    );

    expect(error).toBeNull();
    expect(supabase.rpc).toHaveBeenCalledWith(
      'create_payment_transaction',
      expect.objectContaining({
        p_amount: 65000,
        p_merchant_amount: 65000,
        p_currency: 'NGN',
        p_reference: 'PP-NEW',
        p_metadata: expect.objectContaining({
          paypal_presentment_amount: 50,
          paypal_presentment_currency: 'USD',
          paypal_fx_rate: 1300,
        }),
      })
    );
  });

  it('repoints an existing pending row (preserving prior metadata) instead of inserting', async () => {
    const supabase = buildUpdateSupabase();

    const { error } = await persistPaypalPendingTransaction(
      supabase as unknown as SupabaseClient,
      {
        ...persistParams,
        existingTransaction: {
          gateway_reference: 'PP-OLD',
          metadata: { customer_email: 'customer@example.com' },
        },
      }
    );

    expect(error).toBeNull();
    expect(supabase.from).toHaveBeenCalledWith('transactions');
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase._chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        gateway_reference: 'PP-NEW',
        amount: 65000,
        merchant_amount: 65000,
        metadata: expect.objectContaining({
          customer_email: 'customer@example.com',
          paypal_presentment_amount: 50,
        }),
      })
    );
  });
});

const createParams = {
  credentials: { clientId: 'cid', secretKey: 'sk' },
  environment: 'test' as const,
  merchantId: MERCHANT_ID,
  orderId: ORDER_ID,
  customerEmail: 'customer@example.com',
  orderCurrency: 'NGN',
  residualAmount: 65000,
  presentmentAmount: 50,
  presentmentCurrency: 'USD',
  fxRate: 1300,
  trackingToken: 'track-1',
  mode: 'sandbox' as const,
  existingTransaction: null,
};

describe('createAndPersistPaypalOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createOrder).mockResolvedValue({
      success: true,
      data: { id: 'PP-NEW', approveUrl: 'https://paypal/approve' },
    });
  });

  it('creates the order and persists the pending row on success', async () => {
    const supabase = buildInsertSupabase();

    const result = await createAndPersistPaypalOrder(
      supabase as unknown as SupabaseClient,
      createParams
    );

    expect(result).toEqual({
      ok: true,
      id: 'PP-NEW',
      approveUrl: 'https://paypal/approve',
    });
    expect(createOrder).toHaveBeenCalledWith(
      'cid',
      'sk',
      50,
      'USD',
      'track-1',
      'sandbox',
      { returnUrl: undefined, cancelUrl: undefined }
    );
  });

  it('uses the stable tracking token as the PayPal-Request-Id on a first create', async () => {
    // No prior pending order → the token de-dupes an honest double-submit.
    await createAndPersistPaypalOrder(
      buildInsertSupabase() as unknown as SupabaseClient,
      { ...createParams, existingTransaction: null }
    );

    expect(createOrder).toHaveBeenCalledWith(
      'cid',
      'sk',
      50,
      'USD',
      'track-1',
      'sandbox',
      { returnUrl: undefined, cancelUrl: undefined }
    );
  });

  it('uses a bounded, deterministic replacement PayPal-Request-Id (distinct from the original) after a dead order', async () => {
    // A prior pending PayPal order exists but is no longer reusable (voided /
    // amount changed). Reusing the stable token would make PayPal return the OLD
    // dead order via idempotency, so the replacement id must be distinct — yet
    // stay within PayPal's 38-char limit (a 32-char token + a full order id
    // would exceed it, H3) and stay stable so concurrent retries of the SAME
    // replacement still dedupe.
    const replacementParams = {
      ...createParams,
      existingTransaction: { gateway_reference: 'PP-OLD', metadata: {} },
    };

    const first = await createAndPersistPaypalOrder(
      buildUpdateSupabase() as unknown as SupabaseClient,
      replacementParams
    );
    // Retry the SAME replacement (concurrent double-submit).
    await createAndPersistPaypalOrder(
      buildUpdateSupabase() as unknown as SupabaseClient,
      replacementParams
    );

    expect(first.ok).toBe(true);
    const firstRequestId = vi.mocked(createOrder).mock.calls[0]?.[4];
    const secondRequestId = vi.mocked(createOrder).mock.calls[1]?.[4];

    // Bounded to PayPal's documented 38-char PayPal-Request-Id limit.
    expect((firstRequestId as string).length).toBeLessThanOrEqual(38);
    // Distinct from the original order's id (= the bare tracking token) so
    // PayPal does not idempotently return the dead order.
    expect(firstRequestId).not.toBe('track-1');
    // Deterministic: concurrent retries of the same replacement reuse the id.
    expect(secondRequestId).toBe(firstRequestId);
  });

  it('disables the credential and returns 400 on a PayPal 401', async () => {
    vi.mocked(createOrder).mockResolvedValue({
      success: false,
      error: 'invalid_client',
      code: 'HTTP_401',
    });
    const supabase = buildInsertSupabase();

    const result = await createAndPersistPaypalOrder(
      supabase as unknown as SupabaseClient,
      createParams
    );

    expect(result).toEqual({
      ok: false,
      status: 400,
      body: {
        error: 'PayPal rejected the store credentials',
        code: 'INVALID_PROVIDER_CREDENTIALS',
      },
    });
    expect(markPaypalCredentialInvalid).toHaveBeenCalledWith(
      MERCHANT_ID,
      'test',
      'invalid_client'
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('surfaces a non-auth PayPal failure as a 500', async () => {
    vi.mocked(createOrder).mockResolvedValue({
      success: false,
      error: 'boom',
      code: 'HTTP_500',
    });

    const result = await createAndPersistPaypalOrder(
      buildInsertSupabase() as unknown as SupabaseClient,
      createParams
    );

    expect(result).toEqual({
      ok: false,
      status: 500,
      body: { error: 'boom', code: 'HTTP_500' },
    });
    expect(markPaypalCredentialInvalid).not.toHaveBeenCalled();
  });

  it('returns a 500 DATABASE_ERROR when the persist write fails', async () => {
    const supabase = buildInsertSupabase({ error: { message: 'db down' } });

    const result = await createAndPersistPaypalOrder(
      supabase as unknown as SupabaseClient,
      createParams
    );

    expect(result).toEqual({
      ok: false,
      status: 500,
      body: { error: 'Failed to record transaction', code: 'DATABASE_ERROR' },
    });
  });
});
