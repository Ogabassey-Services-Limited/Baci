import { describe, expect, it } from 'vitest';
import { orderFulfillmentNotificationSchemas } from './order-fulfillment-notification-schemas';

describe('orderFulfillmentNotificationSchemas', () => {
  it('normalizes legacy string shipping addresses', () => {
    const result = orderFulfillmentNotificationSchemas.order.safeParse({
      id: 'order-1',
      customer_id: null,
      order_number: 'ORD-1',
      customer_name: 'Customer',
      customer_email: 'customer@example.com',
      customer_phone: null,
      shipping_status: 'delivered',
      shipping_provider: null,
      tracking_number: null,
      tracking_token: null,
      shipping_address: '1 Legacy Street',
      order_items: [],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.shipping_address).toEqual({
        address: '1 Legacy Street',
      });
    }
  });

  it('rejects unknown fulfillment statuses', () => {
    const result = orderFulfillmentNotificationSchemas.order.safeParse({
      id: 'order-1',
      order_number: 'ORD-1',
      shipping_status: 'lost_in_transit',
      order_items: [],
    });

    expect(result.success).toBe(false);
  });
});
