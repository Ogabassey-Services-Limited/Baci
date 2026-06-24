import { describe, expect, it } from 'vitest';
import { normalizeSocialUrl } from './social';

describe('normalizeSocialUrl', () => {
  it('normalizes Twitter handles to twitter.com for crawler compatibility', () => {
    expect(normalizeSocialUrl('@ogabasseyy', 'twitter')).toBe(
      'https://twitter.com/ogabasseyy'
    );
  });

  it('rewrites existing x.com URLs to twitter.com for Twitter links', () => {
    expect(normalizeSocialUrl('https://x.com/ogabasseyy', 'twitter')).toBe(
      'https://twitter.com/ogabasseyy'
    );
    expect(normalizeSocialUrl('https://www.x.com/ogabasseyy', 'twitter')).toBe(
      'https://twitter.com/ogabasseyy'
    );
    expect(normalizeSocialUrl('http://x.com/ogabasseyy', 'twitter')).toBe(
      'https://twitter.com/ogabasseyy'
    );
    expect(normalizeSocialUrl('https://x.com', 'twitter')).toBe(
      'https://twitter.com'
    );
    expect(normalizeSocialUrl('https://www.x.com', 'twitter')).toBe(
      'https://twitter.com'
    );
    expect(normalizeSocialUrl('https://x.com?lang=en', 'twitter')).toBe(
      'https://twitter.com?lang=en'
    );
    expect(normalizeSocialUrl('https://www.x.com#profile', 'twitter')).toBe(
      'https://twitter.com#profile'
    );
  });

  it('returns undefined for empty social inputs', () => {
    expect(normalizeSocialUrl(undefined, 'twitter')).toBeUndefined();
    expect(normalizeSocialUrl('   ', 'twitter')).toBeUndefined();
  });

  it('preserves already-normalized non-Twitter social URLs', () => {
    expect(
      normalizeSocialUrl('https://instagram.com/ogabasseyy', 'instagram')
    ).toBe('https://instagram.com/ogabasseyy');
  });

  it('keeps platform-specific handle formats for other social networks', () => {
    expect(normalizeSocialUrl('@ogabassey', 'instagram')).toBe(
      'https://instagram.com/ogabassey'
    );
    expect(normalizeSocialUrl('ogabassey', 'tiktok')).toBe(
      'https://www.tiktok.com/@ogabassey'
    );
    expect(normalizeSocialUrl('@ogabassey', 'pinterest')).toBe(
      'https://pinterest.com/ogabassey'
    );
  });
});
