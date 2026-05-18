import { describe, expect, it } from 'vitest';
import { requiresProductSelection } from './product-selection-required';

describe('requiresProductSelection', () => {
  it('requires product-detail selection for sku_matrix products', () => {
    expect(
      requiresProductSelection({
        variant_model: 'sku_matrix',
        has_variants: true,
      })
    ).toBe(true);
  });

  it('requires product-detail selection for products with variant rows', () => {
    expect(
      requiresProductSelection({
        has_variants: true,
        variant_model: 'legacy',
      })
    ).toBe(true);
  });

  it('requires product-detail selection for condition-offer products', () => {
    expect(
      requiresProductSelection({
        has_condition_offers: true,
        available_conditions: ['new'],
      })
    ).toBe(true);
  });

  it('requires product-detail selection for products with multiple conditions', () => {
    expect(
      requiresProductSelection({
        has_variants: false,
        available_conditions: ['open_box', 'used'],
      })
    ).toBe(true);
  });

  it('requires product-detail selection for legacy saved records without trusted metadata', () => {
    expect(
      requiresProductSelection(
        {
          available_conditions: undefined,
        },
        { metadataTrust: 'legacy-saved-record' }
      )
    ).toBe(true);
  });

  it('allows direct quick-add for simple products with trusted metadata', () => {
    expect(
      requiresProductSelection({
        has_variants: false,
        has_condition_offers: false,
        available_conditions: ['new'],
        variant_model: 'legacy',
      })
    ).toBe(false);
  });

  it('requires product-detail selection for iPhone 15-style mixed-condition SKU matrices', () => {
    expect(
      requiresProductSelection({
        has_variants: true,
        variant_model: 'sku_matrix',
        available_conditions: ['open_box', 'used'],
        variants: [
          {
            id: 'iphone-15-open-box-esim',
            condition: 'open_box',
            attributes: { storage: '128GB', sim_type: 'eSIM' },
          },
          {
            id: 'iphone-15-used-physical',
            condition: 'used',
            attributes: { storage: '128GB', sim_type: 'Physical SIM' },
          },
        ],
      })
    ).toBe(true);
  });
});
