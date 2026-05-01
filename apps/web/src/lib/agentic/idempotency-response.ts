import {
  IDEMPOTENCY_PARAMETER_MISMATCH_ERROR,
  IDEMPOTENCY_REQUEST_IN_PROGRESS_ERROR,
  IDEMPOTENCY_RESERVATION_FAILED_ERROR,
  IDEMPOTENCY_TRANSIENT_LOOKUP_ERROR,
  type IdempotencyReservationResult,
} from '@/lib/agentic/idempotency';

type IdempotencyReservationError = Extract<
  IdempotencyReservationResult,
  { ok: false }
>['error'];

/**
 * Maps IdempotencyReservationError values to agent-facing HTTP statuses.
 * IDEMPOTENCY_PARAMETER_MISMATCH_ERROR means a client reused a key with
 * different request parameters and gets 409. True in-progress reservations use
 * 425; reservation infrastructure failures return 503.
 */
export function getAgenticIdempotencyErrorStatus(
  error: IdempotencyReservationError | string
): 409 | 425 | 503 {
  if (error === IDEMPOTENCY_PARAMETER_MISMATCH_ERROR) {
    return 409;
  }
  if (error === IDEMPOTENCY_REQUEST_IN_PROGRESS_ERROR) {
    return 425;
  }
  if (
    error === IDEMPOTENCY_RESERVATION_FAILED_ERROR ||
    error === IDEMPOTENCY_TRANSIENT_LOOKUP_ERROR
  ) {
    return 503;
  }

  return 503;
}
