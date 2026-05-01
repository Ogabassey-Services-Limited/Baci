import { describe, expect, it } from 'vitest';
import {
  type AgenticCheckoutBuyer,
  buildPaymentPendingCheckoutResponse,
  resolveExistingPaymentState,
} from '@/lib/agentic/checkout-completion-response';

const buyer: AgenticCheckoutBuyer = {
  email: 'buyer@example.com',
  first_name: 'Ada',
  last_name: 'Lovelace',
  phone_number: '+2348012345678',
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
      base_amount: 500000,
      discount: 0,
      subtotal: 500000,
      tax: 0,
      total: 500000,
    },
  ],
  totals: [
    { type: 'total' as const, display_text: 'Total Due', amount: 500000 },
  ],
  fulfillmentOptions: [],
  selectedOptionId: 'pickup_store_1',
  messages: [],
};

describe('agentic checkout completion response', () => {
  it('builds the reusable payment-pending response shape', () => {
    const response = buildPaymentPendingCheckoutResponse({
      buyer,
      dvaAccount: {
        account_name: 'Baci Test',
        account_number: '1234567890',
        bank_name: 'Paystack-Titan',
      },
      orderId: 'order-1',
      session: {
        currency: 'NGN',
        session_id: 'agentic_session_1',
        shipping_address: { city: 'Lagos' },
        shipping_method: 'pickup_store_1',
      },
      sessionCalc,
    });

    expect(response).toMatchObject({
      id: 'agentic_session_1',
      buyer,
      status: 'ready_for_payment',
      currency: 'ngn',
      order: {
        id: 'order-1',
        status: 'payment_pending',
      },
      order_id: 'order-1',
      payment_details: {
        type: 'bank_transfer',
        bank_name: 'Paystack-Titan',
        account_number: '1234567890',
        account_name: 'Baci Test',
      },
    });
  });

  it('returns existing payment details instead of allowing duplicate side effects', () => {
    const resolution = resolveExistingPaymentState({
      buyer,
      session: {
        currency: 'NGN',
        metadata: {
          agentic: {
            buyer,
            payment_state: 'payment_pending',
          },
        },
        order_id: 'order-1',
        payment_reference: '1234567890',
        session_id: 'agentic_session_1',
        shipping_method: 'pickup_store_1',
        virtual_account_bank: 'Paystack-Titan',
        virtual_account_name: 'Baci Test',
        virtual_account_number: '1234567890',
      },
      sessionCalc,
    });

    expect(resolution).toMatchObject({
      status: 200,
      body: {
        id: 'agentic_session_1',
        order_id: 'order-1',
        payment_details: {
          account_number: '1234567890',
          bank_name: 'Paystack-Titan',
        },
      },
    });
  });

  it('returns pending payment details from the stored checkout snapshot', () => {
    const resolution = resolveExistingPaymentState({
      session: {
        currency: 'NGN',
        metadata: {
          agentic: {
            buyer,
            line_items: sessionCalc.lineItems,
            payment_state: 'payment_pending',
            totals: sessionCalc.totals,
          },
        },
        order_id: 'order-1',
        payment_reference: '1234567890',
        session_id: 'agentic_session_1',
        shipping_method: 'pickup_store_1',
        virtual_account_bank: 'Paystack-Titan',
        virtual_account_name: 'Baci Test',
        virtual_account_number: '1234567890',
      },
    });

    expect(resolution).toMatchObject({
      status: 200,
      body: {
        buyer,
        id: 'agentic_session_1',
        line_items: sessionCalc.lineItems,
        order_id: 'order-1',
        payment_details: {
          account_name: 'Baci Test',
          account_number: '1234567890',
          bank_name: 'Paystack-Titan',
        },
        totals: sessionCalc.totals,
      },
    });
  });

  it('prefers the stored payment snapshot over a fresh recalculation', () => {
    const storedLineItems = [
      {
        ...sessionCalc.lineItems[0],
        id: 'stored_line',
        total: 400000,
      },
    ];
    const storedTotals = [
      { type: 'total' as const, display_text: 'Total Due', amount: 400000 },
    ];
    const storedPaymentDetails = {
      account_name: 'Baci Test',
      account_number: '1234567890',
      bank_name: 'Paystack-Titan',
    };
    const resolution = resolveExistingPaymentState({
      buyer,
      session: {
        currency: 'NGN',
        metadata: {
          agentic: {
            buyer,
            line_items: storedLineItems,
            payment_state: 'payment_pending',
            totals: storedTotals,
          },
        },
        order_id: 'order-1',
        payment_reference: '1234567890',
        session_id: 'agentic_session_1',
        virtual_account_bank: storedPaymentDetails.bank_name,
        virtual_account_name: storedPaymentDetails.account_name,
        virtual_account_number: '1234567890',
      },
      sessionCalc,
    });

    expect(resolution).toMatchObject({
      status: 200,
      body: {
        line_items: storedLineItems,
        payment_details: storedPaymentDetails,
        totals: storedTotals,
      },
    });
  });

  it('blocks retry when a prior payment side effect exists without full DVA details', () => {
    const resolution = resolveExistingPaymentState({
      buyer,
      session: {
        currency: 'NGN',
        order_id: 'order-1',
        session_id: 'agentic_session_1',
      },
      sessionCalc,
    });

    expect(resolution).toEqual({
      status: 409,
      body: {
        error: 'Session already has pending payment',
        order_id: 'order-1',
        status: 'payment_pending',
      },
    });
  });
});
