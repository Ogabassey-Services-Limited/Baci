import { describe, expect, it } from 'vitest';
import { isValidHttpUrl } from './is-valid-http-url';

describe('isValidHttpUrl', () => {
  it('accepts HTTP URLs and rejects malformed or non-web URLs', () => {
    expect(isValidHttpUrl('https://ogabassey.com/robots.txt')).toBe(true);
    expect(isValidHttpUrl('http://localhost:3000/sitemap.xml')).toBe(true);
    expect(isValidHttpUrl('mailto:support@ogabassey.com')).toBe(false);
    expect(isValidHttpUrl('not-a-url')).toBe(false);
  });
});
