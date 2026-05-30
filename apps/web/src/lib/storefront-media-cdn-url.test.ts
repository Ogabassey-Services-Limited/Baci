import { describe, expect, it } from 'vitest';
import { DEFAULT_MEDIA_CDN_ORIGIN } from '@/config/cdn';
import {
  buildStorefrontMediaCdnUrl,
  canonicalizeStorefrontMediaUrl,
  extractStorefrontMediaStoragePath,
  isSafeStorefrontMediaStoragePath,
} from '@/lib/storefront-media-cdn-url';

describe('storefront media CDN URL helpers', () => {
  it('rejects unsafe storage paths', () => {
    expect(isSafeStorefrontMediaStoragePath('')).toBe(false);
    expect(isSafeStorefrontMediaStoragePath('   ')).toBe(false);
    expect(isSafeStorefrontMediaStoragePath('/merchant-1/logo.svg')).toBe(
      false
    );
    expect(isSafeStorefrontMediaStoragePath('merchant-1//logo.svg')).toBe(
      false
    );
    expect(isSafeStorefrontMediaStoragePath('merchant-1/\x00/logo.svg')).toBe(
      false
    );
    expect(isSafeStorefrontMediaStoragePath('merchant-1/\r\n/logo.svg')).toBe(
      false
    );
    expect(isSafeStorefrontMediaStoragePath('./logo.svg')).toBe(false);
    expect(isSafeStorefrontMediaStoragePath('../logo.svg')).toBe(false);
    expect(isSafeStorefrontMediaStoragePath('path/../file.png')).toBe(false);
  });

  it('canonicalizes Supabase public media URLs to the owned CDN origin', () => {
    expect(
      canonicalizeStorefrontMediaUrl(
        'https://project.supabase.co/storage/v1/object/public/media/merchant-1/logo.svg'
      )
    ).toBe(`${DEFAULT_MEDIA_CDN_ORIGIN}/media/merchant-1/logo.svg`);
  });

  it('preserves safe nested media paths while rejecting traversal and non-media URLs', () => {
    expect(
      extractStorefrontMediaStoragePath(
        `${DEFAULT_MEDIA_CDN_ORIGIN}/media/merchants/merchant-1/favicon/favicon-32.png`
      )
    ).toBe('merchants/merchant-1/favicon/favicon-32.png');
    expect(
      extractStorefrontMediaStoragePath(
        'https://external-cdn.example.com/media/merchants/merchant-1/favicon/favicon-32.png'
      )
    ).toBeNull();
    expect(
      extractStorefrontMediaStoragePath(
        'https://example.com/storage/v1/object/public/media/merchant-1/logo.svg'
      )
    ).toBeNull();

    expect(
      extractStorefrontMediaStoragePath(
        'https://project.supabase.co/storage/v1/object/public/media/merchant-1/../private.png'
      )
    ).toBeNull();
    expect(
      extractStorefrontMediaStoragePath('https://example.com/assets/logo.svg')
    ).toBeNull();
    expect(extractStorefrontMediaStoragePath('not a url')).toBeNull();
    expect(
      extractStorefrontMediaStoragePath(
        'https://project.supabase.co/storage/v1/object/public/media/merchant-1/%E0%A4%A'
      )
    ).toBeNull();
  });

  it('encodes path segments when building CDN URLs', () => {
    expect(buildStorefrontMediaCdnUrl('merchant-1/logo mark.svg')).toBe(
      `${DEFAULT_MEDIA_CDN_ORIGIN}/media/merchant-1/logo%20mark.svg`
    );
    expect(buildStorefrontMediaCdnUrl('merchant-1/logo.svg')).toBe(
      `${DEFAULT_MEDIA_CDN_ORIGIN}/media/merchant-1/logo.svg`
    );
    expect(
      buildStorefrontMediaCdnUrl(
        'merchant-1/logo.svg',
        'https://assets.example.com/base-path'
      )
    ).toBe('https://assets.example.com/media/merchant-1/logo.svg');
    expect(buildStorefrontMediaCdnUrl('merchant-1/logo.svg', 'not a url')).toBe(
      `${DEFAULT_MEDIA_CDN_ORIGIN}/media/merchant-1/logo.svg`
    );
  });

  it('canonicalizes safe path-only inputs and rejects invalid values', () => {
    expect(canonicalizeStorefrontMediaUrl('merchant-1/logo.svg')).toBe(
      `${DEFAULT_MEDIA_CDN_ORIGIN}/media/merchant-1/logo.svg`
    );
    expect(canonicalizeStorefrontMediaUrl('')).toBeNull();
    expect(canonicalizeStorefrontMediaUrl('../secret.png')).toBeNull();
    expect(canonicalizeStorefrontMediaUrl('path/../file.png')).toBeNull();
  });
});
