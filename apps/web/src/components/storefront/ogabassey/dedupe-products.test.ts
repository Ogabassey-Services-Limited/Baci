import { describe, expect, it } from 'vitest';
import { dedupeProductsByIdentity } from './dedupe-products';

describe('dedupeProductsByIdentity', () => {
  it('returns an empty array for empty input', () => {
    expect(dedupeProductsByIdentity([])).toEqual([]);
  });

  it('keeps the first product for a repeated id', () => {
    const result = dedupeProductsByIdentity([
      { id: 'product-1', name: 'Original' },
      { id: 'product-1', name: 'Duplicate' },
      { id: 'product-2', name: 'Other' },
    ]);

    expect(result).toEqual([
      { id: 'product-1', name: 'Original' },
      { id: 'product-2', name: 'Other' },
    ]);
  });

  it('falls back to case-insensitive slug identity when id is missing', () => {
    const result = dedupeProductsByIdentity([
      { slug: 'Samsung-Galaxy-Z-TriFold', name: 'TriFold' },
      { slug: 'samsung-galaxy-z-trifold', name: 'TriFold duplicate' },
    ]);

    expect(result).toEqual([
      { slug: 'Samsung-Galaxy-Z-TriFold', name: 'TriFold' },
    ]);
  });

  it('prioritizes id over slug for identity', () => {
    const result = dedupeProductsByIdentity([
      { id: 'product-1', slug: 'first-slug', name: 'Original' },
      { id: 'product-1', slug: 'second-slug', name: 'Duplicate' },
    ]);

    expect(result).toEqual([
      { id: 'product-1', slug: 'first-slug', name: 'Original' },
    ]);
  });

  it('dedupes products that share a slug even when only one has an id', () => {
    const result = dedupeProductsByIdentity([
      { slug: 'samsung-galaxy-z-trifold', name: 'Slug-only product' },
      {
        id: 'product-1',
        slug: 'Samsung-Galaxy-Z-TriFold',
        name: 'ID-backed duplicate',
      },
      {
        id: 'product-2',
        slug: 'dell-alienware-m18-r3',
        name: 'Different product',
      },
    ]);

    expect(result).toEqual([
      { slug: 'samsung-galaxy-z-trifold', name: 'Slug-only product' },
      {
        id: 'product-2',
        slug: 'dell-alienware-m18-r3',
        name: 'Different product',
      },
    ]);
  });

  it('tracks aliases from skipped duplicate rows for later slug-only matches', () => {
    const result = dedupeProductsByIdentity([
      { id: 'product-1', name: 'ID-only product' },
      {
        id: 'product-1',
        slug: 'samsung-galaxy-z-trifold',
        name: 'ID and slug duplicate',
      },
      {
        slug: 'Samsung-Galaxy-Z-TriFold',
        name: 'Slug-only duplicate',
      },
      {
        id: 'product-2',
        slug: 'dell-alienware-m18-r3',
        name: 'Different product',
      },
    ]);

    expect(result).toEqual([
      { id: 'product-1', name: 'ID-only product' },
      {
        id: 'product-2',
        slug: 'dell-alienware-m18-r3',
        name: 'Different product',
      },
    ]);
  });

  it('does not let aliases from skipped duplicate rows hide a later product with its own id', () => {
    const result = dedupeProductsByIdentity([
      { id: 'product-1', name: 'ID-only product' },
      {
        id: 'product-1',
        slug: 'shared-slug',
        name: 'Dropped duplicate with a conflicting slug',
      },
      {
        id: 'product-2',
        slug: 'shared-slug',
        name: 'Legitimate ID-backed product',
      },
    ]);

    expect(result).toEqual([
      { id: 'product-1', name: 'ID-only product' },
      {
        id: 'product-2',
        slug: 'shared-slug',
        name: 'Legitimate ID-backed product',
      },
    ]);
  });

  it('tracks id aliases from skipped duplicate rows for later id-only matches', () => {
    const result = dedupeProductsByIdentity([
      { slug: 'shared-slug', name: 'Slug-only product' },
      {
        id: 'product-1',
        slug: 'shared-slug',
        name: 'ID and slug duplicate',
      },
      {
        id: 'product-1',
        name: 'ID-only duplicate',
      },
      {
        id: 'product-2',
        slug: 'different-slug',
        name: 'Different product',
      },
    ]);

    expect(result).toEqual([
      { slug: 'shared-slug', name: 'Slug-only product' },
      {
        id: 'product-2',
        slug: 'different-slug',
        name: 'Different product',
      },
    ]);
  });

  it('propagates aliases from inferred duplicate rows for later slug-only matches', () => {
    const result = dedupeProductsByIdentity([
      { slug: 'a', name: 'Original slug-only product' },
      { id: 'product-1', slug: 'a', name: 'First inferred duplicate' },
      { id: 'product-1', slug: 'b', name: 'Second inferred duplicate' },
      { slug: 'b', name: 'Later slug-only duplicate' },
      {
        id: 'product-2',
        slug: 'c',
        name: 'Different product',
      },
    ]);

    expect(result).toEqual([
      { slug: 'a', name: 'Original slug-only product' },
      {
        id: 'product-2',
        slug: 'c',
        name: 'Different product',
      },
    ]);
  });

  it('preserves products without an id or slug', () => {
    const products: { name: string }[] = [
      { name: 'Unknown 1' },
      { name: 'Unknown 1' },
    ];
    const result = dedupeProductsByIdentity(products);

    expect(result).toEqual([{ name: 'Unknown 1' }, { name: 'Unknown 1' }]);
  });

  it('preserves malformed runtime entries without throwing', () => {
    const result = dedupeProductsByIdentity([
      null,
      { id: 'product-1', name: 'Product' },
      null,
      undefined,
      'not-a-product',
    ]);

    expect(result).toEqual([
      null,
      { id: 'product-1', name: 'Product' },
      null,
      undefined,
      'not-a-product',
    ]);
  });

  it('handles mixed identity types', () => {
    const anonymousProduct = { name: 'Anonymous' };
    const result = dedupeProductsByIdentity([
      { id: 'product-1', slug: 'id-backed', name: 'ID backed' },
      { slug: 'Slug-Only', name: 'Slug only' },
      anonymousProduct,
      { id: 'product-1', slug: 'different-slug', name: 'ID duplicate' },
      { slug: 'slug-only', name: 'Slug duplicate' },
      anonymousProduct,
    ]);

    expect(result).toEqual([
      { id: 'product-1', slug: 'id-backed', name: 'ID backed' },
      { slug: 'Slug-Only', name: 'Slug only' },
      anonymousProduct,
      anonymousProduct,
    ]);
  });
});
