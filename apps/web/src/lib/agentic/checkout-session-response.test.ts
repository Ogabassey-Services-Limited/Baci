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
      capabilities: {},
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

  it('adds native ACP fulfillment aliases to checkout state responses', () => {
    const response = buildCheckoutSessionStateResponse({
      currency: 'NGN',
      fulfillmentOptionId: 'shipping_standard',
      fulfillmentOptions: [
        {
          id: 'shipping_standard',
          title: 'Standard Delivery',
          type: 'shipping',
          subtotal: 2500,
          tax: 0,
          total: 2500,
        },
      ],
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
      messages: [],
      policyBaseUrl: 'https://shop.example',
      sessionId: 'agentic_session_1',
      shippingAddress: {
        address: '12 Example Street',
        city: 'Lagos',
        country_code: 'NG',
        email: 'ada@example.com',
        name: 'Ada Buyer',
        phone: '+2348012345678',
        postal_code: '100001',
        state: 'LA',
      },
      status: 'ready_for_payment',
      totals: [{ type: 'total', display_text: 'Total', amount: 502500 }],
    });

    expect(response).toMatchObject({
      capabilities: {},
      fulfillment_details: {
        name: 'Ada Buyer',
        phone_number: '+2348012345678',
        email: 'ada@example.com',
        address: {
          name: 'Ada Buyer',
          line_one: '12 Example Street',
          city: 'Lagos',
          state: 'LA',
          country: 'NG',
          postal_code: '100001',
        },
      },
      selected_fulfillment_options: [
        {
          item_ids: ['line_product-1'],
          option_id: 'shipping_standard',
          type: 'shipping',
        },
      ],
    });
  });

  it('returns empty ACP fulfillment aliases when no address or option is selected', () => {
    const response = buildCheckoutSessionStateResponse({
      currency: 'NGN',
      fulfillmentOptionId: undefined,
      fulfillmentOptions: [],
      lineItems: [],
      messages: [],
      policyBaseUrl: 'https://shop.example',
      sessionId: 'agentic_session_1',
      shippingAddress: undefined,
      status: 'not_ready_for_payment',
      totals: [],
    });

    expect(response.fulfillment_details).toBeNull();
    expect(response.selected_fulfillment_options).toEqual([]);
  });

  it('falls back to shipping for unknown selected fulfillment option ids', () => {
    const response = buildCheckoutSessionStateResponse({
      currency: 'NGN',
      fulfillmentOptionId: 'manual_shipping',
      fulfillmentOptions: [],
      lineItems: [
        {
          id: 'line_product-1',
          item: {
            id: 'product-1',
            product_id: 'product-1',
            quantity: 1,
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
      totals: [],
    });

    expect(response.selected_fulfillment_options).toEqual([
      {
        item_ids: ['line_product-1'],
        option_id: 'manual_shipping',
        type: 'shipping',
      },
    ]);
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
