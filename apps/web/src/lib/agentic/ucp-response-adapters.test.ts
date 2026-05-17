import { NextResponse } from 'next/server';
import { describe, expect, it } from 'vitest';
import {
  adaptCheckoutResponseToUcp,
  buildUcpCheckoutResponse,
  buildUcpOrderResponse,
} from '@/lib/agentic/ucp-response-adapters';

describe('buildUcpCheckoutResponse', () => {
  it('adds UCP metadata and normalizes checkout status, line items, and totals', () => {
    const response = buildUcpCheckoutResponse({
      currency: 'ngn',
      id: 'checkout_1',
      line_items: [
        {
          base_amount: 200_000,
          id: 'line_product_1',
          item: {
            id: 'product_1',
            product_id: 'product_1',
            quantity: 2,
            title: 'Laptop',
          },
          subtotal: 200_000,
          total: 200_000,
        },
      ],
      links: [],
      status: 'ready_for_payment',
      totals: [
        { amount: 200_000, display_text: 'Items', type: 'items_base_amount' },
        { amount: 200_000, display_text: 'Total', type: 'total' },
      ],
    });

    expect(response).toMatchObject({
      status: 'ready_for_complete',
      ucp: {
        capabilities: {
          'dev.ucp.shopping.checkout': [{ version: '2026-04-08' }],
        },
        payment_handlers: {},
        status: 'success',
        version: '2026-04-08',
      },
    });
    expect(response).toMatchObject({
      line_items: [
        {
          item: { id: 'product_1', price: 100_000, title: 'Laptop' },
          quantity: 2,
        },
      ],
      totals: [
        { amount: 200_000, display_text: 'Items', type: 'subtotal' },
        { amount: 200_000, display_text: 'Total', type: 'total' },
      ],
    });
  });

  it('leaves error responses untouched when wrapping route responses', async () => {
    const response = NextResponse.json({ error: 'Invalid' }, { status: 400 });

    const adapted = await adaptCheckoutResponseToUcp(response);

    expect(adapted.status).toBe(400);
    expect(await adapted.json()).toEqual({ error: 'Invalid' });
  });
});

describe('buildUcpOrderResponse', () => {
  it('adds required UCP order fields while preserving legacy fields', () => {
    const response = buildUcpOrderResponse({
      currency: 'ngn',
      id: 'order_1',
      links: { track_order: 'https://shop.example/track-order' },
      order_items: [
        {
          id: 'item_1',
          line_extension_amount: 150_000,
          name: 'Phone',
          price: 150_000,
          product_id: 'product_1',
          quantity: 1,
        },
      ],
      order_number: 'BACI-1',
      payment_status: 'pending',
      shipping_fee: 2_500,
      shipping_status: 'pending',
      subtotal: 150_000,
      total: 152_500,
      updated_at: '2026-05-17T09:00:00.000Z',
    });

    expect(response).toMatchObject({
      checkout_id: 'order_1',
      currency: 'NGN',
      id: 'order_1',
      order_number: 'BACI-1',
      permalink_url: 'https://shop.example/track-order',
      fulfillment: {
        events: [
          {
            status: 'pending',
            timestamp: '2026-05-17T09:00:00.000Z',
          },
        ],
        expectations: [],
      },
      ucp: {
        capabilities: {
          'dev.ucp.shopping.order': [{ version: '2026-04-08' }],
        },
        status: 'success',
        version: '2026-04-08',
      },
    });
    expect(response).toMatchObject({
      line_items: [
        {
          item: { id: 'product_1', price: 150_000, title: 'Phone' },
          quantity: { fulfilled: 0, total: 1 },
          status: 'processing',
        },
      ],
      totals: [
        { amount: 150_000, display_text: 'Subtotal', type: 'subtotal' },
        { amount: 2_500, display_text: 'Shipping', type: 'fulfillment' },
        { amount: 152_500, display_text: 'Total', type: 'total' },
      ],
    });
  });
});
