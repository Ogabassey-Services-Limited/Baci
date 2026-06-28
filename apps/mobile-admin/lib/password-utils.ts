/**
 * Common passwords blocklist (top 100 most common)
 * Based on SecLists and HaveIBeenPwned data
 */
const COMMON_PASSWORDS = new Set([
  'password',
  '123456',
  '12345678',
  'qwerty',
  'abc123',
  'monkey',
  '1234567',
  'letmein',
  'trustno1',
  'dragon',
  'baseball',
  'iloveyou',
  'master',
  'sunshine',
  'ashley',
  'bailey',
  'shadow',
  '123123',
  '654321',
  'superman',
  'qazwsx',
  'michael',
  'football',
  'password1',
  'password123',
  'batman',
  'login',
  'welcome',
  'admin',
  'princess',
  'qwerty123',
  '1q2w3e4r',
  'passw0rd',
  '1234567890',
  'welcome1',
  'p@ssw0rd',
  'hello',
  'charlie',
  'donald',
  'password1!',
  'qwerty1',
  '123qwe',
  'zxcvbnm',
  '121212',
  '000000',
  'access',
  'flower',
  'hottie',
  'loveme',
  'zaq1zaq1',
  'password2',
  'killer',
  'soccer',
  'fuckyou',
  'jennifer',
  'hunter',
  'buster',
  'soccer1',
  'hockey',
  'george',
  'andrew',
  'harley',
  'summer',
  'love',
]);

/**
 * Check if password is a common/weak password
 */
export const isCommonPassword = (password: string): boolean => {
  const lower = password.toLowerCase();
  // Check exact match
  if (COMMON_PASSWORDS.has(lower)) return true;
  // Check with common suffixes removed
  const withoutSuffix = lower.replace(/[0-9!@#$%^&*]+$/, '');
  if (COMMON_PASSWORDS.has(withoutSuffix)) return true;
  return false;
};

/**
 * Password strength checker following NIST SP 800-63B guidelines
 *
 * NIST recommendations:
 * - Minimum 8 characters (we use this as baseline)
 * - Longer is better (12+ is strong, 16+ is very strong)
 * - No complexity requirements (they don't help)
 * - Block common passwords
 * - Check against breach databases (done separately)
 *
 * Returns: 0 (none), 1 (weak), 2 (medium), 3 (strong)
 */
export const checkPasswordStrength = (password: string): number => {
  if (!password) return 0;

  const length = password.length;

  // Too short
  if (length < 8) return 0;

  // Check for common passwords (always weak regardless of length)
  if (isCommonPassword(password)) return 1;

  // Check for keyboard patterns and repeated characters
  const hasRepeatingChars = /(.)\1{2,}/.test(password); // aaa, 111
  const hasSequentialChars =
    /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(
      password
    );
  const hasKeyboardPattern = /(qwerty|asdf|zxcv|qazwsx|1qaz|2wsx)/i.test(
    password
  );

  // Penalize patterns
  if (hasRepeatingChars || hasSequentialChars || hasKeyboardPattern) {
    if (length < 12) return 1;
    if (length < 16) return 2;
  }

  // Length-based scoring (NIST approach: length is the primary factor)
  if (length >= 16) return 3; // Very strong
  if (length >= 12) return 3; // Strong
  if (length >= 10) return 2; // Medium
  return 1; // 8-9 chars: Weak but acceptable
};

export interface PasswordValidationResult {
  isValid: boolean;
  strength: number; // 0-3
  error?: string;
  requirements: {
    length: boolean;
    complexity: boolean; // mapped from strength >= 2
    match?: boolean;
    notCommon: boolean;
  };
}

export const validatePassword = (
  password: string,
  confirmPassword?: string
): PasswordValidationResult => {
  const strength = checkPasswordStrength(password);
  const isCommon = isCommonPassword(password);
  const lengthValid = password.length >= 8;
  const matchValid =
    confirmPassword !== undefined ? password === confirmPassword : true;

  // Rule: strength must be at least 2 (Medium) to be valid.
  // With the length-first scorer above, that means 10+ characters without
  // common/repeating/sequential/keyboard patterns, or 12+ characters when a
  // mild pattern penalty still leaves the password at medium strength.
  const strengthValid = strength >= 2;

  const isValid = lengthValid && strengthValid && !isCommon && matchValid;

  let error: string | undefined;
  if (!lengthValid) error = 'Password must be at least 8 characters.';
  else if (isCommon) error = 'This password is too common.';
  else if (!strengthValid)
    error = 'Password is too weak. Try making it longer.';
  else if (!matchValid) error = 'Passwords do not match.';

  return {
    isValid,
    strength,
    error,
    requirements: {
      length: lengthValid,
      complexity: strengthValid,
      match: confirmPassword !== undefined ? matchValid : undefined,
      notCommon: password.length > 0 && !isCommon,
    },
  };
};
