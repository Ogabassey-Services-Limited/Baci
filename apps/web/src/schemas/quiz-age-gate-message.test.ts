import { describe, expect, it } from 'vitest';
import { QUIZ_AGE_RESTRICTED_MESSAGE } from './quiz-age-gate-message';

describe('QUIZ_AGE_RESTRICTED_MESSAGE', () => {
  it('matches the exact copy the server age gate returns', () => {
    // The client detects an age rejection by comparing runStart's error string
    // to this constant (apiPost surfaces only the message, not the code), so the
    // text must stay byte-identical to the server's quizAgeGateErrorResponse.
    expect(QUIZ_AGE_RESTRICTED_MESSAGE).toBe(
      'Quiz participation requires an adult profile (18+)'
    );
  });
});
