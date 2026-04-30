import {
  IDEMPOTENCY_PARAMETER_MISMATCH_ERROR,
  type IdempotencyReservationResult,
} from '@/lib/agentic/idempotency';

type IdempotencyReservationError = Extract<
  IdempotencyReservationResult,
  { ok: false }
>['error'];

/**
 * Maps IdempotencyReservationError values to agent-facing HTTP statuses.
 * IDEMPOTENCY_PARAMETER_MISMATCH_ERROR means a client reused a key with
 * different request parameters and gets 409; all other reservation errors use
 * 425 so the caller can retry or queue the operation.
 */
export function getAgenticIdempotencyErrorStatus(
  error: IdempotencyReservationError | string
): 409 | 425 {
  return error === IDEMPOTENCY_PARAMETER_MISMATCH_ERROR ? 409 : 425;
}
