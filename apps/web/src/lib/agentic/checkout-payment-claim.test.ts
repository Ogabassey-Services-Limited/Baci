import { describe, expect, it, vi } from 'vitest';
import {
  claimCheckoutPaymentSetup,
  markCheckoutPaymentAccountReady,
  releaseCheckoutPaymentClaim,
} from '@/lib/agentic/checkout-payment-claim';

const buyer = {
  email: 'buyer@example.com',
  first_name: 'Ada',
  last_name: 'Lovelace',
  phone_number: '+2348012345678',
};

function createClaimSupabaseMock(result: {
  data?: { session_id: string } | null;
  error?: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: result.data ?? {
      id: 'row-1',
      session_id: 'agentic_session_1',
      merchant_id: 'merchant-1',
      cart_items: [{ id: 'product-1', quantity: 1 }],
      shipping_method: 'pickup_store_1',
      shipping_address: { city: 'Lagos' },
      currency: 'NGN',
      status: 'processing',
      metadata: null,
    },
    error: result.error ?? null,
  });
  const select = vi.fn(() => ({ maybeSingle }));
  const chain = {
    eq: vi.fn(),
    is: vi.fn(),
    not: vi.fn(),
    select,
  };
  chain.eq.mockReturnValue(chain);
  chain.is.mockReturnValue(chain);
  chain.not.mockReturnValue(chain);

  const update = vi.fn(() => chain);
  const from = vi.fn(() => ({ update }));

  return {
    chain,
    from,
    maybeSingle,
    supabase: { from },
    update,
  };
}

function createReleaseSupabaseMock(error: unknown = null) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: { session_id: 'agentic_session_1' }, error });
  const select = vi.fn(() => ({ maybeSingle }));
  const thirdEq = vi.fn(() => ({ select }));
  const secondEq = vi.fn(() => ({ eq: thirdEq }));
  const firstEq = vi.fn(() => ({ eq: secondEq }));
  const update = vi.fn(() => ({ eq: firstEq }));
  const from = vi.fn(() => ({ update }));

  return {
    from,
    maybeSingle,
    secondEq,
    select,
    supabase: { from },
    thirdEq,
    update,
  };
}

