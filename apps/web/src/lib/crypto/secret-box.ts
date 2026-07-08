// Server-only AES-256-GCM envelope for merchant payment credentials (BYOK
// vault, see docs/payments/byok-payment-providers-plan.md Phase 0.2). The
// KEK never leaves this module and this module never runs in a client
// bundle — `server-only` enforces the latter at build time.
import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
/** AES-GCM's recommended IV size — 96 bits. */
const IV_LENGTH_BYTES = 12;
/** GCM authentication tag size. */
const AUTH_TAG_LENGTH_BYTES = 16;
/** AES-256 key size. */
const KEK_LENGTH_BYTES = 32;

/** The KEK version new ciphertexts are minted with. */
const CURRENT_KEK_VERSION = 1;

/**
 * Maps a KEK version to the env var that holds its base64-encoded 32-byte
 * key. Rotation adds an entry here (e.g. `2: 'PAYMENT_CREDS_ENCRYPTION_KEY_V2'`)
 * — old ciphertexts keep decrypting against their stored `kekVersion` while
 * new writes move to the newest version.
 */
const KEK_ENV_VAR_BY_VERSION: Readonly<Record<number, string>> = {
  1: 'PAYMENT_CREDS_ENCRYPTION_KEY',
};

/**
 * Resolves and validates the KEK for a given version straight from
 * `process.env` on every call (never cached at module scope) so callers
 * always see the current environment — required for key rotation and for
 * tests that stub env vars per-case. Never logs the key value; error
 * messages name the env var, never its contents.
 */
function resolveKek(kekVersion: number): Buffer {
  const envVarName = KEK_ENV_VAR_BY_VERSION[kekVersion];
  if (!envVarName) {
    throw new Error(
      `secret-box: unknown kekVersion ${kekVersion} — no KEK env var is registered for it.`
    );
  }

  const rawValue = process.env[envVarName];
  if (!rawValue) {
    throw new Error(
      `secret-box: ${envVarName} is not set. Cannot encrypt or decrypt payment credentials without it.`
    );
  }

  const decoded = Buffer.from(rawValue, 'base64');
  if (decoded.length !== KEK_LENGTH_BYTES) {
    throw new Error(
      `secret-box: ${envVarName} must decode from base64 to exactly ${KEK_LENGTH_BYTES} bytes (got ${decoded.length}).`
    );
  }

  return decoded;
}

/**
 * Encrypts a secret with the current KEK version. Storage format is a
 * single base64 string: `iv (12 bytes) || authTag (16 bytes) || ciphertext`.
 * The caller persists both `ciphertext` and `kekVersion` (as separate
 * columns/fields) — `kekVersion` is required to decrypt later.
 */
export function encryptSecret(plaintext: string): {
  ciphertext: string;
  kekVersion: number;
} {
  const kekVersion = CURRENT_KEK_VERSION;
  const key = resolveKek(kekVersion);

  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, authTag, encrypted]);
  return { ciphertext: payload.toString('base64'), kekVersion };
}

/**
 * Decrypts a secret previously produced by {@link encryptSecret}. Throws if
 * the KEK version is unknown, the KEK env var is missing/malformed, or
 * authentication fails (tampered ciphertext/authTag, or wrong KEK).
 */
export function decryptSecret(ciphertext: string, kekVersion: number): string {
  const key = resolveKek(kekVersion);

  const payload = Buffer.from(ciphertext, 'base64');
  const minLength = IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES;
  if (payload.length < minLength) {
    throw new Error(
      'secret-box: ciphertext payload is too short to contain an iv and authTag.'
    );
  }

  const iv = payload.subarray(0, IV_LENGTH_BYTES);
  const authTag = payload.subarray(
    IV_LENGTH_BYTES,
    IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES
  );
  const encrypted = payload.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error(
      'secret-box: failed to decrypt — authentication failed or ciphertext is corrupted.'
    );
  }
}
