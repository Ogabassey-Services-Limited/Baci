import { describe, expect, it } from 'vitest';
import { buildStorefrontMetadataTitle } from './storefront-metadata-title';

describe('buildStorefrontMetadataTitle', () => {
  it('keeps storefront titles within the SERP display budget', () => {
    const result = buildStorefrontMetadataTitle({
      suffix: 'Ogabassey',
      title:
        'Apple Magic Keyboard 11-inch for iPad Pro and iPad Air Price in Nigeria',
    });

    expect(result.title.length).toBeLessThanOrEqual(60);
    expect(result.title).toContain('| Ogabassey');
  });

  it('returns an absolute Next metadata title to bypass the platform template', () => {
    const result = buildStorefrontMetadataTitle({
      suffix: 'Ogabassey',
      title: 'AirPods Pro 2nd Gen Type-C Price in Nigeria',
    });

    expect(result.metadataTitle).toEqual({ absolute: result.title });
  });
});
