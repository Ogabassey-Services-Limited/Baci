import { describe, expect, it } from 'vitest';
import {
  buildCheckoutSessionInsert,
  buildCheckoutSessionUpdate,
  mapCheckoutSessionStatus,
} from './checkout-storage';

describe('agentic checkout storage', () => {
  it('builds insert payloads using existing checkout_sessions columns', () => {
    const payload = buildCheckoutSessionInsert({
      sessionId: 'agentic_session_1',
      merchantId: 'merchant-1',
      items: [{ id: 'product-1', quantity: 2 }],
      currency: 'NGN',
      fulfillmentAddress: { city: 'Lagos', country: 'NG' },
      fulfillmentOptionId: 'pickup_store_1',
      lineItems: [],
      fulfillmentOptions: [],
      totals: [
        { type: 'subtotal', display_text: 'Subtotal', amount: 2000 },
        { type: 'fulfillment', display_text: 'Delivery', amount: 500 },
        { type: 'total', display_text: 'Total', amount: 2500 },
      ],
      messages: [],
    });

    expect(payload).toMatchObject({
      session_id: 'agentic_session_1',
      merchant_id: 'merchant-1',
      cart_items: [{ id: 'product-1', quantity: 2 }],
      cart_total: 2500,
      subtotal: 2000,
      shipping_cost: 500,
      total_amount: 2500,
      currency: 'NGN',
      shipping_address: { city: 'Lagos', country: 'NG' },
      shipping_method: 'pickup_store_1',
      status: 'pending',
    });
    expect(payload).not.toHaveProperty('items');
    expect(payload).not.toHaveProperty('line_items');
    expect(payload).not.toHaveProperty('fulfillment_address');
    expect(payload.metadata).toMatchObject({
      agentic: {
        line_items: [],
        fulfillment_options: [],
        totals: expect.any(Array),
        messages: [],
      },
    });
  });

  it('maps internal checkout statuses to agent statuses', () => {
    expect(mapCheckoutSessionStatus({ status: 'pending' })).toBe(
      'not_ready_for_payment'
    );
    expect(
      mapCheckoutSessionStatus({
        status: 'processing',
        hasFulfillmentAddress: true,
        hasLineItems: true,
      })
    ).toBe('ready_for_payment');
    expect(mapCheckoutSessionStatus({ status: 'abandoned' })).toBe('canceled');
    expect(mapCheckoutSessionStatus({ status: 'failed' })).toBe('canceled');
    expect(mapCheckoutSessionStatus({ status: 'completed' })).toBe('completed');
  });

  it('never writes agent-only statuses to checkout_sessions.status', () => {
    const payload = buildCheckoutSessionUpdate({
      items: [{ id: 'product-1', quantity: 1 }],
      currency: 'NGN',
      fulfillmentAddress: { city: 'Lagos', country: 'NG' },
      fulfillmentOptionId: 'pickup_store_1',
      lineItems: [],
      fulfillmentOptions: [],
      totals: [{ type: 'total', display_text: 'Total', amount: 1000 }],
      messages: [],
    });

    expect(['pending', 'processing']).toContain(payload.status);
    expect(payload.status).not.toBe('ready_for_payment');
    expect(payload.status).not.toBe('not_ready_for_payment');
    expect(payload.status).not.toBe('payment_pending');
    expect(payload.status).not.toBe('canceled');
  });

  it('uses items_base_amount as the stored subtotal when subtotal is absent', () => {
    const payload = buildCheckoutSessionInsert({
      sessionId: 'agentic_session_1',
      merchantId: 'merchant-1',
      items: [{ id: 'product-1', quantity: 2 }],
      currency: 'NGN',
      fulfillmentAddress: null,
      fulfillmentOptionId: 'pickup_store_1',
      lineItems: [],
      fulfillmentOptions: [],
      totals: [
        {
          type: 'items_base_amount',
          display_text: 'Items Subtotal',
          amount: 2000,
        },
        { type: 'fulfillment', display_text: 'Delivery', amount: 500 },
        { type: 'total', display_text: 'Total', amount: 2500 },
      ],
      messages: [],
    });

    expect(payload.subtotal).toBe(2000);
  });
});
