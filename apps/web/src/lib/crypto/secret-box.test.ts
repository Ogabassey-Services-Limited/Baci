import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

// `server-only` throws unconditionally when imported outside a Server
// Component bundle — stub it so the module under test can load in Vitest.
vi.mock('server-only', () => ({}));

import { decryptSecret, encryptSecret } from './secret-box';

const ENV_VAR = 'PAYMENT_CREDS_ENCRYPTION_KEY';

function validBase64Key(): string {
  return randomBytes(32).toString('base64');
}

/** Flips one bit of the byte at `byteIndex` in a base64 payload string. */
function tamperBase64Byte(base64Payload: string, byteIndex: number): string {
  const bytes = Buffer.from(base64Payload, 'base64');
  bytes[byteIndex] ^= 0xff;
  return bytes.toString('base64');
}

describe('secret-box', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('round-trips a plaintext secret through encrypt then decrypt', () => {
    // Arrange
    vi.stubEnv(ENV_VAR, validBase64Key());
    const plaintext = 'rk_live_super_secret_stripe_key';

    // Act
    const { ciphertext, kekVersion } = encryptSecret(plaintext);
    const decrypted = decryptSecret(ciphertext, kekVersion);

    // Assert
    expect(decrypted).toBe(plaintext);
    expect(kekVersion).toBe(1);
  });

  it('round-trips an empty-string plaintext', () => {
    // Arrange
    vi.stubEnv(ENV_VAR, validBase64Key());

    // Act
    const { ciphertext, kekVersion } = encryptSecret('');
    const decrypted = decryptSecret(ciphertext, kekVersion);

    // Assert
    expect(decrypted).toBe('');
  });

  it('produces a different ciphertext and IV on each call (random IV per encryption)', () => {
    // Arrange
    vi.stubEnv(ENV_VAR, validBase64Key());
    const plaintext = 'same-plaintext-every-time';

    // Act
    const first = encryptSecret(plaintext);
    const second = encryptSecret(plaintext);

    // Assert
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('throws when the auth tag byte has been tampered with', () => {
    // Arrange
    vi.stubEnv(ENV_VAR, validBase64Key());
    const { ciphertext, kekVersion } = encryptSecret('a merchant secret');
    // iv is bytes 0-11, authTag is bytes 12-27 — tamper inside the authTag.
    const tampered = tamperBase64Byte(ciphertext, 15);

    // Act & Assert
    expect(() => decryptSecret(tampered, kekVersion)).toThrow(
      /failed to decrypt/i
    );
  });

  it('throws when a ciphertext byte has been tampered with', () => {
    // Arrange
    vi.stubEnv(ENV_VAR, validBase64Key());
    const { ciphertext, kekVersion } = encryptSecret('a merchant secret');
    // Ciphertext bytes start at offset 28 (12-byte iv + 16-byte authTag).
    const tampered = tamperBase64Byte(ciphertext, 28);

    // Act & Assert
    expect(() => decryptSecret(tampered, kekVersion)).toThrow(
      /failed to decrypt/i
    );
  });

  it('throws when decrypting with the wrong KEK', () => {
    // Arrange
    vi.stubEnv(ENV_VAR, validBase64Key());
    const { ciphertext, kekVersion } = encryptSecret('a merchant secret');

    // Act: swap in a different, still-valid 32-byte key before decrypting.
    vi.stubEnv(ENV_VAR, validBase64Key());

    // Assert
    expect(() => decryptSecret(ciphertext, kekVersion)).toThrow(
      /failed to decrypt/i
    );
  });

  it('throws a clear error when the KEK env var is missing', () => {
    // Arrange
    vi.stubEnv(ENV_VAR, '');
    delete process.env[ENV_VAR];

    // Act & Assert
    expect(() => encryptSecret('anything')).toThrow(
      /PAYMENT_CREDS_ENCRYPTION_KEY is not set/
    );
  });

  it('throws a clear error when the KEK env var does not decode to 32 bytes', () => {
    // Arrange
    vi.stubEnv(ENV_VAR, Buffer.from('too-short').toString('base64'));

    // Act & Assert
    expect(() => encryptSecret('anything')).toThrow(
      /must decode from base64 to exactly 32 bytes/
    );
  });

  it('throws a clear error for an unknown kekVersion', () => {
    // Arrange
    vi.stubEnv(ENV_VAR, validBase64Key());
    const { ciphertext } = encryptSecret('anything');

    // Act & Assert
    expect(() => decryptSecret(ciphertext, 999)).toThrow(
      /unknown kekVersion 999/
    );
  });
});
