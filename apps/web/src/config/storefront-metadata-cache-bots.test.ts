import { describe, expect, it } from 'vitest';
import {
  getStorefrontMetadataCacheBucket,
  STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX,
} from './storefront-metadata-cache-bots';

describe('storefront metadata cache bot classifier', () => {
  it.each([
    ['Googlebot/2.1'],
    ['AdsBot-Google (+http://www.google.com/adsbot.html)'],
    ['Google-InspectionTool/1.0'],
    ['Twitterbot/1.0'],
    ['Instagram 350.0.0.29.93 Android'],
    ['Mozilla/5.0 AppleWebKit/537.36 Chrome/125.0 Safari/537.36'],
  ])('uses the metadata-blocking bucket for %s', (userAgent) => {
    expect(
      STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX.test(userAgent)
    ).toBe(true);
    expect(getStorefrontMetadataCacheBucket(userAgent)).toBe(
      'metadata-blocking'
    );
  });

  it('does not use the streaming bucket while Next resume mismatches are active', () => {
    expect(
      getStorefrontMetadataCacheBucket(
        'Mozilla/5.0 AppleWebKit/537.36 Chrome/125.0 Safari/537.36'
      )
    ).toBe('metadata-blocking');
  });
});
