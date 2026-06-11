import { describe, expect, it } from 'vitest';
import type { CachedProductLcpHint } from '@/lib/cached-data';
import { getCachedProductLcpHintPrimaryImage } from './cached-product-lcp-hint-primary-image';

function createCachedProductLcpHint(
  images: CachedProductLcpHint['images']
): CachedProductLcpHint {
  return {
    id: 'product-1',
    images,
    name: 'Test product',
  };
}

describe('getCachedProductLcpHintPrimaryImage', () => {
  it('returns the first string image URL', () => {
    expect(
      getCachedProductLcpHintPrimaryImage(
        createCachedProductLcpHint([' https://cdn.example.com/product.avif '])
      )
    ).toBe('https://cdn.example.com/product.avif');
  });

  it('returns the first object image URL', () => {
    expect(
      getCachedProductLcpHintPrimaryImage(
        createCachedProductLcpHint([
          { alt: 'Product image', url: 'https://cdn.example.com/object.webp' },
        ])
      )
    ).toBe('https://cdn.example.com/object.webp');
  });

  it('normalizes blank or missing image values to null', () => {
    expect(
      getCachedProductLcpHintPrimaryImage(createCachedProductLcpHint(['  ']))
    ).toBeNull();
    expect(
      getCachedProductLcpHintPrimaryImage(createCachedProductLcpHint([]))
    ).toBeNull();
    expect(
      getCachedProductLcpHintPrimaryImage(createCachedProductLcpHint(null))
    ).toBeNull();
    expect(getCachedProductLcpHintPrimaryImage(null)).toBeNull();
    expect(getCachedProductLcpHintPrimaryImage(undefined)).toBeNull();
  });

  it('trims whitespace from object image URLs', () => {
    expect(
      getCachedProductLcpHintPrimaryImage(
        createCachedProductLcpHint([
          {
            alt: 'Padded product image',
            url: ' https://cdn.example.com/padded.jpg ',
          },
        ])
      )
    ).toBe('https://cdn.example.com/padded.jpg');
  });

  it('returns null for malformed object image URLs', () => {
    expect(
      getCachedProductLcpHintPrimaryImage(
        createCachedProductLcpHint([
          { alt: 'Missing URL' } as { alt: string; url: string },
        ])
      )
    ).toBeNull();
    expect(
      getCachedProductLcpHintPrimaryImage(
        createCachedProductLcpHint([
          { alt: 'Null URL', url: null } as unknown as {
            alt: string;
            url: string;
          },
        ])
      )
    ).toBeNull();
  });
});
