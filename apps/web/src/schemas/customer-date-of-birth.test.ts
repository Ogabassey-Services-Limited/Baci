import { describe, expect, it } from 'vitest';
import { dateOfBirthSchema } from './customer-date-of-birth';

describe('dateOfBirthSchema', () => {
  it('accepts a well-formed past date', () => {
    expect(dateOfBirthSchema.safeParse('1990-06-15').success).toBe(true);
  });

  it('rejects the wrong format', () => {
    expect(dateOfBirthSchema.safeParse('15/06/1990').success).toBe(false);
    expect(dateOfBirthSchema.safeParse('1990-6-5').success).toBe(false);
    expect(dateOfBirthSchema.safeParse('').success).toBe(false);
  });

  it('rejects an impossible calendar date', () => {
    // Feb 30 rolls over — must be caught, not silently accepted.
    expect(dateOfBirthSchema.safeParse('1990-02-30').success).toBe(false);
    expect(dateOfBirthSchema.safeParse('2000-13-01').success).toBe(false);
  });

  it('rejects a future date', () => {
    const nextYear = new Date().getUTCFullYear() + 1;
    expect(dateOfBirthSchema.safeParse(`${nextYear}-01-01`).success).toBe(
      false
    );
  });

  it('rejects an implausibly old date (>120 years)', () => {
    const tooOld = new Date().getUTCFullYear() - 130;
    expect(dateOfBirthSchema.safeParse(`${tooOld}-01-01`).success).toBe(false);
  });

  it('accepts an under-18 date (eligibility is decided server-side, not here)', () => {
    const child = new Date().getUTCFullYear() - 10;
    expect(dateOfBirthSchema.safeParse(`${child}-01-01`).success).toBe(true);
  });
});
