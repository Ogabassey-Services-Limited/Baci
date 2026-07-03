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
 *   every subsequent send.
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
