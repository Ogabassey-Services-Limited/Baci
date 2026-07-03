/**
 * Push ticket/receipt error codes after which an Expo push token can never
 * be delivered again, so the token row must be deactivated:
 *
 * - `DeviceNotRegistered` — Expo's explicit "stop sending to this token".
 * - `InvalidCredentials` — the token was minted under an (Expo project,
 *   bundle id) pair the push service has no APNs/FCM credentials for, e.g.
 *   legacy builds registered against the wrong Expo project. Delivery can
 *   never succeed for that token. A healthy device mints and re-registers a
 *   fresh token on next app launch (`register_push_token` re-activates on
 *   upsert), so deactivation is self-healing and stops the token failing on
 *   every subsequent send. Deactivation is additionally gated by
 *   `shouldDeactivateForInvalidCredentials` — see below.
 *
 * Transient or message-level codes (`MessageRateExceeded`, `MessageTooBig`,
 * `ExpoError`, `ProviderError`, …) must NOT deactivate the token.
 */
const UNDELIVERABLE_PUSH_TOKEN_ERRORS = new Set([
  'DeviceNotRegistered',
  'InvalidCredentials',
]);

/**
 * Returns the `push_tokens.deactivation_reason` to record for a ticket or
 * receipt error code, or `null` when the token should stay active.
 */
export function getPushTokenDeactivationReason(
  errorCode: unknown
): string | null {
  return typeof errorCode === 'string' &&
    UNDELIVERABLE_PUSH_TOKEN_ERRORS.has(errorCode)
    ? errorCode
    : null;
}

// Only prune InvalidCredentials tokens when they are an isolated sliver of a
// meaningfully sized batch. Below MIN_BATCH the two failure modes are
// indistinguishable, so we stay report-only.
const INVALID_CREDENTIALS_MIN_BATCH_SIZE = 10;
const INVALID_CREDENTIALS_MAX_FAILURE_RATIO = 0.1;

/**
 * Guard for InvalidCredentials deactivation. Unlike `DeviceNotRegistered`
 * (Expo's documented token-specific stop-sending signal),
 * `InvalidCredentials` is ambiguous:
 *
 * - permanent for a token minted under a project/bundle pair we hold no
 *   credentials for — the recurring per-send warning this module exists to
 *   stop, observed as 1 failure in a 200+ token batch;
 * - transient when a project's APNs credentials break mid-incident — then it
 *   hits every iOS token in the send at once, and deactivating them would
 *   strand pushes until each device relaunches, even after credentials are
 *   fixed.
 *
 * An isolated failure inside a healthy batch matches the first case;
 * project-wide breakage skips pruning and stays report-only.
 *
 * Callers must pass counts scoped to a single credential class: the send
 * path groups by token platform (APNs vs FCM) before applying this check,
 * and the receipts cron — which has no platform metadata — never prunes on
 * InvalidCredentials at all.
 */
export function shouldDeactivateForInvalidCredentials(
  failureCount: number,
  batchSize: number
): boolean {
  return (
    batchSize >= INVALID_CREDENTIALS_MIN_BATCH_SIZE &&
    failureCount / batchSize <= INVALID_CREDENTIALS_MAX_FAILURE_RATIO
  );
}
