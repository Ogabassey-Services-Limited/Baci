import { describe, expect, it } from 'vitest';
import {
  extractManagedBlogStoragePath,
  isManagedBlogStoragePath,
} from '@/lib/blog-managed-storage-paths';

describe('blog managed storage paths', () => {
  it('accepts same-merchant blog originals and generated variants', () => {
    expect(
      isManagedBlogStoragePath('merchant-1/blog/cover.png', 'merchant-1')
    ).toBe(true);
    expect(
      isManagedBlogStoragePath(
        'merchant-1/blog/upload-1/landscape_16x9.webp',
        'merchant-1'
      )
    ).toBe(true);
  });

  it('rejects cross-merchant, traversal, and unknown variant paths', () => {
    expect(
      isManagedBlogStoragePath('merchant-2/blog/cover.png', 'merchant-1')
    ).toBe(false);
    expect(
      isManagedBlogStoragePath('merchant-1/blog/../cover.png', 'merchant-1')
    ).toBe(false);
    expect(
      isManagedBlogStoragePath(
        'merchant-1/blog/upload-1/not_a_variant.webp',
        'merchant-1'
      )
    ).toBe(false);
  });

  it('recovers managed paths from public storage and cdn media URLs', () => {
    expect(
      extractManagedBlogStoragePath(
        'https://mock.supabase.co/storage/v1/object/public/media/merchant-1/blog/cover.png?width=1200',
        'merchant-1'
      )
    ).toBe('merchant-1/blog/cover.png');

    expect(
      extractManagedBlogStoragePath(
        'https://cdn.example.com/media/merchant-1/blog/upload-1/landscape_16x9.webp',
        'merchant-1'
      )
    ).toBe('merchant-1/blog/upload-1/landscape_16x9.webp');
  });

  it('does not recover unowned or non-media URLs', () => {
    expect(
      extractManagedBlogStoragePath(
        'https://cdn.example.com/media/merchant-2/blog/cover.png',
        'merchant-1'
      )
    ).toBeNull();
    expect(
      extractManagedBlogStoragePath(
        'https://example.com/assets/cover.png',
        'merchant-1'
      )
    ).toBeNull();
  });
});
