import { describe, expect, it } from '@jest/globals';
import {
  getFriendlyQuizErrorMessage,
  QUIZ_ERROR_MESSAGES,
} from './quiz-error-messages';
import { QuizServiceError } from './quiz-types';

describe('getFriendlyQuizErrorMessage', () => {
  it('maps the new attempt-cap semantic code to friendly copy', () => {
    const error = new QuizServiceError(
      'attempt_limit_reached',
      'QUIZ_ATTEMPT_LIMIT_REACHED',
      409
    );

    expect(getFriendlyQuizErrorMessage(error, 'fallback')).toBe(
      QUIZ_ERROR_MESSAGES.QUIZ_ATTEMPT_LIMIT_REACHED
    );
  });

  it('recognizes the attempt cap by raw DB code even without a semantic code', () => {
    const error = new QuizServiceError('attempt_limit_reached', 'QZ030', 409);

    expect(getFriendlyQuizErrorMessage(error, 'fallback')).toBe(
      QUIZ_ERROR_MESSAGES.QUIZ_ATTEMPT_LIMIT_REACHED
    );
  });

  it('maps the answer-too-late code to friendly copy', () => {
    const error = new QuizServiceError(
      'Quiz answer was submitted after the question window',
      'QUIZ_ANSWER_TOO_LATE',
      409
    );

    expect(getFriendlyQuizErrorMessage(error, 'fallback')).toBe(
      QUIZ_ERROR_MESSAGES.QUIZ_ANSWER_TOO_LATE
    );
  });

  it('falls back to the server message for unknown quiz codes', () => {
    const error = new QuizServiceError(
      'Quiz is temporarily unavailable',
      'QUIZ_SOME_NEW_CODE',
      500
    );

    expect(getFriendlyQuizErrorMessage(error, 'fallback')).toBe(
      'Quiz is temporarily unavailable'
    );
  });

  it('uses the fallback when a quiz error carries no message', () => {
    const error = new QuizServiceError('   ', 'QUIZ_SOME_NEW_CODE', 500);

    expect(getFriendlyQuizErrorMessage(error, 'Something went wrong')).toBe(
      'Something went wrong'
    );
  });

  it('returns the message for a plain Error', () => {
    expect(
      getFriendlyQuizErrorMessage(new Error('boom'), 'fallback')
    ).toBe('boom');
  });

  it('returns the fallback for non-error values', () => {
    expect(getFriendlyQuizErrorMessage('nope', 'fallback')).toBe('fallback');
    expect(getFriendlyQuizErrorMessage(undefined, 'fallback')).toBe('fallback');
  });
});
