import { describe, expect, it } from 'vitest';
import { orderListRowSchema } from './order-list-row';

describe('orderListRowSchema', () => {
  it('normalizes legacy fulfilled shipping status to delivered', () => {
    const parsed = orderListRowSchema.parse({
      id: 'order-1',
      order_items: [{ id: 'item-1' }],
      payment_status: 'paid',
      shipping_status: 'fulfilled',
    });

    expect(parsed.shipping_status).toBe('delivered');
  });

  it('rejects unsupported payment and shipping statuses', () => {
    expect(
      orderListRowSchema.safeParse({
        id: 'order-1',
        order_items: [],
        payment_status: 'settled',
        shipping_status: 'unknown',
      }).success
    ).toBe(false);
  });
});
