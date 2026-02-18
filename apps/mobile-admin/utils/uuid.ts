import * as Crypto from 'expo-crypto';

/**
 * Generates a RFC4122 version 4 compliant UUID
 * Uses crypto.randomUUID() when available (modern Hermes/JSC), falls back to expo-crypto
 */
export function generateUUID(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return Crypto.randomUUID();
}
