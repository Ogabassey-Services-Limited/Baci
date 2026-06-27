import { describe, expect, it } from 'vitest';
import {
  checkPasswordStrength,
  isCommonPassword,
  validatePassword,
} from './password-utils';

describe('password-utils', () => {
  describe('isCommonPassword', () => {
    it('returns true for exact matches in the common list', () => {
      expect(isCommonPassword('password')).toBe(true);
      expect(isCommonPassword('123456')).toBe(true);
      expect(isCommonPassword('qwerty')).toBe(true);
    });

    it('returns true for matches with common suffixes removed', () => {
      expect(isCommonPassword('password123!')).toBe(true);
      expect(isCommonPassword('admin99')).toBe(true);
      expect(isCommonPassword('qwerty@#$')).toBe(true);
    });

    it('returns false for non-common passwords', () => {
      expect(isCommonPassword('uniquePassw0rd')).toBe(false);
      expect(isCommonPassword('BaciSecure2026!')).toBe(false);
    });
  });

  describe('checkPasswordStrength', () => {
    it('returns 0 for passwords shorter than 8 characters', () => {
      expect(checkPasswordStrength('short')).toBe(0);
      expect(checkPasswordStrength('1234567')).toBe(0);
      expect(checkPasswordStrength('')).toBe(0);
    });

    it('returns 1 for common passwords regardless of length', () => {
      expect(checkPasswordStrength('password')).toBe(1);
      expect(checkPasswordStrength('password123')).toBe(1);
    });

    it('returns 1 for 8-9 character passwords without patterns', () => {
      expect(checkPasswordStrength('GoodP@sw')).toBe(1);
      expect(checkPasswordStrength('TestPass1')).toBe(1);
    });

    it('returns 2 for 10-11 character passwords without patterns', () => {
      // Note: 'GoodP@ssword' has 12 chars so it would return 3. Let's use 10-11 char strings.
      expect(checkPasswordStrength('GoodP@ss12')).toBe(2);
      expect(checkPasswordStrength('SecureTest1')).toBe(2);
    });

    it('returns 3 for passwords 12 characters or longer without patterns', () => {
      expect(checkPasswordStrength('VerySecureP@ssword123')).toBe(3);
      expect(checkPasswordStrength('LongRandomString!')).toBe(3);
    });

    it('penalizes repeating characters', () => {
      // 10 chars with repeats: normally 2, but penalized to 1
      expect(checkPasswordStrength('aaaa123456')).toBe(1);
      // 12 chars with repeats: normally 3, but penalized to 2
      expect(checkPasswordStrength('aaaa12345678')).toBe(2);
      // 16 chars with repeats: normally 3, penalized to 2 because 16 is not < 16 but 12 < 16 condition
      // Wait, if length >= 16, it doesn't penalize below 2. length < 16 returns 2.
      // let's just test the < 12 case
    });

    it('penalizes sequential characters', () => {
      // 10 chars sequential
      expect(checkPasswordStrength('abc1234567')).toBe(1);
    });

    it('penalizes keyboard patterns', () => {
      // 10 chars pattern
      expect(checkPasswordStrength('qwertyTest')).toBe(1);
    });
  });

  describe('validatePassword', () => {
    it('validates a strong password successfully', () => {
      const result = validatePassword('SecurePass123!');
      expect(result.isValid).toBe(true);
      expect(result.strength).toBeGreaterThanOrEqual(2);
      expect(result.error).toBeUndefined();
      expect(result.requirements).toEqual({
        length: true,
        complexity: true,
        match: undefined,
        notCommon: true,
      });
    });

    it('validates a strong password with matching confirmPassword', () => {
      const result = validatePassword('SecurePass123!', 'SecurePass123!');
      expect(result.isValid).toBe(true);
      expect(result.requirements.match).toBe(true);
    });

    it('fails validation if password is too short', () => {
      const result = validatePassword('Short1!');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must be at least 8 characters.');
      expect(result.requirements.length).toBe(false);
    });

    it('fails validation if password is common', () => {
      const result = validatePassword('password123');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('This password is too common.');
      expect(result.requirements.notCommon).toBe(false);
    });

    it('fails validation if confirmPassword does not match', () => {
      const result = validatePassword('SecurePass123!', 'DifferentPass123!');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Passwords do not match.');
      expect(result.requirements.match).toBe(false);
    });

    it('fails validation for 8-9 character passwords despite comments', () => {
      // The code comment says: "This effectively enforces >10 chars OR >8 chars without patterns"
      // However, checkPasswordStrength returns 1 for length < 10.
      // validatePassword requires strength >= 2.
      // Therefore, 8 or 9 char passwords ALWAYS fail, even if they have no patterns.
      const result = validatePassword('GoodP@sw');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password is too weak. Try making it longer.');
      expect(result.strength).toBe(1);
      expect(result.requirements.complexity).toBe(false);
    });
  });
});
