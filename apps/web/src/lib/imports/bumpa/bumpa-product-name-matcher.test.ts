import { describe, expect, it } from 'vitest';
import type { ExistingImportedProduct } from '@/lib/imports/bumpa/bumpa-types';
import { createBumpaProductNameMatcher } from './bumpa-product-name-matcher';

function product(
  overrides: Partial<ExistingImportedProduct>
): ExistingImportedProduct {
  return {
    condition: overrides.condition ?? null,
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
        name: 'Samsung Galaxy Z Fold 5 / Z Fold 5 12GB 512GB',
        status: 'active',
      }),
      product({
        id: 'fold-5-archived',
        name: 'Samsung Galaxy Z Fold 5',
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

  it('does not match catalog variants missing imported model qualifiers', () => {
    const matchProduct = createBumpaProductNameMatcher([
      product({
        id: 'iphone-15-pro',
        name: 'iPhone 15 Pro 256GB',
        status: 'active',
      }),
    ]);

    expect(matchProduct('iPhone 15 Pro Max 256GB')).toBeNull();
  });

  it('does not fuzzy match products with conflicting model identifiers', () => {
    const matchProduct = createBumpaProductNameMatcher([
      product({
        id: 'elitebook-g6',
        name: 'HP EliteBook 840 G6 8GB 256GB',
        status: 'active',
      }),
    ]);

    expect(matchProduct('HP EliteBook 840 G5 8GB 256GB')).toBeNull();
  });

  it('uses imported condition when catalog products share a normalized name', () => {
    const matchProduct = createBumpaProductNameMatcher([
      product({
        condition: 'used',
        id: 'iphone-13-used',
        name: 'iPhone 13 128GB',
        status: 'active',
      }),
      product({
        condition: 'new',
        id: 'iphone-13-new',
        name: 'iPhone 13 128GB',
        status: 'active',
      }),
    ]);

    expect(matchProduct('iPhone 13 128GB (Brand New)')?.id).toBe(
      'iphone-13-new'
    );
    expect(matchProduct('iPhone 13 128GB (Premium Used)')?.id).toBe(
      'iphone-13-used'
    );
  });

  it('does not guess between condition-specific products when the import has no condition', () => {
    const matchProduct = createBumpaProductNameMatcher([
      product({
        condition: 'new',
        id: 'iphone-13-new',
        name: 'iPhone 13 128GB',
        status: 'active',
      }),
      product({
        condition: 'used',
        id: 'iphone-13-used',
        name: 'iPhone 13 128GB',
        status: 'active',
      }),
    ]);

    expect(matchProduct('iPhone 13 128GB')).toBeNull();
  });

  it('prefers an unconditioned catalog product for no-condition imports', () => {
    const matchProduct = createBumpaProductNameMatcher([
      product({
        condition: 'new',
        id: 'iphone-13-new',
        name: 'iPhone 13 128GB',
        status: 'active',
      }),
      product({
        id: 'iphone-13',
        name: 'iPhone 13 128GB',
        status: 'active',
      }),
      product({
        condition: 'used',
        id: 'iphone-13-used',
        name: 'iPhone 13 128GB',
        status: 'active',
      }),
    ]);

    expect(matchProduct('iPhone 13 128GB')?.id).toBe('iphone-13');
  });

  it('uses an explicit condition override when fulfillment text carries the condition', () => {
    const matchProduct = createBumpaProductNameMatcher([
      product({
        condition: 'new',
        id: 'iphone-13-new',
        name: 'iPhone 13 128GB',
        status: 'active',
      }),
      product({
        condition: 'used',
        id: 'iphone-13-used',
        name: 'iPhone 13 128GB',
        status: 'active',
      }),
    ]);

    expect(matchProduct('iPhone 13 128GB', 'Premium Used')?.id).toBe(
      'iphone-13-used'
    );
  });

  it('normalizes refurbished condition text consistently for name matching', () => {
    const matchProduct = createBumpaProductNameMatcher([
      product({
        condition: 'open_box',
        id: 'pixel-refurbished',
        name: 'Google Pixel 8 128GB',
        status: 'active',
      }),
    ]);

    expect(matchProduct('Pixel 8 128gb Refurbished')?.id).toBe(
      'pixel-refurbished'
    );
  });

  it('rejects accessory catalog names that only add accessory tokens', () => {
    const matchProduct = createBumpaProductNameMatcher([
      product({
        id: 's22-ultra-case',
        name: 'Samsung Galaxy S22 Ultra 256GB Case',
        status: 'active',
      }),
    ]);

    expect(matchProduct('Samsung Galaxy S22 Ultra 256GB')).toBeNull();
  });
});
