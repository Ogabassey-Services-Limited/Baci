import { describe, expect, it } from 'vitest';
import { getOrderItemVariantSummary } from './new-order-item-variant-summary';

describe('getOrderItemVariantSummary', () => {
  it('prefers the stored variant name when present', () => {
    expect(
      getOrderItemVariantSummary({
        condition: 'open_box',
        variant_attributes: { Storage: '128GB' },
        variant_name: 'Burgundy / 128GB',
      })
    ).toBe('Burgundy / 128GB');
  });

  it('falls back to formatted attributes before condition', () => {
    expect(
      getOrderItemVariantSummary({
        condition: 'used',
        variant_attributes: { Storage: '256GB' },
        variant_name: null,
      })
    ).toBe('256GB');
  });

  it('summarizes condition-only variants so their change action can render', () => {
    expect(
      getOrderItemVariantSummary({
        condition: 'open_box',
        variant_attributes: null,
        variant_name: null,
      })
    ).toBe('Open Box');
  });
});
