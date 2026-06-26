import { describe, expect, it } from 'vitest';
import { enrichBumpaOrderItems } from './enrich-bumpa-order-items';

describe('enrichBumpaOrderItems', () => {
  it('adds Bumpa metadata to bare imported items', () => {
    const [item] = enrichBumpaOrderItems([
      {
        productId: null,
        productName: 'Samsung S23 256gb (Open Box)',
        sku: null,
        quantity: 1,
        unitPrice: 500000,
        lineTotal: 500000,
        matched: false,
        matchSource: 'unmatched',
      },
    ]);

    expect(item.importMetadata).toMatchObject({
      bumpa: {
        normalized_product_name: 'Samsung S23 256GB (Open Box)',
        product_kind: 'device',
      },
    });
  });

  it('preserves existing metadata while adding Bumpa metadata', () => {
    const [item] = enrichBumpaOrderItems([
      {
        productId: null,
        productName: 'Samsung S23 256gb (Open Box)',
        sku: null,
        quantity: 1,
        unitPrice: 500000,
        lineTotal: 500000,
        matched: false,
        matchSource: 'unmatched',
        importMetadata: { upstream: { matchedBy: 'sku' } },
      },
    ]);

    expect(item.importMetadata).toMatchObject({
      upstream: { matchedBy: 'sku' },
      bumpa: {
        normalized_product_name: 'Samsung S23 256GB (Open Box)',
        product_kind: 'device',
      },
    });
  });

  it('adds fallback Bumpa metadata when the product name is blank', () => {
    const [item] = enrichBumpaOrderItems([
      {
        productId: null,
        productName: '',
        sku: null,
        quantity: 1,
        unitPrice: 500000,
        lineTotal: 500000,
        matched: false,
        matchSource: 'unmatched',
      },
    ]);

    expect(item.importMetadata).toMatchObject({
      bumpa: {
        normalized_product_name: 'Unidentified Product',
        analytics_product_key: 'unidentified-product',
      },
    });
  });
});
