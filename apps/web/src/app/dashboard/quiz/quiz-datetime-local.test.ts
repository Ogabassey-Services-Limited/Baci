import { describe, expect, it } from 'vitest';
import { quizDatetimeLocalToIso } from './quiz-datetime-local';

describe('quizDatetimeLocalToIso', () => {
  it('accepts the bare GMT zero-offset name returned for UTC', () => {
    expect(quizDatetimeLocalToIso('2027-08-06T09:00', 'UTC')).toBe(
      '2027-08-06T09:00:00.000Z'
    );
  });

  it('converts positive and negative timezone offsets to UTC', () => {
    expect(quizDatetimeLocalToIso('2027-08-06T09:00', 'Africa/Lagos')).toBe(
      '2027-08-06T08:00:00.000Z'
    );
    expect(quizDatetimeLocalToIso('2027-08-06T09:00', 'America/New_York')).toBe(
      '2027-08-06T13:00:00.000Z'
    );
  });

  it('rejects malformed wall clocks and timezone names', () => {
    expect(quizDatetimeLocalToIso('2027-02-30T09:00', 'UTC')).toBeNull();
    expect(quizDatetimeLocalToIso('2027-08-06 09:00', 'UTC')).toBeNull();
    expect(
      quizDatetimeLocalToIso('2027-08-06T09:00', 'Not/A_Timezone')
    ).toBeNull();
  });
});
