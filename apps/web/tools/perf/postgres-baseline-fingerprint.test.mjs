import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createFingerprint } from './postgres-baseline-fingerprint.mjs';

const key = Buffer.from('baseline-fingerprint-key-material-32-bytes');

describe('postgres baseline fingerprints', () => {
  it('uses a stable keyed HMAC instead of a guessable SHA-256 digest', () => {
    const value = 'public\u001fproducts\u001fmerchant_id';
    const fingerprint = createFingerprint(key);

    expect(fingerprint(value)).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint(value)).toBe(createFingerprint(Buffer.from(key))(value));
    expect(fingerprint(value)).not.toBe(
      createHash('sha256').update(value).digest('hex')
    );
    expect(fingerprint(value)).not.toBe(
      createFingerprint(Buffer.from('another-fingerprint-key-material-32'))(
        value
      )
    );
  });

  it('rejects missing and undersized key material', () => {
    expect(() => createFingerprint()).toThrow(/fingerprint key/i);
    expect(() => createFingerprint(Buffer.alloc(31))).toThrow(/32 bytes/i);
  });
});
