import { describe, expect, it } from 'vitest';
import { getStoragePattern } from '@/lib/storefront-product/price-intent-classifier-constants';

describe('getStoragePattern', () => {
  it('returns a fresh global regex instance for each classifier scan', () => {
    const firstPattern = getStoragePattern();
    const secondPattern = getStoragePattern();

    expect(firstPattern).not.toBe(secondPattern);
    expect(firstPattern.exec('iphone 128gb price')?.[0]).toBe('128gb');
    expect(firstPattern.exec('iphone 128gb price')).toBeNull();
    expect(secondPattern.exec('iphone 128gb price')?.[0]).toBe('128gb');
  });

  it('matches spaced and case-insensitive storage tokens', () => {
    const matches = Array.from(
      'MacBook 1 TB with 512 GB storage'.matchAll(getStoragePattern())
    );

    expect(matches.map((match) => match[0])).toEqual(['1 TB', '512 GB']);
  });
});
