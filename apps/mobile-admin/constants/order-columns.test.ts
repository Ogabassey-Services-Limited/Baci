import { describe, expect, it } from 'vitest';
import { ORDER_COLUMNS } from './order-columns';

describe('ORDER_COLUMNS', () => {
  it('does not request stale order columns that break mobile queries', () => {
    expect(ORDER_COLUMNS).not.toContain('customer_address');
    expect(ORDER_COLUMNS).not.toContain('discount_code');
  });

  it('keeps the fields required by the orders list and detail screens', () => {
    expect(ORDER_COLUMNS).toContain('shipping_address');
    expect(ORDER_COLUMNS).toContain('amount_paid');
    expect(ORDER_COLUMNS).toContain('is_credit_order');
    expect(ORDER_COLUMNS).toContain('recorded_by_user_id');
    expect(ORDER_COLUMNS).toContain('fulfillment_details');
  });
});
