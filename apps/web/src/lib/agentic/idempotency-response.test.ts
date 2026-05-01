import { describe, expect, it } from 'vitest';
import {
  IDEMPOTENCY_PARAMETER_MISMATCH_ERROR,
  IDEMPOTENCY_REQUEST_IN_PROGRESS_ERROR,
  IDEMPOTENCY_RESERVATION_FAILED_ERROR,
  IDEMPOTENCY_TRANSIENT_LOOKUP_ERROR,
} from '@/lib/agentic/idempotency';
import { getAgenticIdempotencyErrorStatus } from '@/lib/agentic/idempotency-response';

describe('getAgenticIdempotencyErrorStatus', () => {
  it('maps request parameter mismatches to a conflict response', () => {
    expect(
      getAgenticIdempotencyErrorStatus(IDEMPOTENCY_PARAMETER_MISMATCH_ERROR)
    ).toBe(409);
  });

  it('maps in-progress reservations to retry-later responses', () => {
    expect(
      getAgenticIdempotencyErrorStatus(IDEMPOTENCY_REQUEST_IN_PROGRESS_ERROR)
    ).toBe(425);
  });

  it('maps reservation infrastructure failures to service unavailable', () => {
    expect(
      getAgenticIdempotencyErrorStatus(IDEMPOTENCY_RESERVATION_FAILED_ERROR)
    ).toBe(503);
    expect(
      getAgenticIdempotencyErrorStatus(IDEMPOTENCY_TRANSIENT_LOOKUP_ERROR)
    ).toBe(503);
    expect(getAgenticIdempotencyErrorStatus('some unknown error')).toBe(503);
  });
});
