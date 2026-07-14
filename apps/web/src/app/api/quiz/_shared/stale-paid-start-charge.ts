/**
 * Detects a start response that was produced by the PAID entry RPC.
 *
 * Entry is free, so `start_quiz_attempt` must always return
 * `examPassPointsSpent: 0`. A positive value can only come from a database that
 * has not applied `20260714102000_quiz_free_entry.sql` — the old RPC is still
 * live and has just DEBITED the player a loyalty point.
 *
 * This is not a theoretical window. The QZ011 error guard alone does not cover
 * it: the old RPC only raises QZ011 when the customer holds fewer points than
 * the cost, so players who DO hold a point are charged and the call SUCCEEDS.
 * Those are exactly the players a free-entry release must not charge.
 */
export type StalePaidStartCharge = {
  /** Null when the payload is too malformed to identify the attempt. */
  attemptId: string | null;
  pointsSpent: number;
};

export function readStalePaidStartCharge(
  data: unknown
): StalePaidStartCharge | null {
  if (!data || typeof data !== 'object') return null;

  const payload = data as Record<string, unknown>;
  const pointsSpent = payload.examPassPointsSpent;

  if (
    typeof pointsSpent !== 'number' ||
    !Number.isFinite(pointsSpent) ||
    pointsSpent <= 0
  ) {
    return null;
  }

  const attemptId = payload.attemptId;

  return {
    attemptId:
      typeof attemptId === 'string' && attemptId.length > 0 ? attemptId : null,
    pointsSpent,
  };
}
