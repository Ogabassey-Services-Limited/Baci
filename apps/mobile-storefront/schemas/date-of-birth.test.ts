import {
  DateOfBirthSchema,
  getDateOfBirthValidationError,
} from './date-of-birth';

describe('DateOfBirthSchema', () => {
  it('accepts a real, past calendar date', () => {
    expect(DateOfBirthSchema.safeParse('1990-06-15').success).toBe(true);
  });

  it('rejects a non-ISO shape', () => {
    const result = DateOfBirthSchema.safeParse('15/06/1990');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Enter your date of birth as YYYY-MM-DD'
      );
    }
  });

  it('rejects an impossible calendar date (Feb 30)', () => {
    const result = DateOfBirthSchema.safeParse('1990-02-30');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Enter a valid date');
    }
  });

  it('rejects a future date', () => {
    const nextYear = new Date().getUTCFullYear() + 1;
    const result = DateOfBirthSchema.safeParse(`${nextYear}-01-01`);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Enter a valid date of birth'
      );
    }
  });

  it('rejects a date beyond a plausible lifespan (>120 years)', () => {
    const tooOld = new Date().getUTCFullYear() - 121;
    expect(DateOfBirthSchema.safeParse(`${tooOld}-01-01`).success).toBe(false);
  });

  it('accepts today (age 0 is a real, non-future date)', () => {
    const now = new Date();
    const iso = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    expect(DateOfBirthSchema.safeParse(iso).success).toBe(true);
  });
});

describe('getDateOfBirthValidationError', () => {
  it('returns null for a valid date of birth', () => {
    expect(getDateOfBirthValidationError('1990-06-15')).toBeNull();
  });

  it('returns a friendly message for a malformed value', () => {
    expect(getDateOfBirthValidationError('not-a-date')).toBe(
      'Enter your date of birth as YYYY-MM-DD'
    );
  });

  it('returns a friendly message for a future date', () => {
    const nextYear = new Date().getUTCFullYear() + 1;
    expect(getDateOfBirthValidationError(`${nextYear}-01-01`)).toBe(
      'Enter a valid date of birth'
    );
  });
});
