import { describe, expect, it } from 'vitest';
import { PAID_ORDER_RICH_SELECT } from '@/lib/payments/paid-order-rich-select';

describe('PAID_ORDER_RICH_SELECT', () => {
  it('never reintroduces order_items.subtotal (PR #2999 regression)', () => {
    const orderItemsProjection =
      PAID_ORDER_RICH_SELECT.match(/order_items\(([^)]*)\)/)?.[1] ?? '';

    expect(orderItemsProjection).toBe(
      'id, product_id, condition, name, price, quantity, variant_name'
    );
    expect(orderItemsProjection).not.toContain('subtotal');
  });

  it('keeps the outbox financial-consistency columns', () => {
    for (const column of [
      'tax_basis',
      'gift_wrapping_fee',
      'tax_amount',
      'discount_amount',
      'ad_tracking',
    ]) {
      expect(PAID_ORDER_RICH_SELECT).toContain(column);
    }
  });
});
