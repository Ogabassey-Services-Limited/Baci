import { describe, expect, it } from 'vitest';
import {
  buildBumpaOrderItemSnapshot,
  normalizeBumpaConditionForCatalog,
  stripBumpaReceiptConditionFromName,
} from './bumpa-order-item-snapshot';
import type { ExistingImportedProduct } from './bumpa-types';

function product(
  overrides: Partial<ExistingImportedProduct> = {}
): ExistingImportedProduct {
  return {
    externalId: null,
    externalSource: null,
    id: 'product-1',
    images: [],
    name: 'Samsung Galaxy Z Fold 5 / Z Fold 5 12GB 512GB',
    price: 930_000,
    sku: null,
    status: 'active',
    ...overrides,
  };
}

describe('Bumpa order item snapshots', () => {
  it('uses matched catalog names and images while preserving imported condition as a variant label', () => {
    const snapshot = buildBumpaOrderItemSnapshot({
      importedProductName: 'Samsung Galaxy Fold 5 512GB (Premium Used)',
      importMetadata: {
        bumpa: {
          condition: 'Premium Used',
        },
      },
      matchedProduct: product({
        images: ['https://cdn.example.com/fold-5.jpg'],
      }),
    });

    expect(snapshot).toEqual({
      condition: 'used',
      imageUrl: 'https://cdn.example.com/fold-5.jpg',
      productName: 'Samsung Galaxy Z Fold 5 / Z Fold 5 12GB 512GB',
      variantName: 'Used',
    });
  });

  it('strips condition text from unmatched imported names for receipt display', () => {
    const snapshot = buildBumpaOrderItemSnapshot({
      importedProductName: 'Pixel 7a 128gb Open Box',
      importMetadata: {},
      matchedProduct: null,
    });

    expect(snapshot).toMatchObject({
      condition: 'open_box',
      productName: 'Pixel 7a 128gb',
      variantName: 'Open Box',
    });
  });

  it('does not leave bracket residue when stripping receipt condition text', () => {
    expect(
      stripBumpaReceiptConditionFromName('HP EliteBook (UK Used) [New Screen]')
    ).toBe('HP EliteBook [New Screen]');
    expect(
      stripBumpaReceiptConditionFromName(
        'HP EliteBook || 8GB || 256GB SSD || UK used'
      )
    ).toBe('HP EliteBook || 8GB || 256GB SSD');
  });

  it('normalizes Bumpa condition labels to catalog condition values', () => {
    expect(normalizeBumpaConditionForCatalog('Brand New')).toBe('new');
    expect(normalizeBumpaConditionForCatalog('UK Used')).toBe('used');
    expect(normalizeBumpaConditionForCatalog('open_box')).toBe('open_box');
  });

  it('derives receipt condition from the matched catalog name when the condition column is empty', () => {
    const snapshot = buildBumpaOrderItemSnapshot({
      importedProductName: 'Google Pixel 8 128GB',
      importMetadata: {},
      matchedProduct: product({
        condition: null,
        name: 'Google Pixel 8 128GB (Premium Used)',
      }),
    });

    expect(snapshot).toMatchObject({
      condition: 'used',
      productName: 'Google Pixel 8 128GB',
      variantName: 'Used',
    });
  });

  it('does not treat leading product words like New 2025 as receipt conditions', () => {
    const snapshot = buildBumpaOrderItemSnapshot({
      importedProductName: 'New 2025 Apple iPad M3 256gb WiFi + Cellular',
      importMetadata: {
        bumpa: {
          condition: 'New',
          condition_source: 'plain',
        },
      },
      matchedProduct: product({
        condition: null,
        name: 'New 2025 Apple iPad M3 256gb WiFi + Cellular',
      }),
    });

    expect(snapshot).toMatchObject({
      condition: null,
      productName: 'New 2025 Apple iPad M3 256gb WiFi + Cellular',
      variantName: null,
    });
  });
});
