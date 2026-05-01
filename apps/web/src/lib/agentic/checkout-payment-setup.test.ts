import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import { createAgenticCheckoutPaymentAccount } from '@/lib/agentic/checkout-payment-account';
import {
  buildCheckoutPaymentClaimReference,
  claimCheckoutPaymentSetup,
  markCheckoutPaymentAccountReady,
  releaseCheckoutPaymentClaim,
} from '@/lib/agentic/checkout-payment-claim';
import { prepareAgenticCheckoutPayment } from '@/lib/agentic/checkout-payment-setup';

vi.mock('@/lib/agentic/checkout', () => ({
  calculateCheckoutSession: vi.fn(),
}));
vi.mock('@/lib/agentic/checkout-payment-account', () => ({
  createAgenticCheckoutPaymentAccount: vi.fn(),
}));
vi.mock('@/lib/agentic/checkout-payment-claim', () => ({
  buildCheckoutPaymentClaimReference: vi.fn(),
  claimCheckoutPaymentSetup: vi.fn(),
  markCheckoutPaymentAccountReady: vi.fn(),
  releaseCheckoutPaymentClaim: vi.fn(),
}));

const buyer = {
  email: 'buyer@example.com',
  first_name: 'Ada',
  last_name: 'Lovelace',
  phone_number: '+2348012345678',
};
const session = {
  cart_items: [{ id: 'product-1', quantity: 1 }],
  currency: 'NGN',
  id: 'row-1',
  merchant_id: 'merchant-1',
  metadata: null,
  order_id: null,
  payment_reference: null,
  session_id: 'agentic_session_1',
  shipping_address: { city: 'Lagos' },
  shipping_method: 'pickup_store_1',
  status: 'processing' as const,
  virtual_account_number: null,
};

const sessionCalc = {
  lineItems: [
    {
      id: 'line_product-1',
      item: {
        id: 'product-1',
        product_id: 'product-1',
        quantity: 1,
        title: 'Phone',
      },
      base_amount: 500_000,
      discount: 0,
      subtotal: 500_000,
      tax: 0,
      total: 500_000,
    },
  ],
  totals: [
    { type: 'total' as const, display_text: 'Total Due', amount: 500_000 },
  ],
  fulfillmentOptions: [],
  selectedOptionId: 'pickup_store_1',
  messages: [],
};

const dvaAccount = {
  account_name: 'Ada Lovelace',
  account_number: '1234567890',
  bank_name: 'Paystack-Titan',
};
const authorizationInput = {
  authorizationSecrets: ['confirmation-secret'],
  completionAuthorization: {
    currency: 'NGN',
    expires_at: '2999-01-01T00:00:00.000Z',
    mandate_id: 'mandate-1',
    max_amount: 500_000,
    session_id: 'agentic_session_1',
    signature:
      '314fa3c91a884f9f2326b44a666192f0f93ef3a638ea32c485bc8aadb6bef738',
    type: 'payment_mandate' as const,
  },
};

function paymentInput(overrides: Record<string, unknown> = {}) {
  return {
    ...authorizationInput,
    buyer,
    canResumePaymentAccount: false,
    merchantId: 'merchant-1',
    metadata: { agentic: { line_items: [] } },
    paystackSubaccountCode: 'ACCT_TESTMOCK1234567',
    session,
    sessionCalc,
    sessionId: 'agentic_session_1',
    storedDvaAccount: null,
    supabase: {} as SupabaseClient,
    ...overrides,
  };
}

describe('prepareAgenticCheckoutPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildCheckoutPaymentClaimReference).mockReturnValue(
      'agentic_claim_1'
    );
    vi.mocked(releaseCheckoutPaymentClaim).mockResolvedValue({
      error: null,
      released: true,
    });
  });

  it('resumes a stored payment account without creating duplicate side effects', async () => {
    const result = await prepareAgenticCheckoutPayment(
      paymentInput({
        canResumePaymentAccount: true,
        storedDvaAccount: dvaAccount,
      })
    );

    expect(result).toMatchObject({
      ok: true,
      payment: {
        dvaAccount,
        session,
        sessionCalc,
      },
    });
    expect(claimCheckoutPaymentSetup).not.toHaveBeenCalled();
  });

  it('claims the session and stores the generated account before order creation', async () => {
    vi.mocked(claimCheckoutPaymentSetup).mockResolvedValue({
      claimed: true,
      error: null,
      session,
    });
    vi.mocked(calculateCheckoutSession).mockResolvedValue(sessionCalc);
    vi.mocked(createAgenticCheckoutPaymentAccount).mockResolvedValue({
      account: {
        ...dvaAccount,
        assigned: true,
        currency: 'NGN',
      },
      ok: true,
    });
    vi.mocked(markCheckoutPaymentAccountReady).mockResolvedValue({
      error: null,
      stored: true,
    });

    const result = await prepareAgenticCheckoutPayment(paymentInput());

    expect(result).toMatchObject({
      ok: true,
      payment: {
        dvaAccount,
        session,
        sessionCalc,
      },
    });
    expect(claimCheckoutPaymentSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        claimReference: 'agentic_claim_1',
        sessionId: 'agentic_session_1',
      })
    );
    expect(markCheckoutPaymentAccountReady).toHaveBeenCalledWith(
      expect.objectContaining({
        claimReference: 'agentic_claim_1',
        dvaAccount: expect.objectContaining(dvaAccount),
        merchantId: 'merchant-1',
      })
    );
    expect(createAgenticCheckoutPaymentAccount).toHaveBeenCalledWith({
      buyer,
      paystackSubaccountCode: 'ACCT_TESTMOCK1234567',
    });
  });

  it('returns a database error when the payment setup claim write fails', async () => {
    vi.mocked(claimCheckoutPaymentSetup).mockResolvedValue({
      claimed: false,
      error: {
        code: 'PGRST000',
        details: '',
        hint: '',
        message: 'claim write failed',
        name: 'PostgrestError',
        toJSON() {
          return this;
        },
      },
      session: null,
    });

    const result = await prepareAgenticCheckoutPayment(paymentInput());

    expect(result).toEqual({
      body: { error: 'Database error' },
      ok: false,
      status: 500,
    });
    expect(createAgenticCheckoutPaymentAccount).not.toHaveBeenCalled();
    expect(releaseCheckoutPaymentClaim).not.toHaveBeenCalled();
  });

  it('releases the claim when payment account creation fails', async () => {
    vi.mocked(claimCheckoutPaymentSetup).mockResolvedValue({
      claimed: true,
      error: null,
      session,
    });
    vi.mocked(calculateCheckoutSession).mockResolvedValue(sessionCalc);
    vi.mocked(createAgenticCheckoutPaymentAccount).mockResolvedValue({
      error: new Error('paystack down'),
      errorMessage: 'paystack down',
      ok: false,
    });

    const result = await prepareAgenticCheckoutPayment(paymentInput());

    expect(result).toEqual({
      body: {
        details: 'Payment provider error',
        error: 'Failed to generate payment account',
      },
      ok: false,
      status: 502,
    });
    expect(releaseCheckoutPaymentClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        failureDetails: { payment_error: 'paystack down' },
      })
    );
  });

  it('keeps the original payment error when claim release fails', async () => {
    vi.mocked(claimCheckoutPaymentSetup).mockResolvedValue({
      claimed: true,
      error: null,
      session,
    });
    vi.mocked(calculateCheckoutSession).mockResolvedValue(sessionCalc);
    vi.mocked(createAgenticCheckoutPaymentAccount).mockResolvedValue({
      error: new Error('paystack down'),
      errorMessage: 'paystack down',
      ok: false,
    });
    vi.mocked(releaseCheckoutPaymentClaim).mockRejectedValue(
      new Error('release failed')
    );

    const result = await prepareAgenticCheckoutPayment(paymentInput());

    expect(result).toEqual({
      body: {
        details: 'Payment provider error',
        error: 'Failed to generate payment account',
      },
      ok: false,
      status: 502,
    });
  });

  it('does not persist a raw payment account number when marking ready fails', async () => {
    vi.mocked(claimCheckoutPaymentSetup).mockResolvedValue({
      claimed: true,
      error: null,
      session,
    });
    vi.mocked(calculateCheckoutSession).mockResolvedValue(sessionCalc);
    vi.mocked(createAgenticCheckoutPaymentAccount).mockResolvedValue({
      account: {
        ...dvaAccount,
        assigned: true,
        currency: 'NGN',
      },
      ok: true,
    });
    vi.mocked(markCheckoutPaymentAccountReady).mockResolvedValue({
      error: {
        code: 'PGRST000',
        details: '',
        hint: '',
        message: 'database leaked 1234567890',
        name: 'PostgrestError',
        toJSON() {
          return this;
        },
      },
      stored: false,
    });

    const result = await prepareAgenticCheckoutPayment(paymentInput());

    expect(result).toEqual({
      body: { error: 'Database error' },
      ok: false,
      status: 500,
    });
    expect(releaseCheckoutPaymentClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        failureDetails: expect.objectContaining({
          payment_account: '******7890',
        }),
      })
    );
  });
});
