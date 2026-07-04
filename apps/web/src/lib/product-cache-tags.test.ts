import { describe, expect, it } from 'vitest';
import {
  getProductScopedCacheTag,
  getProductSlugSetCacheTag,
} from '@/lib/product-cache-tags';

describe('getProductScopedCacheTag', () => {
  it('preserves existing ASCII cache tag format for safe product slugs', () => {
    expect(
      getProductScopedCacheTag('product', 'merchant-123', 'iphone-16-pro')
    ).toBe('product-merchant-123-iphone-16-pro');
  });

  it('hashes non-ASCII product slugs into ByteString-safe cache tags', () => {
    const tag = getProductScopedCacheTag(
      'product',
      'merchant-123',
      'dell-alienware-x14-r2-–-14”'
    );

    expect(tag).toMatch(
      /^product-merchant-123-dell-alienware-x14-r2-14-[a-f0-9]{32}$/
    );
    expect(tag).not.toContain('–');
    expect(tag).not.toContain('”');
    expect(tag.length).toBeLessThanOrEqual(256);
  });

  it('hashes overly long tags while retaining readable context', () => {
    const tag = getProductScopedCacheTag(
      'product-legacy-redirect',
      'merchant-123',
      'x'.repeat(260)
    );

    expect(tag).toMatch(
      /^product-legacy-redirect-merchant-123-x{48}-[a-f0-9]{32}$/
    );
    expect(tag.length).toBeLessThanOrEqual(256);
  });
});

describe('getProductSlugSetCacheTag', () => {
  it('builds the dedicated per-merchant slug-set tag', () => {
    expect(getProductSlugSetCacheTag('merchant-123')).toBe(
      'product-slug-set-merchant-123'
    );
  });

  it('contains no comma (Vercel-Cache-Tag delimiter) and stays under 256 chars', () => {
    const tag = getProductSlugSetCacheTag(
      '6b5cb8a4-5575-456c-b936-8cdfae30db74'
    );

    expect(tag).not.toContain(',');
    expect(tag.length).toBeLessThanOrEqual(256);
  });
});
