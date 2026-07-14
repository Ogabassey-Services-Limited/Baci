import { describe, expect, it } from 'vitest';
import { filterBrandMatchedSocialProfiles } from './brand-matched-social-profiles';

describe('filterBrandMatchedSocialProfiles', () => {
  it('keeps profiles whose visible identity matches the merchant brand', () => {
    expect(
      filterBrandMatchedSocialProfiles('Ogabassey', [
        'https://www.youtube.com/@ogabassey',
        'https://www.linkedin.com/company/ogabasseyy',
      ])
    ).toEqual([
      'https://www.youtube.com/@ogabassey',
      'https://www.linkedin.com/company/ogabasseyy',
    ]);
  });

  it('omits unrelated handles instead of asserting false entity identity', () => {
    expect(
      filterBrandMatchedSocialProfiles('Ogabassey', [
        'https://www.tiktok.com/@qynovx',
        'https://twitter.com/sxgtow',
        'https://facebook.com/odvkrk',
        'https://instagram.com/ywzhqv',
        'https://www.snapchat.com/@bvhnuj',
      ])
    ).toEqual([]);
  });

  it('rejects malformed URLs and deduplicates accepted profiles', () => {
    expect(
      filterBrandMatchedSocialProfiles('Test Store', [
        'not-a-url',
        'https://instagram.com/teststore',
        'https://instagram.com/teststore',
      ])
    ).toEqual(['https://instagram.com/teststore']);
  });
});
