import { describe, expect, it } from 'vitest';
import {
  calculateQuizAgeYears,
  parseQuizDateOfBirth,
} from './route-helpers-age';

describe('quiz age helpers', () => {
  it('rejects impossible and non-ISO dates', () => {
    expect(parseQuizDateOfBirth('2000-02-30')).toBeNull();
    expect(parseQuizDateOfBirth('02/29/2000')).toBeNull();
  });

  it('calculates age around the UTC birthday boundary', () => {
    const dateOfBirth = parseQuizDateOfBirth('2008-08-06');
    expect(dateOfBirth).not.toBeNull();
    if (!dateOfBirth) return;

    expect(
      calculateQuizAgeYears(dateOfBirth, new Date('2026-08-05T23:59:59Z'))
    ).toBe(17);
    expect(
      calculateQuizAgeYears(dateOfBirth, new Date('2026-08-06T00:00:00Z'))
    ).toBe(18);
  });
});
