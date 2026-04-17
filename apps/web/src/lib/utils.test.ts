import { describe, expect, it } from 'vitest';
import {
  checkPasswordStrength,
  isCommonPassword,
  MIN_ACCEPTABLE_PASSWORD_STRENGTH,
} from '@/lib/utils';

describe('utils', () => {
  describe('isCommonPassword', () => {
    it('should identify common passwords (exact match)', () => {
      expect(isCommonPassword('password')).toBe(true);
      expect(isCommonPassword('123456')).toBe(true);
    });

    it('should identify common passwords (case insensitive)', () => {
      expect(isCommonPassword('PASSWORD')).toBe(true);
      expect(isCommonPassword('PaSsWoRd')).toBe(true);
    });

    it('should identify common passwords with common suffixes', () => {
      expect(isCommonPassword('password123')).toBe(true);
      expect(isCommonPassword('password!')).toBe(true);
      expect(isCommonPassword('admin123!')).toBe(true);
    });

    it('should not identify unique passwords as common', () => {
      expect(isCommonPassword('MyUniquePassword')).toBe(false);
      expect(isCommonPassword('CorrectHorseBatteryStaple')).toBe(false);
    });
  });

  describe('checkPasswordStrength', () => {
    it('should return 0 for empty or very short passwords', () => {
      expect(checkPasswordStrength('')).toBe(0);
      expect(checkPasswordStrength('short')).toBe(0);
      expect(checkPasswordStrength('1234567')).toBe(0);
    });

    it('should return 1 for common passwords regardless of length', () => {
      expect(checkPasswordStrength('password')).toBe(1);
      expect(checkPasswordStrength('password123456')).toBe(1); // Long but common
    });

    it('should penalize repeating characters', () => {
      // 12 chars -> normally 3 (Strong), but pattern penalty -> 2 (Medium) because length < 16
      expect(checkPasswordStrength('aaaaaaaaaaaa')).toBe(2);

      // 11 chars -> normally 2 (Medium), but pattern penalty -> 1 (Weak) because length < 12
      expect(checkPasswordStrength('aaaaaaaaaaa')).toBe(1);
    });

    it('should penalize sequential characters', () => {
      // 12 chars -> normally 3 (Strong), but pattern penalty -> 2 (Medium) because length < 16
      expect(checkPasswordStrength('abcdefghijkl')).toBe(2);
    });

    it('should penalize keyboard patterns', () => {
      // 12 chars -> normally 3 (Strong), but pattern penalty -> 2 (Medium) because length < 16
      expect(checkPasswordStrength('qwertyuiopas')).toBe(2);
    });

    it('should treat long passwords with patterns as Strong', () => {
      // 16+ chars -> fall through pattern check (length >= 16) -> 3 (Strong)
      expect(checkPasswordStrength('aaaaaaaaaaaaaaaa')).toBe(3);
    });

    it('should return 2 (Medium) for medium length passwords (10-11 chars)', () => {
      expect(checkPasswordStrength('MyUniquePa')).toBe(2);
    });

    it('documents the minimum acceptable password strength score', () => {
      expect(MIN_ACCEPTABLE_PASSWORD_STRENGTH).toBe(2);
      expect(checkPasswordStrength('Longpass10')).toBe(
        MIN_ACCEPTABLE_PASSWORD_STRENGTH
      );
    });

    it('should return 3 (Strong) for strong passwords (12+ chars)', () => {
      expect(checkPasswordStrength('MyUniquePassword')).toBe(3);
    });

    it('should return 3 (Strong) for very strong passwords (16+ chars)', () => {
      expect(checkPasswordStrength('MyUniquePasswordLonger')).toBe(3);
    });
  });
});
