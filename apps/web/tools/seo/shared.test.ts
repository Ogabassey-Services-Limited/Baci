import { describe, expect, it } from 'vitest';
import {
  normalizeOrigin,
  parseCsvOrigins,
  parseCsvUrls,
  parseToggle,
} from './shared';

describe('seo monitoring shared helpers', () => {
  it('normalizes origins by trimming paths and trailing slashes', () => {
    expect(normalizeOrigin(' https://usebaci.com/pricing ')).toBe(
      'https://usebaci.com'
    );
  });

  it('normalizes origins with trailing slashes and preserves ports', () => {
    expect(normalizeOrigin('https://usebaci.com/')).toBe('https://usebaci.com');
    expect(normalizeOrigin('https://usebaci.com:8080/path')).toBe(
      'https://usebaci.com:8080'
    );
  });

  it('throws for empty origin input', () => {
    expect(() => normalizeOrigin('   ')).toThrow();
  });

  it('parses comma-separated origins and removes duplicates', () => {
    expect(
      parseCsvOrigins(
        'https://ogabassey.com, https://shop.ogabassey.com/path, https://ogabassey.com'
      )
    ).toEqual(['https://ogabassey.com', 'https://shop.ogabassey.com']);
  });

  it('parses comma-separated absolute urls and preserves query strings', () => {
    expect(
      parseCsvUrls(
        'https://usebaci.com/pricing, https://ogabassey.com/blog?utm_source=test'
      )
    ).toEqual([
      'https://usebaci.com/pricing',
      'https://ogabassey.com/blog?utm_source=test',
    ]);
  });

  it('skips invalid urls instead of throwing', () => {
    expect(parseCsvUrls('not-a-url, https://usebaci.com/pricing')).toEqual([
      'https://usebaci.com/pricing',
    ]);
  });

  it('parses toggle env strings with a default fallback', () => {
    expect(parseToggle(undefined, true)).toBe(true);
    expect(parseToggle('false', true)).toBe(false);
    expect(parseToggle('0', true)).toBe(false);
    expect(parseToggle('yes', false)).toBe(true);
  });
});
