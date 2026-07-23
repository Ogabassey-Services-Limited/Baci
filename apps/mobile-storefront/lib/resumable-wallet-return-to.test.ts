import { describe, expect, it } from '@jest/globals';
import { sanitizeResumableWalletReturnTo } from './resumable-wallet-return-to';

describe('sanitizeResumableWalletReturnTo', () => {
  it.each([
    '/checkout',
    '/imei-check',
    '/utilities/airtime',
    '/utilities/data',
    '/utilities/tv',
    '/utilities/power',
    '/utilities/gaming',
    '/utilities/data?repeatAmount=1000&repeatNetwork=mtn',
  ])('accepts the resumable destination %s', (path) => {
    expect(sanitizeResumableWalletReturnTo(path)).toBe(path);
  });

  it.each([
    ['auth redirector chain', '/auth/callback?returnTo=//evil.com'],
    [
      'auth redirector with absolute nested value',
      '/auth/callback?returnTo=https://evil.com',
    ],
    ['nested redirect param', '/checkout?redirect=//evil.com'],
    ['nested next param', '/checkout?next=/auth/callback'],
    ['encoded nested returnTo', '/checkout%3FreturnTo=%2F%2Fevil.com'],
    ['unknown route', '/settings'],
    ['unknown utility type', '/utilities/crypto'],
    ['protocol-relative', '//evil.com'],
    ['traversal', '/checkout/../auth/callback'],
    ['backslash', '/checkout\\evil'],
    ['non-string', 42],
    ['undefined', undefined],
  ])('rejects %s', (_label, value) => {
    expect(sanitizeResumableWalletReturnTo(value)).toBeUndefined();
  });
});
