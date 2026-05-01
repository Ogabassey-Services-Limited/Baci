import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateCheckoutSession } from '@/lib/agentic/checkout';
import { resolveCheckoutCompletionSessionState } from '@/lib/agentic/checkout-completion-session-state';
import type { AgenticCheckoutSessionRecord } from '@/lib/agentic/checkout-session-record';

vi.mock('@/lib/agentic/checkout', () => ({
  calculateCheckoutSession: vi.fn(() => {
    throw new Error('calculateCheckoutSession should not be called');
  }),
}));

const lineItems = [
  {
    base_amount: 500000,
    discount: 0,
    id: 'line_product-1',
    item: {
      id: 'product-1',
      product_id: 'product-1',
      quantity: 1,
      title: 'Phone',
    },
    subtotal: 500000,
    tax: 0,
    total: 500000,
  },
];

const totals = [{ type: 'total', display_text: 'Total Due', amount: 500000 }];

const readySession: AgenticCheckoutSessionRecord = {
  cart_items: [{ id: 'product-1', quantity: 1 }],
  currency: 'NGN',
  id: 'row-1',
  merchant_id: 'merchant-1',
  metadata: { agentic: { existing: true } },
  order_id: null,
  payment_reference: null,
  session_id: 'agentic_session_1',
  shipping_address: { city: 'Lagos' },
  shipping_method: 'pickup_store_1',
  status: 'processing',
  virtual_account_bank: null,
  virtual_account_name: null,
  virtual_account_number: null,
};

describe('resolveCheckoutCompletionSessionState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resumes payment-account-ready sessions from stored state', async () => {
    const session = {
      ...readySession,
      // Deliberately invalid: resume must use the stored payment snapshot.
      cart_items: [{ invalid: true }] as never,
      metadata: {
        agentic: {
          dva_account: {
            account_name: 'Baci Test',
            account_number: '1234567890',
            bank_name: 'Paystack-Titan',
          },
          line_items: lineItems,
          payment_state: 'payment_account_ready',
          totals,
        },
      },
    };

    const result = await resolveCheckoutCompletionSessionState({
      authorizationSecrets: [],
      completionAuthorization: undefined,
      merchantId: 'merchant-1',
      session,
      sessionId: 'agentic_session_1',
      supabase: {} as never,
    });

    expect(result).toMatchObject({
      canResumePaymentAccount: true,
      ok: true,
      sessionCalc: {
        lineItems,
        selectedOptionId: 'pickup_store_1',
        totals,
      },
      storedDvaAccount: {
        account_number: '1234567890',
        bank_name: 'Paystack-Titan',
      },
    });
    expect(calculateCheckoutSession).not.toHaveBeenCalled();
  });

  it('resumes order-finalizing sessions from stored state', async () => {
    const session = {
      ...readySession,
      // Deliberately invalid: resume must use the stored payment snapshot.
      cart_items: [{ invalid: true }] as never,
      metadata: {
        agentic: {
          dva_account: {
            account_name: 'Baci Test',
            account_number: '1234567890',
            bank_name: 'Paystack-Titan',
          },
          finalization_claim: 'claim-1',
          line_items: lineItems,
          payment_state: 'order_finalizing',
          totals,
        },
      },
    };

    const result = await resolveCheckoutCompletionSessionState({
      authorizationSecrets: [],
      completionAuthorization: undefined,
      merchantId: 'merchant-1',
      session,
      sessionId: 'agentic_session_1',
      supabase: {} as never,
    });

    expect(result).toMatchObject({
      canResumePaymentAccount: true,
      ok: true,
      sessionCalc: {
        lineItems,
        selectedOptionId: 'pickup_store_1',
        totals,
      },
      storedDvaAccount: {
        account_number: '1234567890',
        bank_name: 'Paystack-Titan',
      },
    });
    expect(calculateCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns a conflict when payment-account-ready state is incomplete', async () => {
    const session = {
      ...readySession,
      metadata: { agentic: { payment_state: 'payment_account_ready' } },
      virtual_account_number: '1234567890',
    };

    const result = await resolveCheckoutCompletionSessionState({
      authorizationSecrets: [],
      completionAuthorization: undefined,
      merchantId: 'merchant-1',
      session,
      sessionId: 'agentic_session_1',
      supabase: {} as never,
    });

    expect(result).toMatchObject({
      body: {
        error: 'Missing or corrupted DVA account',
        status: 'payment_account_missing',
      },
      ok: false,
      status: 409,
    });
    expect(calculateCheckoutSession).not.toHaveBeenCalled();
  });
});
