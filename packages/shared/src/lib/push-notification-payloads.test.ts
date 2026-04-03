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

    expect(
      getAdminNotificationNavigationTarget({
        type: 'negotiation',
        negotiation_id: 'neg-99',
      })
    ).toEqual({
      screen: 'negotiation',
      params: { id: 'neg-99' },
    });
  });
});

describe('getStorefrontNotificationNavigationTarget', () => {
  it('routes order update payloads to order details using snake_case order_id', () => {
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

  it('routes order update payloads to order details using camelCase orderId', () => {
    expect(
      getStorefrontNotificationNavigationTarget({
        type: 'order_update',
        orderId: 'order-456',
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

  it('returns null for null or undefined payload', () => {
    expect(getStorefrontNotificationNavigationTarget(null)).toBeNull();
    expect(getStorefrontNotificationNavigationTarget(undefined)).toBeNull();
  });

  it('returns home for an unknown notification type', () => {
    expect(
      getStorefrontNotificationNavigationTarget({ type: 'unknown_type' })
    ).toEqual({ screen: 'home' });
  });

  it('falls back to orders list when order_update lacks an order id', () => {
    expect(
      getStorefrontNotificationNavigationTarget({ type: 'order_update' })
    ).toEqual({ screen: 'orders' });
  });

  it('falls back to home when promotion has no slug', () => {
    expect(
      getStorefrontNotificationNavigationTarget({ type: 'promotion' })
    ).toEqual({ screen: 'home' });
  });
});

describe('getAdminNotificationNavigationTarget — edge cases', () => {
  it('returns null for null or undefined payload', () => {
    expect(getAdminNotificationNavigationTarget(null)).toBeNull();
    expect(getAdminNotificationNavigationTarget(undefined)).toBeNull();
  });

  it('returns index for an unknown notification type', () => {
    expect(
      getAdminNotificationNavigationTarget({ type: 'unknown_type' })
    ).toEqual({ screen: 'index' });
  });
});
