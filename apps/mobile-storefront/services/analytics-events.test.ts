import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { trackEvent } from './analytics-core';
import {
  trackAddToCart,
  trackCategoryViewed,
  trackError,
  trackOrderCompleted,
  trackPaymentFailed,
  trackProductViewed,
  trackSearch,
  trackWishlistAction,
} from './analytics-events';

jest.mock('./analytics-core', () => ({
  trackEvent: jest.fn(),
}));

describe('analytics event wrappers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tracks product views with PostHog ecommerce fields', () => {
    trackProductViewed({
      id: 'product-1',
      name: 'Redmi Note 14',
      price: 220000,
      category: 'Phones',
      slug: 'redmi-note-14',
    });

    expect(trackEvent).toHaveBeenCalledWith('Product Viewed', {
      product_id: 'product-1',
      category: 'Phones',
      name: 'Redmi Note 14',
      product_name: 'Redmi Note 14',
      price: 220000,
      currency: 'NGN',
      value: 220000,
      slug: 'redmi-note-14',
    });
  });

  it('tracks add-to-cart and order completion with checkout context', () => {
    trackAddToCart(
      {
        id: 'product-1',
        name: 'Redmi Note 14',
        price: 220000,
        quantity: 2,
        currency: 'NGN',
      },
      440000
    );
    trackOrderCompleted({
      orderId: 'order-1',
      orderNumber: 'BAC-001',
      total: 450000,
      subtotal: 440000,
      shipping: 10000,
      itemCount: 2,
      paymentMethod: 'card',
    });

    expect(trackEvent).toHaveBeenNthCalledWith(1, 'Product Added', {
      product_id: 'product-1',
      name: 'Redmi Note 14',
      product_name: 'Redmi Note 14',
      price: 220000,
      quantity: 2,
      currency: 'NGN',
      value: 440000,
      cart_value: 440000,
    });
    expect(trackEvent).toHaveBeenNthCalledWith(
      2,
      'Order Completed',
      expect.objectContaining({
        order_id: 'order-1',
        order_number: 'BAC-001',
        value: 450000,
        payment_method: 'card',
      })
    );
  });

  it('tracks discovery and error events', () => {
    trackSearch('iphone', 7, { condition: 'new' });
    trackError('stock_check', 'Unavailable', { product_id: 'product-1' });

    expect(trackEvent).toHaveBeenNthCalledWith(1, 'Products Searched', {
      query: 'iphone',
      result_count: 7,
      filters: { condition: 'new' },
    });
    expect(trackEvent).toHaveBeenNthCalledWith(2, 'Error', {
      error_type: 'stock_check',
      error_message: 'Unavailable',
      product_id: 'product-1',
    });
  });

  it('tracks category and wishlist events with canonical ecommerce names', () => {
    trackCategoryViewed('Smartphones', 'smartphones', 24);
    trackWishlistAction('added', {
      id: 'product-1',
      name: 'Redmi Note 14',
    });

    expect(trackEvent).toHaveBeenNthCalledWith(1, 'Product List Viewed', {
      list_id: 'smartphones',
      category: 'Smartphones',
      category_name: 'Smartphones',
      category_slug: 'smartphones',
      product_count: 24,
    });
    expect(trackEvent).toHaveBeenNthCalledWith(2, 'Product Added to Wishlist', {
      product_id: 'product-1',
      name: 'Redmi Note 14',
      product_name: 'Redmi Note 14',
    });
  });

  it('tracks wishlist removal with the canonical ecommerce name', () => {
    trackWishlistAction('removed', {
      id: 'product-1',
      name: 'Redmi Note 14',
    });

    expect(trackEvent).toHaveBeenCalledWith('Product Removed from Wishlist', {
      product_id: 'product-1',
      name: 'Redmi Note 14',
      product_name: 'Redmi Note 14',
    });
  });

  it('compacts optional fields before forwarding analytics properties', () => {
    trackPaymentFailed('gateway_timeout');
    trackSearch('iphone', 0);

    expect(trackEvent).toHaveBeenNthCalledWith(1, 'Payment Failed', {
      reason: 'gateway_timeout',
    });
    expect(trackEvent).toHaveBeenNthCalledWith(2, 'Products Searched', {
      query: 'iphone',
      result_count: 0,
    });
  });
});
