import { describe, expect, it } from 'vitest';
import { DEFAULT_BLOG_MEDIA_CDN_ORIGIN } from '@/config/cdn';
import {
  buildBlogMediaCdnUrl,
  canonicalizeBlogMediaUrl,
  extractManagedBlogStoragePath,
  isManagedBlogStoragePath,
  PLATFORM_BLOG_MEDIA_PREFIX,
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

  it('builds canonical owned-domain CDN URLs for managed blog media paths', () => {
    expect(
      buildBlogMediaCdnUrl('merchant-1/blog/cover_image.png', 'merchant-1')
    ).toBe(
      `${DEFAULT_BLOG_MEDIA_CDN_ORIGIN}/media/merchant-1/blog/cover_image.png`
    );

    expect(
      buildBlogMediaCdnUrl(
        'merchant-1/blog/upload-1/landscape_16x9.webp',
        'merchant-1',
        'https://cdn.example.com/'
      )
    ).toBe(
      'https://cdn.example.com/media/merchant-1/blog/upload-1/landscape_16x9.webp'
    );
  });

  it('does not build CDN URLs for cross-merchant or unsafe paths', () => {
    expect(
      buildBlogMediaCdnUrl('merchant-2/blog/cover.png', 'merchant-1')
    ).toBeNull();

    expect(
      buildBlogMediaCdnUrl('merchant-1/blog/../cover.png', 'merchant-1')
    ).toBeNull();
  });

  it('canonicalizes Supabase public URLs to the owned CDN media origin', () => {
    expect(
      canonicalizeBlogMediaUrl(
        'https://mock.supabase.co/storage/v1/object/public/media/merchant-1/blog/upload-1/landscape_16x9.webp',
        'merchant-1'
      )
    ).toBe(
      `${DEFAULT_BLOG_MEDIA_CDN_ORIGIN}/media/merchant-1/blog/upload-1/landscape_16x9.webp`
    );

    expect(
      canonicalizeBlogMediaUrl(
        'https://example.com/assets/cover.png',
        'merchant-1'
      )
    ).toBeNull();
  });

  it('accepts platform blog originals and variants for the platform scope', () => {
    expect(
      isManagedBlogStoragePath(`${PLATFORM_BLOG_MEDIA_PREFIX}/cover.png`, {
        kind: 'platform',
      })
    ).toBe(true);
    expect(
      isManagedBlogStoragePath(
        `${PLATFORM_BLOG_MEDIA_PREFIX}/upload-1/landscape_16x9.webp`,
        { kind: 'platform' }
      )
    ).toBe(true);
  });

  it('rejects platform paths for merchant scope and merchant paths for platform scope', () => {
    expect(
      isManagedBlogStoragePath(
        `${PLATFORM_BLOG_MEDIA_PREFIX}/cover.png`,
        'merchant-1'
      )
    ).toBe(false);
    expect(
      isManagedBlogStoragePath('merchant-1/blog/cover.png', {
        kind: 'platform',
      })
    ).toBe(false);
  });

  it('extracts managed platform paths from public URLs', () => {
    expect(
      extractManagedBlogStoragePath(
        'https://cdn.example.com/media/platform/blog/upload-1/landscape_16x9.webp',
        { kind: 'platform' }
      )
    ).toBe(`${PLATFORM_BLOG_MEDIA_PREFIX}/upload-1/landscape_16x9.webp`);
  });

  it('builds canonical CDN URLs for platform scope managed paths', () => {
    expect(
      buildBlogMediaCdnUrl(`${PLATFORM_BLOG_MEDIA_PREFIX}/cover_image.png`, {
        kind: 'platform',
      })
    ).toBe(
      `${DEFAULT_BLOG_MEDIA_CDN_ORIGIN}/media/${PLATFORM_BLOG_MEDIA_PREFIX}/cover_image.png`
    );
  });
});
