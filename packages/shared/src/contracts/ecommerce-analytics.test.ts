import { describe, expect, it } from 'vitest';
import {
  buildCheckoutStartedProperties,
  buildCheckoutStepCompletedProperties,
  buildOrderCompletedProperties,
  buildPaymentFailedProperties,
  buildProductAddedProperties,
  buildProductListViewedProperties,
  buildProductRemovedProperties,
  buildProductsSearchedProperties,
  buildProductViewedProperties,
  buildWishlistProductProperties,
  compactAnalyticsProperties,
  ECOMMERCE_ANALYTICS_EVENTS,
  eventForWishlistAction,
} from './ecommerce-analytics';

describe('ecommerce analytics contract', () => {
  it('removes undefined values without dropping valid falsy values', () => {
    expect(
      compactAnalyticsProperties({
        keepFalse: false,
        keepZero: 0,
        keepNull: null,
        dropUndefined: undefined,
        nested: {
          keep: 'value',
          drop: undefined,
        },
        list: [{ keep: true, drop: undefined }, undefined],
      })
    ).toEqual({
      keepFalse: false,
      keepZero: 0,
      keepNull: null,
      nested: { keep: 'value' },
      list: [{ keep: true }],
    });
  });

  it('builds product events with PostHog ecommerce fields and legacy aliases', () => {
    expect(
      buildProductViewedProperties({
        id: 'product-1',
        sku: 'SKU-1',
        name: 'Redmi Note 14',
        price: 220000,
        quantity: 2,
        category: 'Smartphones',
        brand: 'Xiaomi',
        slug: 'redmi-note-14',
        currency: 'NGN',
      })
    ).toEqual({
      product_id: 'product-1',
      sku: 'SKU-1',
      category: 'Smartphones',
      name: 'Redmi Note 14',
      product_name: 'Redmi Note 14',
      brand: 'Xiaomi',
      price: 220000,
      quantity: 2,
      currency: 'NGN',
      value: 440000,
      slug: 'redmi-note-14',
    });
  });

  it('adds cart value to add-to-cart properties', () => {
    expect(
      buildProductAddedProperties(
        {
          id: 'product-1',
          name: 'Redmi Note 14',
          price: 220000,
          quantity: 2,
        },
        440000
      )
    ).toMatchObject({
      product_id: 'product-1',
      name: 'Redmi Note 14',
      currency: 'NGN',
      value: 440000,
      cart_value: 440000,
    });
  });

  it('omits absent optional product fields and still defaults currency', () => {
    expect(
      buildProductRemovedProperties({
        id: 'product-1',
        name: 'Redmi Note 14',
        price: 220000,
      })
    ).toEqual({
      product_id: 'product-1',
      name: 'Redmi Note 14',
      product_name: 'Redmi Note 14',
      price: 220000,
      currency: 'NGN',
      value: 220000,
    });
  });

  it('builds checkout started properties with default currency', () => {
    expect(
      buildCheckoutStartedProperties({
        itemCount: 2,
        subtotal: 440000,
      })
    ).toEqual({
      item_count: 2,
      subtotal: 440000,
      currency: 'NGN',
      value: 440000,
    });
  });

  it('uses numeric and named checkout step fields', () => {
    expect(
      buildCheckoutStepCompletedProperties('payment_method', {
        payment_method: 'paystack',
      })
    ).toEqual({
      checkout_step: 'payment_method',
      step: 'payment_method',
      step_name: 'payment_method',
      step_index: 2,
      payment_method: 'paystack',
    });
  });

  it('builds order completion revenue fields', () => {
    expect(
      buildOrderCompletedProperties({
        orderId: 'order-1',
        orderNumber: 'BAC-001',
        total: 450000,
        subtotal: 440000,
        shipping: 10000,
        currency: 'NGN',
        itemCount: 2,
        paymentMethod: 'card',
      })
    ).toEqual({
      order_id: 'order-1',
      order_number: 'BAC-001',
      total: 450000,
      value: 450000,
      subtotal: 440000,
      shipping: 10000,
      currency: 'NGN',
      item_count: 2,
      payment_method: 'card',
    });
  });

  it('builds payment failure properties without undefined order ids', () => {
    expect(buildPaymentFailedProperties('gateway_timeout')).toEqual({
      reason: 'gateway_timeout',
    });
  });

  it('builds searched product properties with and without filters', () => {
    expect(buildProductsSearchedProperties('redmi', 3)).toEqual({
      query: 'redmi',
      result_count: 3,
    });

    expect(
      buildProductsSearchedProperties('redmi', 3, { brand: 'Xiaomi' })
    ).toEqual({
      query: 'redmi',
      result_count: 3,
      filters: { brand: 'Xiaomi' },
    });
  });

  it('maps category views to PostHog product list viewed semantics', () => {
    expect(
      buildProductListViewedProperties({
        name: 'Smartphones',
        slug: 'smartphones',
        productCount: 24,
      })
    ).toEqual({
      list_id: 'smartphones',
      category: 'Smartphones',
      category_name: 'Smartphones',
      category_slug: 'smartphones',
      product_count: 24,
    });
  });

  it('uses canonical wishlist event names', () => {
    expect(buildWishlistProductProperties({ id: 'p1', name: 'Phone' })).toEqual(
      {
        product_id: 'p1',
        name: 'Phone',
        product_name: 'Phone',
      }
    );
    expect(eventForWishlistAction('added')).toBe(
      ECOMMERCE_ANALYTICS_EVENTS.productAddedToWishlist
    );
    expect(eventForWishlistAction('removed')).toBe(
      ECOMMERCE_ANALYTICS_EVENTS.productRemovedFromWishlist
    );
  });
});
