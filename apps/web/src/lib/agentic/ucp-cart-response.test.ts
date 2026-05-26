import { describe, expect, it } from 'vitest';
import { buildUcpCartResponse } from './ucp-cart-response';

describe('buildUcpCartResponse', () => {
  it('returns a stable cart resource', () => {
    expect(
      buildUcpCartResponse({
        cartId: 'cart_123',
        continueUrl:
          'https://ogabassey.com/ogabassey/cart?agentic_cart_id=cart_123',
        currency: 'NGN',
        lineItems: [
          {
            base_amount: 2000,
            discount: 0,
            id: 'line_product_1',
            item: {
              id: 'product-1',
              product_id: 'product-1',
              quantity: 2,
              title: 'iPhone 15',
            },
            subtotal: 2000,
            tax: 0,
            total: 2000,
          },
        ],
        status: 'active',
        totals: [{ amount: 2000, display_text: 'Total', type: 'total' }],
      })
    ).toMatchObject({
      continue_url:
        'https://ogabassey.com/ogabassey/cart?agentic_cart_id=cart_123',
      id: 'cart_123',
      line_items: [
        {
          id: 'line_product_1',
          item: { id: 'product-1', title: 'iPhone 15' },
          quantity: 2,
          totals: [
            { amount: 2000, display_text: 'Subtotal', type: 'subtotal' },
            { amount: 2000, display_text: 'Total', type: 'total' },
          ],
        },
      ],
      status: 'active',
      totals: [{ amount: 2000, display_text: 'Total', type: 'total' }],
      ucp: {
        capabilities: {
          'dev.ucp.shopping.cart': [{ version: '2026-04-08' }],
        },
        version: '2026-04-08',
      },
    });
  });
});