describe('agentic checkout payment claim', () => {
  it('claims payment setup with null side-effect guards', async () => {
    const mock = createClaimSupabaseMock({});

    const result = await claimCheckoutPaymentSetup({
      buyer,
      claimReference: 'agentic_claim_1',
      merchantId: 'merchant-1',
      metadata: { agentic: { line_items: [] } },
      sessionId: 'agentic_session_1',
      supabase: mock.supabase as never,
    });

    expect(result.claimed).toBe(true);
    expect(mock.from).toHaveBeenCalledWith('checkout_sessions');
    expect(mock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_reference: 'agentic_claim_1',
        metadata: expect.objectContaining({
          agentic: expect.objectContaining({
            buyer,
            payment_state: 'claiming_payment',
          }),
        }),
      })
    );
    expect(mock.chain.eq).toHaveBeenCalledWith(
      'session_id',
      'agentic_session_1'
    );
    expect(mock.chain.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(mock.chain.is).toHaveBeenCalledWith('order_id', null);
    expect(mock.chain.is).toHaveBeenCalledWith('payment_reference', null);
    expect(mock.chain.is).toHaveBeenCalledWith('virtual_account_number', null);
    expect(mock.chain.eq).toHaveBeenCalledWith('status', 'processing');
    expect(mock.chain.not).toHaveBeenCalledWith('shipping_address', 'is', null);
  });

  it('returns the database error when payment setup claim fails', async () => {
    const error = new Error('db error');
    const mock = createClaimSupabaseMock({ data: null, error });

    const result = await claimCheckoutPaymentSetup({
      buyer,
      claimReference: 'agentic_claim_1',
      merchantId: 'merchant-1',
      metadata: { agentic: { line_items: [] } },
      sessionId: 'agentic_session_1',
      supabase: mock.supabase as never,
    });

    expect(result).toMatchObject({ claimed: false, error });
    expect(mock.update).toHaveBeenCalled();
  });

  it('releases a claim when setup fails before payment side effects exist', async () => {
    const mock = createReleaseSupabaseMock();

    const result = await releaseCheckoutPaymentClaim({
      buyer,
      claimReference: 'agentic_claim_1',
      merchantId: 'merchant-1',
      metadata: { agentic: { line_items: [] } },
      sessionId: 'agentic_session_1',
      supabase: mock.supabase as never,
    });

    expect(result.error).toBeNull();
    expect(result.released).toBe(true);
    expect(mock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_reference: null,
        metadata: expect.objectContaining({
          agentic: expect.objectContaining({
            payment_state: 'payment_setup_failed',
          }),
        }),
      })
    );
    expect(mock.secondEq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(mock.thirdEq).toHaveBeenCalledWith(
      'payment_reference',
      'agentic_claim_1'
    );
    expect(mock.select).toHaveBeenCalledWith('session_id');
  });

  it('does not let failure details overwrite the validated buyer', async () => {
    const mock = createReleaseSupabaseMock();

    await releaseCheckoutPaymentClaim({
      buyer,
      claimReference: 'agentic_claim_1',
      failureDetails: {
        buyer: { email: 'spoof@example.com' },
        payment_error: 'paystack down',
      },
      merchantId: 'merchant-1',
      metadata: { agentic: { line_items: [] } },
      sessionId: 'agentic_session_1',
      supabase: mock.supabase as never,
    });

    expect(mock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          agentic: expect.objectContaining({
            buyer,
            payment_error: 'paystack down',
          }),
        }),
      })
    );
  });

  it('reports when a claim release matched no checkout session', async () => {
    const mock = createReleaseSupabaseMock();
    mock.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await releaseCheckoutPaymentClaim({
      buyer,
      claimReference: 'agentic_claim_1',
      merchantId: 'merchant-1',
      metadata: { agentic: { line_items: [] } },
      sessionId: 'agentic_session_1',
      supabase: mock.supabase as never,
    });

    expect(result).toEqual({ error: null, released: false });
  });

  it('returns the database error when claim release fails', async () => {
    const error = new Error('db error');
    const mock = createReleaseSupabaseMock(error);

    const result = await releaseCheckoutPaymentClaim({
      buyer,
      claimReference: 'agentic_claim_1',
      merchantId: 'merchant-1',
      metadata: { agentic: { line_items: [] } },
      sessionId: 'agentic_session_1',
      supabase: mock.supabase as never,
    });

    expect(result).toEqual({ error, released: false });
    expect(mock.update).toHaveBeenCalled();
  });

  it('stores generated payment account details as a recoverable state', async () => {
    const mock = createClaimSupabaseMock({});

    const result = await markCheckoutPaymentAccountReady({
      buyer,
      claimReference: 'agentic_claim_1',
      dvaAccount: {
        account_name: 'Baci Test',
        account_number: '1234567890',
        bank_name: 'Paystack-Titan',
      },
      merchantId: 'merchant-1',
      metadata: { agentic: { line_items: [] } },
      sessionId: 'agentic_session_1',
      supabase: mock.supabase as never,
    });

    expect(result.stored).toBe(true);
    expect(mock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_reference: '1234567890',
        virtual_account_number: '1234567890',
        metadata: expect.objectContaining({
          agentic: expect.objectContaining({
            payment_state: 'payment_account_ready',
          }),
        }),
      })
    );
    expect(mock.chain.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(mock.chain.eq).toHaveBeenCalledWith(
      'payment_reference',
      'agentic_claim_1'
    );
  });

  it('returns the database error when marking the payment account ready fails', async () => {
    const error = new Error('db error');
    const mock = createClaimSupabaseMock({ data: null, error });

    const result = await markCheckoutPaymentAccountReady({
      buyer,
      claimReference: 'agentic_claim_1',
      dvaAccount: {
        account_name: 'Baci Test',
        account_number: '1234567890',
        bank_name: 'Paystack-Titan',
      },
      merchantId: 'merchant-1',
      metadata: { agentic: { line_items: [] } },
      sessionId: 'agentic_session_1',
      supabase: mock.supabase as never,
    });

    expect(result).toEqual({ error, stored: false });
    expect(mock.update).toHaveBeenCalled();
  });
});
