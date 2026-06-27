import { describe, expect, it } from '@jest/globals';
import { variantProduct } from '@/lib/product-route/product-detail-screen.fixtures';
import { getSelectionSyncSignature } from './get-selection-sync-signature';

describe('getSelectionSyncSignature', () => {
  it('changes when purchasable variant inventory changes', () => {
    const initialSignature = getSelectionSyncSignature(variantProduct);
    const updatedSignature = getSelectionSyncSignature({
      ...variantProduct,
      variants: variantProduct.variants?.map((variant, index) =>
        index === 0 ? { ...variant, stock_quantity: 0 } : variant
      ),
    });

    expect(initialSignature).not.toBe(updatedSignature);
  });

  it('changes when variant prices change', () => {
    const initialSignature = getSelectionSyncSignature(variantProduct);
    const updatedSignature = getSelectionSyncSignature({
      ...variantProduct,
      variants: variantProduct.variants?.map((variant, index) =>
        index === 1 ? { ...variant, price_override: 1 } : variant
      ),
    });

    expect(initialSignature).not.toBe(updatedSignature);
  });

  it('changes when the base product price changes', () => {
    // The price-first resolver falls back to product.price for variants
    // without an absolute price/override, so a base-price change can flip the
    // cheapest variant and must invalidate the signature.
    const initialSignature = getSelectionSyncSignature(variantProduct);
    const updatedSignature = getSelectionSyncSignature({
      ...variantProduct,
      price: variantProduct.price + 1000,
    });

    expect(initialSignature).not.toBe(updatedSignature);
  });

  it('returns an empty signature when no product is loaded', () => {
    expect(getSelectionSyncSignature(null)).toBe('');
  });

  it('is stable for identical products and observes selection inputs', () => {
    const initialSignature = getSelectionSyncSignature(variantProduct);

    expect(getSelectionSyncSignature(variantProduct)).toBe(initialSignature);
    expect(
      getSelectionSyncSignature({
        ...variantProduct,
        color_images: { Gold: ['https://cdn.example.com/gold.jpg'] },
      })
    ).not.toBe(initialSignature);
    expect(
      getSelectionSyncSignature({
        ...variantProduct,
        images: ['https://cdn.example.com/alternate.jpg'],
      })
    ).not.toBe(initialSignature);
    expect(
      getSelectionSyncSignature({
        ...variantProduct,
        colors: ['Gold'],
      })
    ).not.toBe(initialSignature);
    expect(
      getSelectionSyncSignature({
        ...variantProduct,
        variant_attributes: { storage: ['256GB'] },
      })
    ).not.toBe(initialSignature);
  });

  it('normalizes absent variant rows to an empty array', () => {
    expect(
      getSelectionSyncSignature({ ...variantProduct, variants: undefined })
    ).toBe(getSelectionSyncSignature({ ...variantProduct, variants: [] }));
    expect(
      getSelectionSyncSignature({ ...variantProduct, variants: undefined })
    ).toContain('"variants":[]');
  });
});
