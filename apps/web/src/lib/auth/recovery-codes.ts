import 'server-only';

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Merchant passkey recovery codes ("look-up secrets" per NIST SP 800-63B-4 §5.1.2).
 *
 * Design (research-backed):
 * - 120 bits of entropy per code (24 Crockford-base32 chars). Because each code
 *   has >= 112 bits, NIST permits an *approved one-way function* — no slow KDF.
 * - Hash = HMAC-SHA-256 keyed with a server-side pepper, so a DB leak alone is
 *   not enough to verify a code offline.
 * - Single-use, brute-force lockout, and replacement-code reissue are enforced
 *   by the store layer (see the recovery-code store/verify flow), not here.
 * - Account-recovery notifications belong to the recovery-session integration
 *   that consumes a successfully redeemed code.
 *
 * Refs: NIST SP 800-63B-4 §5.1.2 (look-up secrets); OWASP MFA Cheat Sheet.
 */

// Crockford base32 — excludes the visually ambiguous I, L, O, U.
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_CHARS = 24; // 24 * 5 bits = 120 bits of entropy per code

export const RECOVERY_CODE_COUNT = 10;
export const MAX_RECOVERY_CODE_INPUT_LENGTH = 128;

function randomCrockfordChar(): string {
  return CROCKFORD_ALPHABET[randomInt(CROCKFORD_ALPHABET.length)];
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    let raw = '';
    for (let c = 0; c < CODE_CHARS; c += 1) {
      raw += randomCrockfordChar();
    }
    const groups = raw.match(/.{1,4}/g) ?? [raw]; // 4-char groups for readability
    codes.push(groups.join('-'));
  }
  return codes;
}

/**
 * Canonical form for storage/comparison: uppercase, separators stripped, and
 * Crockford-ambiguous characters folded (O -> 0, I/L -> 1) so a user typing
 * "O"/"l" still matches.
 */
export function normalizeRecoveryCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export function hashRecoveryCode(code: string, pepper: string): string {
  return createHmac('sha256', pepper)
    .update(normalizeRecoveryCode(code))
    .digest('hex');
}

export function hashRecoveryCodeCandidate(
  input: string,
  pepper: string
): string | null {
  if (!input || input.length > MAX_RECOVERY_CODE_INPUT_LENGTH) {
    return null;
  }

  return hashRecoveryCode(input, pepper);
}

export function verifyRecoveryCodeHash(
  candidateHash: string | null,
  storedHash: string
): boolean {
  if (!candidateHash || !storedHash) {
    return false;
  }

  const candidate = Buffer.from(candidateHash, 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(candidate, stored);
}

export function verifyRecoveryCode(
  input: string,
  storedHash: string,
  pepper: string
): boolean {
  return verifyRecoveryCodeHash(
    hashRecoveryCodeCandidate(input, pepper),
    storedHash
  );
}
