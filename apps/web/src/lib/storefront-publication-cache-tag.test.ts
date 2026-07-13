import { describe, expect, it } from 'vitest';
import { getStorefrontPublicationCacheTag } from './storefront-publication-cache-tag';

describe('getStorefrontPublicationCacheTag', () => {
  it('normalizes merchant slugs into a collision-safe tag namespace', () => {
    expect(
      getStorefrontPublicationCacheTag({
        kind: 'slug',
        value: ' OgaBassey ',
      })
    ).toBe('ps:ogabassey');
  });

  it('keeps hostname identity separate from slug identity', () => {
    expect(
      getStorefrontPublicationCacheTag({
        kind: 'hostname',
        value: ' WWW.OGABASSEY.COM ',
      })
    ).toBe('ph:www.ogabassey.com');
  });

  it('rejects blank or comma-bearing values that Vercel cannot tag safely', () => {
    expect(
      getStorefrontPublicationCacheTag({ kind: 'slug', value: ' ' })
    ).toBeNull();
    expect(
      getStorefrontPublicationCacheTag({
        kind: 'hostname',
        value: 'shop.example.com,other-tag',
      })
    ).toBeNull();
  });

  it("stays within Vercel's 256-byte tag limit for a maximum DNS hostname", () => {
    const maximumHostname = `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(
      63
    )}.${'d'.repeat(61)}`;
    const tag = getStorefrontPublicationCacheTag({
      kind: 'hostname',
      value: maximumHostname,
    });

    expect(maximumHostname).toHaveLength(253);
    expect(tag).toHaveLength(256);
  });
});
