import { describe, expect, it } from 'vitest';
import {
  AGENTIC_REPLAY_REQUEST_ID_ERROR,
  AGENTIC_REPLAY_RESERVATION_FAILED_ERROR,
} from '@/lib/agentic/request-replay';
import { getAgenticReplayErrorStatus } from '@/lib/agentic/request-replay-response';

describe('getAgenticReplayErrorStatus', () => {
  it('maps duplicate request IDs to conflict responses', () => {
    expect(getAgenticReplayErrorStatus(AGENTIC_REPLAY_REQUEST_ID_ERROR)).toBe(
      409
    );
  });

  it('maps reservation failures to unavailable responses', () => {
    expect(
      getAgenticReplayErrorStatus(AGENTIC_REPLAY_RESERVATION_FAILED_ERROR)
    ).toBe(503);
    expect(getAgenticReplayErrorStatus('some unknown error')).toBe(503);
  });
});
