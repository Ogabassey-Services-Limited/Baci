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
    ['protocol-relative', '//evil.com'],
    ['traversal', '/utilities/../admin'],
    ['trailing traversal', '/utilities/..'],
    ['current-dir segment', '/utilities/./x'],
    ['backslash', '/utilities\\evil'],
    ['encoded slash', '/utilities%2f..%2fadmin'],
    ['encoded backslash', '%5c%5cevil.com'],
    ['relative', 'utilities/airtime'],
    ['non-string', 42],
    ['undefined', undefined],
  ])('rejects %s', (_label, value) => {
    expect(sanitizeWalletReturnToPath(value)).toBeUndefined();
  });

  it('rejects values whose single decode reveals encoded separators', () => {
    expect(sanitizeWalletReturnToPath('/utilities%252fadmin')).toBeUndefined();
  });
});
