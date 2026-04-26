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

  it('preserves products without an id or slug', () => {
    const products: { name: string }[] = [
      { name: 'Unknown 1' },
      { name: 'Unknown 1' },
    ];
    const result = dedupeProductsByIdentity(products);

    expect(result).toEqual([{ name: 'Unknown 1' }, { name: 'Unknown 1' }]);
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
