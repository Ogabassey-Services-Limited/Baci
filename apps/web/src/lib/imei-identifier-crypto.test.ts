// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  decryptImeiIdentifier,
  encryptImeiIdentifier,
} from './imei-identifier-crypto';

const KEY = Buffer.alloc(32, 7).toString('base64');
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64');

describe('IMEI identifier encryption', () => {
  it('round-trips an identifier with authenticated encryption', () => {
    const ciphertext = encryptImeiIdentifier('490154203237518', KEY);

    expect(ciphertext).toMatch(/^v1\.[^.]+\.[^.]+\.[^.]+$/);
    expect(decryptImeiIdentifier(ciphertext, KEY)).toBe('490154203237518');
  });

  it('uses a fresh IV for each encryption', () => {
    expect(encryptImeiIdentifier('490154203237518', KEY)).not.toBe(
      encryptImeiIdentifier('490154203237518', KEY)
    );
  });

  it('rejects an invalid key or tampered ciphertext', () => {
    const ciphertext = encryptImeiIdentifier('490154203237518', KEY);

    expect(() => decryptImeiIdentifier(ciphertext, OTHER_KEY)).toThrow();
    expect(() => encryptImeiIdentifier('490154203237518', 'too-short')).toThrow(
      '32-byte base64 or 64-character hex'
    );
  });
});
