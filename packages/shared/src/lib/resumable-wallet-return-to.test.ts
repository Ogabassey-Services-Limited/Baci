import { describe, expect, it } from 'vitest';
import { sanitizeResumableWalletReturnTo } from './resumable-wallet-return-to';

describe('sanitizeResumableWalletReturnTo', () => {
  it.each([
    '/checkout',
    '/imei-check',
    '/orders/11111111-1111-4111-8111-111111111111',
    '/utilities/airtime',
    '/utilities/data',
    '/utilities/tv',
    '/utilities/power',
    '/utilities/gaming',
    '/utilities/airtime?repeatAmount=500&repeatPhoneNumber=08031234567',
  ])('accepts the resumable destination %s', (path) => {
    expect(sanitizeResumableWalletReturnTo(path)).toBe(path);
  });

  it.each([
    [
      'auth redirector with protocol-relative nested returnTo',
      '/auth/callback?returnTo=//evil.com',
    ],
    [
      'auth redirector with absolute nested returnTo',
      '/auth/callback?returnTo=https://evil.com',
    ],
    ['auth redirector without params', '/auth/callback'],
    [
      'nested redirect param on an allowlisted path',
      '/checkout?redirect=//evil.com',
    ],
    [
      'nested next param on an allowlisted path',
      '/checkout?next=/auth/callback',
    ],
    [
      'nested url param on an allowlisted path',
      '/checkout?url=https://evil.com',
    ],
    [
      'nested continue param on an allowlisted path',
      '/checkout?continue=//evil.com',
    ],
    ['encoded nested returnTo', '/checkout%3FreturnTo=%2F%2Fevil.com'],
    ['encoded pathname', '/%63heckout'],
    ['unknown internal route', '/settings'],
    ['unknown utility type', '/utilities/crypto'],
    ['utility history', '/utilities/history?type=power'],
    ['protocol-relative', '//evil.com'],
    ['traversal', '/checkout/../auth/callback'],
    ['backslash', '/checkout\\evil'],
    ['fragment', '/checkout#/auth/callback'],
    ['relative', 'checkout'],
    ['non-string', 42],
    ['undefined', undefined],
  ])('rejects %s', (_label, value) => {
    expect(sanitizeResumableWalletReturnTo(value)).toBeUndefined();
  });
});
