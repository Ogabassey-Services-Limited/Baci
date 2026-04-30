import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import { createAgenticCheckoutPaymentAccount } from '@/lib/agentic/checkout-payment-account';
import {
  buildCheckoutPaymentClaimReference,
  claimCheckoutPaymentSetup,
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
};

const baseCalculation = {
  fulfillmentOptions: [],
  lineItems: [
    {
      base_amount: 500_000,
      discount: 0,
      id: 'line_product-1',
      item: {
        id: 'product-1',
        product_id: 'product-1',
        quantity: 1,
        title: 'Phone',
      },
      subtotal: 500_000,
      tax: 0,
      total: 500_000,
    },
  ],
  messages: [],
  selectedOptionId: 'pickup_store_1',
  totals: [
    { amount: 500_000, display_text: 'Total Due', type: 'total' as const },
  ],
};

function prepareInput(overrides: Record<string, unknown> = {}) {
  return {
    authorizationSecrets: ['confirmation-secret'],
    buyer,
    canResumePaymentAccount: false,
    completionAuthorization: {
      amount: 500_000,
      confirmed_at: new Date().toISOString(),
      currency: 'NGN',
      session_id: 'agentic_session_1',
      signature: 'invalid-for-new-total',
      type: 'human_confirmation' as const,
    },
    merchantId: 'merchant-1',
    metadata: { agentic: { line_items: [] } },
    paystackSubaccountCode: 'ACCT_test123',
    session,
    sessionCalc: baseCalculation,
    sessionId: 'agentic_session_1',
    storedDvaAccount: null,
    supabase: {} as SupabaseClient,
    ...overrides,
  };
}

describe('prepareAgenticCheckoutPayment authorization', () => {
  it('releases the payment claim when the claimed total no longer matches the authorization', async () => {
    vi.mocked(buildCheckoutPaymentClaimReference).mockReturnValue('claim-1');
    vi.mocked(claimCheckoutPaymentSetup).mockResolvedValue({
      claimed: true,
      error: null,
      session,
    });
    vi.mocked(calculateCheckoutSession).mockResolvedValue({
      ...baseCalculation,
      totals: [
        { amount: 600_000, display_text: 'Total Due', type: 'total' as const },
      ],
    });
    vi.mocked(releaseCheckoutPaymentClaim).mockResolvedValue({
      error: null,
      released: true,
    });

    const result = await prepareAgenticCheckoutPayment(prepareInput());

    expect(result).toMatchObject({
      body: { code: 'CONFIRMATION_MISMATCH' },
      ok: false,
      status: 403,
    });
    expect(createAgenticCheckoutPaymentAccount).not.toHaveBeenCalled();
    expect(releaseCheckoutPaymentClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        failureDetails: {
          payment_error: 'authorization_CONFIRMATION_MISMATCH',
        },
      })
    );
  });

  it('releases the payment claim when the claimed calculation has errors', async () => {
    vi.mocked(buildCheckoutPaymentClaimReference).mockReturnValue('claim-1');
    vi.mocked(claimCheckoutPaymentSetup).mockResolvedValue({
      claimed: true,
      error: null,
      session,
    });
    vi.mocked(calculateCheckoutSession).mockResolvedValue({
      ...baseCalculation,
      messages: [
        {
          content: 'Product is out of stock',
          content_type: 'plain',
          type: 'error' as const,
        },
      ],
    });
    vi.mocked(releaseCheckoutPaymentClaim).mockResolvedValue({
      error: null,
      released: true,
    });

    const result = await prepareAgenticCheckoutPayment(prepareInput());

    expect(result).toMatchObject({
      body: { error: 'Checkout calculation has errors' },
      ok: false,
      status: 409,
    });
    expect(createAgenticCheckoutPaymentAccount).not.toHaveBeenCalled();
  });

  it('releases the payment claim when the claimed calculation throws', async () => {
    vi.mocked(buildCheckoutPaymentClaimReference).mockReturnValue('claim-1');
    vi.mocked(claimCheckoutPaymentSetup).mockResolvedValue({
      claimed: true,
      error: null,
      session,
    });
    vi.mocked(calculateCheckoutSession).mockRejectedValue(
      new Error('calculator unavailable')
    );
    vi.mocked(releaseCheckoutPaymentClaim).mockResolvedValue({
      error: null,
      released: true,
    });

    const result = await prepareAgenticCheckoutPayment(prepareInput());

    expect(result).toMatchObject({
      body: { error: 'Checkout calculation failed' },
      ok: false,
      status: 500,
    });
    expect(createAgenticCheckoutPaymentAccount).not.toHaveBeenCalled();
    expect(releaseCheckoutPaymentClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        failureDetails: {
          payment_error: 'claimed_session_calculation_failed',
        },
      })
    );
  });

  it('releases the payment claim when the claimed total is invalid', async () => {
    vi.mocked(buildCheckoutPaymentClaimReference).mockReturnValue('claim-1');
    vi.mocked(claimCheckoutPaymentSetup).mockResolvedValue({
      claimed: true,
      error: null,
      session,
    });
    vi.mocked(calculateCheckoutSession).mockResolvedValue({
      ...baseCalculation,
      totals: [],
    });
    vi.mocked(releaseCheckoutPaymentClaim).mockResolvedValue({
      error: null,
      released: true,
    });

    const result = await prepareAgenticCheckoutPayment(prepareInput());

    expect(result).toMatchObject({
      body: { error: 'Could not calculate total' },
      ok: false,
      status: 500,
    });
    expect(createAgenticCheckoutPaymentAccount).not.toHaveBeenCalled();
    expect(releaseCheckoutPaymentClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        failureDetails: { payment_error: 'claimed_session_total_invalid' },
      })
    );
  });
});
