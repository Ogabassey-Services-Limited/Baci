import { describe, expect, it } from 'vitest';
import { TRANSACTION_REVIEW_SELECTORS } from './transaction-review-selectors';

describe('transaction review selectors', () => {
  it('retains discount provenance in the line-id compatibility selector', () => {
    const selector = TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoLineId;

    expect(selector).toContain('discount_amount');
    expect(selector).toContain('ad_tracking');
    expect(selector).not.toContain('order_items(id, line_id');
  });

  it('provides a final selector that does not require variant_id', () => {
    const selector = TRANSACTION_REVIEW_SELECTORS.baseWithDiscountNoVariantId;

    expect(selector).toContain('discount_amount');
    expect(selector).toContain('ad_tracking');
    expect(selector).toContain('line_id');
    expect(selector).toContain('external_source');
    expect(selector).not.toContain('variant_id');
  });

  it('uses a minimal final selector when optional item columns are unavailable', () => {
    const selector = TRANSACTION_REVIEW_SELECTORS.noVariantId;

    expect(selector).toContain('discount_amount');
    expect(selector).toContain('external_source');
    expect(selector).not.toContain('line_id');
    expect(selector).not.toContain('variant_id');
    expect(selector).not.toContain('variant_attributes');
    expect(selector).not.toContain('condition');
  });

  it('keeps cost relationships when adjustment columns are unavailable', () => {
    const selector = TRANSACTION_REVIEW_SELECTORS.legacyNoAdjustments;

    expect(selector).toContain('cost_price');
    expect(selector).toContain('order_item_unit_costs');
    expect(selector).toContain('product_variants');
    expect(selector).not.toContain('assurance_fee');
    expect(selector).not.toContain('vat_category_code');
    expect(selector).not.toContain('vat_rate');
  });

  it('keeps cost relationships when variant attributes are unavailable', () => {
    const selector = TRANSACTION_REVIEW_SELECTORS.legacyNoVariantAttributes;

    expect(selector).not.toContain('variant_attributes');
    expect(selector).toContain('variant_id');
    expect(selector).toContain('cost_price');
    expect(selector).toContain('order_item_unit_costs');
    expect(selector).toContain('product_variants');
  });

  it('keeps cost relationships when discount code ids are unavailable', () => {
    const selector = TRANSACTION_REVIEW_SELECTORS.legacyNoDiscountCode;

    expect(selector).not.toContain('discount_code_id');
    expect(selector).toContain('cost_price');
    expect(selector).toContain('assurance_fee');
    expect(selector).toContain('vat_category_code');
    expect(selector).toContain('vat_rate');
    expect(selector).toContain('order_item_unit_costs');
    expect(selector).toContain('product_variants');
  });

  it('keeps a cost fallback when adjustment columns are unavailable too', () => {
    const selector =
      TRANSACTION_REVIEW_SELECTORS.legacyNoAdjustmentsNoDiscountCode;

    expect(selector).not.toContain('discount_code_id');
    expect(selector).toContain('cost_price');
    expect(selector).toContain('order_item_unit_costs');
    expect(selector).toContain('product_variants');
    expect(selector).not.toContain('assurance_fee');
  });
});
