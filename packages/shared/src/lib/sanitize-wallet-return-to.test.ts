import { describe, expect, it } from 'vitest';
import { sanitizeWalletReturnToPath } from './sanitize-wallet-return-to';

describe('sanitizeWalletReturnToPath', () => {
  it.each([
    '/utilities/airtime',
    '/utilities/airtime?repeatAmount=500&repeatPhoneNumber=08031234567',
    '/checkout',
    '/imei-check',
  ])('accepts the internal path %s', (path) => {
    expect(sanitizeWalletReturnToPath(path)).toBe(path);
  });

  it.each([
    [
      'a slash inside an address value',
      '/utilities/tv?repeatCustomerAddress=Flat%201%2F2',
    ],
    ['a backslash inside a value', '/utilities/power?repeatBillerName=A%5CB'],
  ])('accepts %s — encoded separators only steer navigation in the PATH', (_label, href) => {
    expect(sanitizeWalletReturnToPath(href)).toBe(href);
  });

  it.each([
    ['protocol-relative', '//evil.com'],
    ['traversal', '/utilities/../admin'],
    ['trailing traversal', '/utilities/..'],
    ['current-dir segment', '/utilities/./x'],
    ['backslash', '/utilities\\evil'],
    ['encoded slash in the path', '/utilities%2f..%2fadmin'],
    ['encoded backslash', '%5c%5cevil.com'],
    ['relative', 'utilities/airtime'],
    ['fragment', '/checkout#/../secrets'],
    ['encoded query delimiter in the path', '/checkout%3Fmode=resume'],
    ['encoded fragment delimiter in the path', '/checkout%23resume'],
    ['nested returnTo param', '/checkout?returnTo=//evil.com'],
    ['nested redirect param', '/checkout?redirect=%2F%2Fevil.com'],
    ['nested next param', '/checkout?next=/auth/callback'],
    ['malformed query pair', '/checkout?novalue'],
    ['non-string', 42],
    ['undefined', undefined],
  ])('rejects %s', (_label, value) => {
    expect(sanitizeWalletReturnToPath(value)).toBeUndefined();
  });

  it('rejects a double-encoded separator that a single decode reveals', () => {
    expect(sanitizeWalletReturnToPath('/utilities%252fadmin')).toBeUndefined();
  });

  it('rejects an encoded "?" — the whole value is then a path, so %2F cannot hide in a "query"', () => {
    expect(
      sanitizeWalletReturnToPath('/checkout%3FreturnTo=%2F%2Fevil.com')
    ).toBeUndefined();
  });
});
