import { describe, expect, it } from 'vitest';
import { validateAgenticDvaCutoverSnapshot } from './agentic-dva-cutover-snapshot';

const snapshot = {
  lineItems: [
    {
      base_amount: 500000,
      discount: 0,
      id: 'line-1',
      item: { id: 'product-1', product_id: 'product-1', quantity: 1 },
      subtotal: 500000,
      tax: 0,
      total: 500000,
    },
  ],
  totals: [
    { amount: 500000, display_text: 'Subtotal', type: 'subtotal' as const },
    { amount: 0, display_text: 'Shipping', type: 'fulfillment' as const },
    { amount: 500000, display_text: 'Total', type: 'total' as const },
  ],
};

describe('validateAgenticDvaCutoverSnapshot', () => {
  it('accepts an exact stored cart and amount snapshot', () => {
    const result = validateAgenticDvaCutoverSnapshot(record(), snapshot);

    expect(result).toBeNull();
  });

  it('rejects cart and amount drift', () => {
    const cartDrift = validateAgenticDvaCutoverSnapshot(
      record({ cart_items: [{ id: 'product-2', quantity: 1 }] }),
      snapshot
    );
    const totalDrift = validateAgenticDvaCutoverSnapshot(
      record({ total_amount: 499999 }),
      snapshot
    );
    const quantityDrift = validateAgenticDvaCutoverSnapshot(
      record({ cart_items: [{ id: 'product-1', quantity: 2 }] }),
      snapshot
    );
    const missingShippingAmount = validateAgenticDvaCutoverSnapshot(
      record({ shipping_cost: null }),
      snapshot
    );

    expect(cartDrift).toBe('cart_snapshot_mismatch');
    expect(quantityDrift).toBe('cart_snapshot_mismatch');
    expect(totalDrift).toBe('amount_snapshot_mismatch');
    expect(missingShippingAmount).toBe('amount_snapshot_mismatch');
  });

  it('rejects an invalid payment snapshot', () => {
    const result = validateAgenticDvaCutoverSnapshot(record(), {
      ...snapshot,
      lineItems: [],
    });

    expect(result).toBe('payment_snapshot_invalid');
  });
});

function record(overrides: Record<string, unknown> = {}) {
  return {
    cart_items: [{ id: 'product-1', quantity: 1 }],
    shipping_cost: 0,
    subtotal: 500000,
    total_amount: 500000,
    ...overrides,
  };
}
