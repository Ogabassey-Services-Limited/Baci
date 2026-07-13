/**
 * Loyalty points deducted when a customer starts one prize exam attempt.
 *
 * Entry is FREE (0). Charging loyalty points made entry purchase-gated — points
 * are only ever earned by buying — which is consideration, and with prizes at
 * stake that turns the quiz into a regulated promotional competition with no
 * free-entry defence. `start_quiz_attempt` no longer charges; see
 * supabase/migrations/20260713180000_quiz_free_entry.sql.
 *
 * Kept rather than deleted: it is still the wire contract for the
 * `examPassPointsSpent` field returned to the web and mobile clients.
 */
export const EXAM_PASS_POINTS_COST = 0;
