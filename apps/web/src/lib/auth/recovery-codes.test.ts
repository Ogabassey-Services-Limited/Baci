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

describe('generateRecoveryCodes', () => {
  it('returns the default number of codes', () => {
    expect(generateRecoveryCodes()).toHaveLength(RECOVERY_CODE_COUNT);
  });

  it('returns the requested number of codes', () => {
    expect(generateRecoveryCodes(6)).toHaveLength(6);
  });

  it('produces unique codes within a set', () => {
    const codes = generateRecoveryCodes(50);
    expect(new Set(codes.map(normalizeRecoveryCode)).size).toBe(50);
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

  it('does not collide across separate generations', () => {
    const a = generateRecoveryCodes().map(normalizeRecoveryCode);
    const b = generateRecoveryCodes().map(normalizeRecoveryCode);
    expect(a.some((code) => b.includes(code))).toBe(false);
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
    const [code] = generateRecoveryCodes(1);
    expect(hashRecoveryCode(code, PEPPER)).toBe(hashRecoveryCode(code, PEPPER));
  });

  it('never returns the plaintext code', () => {
    const [code] = generateRecoveryCodes(1);
    const hash = hashRecoveryCode(code, PEPPER);
    expect(hash).not.toContain(normalizeRecoveryCode(code));
    expect(hash).toMatch(/^[0-9a-f]{64}$/); // HMAC-SHA-256 hex
  });

  it('changes with a different pepper (keyed)', () => {
    const [code] = generateRecoveryCodes(1);
    expect(hashRecoveryCode(code, PEPPER)).not.toBe(
      hashRecoveryCode(code, 'a-different-pepper')
    );
  });

  it('produces different hashes for different codes', () => {
    const [a, b] = generateRecoveryCodes(2);
    expect(hashRecoveryCode(a, PEPPER)).not.toBe(hashRecoveryCode(b, PEPPER));
  });

  it('ignores formatting (hyphens/case) — hash matches the normalized code', () => {
    const [code] = generateRecoveryCodes(1);
    const messy = `  ${code.toLowerCase()}  `;
    expect(hashRecoveryCode(messy, PEPPER)).toBe(
      hashRecoveryCode(code, PEPPER)
    );
  });
});

describe('verifyRecoveryCode', () => {
  it('accepts the correct code regardless of formatting', () => {
    const [code] = generateRecoveryCodes(1);
    const stored = hashRecoveryCode(code, PEPPER);
    expect(verifyRecoveryCode(code, stored, PEPPER)).toBe(true);
    expect(verifyRecoveryCode(code.toLowerCase(), stored, PEPPER)).toBe(true);
    expect(verifyRecoveryCode(code.replace(/-/g, ''), stored, PEPPER)).toBe(
      true
    );
  });

  it('rejects an incorrect code', () => {
    const [code, other] = generateRecoveryCodes(2);
    const stored = hashRecoveryCode(code, PEPPER);
    expect(verifyRecoveryCode(other, stored, PEPPER)).toBe(false);
  });

  it('rejects when the pepper is wrong', () => {
    const [code] = generateRecoveryCodes(1);
    const stored = hashRecoveryCode(code, PEPPER);
    expect(verifyRecoveryCode(code, stored, 'wrong-pepper')).toBe(false);
  });

  it('rejects empty / malformed input safely', () => {
    const [code] = generateRecoveryCodes(1);
    const stored = hashRecoveryCode(code, PEPPER);
    expect(verifyRecoveryCode('', stored, PEPPER)).toBe(false);
    expect(verifyRecoveryCode(code, '', PEPPER)).toBe(false);
  });

  it('rejects oversized input before hashing', () => {
    const [code] = generateRecoveryCodes(1);
    const stored = hashRecoveryCode(code, PEPPER);
    expect(
      verifyRecoveryCode(
        'A'.repeat(MAX_RECOVERY_CODE_INPUT_LENGTH + 1),
        stored,
        PEPPER
      )
    ).toBe(false);
  });
});
