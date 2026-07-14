/**
 * Loyalty points deducted when a customer starts one prize exam attempt.
 *
 * Entry is FREE (0). Charging loyalty points made entry purchase-gated — points
 * are only ever earned by buying — which is consideration, and with prizes at
 * stake that turns the quiz into a regulated promotional competition with no
 * free-entry defence. `start_quiz_attempt` no longer charges; see
 * supabase/migrations/20260714102000_quiz_free_entry.sql.
 *
 * Kept rather than deleted: it is still the wire contract for the
 * `examPassPointsSpent` field returned to the web and mobile clients.
 */
export const EXAM_PASS_POINTS_COST = 0;

/**
 * Required by free-entry clients before the server creates an attempt.
 * Older bundles omit this marker and are rejected before the RPC runs, so they
 * cannot reject the new zero-cost response after consuming an attempt slot.
 */
export const QUIZ_FREE_ENTRY_MODE = 'free-v1' as const;

/** Signed RPC action used by the free-entry server route. */
export const QUIZ_FREE_ENTRY_RPC_ACTION = 'start_quiz_attempt_free_v1' as const;

/** Signed server action required before an attempt can be bound to a device. */
export const QUIZ_DEVICE_BIND_RPC_ACTION =
  'bind_quiz_attempt_device_v1' as const;

/** Signed server action for an atomic quiz start plus device-cap decision. */
export const QUIZ_DEVICE_START_RPC_ACTION =
  'start_quiz_attempt_with_device_v1' as const;
