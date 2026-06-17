import { describe, expect, it } from 'vitest';
import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';

describe('toSafeInternalRedirectPath', () => {
  it('returns trimmed internal paths', () => {
    expect(toSafeInternalRedirectPath(' /smartphones/iphone-15 ')).toBe(
      '/smartphones/iphone-15'
    );
  });

  it.each([
    null,
    undefined,
    123,
    '',
    'https://evil.example/path',
    '//evil.example/path',
    '/\\evil.example',
    '/smartphones/iphone:15',
    '/%2f%2fevil.example/path',
    '/smartphones/iphone%3a15',
  ])('rejects unsafe redirect path %s', (value) => {
    expect(toSafeInternalRedirectPath(value)).toBeNull();
  });
});
