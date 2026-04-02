import { describe, expect, it } from '@jest/globals';
import {
  CUSTOMER_ORDER_PROGRESS_STEPS,
  getCustomerOrderProgressIndex,
  getCustomerOrderProgressState,
  getCustomerOrderStatusKey,
  getCustomerOrderStatusMeta,
  isCustomerOrderClosed,
} from './customer-order-status';

describe('customer order status helpers', () => {
  it('maps internal fulfillment states to customer-facing statuses', () => {
    expect(getCustomerOrderStatusKey('pending')).toBe('placed');
    expect(getCustomerOrderStatusKey('processing')).toBe('confirmed');
    expect(getCustomerOrderStatusKey('confirmed')).toBe('confirmed');
  });

  it('treats out for delivery as on the way', () => {
    expect(getCustomerOrderStatusKey('out_for_delivery')).toBe('shipped');
    expect(getCustomerOrderStatusMeta('out_for_delivery')).toMatchObject({
      label: 'Shipped',
      icon: 'car-outline',
    });
  });

  it('maps terminal statuses consistently', () => {
    expect(getCustomerOrderStatusKey('cancelled')).toBe('cancelled');
    expect(getCustomerOrderStatusKey('refunded')).toBe('cancelled');
    expect(getCustomerOrderStatusKey('returned')).toBe('returned');
    expect(isCustomerOrderClosed('cancelled')).toBe(true);
    expect(isCustomerOrderClosed('returned')).toBe(true);
    expect(isCustomerOrderClosed('shipped')).toBe(false);
  });

  it('returns progress indices only for active delivery states', () => {
    expect(getCustomerOrderProgressIndex('pending')).toBe(0);
    expect(getCustomerOrderProgressIndex('processing')).toBe(1);
    expect(getCustomerOrderProgressIndex('shipped')).toBe(2);
    expect(getCustomerOrderProgressIndex('delivered')).toBe(3);
    expect(getCustomerOrderProgressIndex('cancelled')).toBe(-1);
  });

  it('derives progress state for each customer step', () => {
    const shippedStates = CUSTOMER_ORDER_PROGRESS_STEPS.map((step) =>
      getCustomerOrderProgressState('shipped', step.key)
    );

    expect(shippedStates).toEqual([
      'completed',
      'completed',
      'current',
      'upcoming',
    ]);
  });
});
