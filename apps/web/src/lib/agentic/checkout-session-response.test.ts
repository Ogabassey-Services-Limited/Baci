import { describe, expect, it } from 'vitest';
import { buildCheckoutSessionStateResponse } from '@/lib/agentic/checkout-session-response';

describe('buildCheckoutSessionStateResponse', () => {
  it('normalizes session state responses for agent clients', () => {
    const response = buildCheckoutSessionStateResponse({
      currency: 'NGN',
      fulfillmentOptionId: undefined,
      fulfillmentOptions: [
        {
          id: 'pickup_store_1',
          title: 'Pickup',
          type: 'pickup',
          subtotal: 0,
          tax: 0,
          total: 0,
        },
      ],
      lineItems: [
        {
          id: 'line_item_1',
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
      messages: [],
      policyBaseUrl: 'https://shop.example',
      sessionId: 'agentic_session_1',
      shippingAddress: undefined,
      status: 'ready_for_payment',
      totals: [{ type: 'total', display_text: 'Total', amount: 500000 }],
    });

    expect(response).toMatchObject({
      currency: 'ngn',
      fulfillment_option_id: null,
      id: 'agentic_session_1',
      links: [
        { type: 'terms_of_use', url: 'https://shop.example/terms' },
        { type: 'privacy_policy', url: 'https://shop.example/privacy' },
      ],
      shipping_address: null,
      status: 'ready_for_payment',
    });
  });

  it('normalizes sparse edge-case state responses', () => {
    const response = buildCheckoutSessionStateResponse({
      currency: 'NgN',
      fulfillmentOptionId: undefined,
      fulfillmentOptions: [],
      lineItems: [],
      messages: [],
      policyBaseUrl: 'https://shop.example',
      sessionId: 'agentic_session_empty',
      shippingAddress: null,
      status: 'not_ready_for_payment',
      totals: [],
    });

    expect(response).toMatchObject({
      currency: 'ngn',
      fulfillment_option_id: null,
      fulfillment_options: [],
      id: 'agentic_session_empty',
      line_items: [],
      shipping_address: null,
      status: 'not_ready_for_payment',
      totals: [],
    });
    expect(response.links).toEqual([
      { type: 'terms_of_use', url: 'https://shop.example/terms' },
      { type: 'privacy_policy', url: 'https://shop.example/privacy' },
    ]);
  });
});
