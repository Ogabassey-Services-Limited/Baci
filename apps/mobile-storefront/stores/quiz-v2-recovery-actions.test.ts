import { describe, expect, it, jest } from '@jest/globals';
import type { QuizV2Attempt } from '@/services/quiz-types';
import { createQuizV2RecoveryResponseApplier } from './quiz-v2-recovery-actions';
import type { QuizV2StoreAccess } from './quiz-v2-store-access';

const fallback: QuizV2Attempt = {
  attemptId: 'attempt-1',
  eventEndsAt: '2026-08-04T12:05:00.000Z',
  eventId: 'event-1',
  question: undefined,
  resultsAvailableAt: null,
  serverNow: '2026-08-04T12:00:00.000Z',
  status: 'in_progress',
};

describe('createQuizV2RecoveryResponseApplier', () => {
  it('keeps an active question retryable when expiry reconciliation is unavailable', async () => {
    const set = jest.fn();
    const access = {
      get: jest.fn(),
      getGeneration: jest.fn(() => 0),
      getMessage: jest.fn(() => ''),
      set,
    } as unknown as QuizV2StoreAccess;
    const apply = jest.fn(async () => undefined);
    const applyRecoveryResponse = createQuizV2RecoveryResponseApplier({
      access,
      apply,
    });

    await applyRecoveryResponse(
      {
        availability: 'unavailable',
        attempt: undefined,
        eventEndsAt: fallback.eventEndsAt,
        serverNow: fallback.serverNow,
      },
      fallback
    );

    expect(set).toHaveBeenCalledWith({
      error: null,
      expiryRetryable: true,
      status: 'question',
      v2Attempt: fallback,
    });
    expect(apply).not.toHaveBeenCalled();
  });
});
