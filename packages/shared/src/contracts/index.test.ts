import { describe, expect, it } from 'vitest';
import {
  BACI_ADMIN_SCHEME,
  buildCustomerFullName,
  buildOrderCompletedProperties,
  ECOMMERCE_ANALYTICS_EVENTS,
  JUMIA_MOBILE_RETURN_PATH,
  MOBILE_ADMIN_ORDER_COLUMNS,
  MOBILE_ADMIN_PRODUCT_COLUMNS,
  normalizeRegisteredAddress,
  PAYMENT_METHOD_SETTING_DEFINITIONS,
  TRUST_PROFILE_RETURN_METHODS,
  WEB_ORDER_COLUMNS,
  WEB_PRODUCT_COLUMNS,
} from './index';

describe('contracts barrel', () => {
  it('re-exports shared contract helpers and constants', () => {
    expect(buildCustomerFullName('Ada', 'Lovelace')).toBe('Ada Lovelace');
    expect(
      buildOrderCompletedProperties({
        itemCount: 1,
        orderId: 'order-1',
        orderNumber: 'BAC-001',
        subtotal: 220000,
        total: 220000,
      })
    ).toBeDefined();
    expect(ECOMMERCE_ANALYTICS_EVENTS.orderCompleted).toBe('Order Completed');
    expect(BACI_ADMIN_SCHEME).toBe('baciadmin');
    expect(JUMIA_MOBILE_RETURN_PATH).toBe('/sales-channels');
    expect(MOBILE_ADMIN_ORDER_COLUMNS).toContain('merchant_id');
    expect(WEB_ORDER_COLUMNS).toContain('merchant_id');
    expect(MOBILE_ADMIN_PRODUCT_COLUMNS).toContain('stock_quantity');
    expect(WEB_PRODUCT_COLUMNS).toContain('merchant_id');
    expect(normalizeRegisteredAddress({ city: ' Lagos ' })).toEqual({
      city: 'Lagos',
      country: null,
      postal_code: null,
      state: null,
      street: null,
    });
    expect(PAYMENT_METHOD_SETTING_DEFINITIONS.length).toBeGreaterThan(0);
    expect(TRUST_PROFILE_RETURN_METHODS).toContain('in_store');
  });
});
