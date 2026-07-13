import { createHmac } from 'node:crypto';

const MINIMUM_KEY_BYTES = 32;

export function createFingerprint(key) {
  if (!Buffer.isBuffer(key)) {
    throw new Error('fingerprint key must be a private binary buffer');
  }
  if (key.byteLength < MINIMUM_KEY_BYTES) {
    throw new Error(
      `fingerprint key must contain at least ${MINIMUM_KEY_BYTES} bytes`
    );
  }
  return (value) => createHmac('sha256', key).update(value).digest('hex');
}
