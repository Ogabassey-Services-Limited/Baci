import { describe, expect, it } from 'vitest';
import {
  getAdminNotificationNavigationTarget,
  getStorefrontNotificationNavigationTarget,
} from './push-notification-payloads';

describe('getAdminNotificationNavigationTarget', () => {
  it('routes new order payloads directly to the order when order_id is present', () => {
    expect(
      getAdminNotificationNavigationTarget({
        type: 'new_order',
        order_id: 'order-123',
      })
    ).toEqual({
      screen: 'order',
      params: { id: 'order-123' },
    });
  });

  it('falls back to the orders list when the admin payload lacks an order id', () => {
    expect(
      getAdminNotificationNavigationTarget({
        type: 'payment_received',
        order_number: 'ORD-123',
      })
    ).toEqual({ screen: 'orders' });
  });

  it('supports negotiation payloads using camelCase or snake_case ids', () => {
    expect(
      getAdminNotificationNavigationTarget({
        type: 'negotiation',
        negotiationId: 'neg-42',
      })
    ).toEqual({
      screen: 'negotiation',
      params: { id: 'neg-42' },
    });
  });
});

describe('getStorefrontNotificationNavigationTarget', () => {
  it('routes order update payloads to order details using either orderId key', () => {
    expect(
      getStorefrontNotificationNavigationTarget({
        type: 'order_update',
        order_id: 'order-456',
      })
    ).toEqual({
      screen: 'order-details',
      params: { id: 'order-456' },
    });
  });

  it('routes promotions to product or category pages based on available slug', () => {
    expect(
      getStorefrontNotificationNavigationTarget({
        type: 'promotion',
        productSlug: 'iphone-17',
      })
    ).toEqual({
      screen: 'product',
      params: { slug: 'iphone-17' },
    });

    expect(
      getStorefrontNotificationNavigationTarget({
        type: 'promotion',
        category_slug: 'laptops',
      })
    ).toEqual({
      screen: 'category',
      params: { slug: 'laptops' },
    });
  });
});
