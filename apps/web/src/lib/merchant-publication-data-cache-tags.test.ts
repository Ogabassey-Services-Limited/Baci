import { describe, expect, it } from 'vitest';
import { buildMerchantPublicationDataCacheTags } from './merchant-publication-data-cache-tags';

describe('buildMerchantPublicationDataCacheTags', () => {
  it('covers current and retired slugs plus every resolved domain alias', () => {
    expect(
      buildMerchantPublicationDataCacheTags({
        canonicalMerchantSlug: 'ogabassey',
        identifiers: ['ogabassey', 'old-store', 'OGABASSEY.COM'],
        merchantId: 'merchant-1',
      })
    ).toEqual([
      'merchant-id-merchant-1',
      'features-merchant-1',
      'merchant-slug-ogabassey',
      'merchant-ogabassey',
      'domain-ogabassey',
      'merchant-slug-old-store',
      'merchant-old-store',
      'domain-old-store',
      'merchant-ogabassey.com',
      'domain-ogabassey.com',
      'merchant-www.ogabassey.com',
      'domain-www.ogabassey.com',
    ]);
  });

  it('returns no tags for a blank merchant id', () => {
    expect(
      buildMerchantPublicationDataCacheTags({
        canonicalMerchantSlug: 'store',
        identifiers: ['store'],
        merchantId: ' ',
      })
    ).toEqual([]);
  });

  it('omits identifier-derived tags that exceed the 256-byte cache limit', () => {
    const oversizedIdentifier = `${'é'.repeat(130)}.example`;

    const tags = buildMerchantPublicationDataCacheTags({
      canonicalMerchantSlug: null,
      identifiers: [oversizedIdentifier],
      merchantId: 'merchant-1',
    });

    expect(tags).toEqual(['merchant-id-merchant-1', 'features-merchant-1']);
    expect(
      tags.every((tag) => new TextEncoder().encode(tag).byteLength <= 256)
    ).toBe(true);
  });
});
