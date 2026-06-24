import { describe, expect, it } from 'vitest';
import { normalizeSocialUrl } from './social';

describe('normalizeSocialUrl', () => {
  it('normalizes Pinterest handles to pinterest.com', () => {
    expect(normalizeSocialUrl('@ogabassey', 'pinterest')).toBe(
      'https://pinterest.com/ogabassey'
    );
  });

  it('normalizes Twitter handles to the crawler-stable twitter.com host', () => {
    expect(normalizeSocialUrl('@ogabasseyy', 'twitter')).toBe(
      'https://twitter.com/ogabasseyy'
    );
  });

  it('normalizes x.com Twitter profile URLs to the twitter.com host', () => {
    expect(normalizeSocialUrl('https://x.com/ogabasseyy', 'twitter')).toBe(
      'https://twitter.com/ogabasseyy'
    );
  });

  it('normalizes Twitter profile URLs with uppercase schemes', () => {
    expect(normalizeSocialUrl('HTTPS://x.com/ogabasseyy', 'twitter')).toBe(
      'https://twitter.com/ogabasseyy'
    );
  });

  it('does not rewrite Twitter content routes as profile URLs', () => {
    expect(normalizeSocialUrl('https://x.com/i/status/54321', 'twitter')).toBe(
      'https://x.com/i/status/54321'
    );
  });

  it('does not rewrite user status routes as profile URLs', () => {
    expect(
      normalizeSocialUrl('https://x.com/ogabasseyy/status/54321', 'twitter')
    ).toBe('https://x.com/ogabasseyy/status/54321');
  });
});
