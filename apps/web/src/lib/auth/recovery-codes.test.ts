import { describe, expect, it } from 'vitest';
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  MAX_RECOVERY_CODE_INPUT_LENGTH,
  normalizeRecoveryCode,
  RECOVERY_CODE_COUNT,
  verifyRecoveryCode,
} from './recovery-codes';

const PEPPER = 'test-pepper-value-do-not-use-in-prod';
const FIXED_CODE = '0123-4567-89AB-CDEF-GHJK-MNPQ';
const OTHER_FIXED_CODE = 'RSTV-WXYZ-0123-4567-89AB-CDEF';

describe('generateRecoveryCodes', () => {
  it('returns the default number of codes', () => {
    expect(generateRecoveryCodes()).toHaveLength(RECOVERY_CODE_COUNT);
  });

  it('returns the requested number of codes', () => {
    expect(generateRecoveryCodes(6)).toHaveLength(6);
  });

  it('produces codes with at least 112 bits of entropy (>= 24 Crockford base32 chars)', () => {
    for (const code of generateRecoveryCodes()) {
      const normalized = normalizeRecoveryCode(code);
      expect(normalized.length).toBeGreaterThanOrEqual(24); // 24 * 5 = 120 bits
      // Crockford base32 alphabet only (excludes I, L, O, U)
      expect(normalized).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/);
    }
  });

  it('formats codes in hyphenated groups for readability', () => {
    for (const code of generateRecoveryCodes()) {
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4})+$/);
    }
  });
});

describe('normalizeRecoveryCode', () => {
  it('uppercases and strips separators/whitespace', () => {
    expect(normalizeRecoveryCode('abcd-efgh ijkm')).toBe(
      'ABCDEFGHIJKM'.replace(/[ILO]/g, (c) => (c === 'O' ? '0' : '1'))
    );
  });

  it('maps Crockford-ambiguous characters (O->0, I/L->1)', () => {
    expect(normalizeRecoveryCode('OIL0')).toBe('0110');
  });

  it('is idempotent', () => {
    const once = normalizeRecoveryCode('aBc-dEf');
    expect(normalizeRecoveryCode(once)).toBe(once);
  });
});

describe('hashRecoveryCode', () => {
  it('is deterministic for the same code + pepper', () => {
    expect(hashRecoveryCode(FIXED_CODE, PEPPER)).toBe(
      hashRecoveryCode(FIXED_CODE, PEPPER)
    );
  });

  it('never returns the plaintext code', () => {
    const hash = hashRecoveryCode(FIXED_CODE, PEPPER);
    expect(hash).not.toContain(normalizeRecoveryCode(FIXED_CODE));
    expect(hash).toMatch(/^[0-9a-f]{64}$/); // HMAC-SHA-256 hex
  });

  it('changes with a different pepper (keyed)', () => {
    expect(hashRecoveryCode(FIXED_CODE, PEPPER)).not.toBe(
      hashRecoveryCode(FIXED_CODE, 'a-different-pepper')
    );
  });

  it('produces different hashes for different codes', () => {
    expect(hashRecoveryCode(FIXED_CODE, PEPPER)).not.toBe(
      hashRecoveryCode(OTHER_FIXED_CODE, PEPPER)
    );
  });

  it('ignores formatting (hyphens/case) — hash matches the normalized code', () => {
    const messy = `  ${FIXED_CODE.toLowerCase()}  `;
    expect(hashRecoveryCode(messy, PEPPER)).toBe(
      hashRecoveryCode(FIXED_CODE, PEPPER)
    );
  });
});

describe('verifyRecoveryCode', () => {
  it('accepts the correct code regardless of formatting', () => {
    const stored = hashRecoveryCode(FIXED_CODE, PEPPER);
    expect(verifyRecoveryCode(FIXED_CODE, stored, PEPPER)).toBe(true);
    expect(verifyRecoveryCode(FIXED_CODE.toLowerCase(), stored, PEPPER)).toBe(
      true
    );
    expect(
      verifyRecoveryCode(FIXED_CODE.replace(/-/g, ''), stored, PEPPER)
    ).toBe(true);
  });

  it('rejects an incorrect code', () => {
    const stored = hashRecoveryCode(FIXED_CODE, PEPPER);
    expect(verifyRecoveryCode(OTHER_FIXED_CODE, stored, PEPPER)).toBe(false);
  });

  it('rejects when the pepper is wrong', () => {
    const stored = hashRecoveryCode(FIXED_CODE, PEPPER);
    expect(verifyRecoveryCode(FIXED_CODE, stored, 'wrong-pepper')).toBe(false);
  });

  it('rejects empty / malformed input safely', () => {
    const stored = hashRecoveryCode(FIXED_CODE, PEPPER);
    expect(verifyRecoveryCode('', stored, PEPPER)).toBe(false);
    expect(verifyRecoveryCode(FIXED_CODE, '', PEPPER)).toBe(false);
  });

  it('rejects oversized input before hashing', () => {
    const stored = hashRecoveryCode(FIXED_CODE, PEPPER);
    expect(
      verifyRecoveryCode(
        'A'.repeat(MAX_RECOVERY_CODE_INPUT_LENGTH + 1),
        stored,
        PEPPER
      )
    ).toBe(false);
  });
});
