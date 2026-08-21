import { describe, expect, it } from 'vitest';
import {
  decryptAdsToken,
  encryptAdsToken,
  timingSafeStringEqual,
} from './crypto';

const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64url');

describe('ads crypto', () => {
  it('encrypts a provider-bound token without serializing its plaintext', () => {
    const ciphertext = encryptAdsToken(
      'opaque-secret-value',
      ENCRYPTION_KEY,
      'meta_ads'
    );

    expect(ciphertext).toMatch(/^v2\.meta_ads\.[^.]+\.[^.]+\.[^.]+$/);
    expect(ciphertext).not.toContain('opaque-secret-value');
    expect(decryptAdsToken(ciphertext, ENCRYPTION_KEY, 'meta_ads')).toBe(
      'opaque-secret-value'
    );
  });

  it('does not decrypt a token for a different provider', () => {
    const ciphertext = encryptAdsToken(
      'opaque-secret-value',
      ENCRYPTION_KEY,
      'meta_ads'
    );

    expect(() =>
      decryptAdsToken(ciphertext, ENCRYPTION_KEY, 'tiktok_ads')
    ).toThrow();
  });

  it('compares state/cookie values without exposing length differences', () => {
    expect(timingSafeStringEqual('same', 'same')).toBe(true);
    expect(timingSafeStringEqual('same', 'different')).toBe(false);
  });
});
