import { describe, expect, it } from 'vitest';
import {
  buildUcpCartInsert,
  buildUcpCartUpdate,
  mapUcpCartStatus,
} from './ucp-cart-storage';

describe('ucp cart storage', () => {
  it('builds a merchant-scoped cart insert', () => {
    expect(
      buildUcpCartInsert({
        cartId: 'cart_123',
        currency: 'ngn',
        items: [{ id: 'product-1', quantity: 2 }],
        merchantId: 'merchant-1',
        metadata: { source: 'ucp' },
      })
    ).toMatchObject({
      cart_id: 'cart_123',
      cart_items: [{ id: 'product-1', quantity: 2 }],
      currency: 'NGN',
      merchant_id: 'merchant-1',
      status: 'active',
    });
  });

  it('does not clear buyer context on line item updates', () => {
    expect(
      buildUcpCartUpdate({
        existingBuyer: { email: 'buyer@example.com' },
        items: [{ id: 'product-2', quantity: 1 }],
      })
    ).toMatchObject({
      buyer: { email: 'buyer@example.com' },
      cart_items: [{ id: 'product-2', quantity: 1 }],
      status: 'active',
    });
  });

  it('maps internal statuses to UCP statuses', () => {
    expect(mapUcpCartStatus('active')).toBe('active');
    expect(mapUcpCartStatus('converted')).toBe('converted');
    expect(mapUcpCartStatus('canceled')).toBe('canceled');
    expect(mapUcpCartStatus('expired')).toBe('expired');
  });
});
