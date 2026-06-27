import { describe, expect, it } from 'vitest';
import type { ExistingImportedProduct } from '@/lib/imports/bumpa/bumpa-types';
import { createBumpaProductNameMatcher } from './bumpa-product-name-matcher';

function product(
  overrides: Partial<ExistingImportedProduct>
): ExistingImportedProduct {
  return {
    externalId: null,
    externalSource: null,
    id: overrides.id ?? 'product-1',
    name: overrides.name ?? 'Product',
    price: null,
    sku: null,
    status: overrides.status ?? 'active',
  };
}

describe('createBumpaProductNameMatcher', () => {
  it('matches Bumpa Samsung Fold names to catalog Z Fold products', () => {
    const matchProduct = createBumpaProductNameMatcher([
      product({
        id: 'fold-5',
        name: 'Samsung Galaxy Z Fold 5',
        status: 'active',
      }),
      product({
        id: 'fold-5-archived',
        name: 'Samsung Galaxy Z Fold 5 12GB 512GB',
        status: 'archived',
      }),
    ]);

    expect(matchProduct('Samsung Galaxy Fold 5 512GB (Premium Used)')?.id).toBe(
      'fold-5'
    );
  });

  it('matches exact normalized condition names before fuzzy matching', () => {
    const matchProduct = createBumpaProductNameMatcher([
      product({
        id: 'pixel',
        name: 'Google Pixel 7a 128GB (Premium Used)',
        status: 'archived',
      }),
      product({
        id: 'pixel-family',
        name: 'Google Pixel 7a',
        status: 'active',
      }),
    ]);

    expect(matchProduct('Pixel 7a 128gb (Premium Used)')?.id).toBe('pixel');
  });

  it('prefers active products when exact normalized names collide', () => {
    const matchProduct = createBumpaProductNameMatcher([
      product({
        id: 'archived-fold',
        name: 'Samsung Galaxy Z Fold 5',
        status: 'archived',
      }),
      product({
        id: 'active-fold',
        name: 'Samsung Galaxy Z Fold 5 (Premium Used)',
        status: 'active',
      }),
    ]);

    expect(matchProduct('Samsung Galaxy Fold 5 (Premium Used)')?.id).toBe(
      'active-fold'
    );
  });

  it('returns null when the imported product cannot be matched', () => {
    const matchProduct = createBumpaProductNameMatcher([
      product({
        id: 'fold-5',
        name: 'Samsung Galaxy Z Fold 5',
        status: 'active',
      }),
    ]);

    expect(matchProduct('Oraimo Power Bank 20000mAh')).toBeNull();
  });
});
