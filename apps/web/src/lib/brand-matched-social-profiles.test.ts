import { describe, expect, it } from 'vitest';
import { filterBrandMatchedSocialProfiles } from '@/lib/brand-matched-social-profiles';

describe('filterBrandMatchedSocialProfiles', () => {
  it('keeps profiles whose visible identity matches the merchant brand', () => {
    expect(
      filterBrandMatchedSocialProfiles('Ogabassey', [
        'https://instagram.com/ogabasseyy',
        'https://www.facebook.com/ogabasseyyy',
        'https://x.com/ogabasseyy',
        'https://www.snapchat.com/@ogabassey',
        'https://www.tiktok.com/@ogabasseyy',
        'https://www.youtube.com/@ogabassey',
        'https://www.linkedin.com/company/ogabasseyy',
      ])
    ).toEqual([
      'https://instagram.com/ogabasseyy',
      'https://www.facebook.com/ogabasseyyy',
      'https://x.com/ogabasseyy',
      'https://www.snapchat.com/@ogabassey',
      'https://www.tiktok.com/@ogabasseyy',
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

  it('does not accept a profile that matches only a business descriptor', () => {
    expect(
      filterBrandMatchedSocialProfiles('Ada Fashion', [
        'https://twitter.com/fashiondaily',
      ])
    ).toEqual([]);
  });

  it('does not accept an arbitrary suffix after a full brand identity', () => {
    expect(
      filterBrandMatchedSocialProfiles('Ogabassey', [
        'https://instagram.com/ogabasseyfraud',
      ])
    ).toEqual([]);
  });

  it('keeps exact profiles for short brand names and acronyms', () => {
    expect(
      filterBrandMatchedSocialProfiles('MTN', ['https://twitter.com/MTN'])
    ).toEqual(['https://twitter.com/MTN']);
    expect(
      filterBrandMatchedSocialProfiles('KFC', ['https://instagram.com/kfc'])
    ).toEqual(['https://instagram.com/kfc']);
  });

  it('matches the core brand when the business name has a generic suffix', () => {
    expect(
      filterBrandMatchedSocialProfiles('Ogabassey Nigeria Limited', [
        'https://www.youtube.com/@ogabassey',
      ])
    ).toEqual(['https://www.youtube.com/@ogabassey']);
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
