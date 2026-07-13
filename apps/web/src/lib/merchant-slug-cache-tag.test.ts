import { describe, expect, it } from 'vitest';
import { getMerchantSlugCacheTag } from './merchant-slug-cache-tag';

describe('getMerchantSlugCacheTag', () => {
  it('normalizes the exact tag shared by merchant lookup and publication eviction', () => {
    expect(getMerchantSlugCacheTag(' OgaBassey ')).toBe(
      'merchant-slug-ogabassey'
    );
  });
});
