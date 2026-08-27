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
});
