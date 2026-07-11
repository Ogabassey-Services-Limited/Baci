const ATTEMPT_LIMIT_MESSAGE =
  "You've reached the maximum number of attempts for this quiz.";

/**
 * Maps a quiz action failure to shopper-facing copy. `apiPost` throws with the
 * server's human `error` string, so we humanize the raw per-event attempt-cap
 * token (QZ030 / attempt_limit_reached) defensively — if the server already
 * returns friendly copy this passes it straight through.
 */
export function getQuizErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Quiz action failed. Please try again.';
  }

  const normalized = error.message.trim().toLowerCase();
  if (
    normalized === 'qz030' ||
    normalized.includes('attempt_limit_reached')
  ) {
    return ATTEMPT_LIMIT_MESSAGE;
  }

  return error.message;
}
