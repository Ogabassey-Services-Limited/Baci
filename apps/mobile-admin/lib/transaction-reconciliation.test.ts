import { describe, expect, it } from 'vitest';
import { rankReconciliationCandidates } from './transaction-reconciliation';

describe('rankReconciliationCandidates', () => {
  it('suggests a high confidence variant match when tokens and price line up', () => {
    const [match] = rankReconciliationCandidates({
      item: {
        id: 'item-1',
        name: 'iPhone 11 Pro 64gb Premium Used [IMEI: 353232106161443]',
        price: 180000,
      },
      products: [
        {
          productId: 'iphone-11-pro',
          variantId: 'variant-1',
          name: '64GB Premium Used',
          parentName: 'iPhone 11 Pro',
          price: 180000,
          status: 'active',
        },
      ],
    });

    expect(match).toMatchObject({
      confidence: 'high',
      label: 'iPhone 11 Pro 64GB Premium Used',
      productId: 'iphone-11-pro',
      variantId: 'variant-1',
    });
  });

  it('keeps price-mismatched matches low confidence', () => {
    const [match] = rankReconciliationCandidates({
      item: {
        id: 'item-1',
        name: 'iPhone 11 Pro 64gb Premium Used',
        price: 180000,
      },
      products: [
        {
          productId: 'product-1',
          variantId: null,
          name: 'iPhone 11 Pro',
          parentName: null,
          price: 450000,
          status: 'active',
        },
      ],
    });

    expect(match).toMatchObject({
      confidence: 'low',
      productId: 'product-1',
      variantId: null,
    });
  });
});
