import { describe, expect, it } from 'vitest';
import { buildTransactionDiscountLineKey } from './transaction-discount-line-key';

describe('buildTransactionDiscountLineKey', () => {
  it('canonicalizes variant-attribute order for the same persisted line', () => {
    const first = buildTransactionDiscountLineKey({
      condition: 'new',
      productId: 'product-1',
      variantAttributes: { Color: 'Blue', Storage: '128GB' },
      variantId: 'variant-1',
    });
    const second = buildTransactionDiscountLineKey({
      condition: 'new',
      productId: 'product-1',
      variantAttributes: { Storage: '128GB', Color: 'Blue' },
      variantId: 'variant-1',
    });

    expect(first).toBe(second);
  });

  it('distinguishes persisted lines with different attributes', () => {
    const blue = buildTransactionDiscountLineKey({
      productId: 'product-1',
      variantAttributes: { Color: 'Blue' },
      variantId: 'variant-1',
    });
    const green = buildTransactionDiscountLineKey({
      productId: 'product-1',
      variantAttributes: { Color: 'Green' },
      variantId: 'variant-1',
    });

    expect(blue).not.toBe(green);
  });

  it('canonicalizes omitted optional fields as their persisted defaults', () => {
    const omitted = buildTransactionDiscountLineKey({
      productId: 'product-1',
      variantId: null,
    });
    const explicitDefaults = buildTransactionDiscountLineKey({
      condition: null,
      productId: 'product-1',
      variantAttributes: null,
      variantId: null,
    });

    expect(omitted).toBe('["product-1",null,null,{}]');
    expect(explicitDefaults).toBe(omitted);
  });

  it('orders locale-sensitive attribute keys by code point', () => {
    const key = buildTransactionDiscountLineKey({
      productId: 'product-1',
      variantAttributes: { z: 'last', '\u00e4': 'accent' },
      variantId: null,
    });

    expect(key).toBe('["product-1",null,null,{"z":"last","ä":"accent"}]');
  });
});
