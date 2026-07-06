import { QuizServiceError } from './quiz-types';

/**
 * Friendly, player-facing copy for known quiz error codes. The mobile client
 * receives the *semantic* code the web route emits (e.g. `QUIZ_ANSWER_TOO_LATE`
 * from DB code `QZ029`), not the raw `QZxxx` code — see
 * `apps/web/src/app/api/quiz/_shared/route-helpers.ts` (`QUIZ_RPC_CLIENT_ERRORS`).
 * Any code without an entry falls back to the server's own human-readable
 * message, which is already actionable — never a spinner or crash.
 */
export const QUIZ_ERROR_MESSAGES: Record<string, string> = {
  // New per-event attempt cap (DB code QZ030 = attempt_limit_reached).
  QUIZ_ATTEMPT_LIMIT_REACHED:
    "You've reached the maximum number of attempts for this quiz.",
  QUIZ_ANSWER_TOO_LATE:
    'Time ran out on that question. Start a new attempt to try again.',
  QUIZ_ANSWER_TOO_FAST:
    'That answer came in a little too fast. Wait a moment and try again.',
  QUIZ_EVENT_NOT_OPEN:
    'This quiz is not open right now. Check back when it starts.',
  QUIZ_QUESTION_NOT_FOUND: 'This quiz has no available questions right now.',
  QUIZ_QUESTION_NOT_ISSUED:
    'This question is not ready for answers yet. Please try again.',
  QUIZ_CUSTOMER_NOT_FOUND:
    'We could not find your player profile. Sign in and try again.',
  QUIZ_AUTH_REQUIRED: 'Please sign in to play the quiz.',
};

/**
 * True when an error represents the per-event attempt cap, matched defensively
 * across the raw DB code, the semantic code, and the message text so the
 * friendly copy still shows even if the web semantic code differs from our key.
 */
function isAttemptLimitError(error: QuizServiceError): boolean {
  const code = error.code.toUpperCase();
  const message = error.message.toLowerCase();
  return (
    code === 'QZ030' ||
    code.includes('ATTEMPT_LIMIT') ||
    message.includes('attempt_limit') ||
    message.includes('maximum number of attempts')
  );
}

/**
 * Resolve a player-facing message from an unknown error. Known quiz codes map to
 * friendly copy; everything else falls back to the error's own message and then
 * the provided fallback, guaranteeing a non-empty, actionable string.
 */
export function getFriendlyQuizErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (error instanceof QuizServiceError) {
    const mapped = QUIZ_ERROR_MESSAGES[error.code];
    if (mapped) return mapped;
    if (isAttemptLimitError(error)) {
      return QUIZ_ERROR_MESSAGES.QUIZ_ATTEMPT_LIMIT_REACHED;
    }
    return error.message.trim() || fallback;
  }

  if (error instanceof Error) {
    return error.message.trim() || fallback;
  }

  return fallback;
}
