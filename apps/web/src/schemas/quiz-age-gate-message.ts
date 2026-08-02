/**
 * Shopper-facing copy returned when the server age gate rejects a start (18+).
 * Shared so the server response and the client (which only receives this
 * message string, not the error code, through apiPost) agree on the exact text
 * used to detect an age rejection and reopen the correction gate.
 *
 * Kept in its own module rather than the large quiz schema file so neither the
 * server route helpers nor the client gate drag the schema graph in for a
 * single string.
 */
export const QUIZ_AGE_RESTRICTED_MESSAGE =
  'Quiz participation requires an adult profile (18+)';
