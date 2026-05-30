import { describe, expect, it } from 'vitest';
import { getProductScopedCacheTag } from '@/lib/product-cache-tags';

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
