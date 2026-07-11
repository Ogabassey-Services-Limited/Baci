import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_BYTES = 16;
const IV_BYTES = 12;
const VERSION = 'v1';
const AAD = Buffer.from('baci-imei-identifier:v1', 'utf8');
const HEX_KEY_PATTERN = /^[0-9a-f]{64}$/i;
const BASE64_KEY_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function decodeKey(encodedKey: string): Buffer {
  const value = encodedKey.trim();
  const key = HEX_KEY_PATTERN.test(value)
    ? Buffer.from(value, 'hex')
    : BASE64_KEY_PATTERN.test(value)
      ? Buffer.from(value, 'base64')
      : Buffer.alloc(0);

  if (key.length !== 32) {
    throw new Error(
      'IMEI identifier encryption key must be a 32-byte base64 or 64-character hex value'
    );
  }
  return key;
}

export function encryptImeiIdentifier(
  identifier: string,
  encodedKey: string
): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, decodeKey(encodedKey), iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([
    cipher.update(identifier, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptImeiIdentifier(
  payload: string,
  encodedKey: string
): string {
  const [version, ivValue, authTagValue, ciphertextValue, extra] =
    payload.split('.');
  if (
    version !== VERSION ||
    !ivValue ||
    !authTagValue ||
    !ciphertextValue ||
    extra
  ) {
    throw new Error('Invalid IMEI identifier ciphertext');
  }

  const iv = Buffer.from(ivValue, 'base64url');
  const authTag = Buffer.from(authTagValue, 'base64url');
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error('Invalid IMEI identifier ciphertext');
  }

  const decipher = createDecipheriv(ALGORITHM, decodeKey(encodedKey), iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  decipher.setAAD(AAD);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
