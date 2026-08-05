import { describe, expect, it } from 'vitest';
import { parseQuizV2Attempt, parseQuizV2RawResult } from './quiz-v2-projection';

describe('quiz v2 projection parsers', () => {
  it('strips internal device diagnostics from attempt responses', () => {
    const parsed = parseQuizV2Attempt({
      attemptId: 'attempt-1',
      deviceAllowed: true,
      eventEndsAt: '2026-08-05T10:05:00.000Z',
      eventId: 'event-1',
      question: {
        deadlineAt: '2026-08-05T10:00:10.000Z',
        id: 'question-1',
        index: 1,
        issuedAt: '2026-08-05T10:00:00.000Z',
        options: [{ id: 'a', label: 'A' }],
        prompt: 'Question?',
        timeLimitSeconds: 10,
        total: 1,
      },
      resultsAvailableAt: null,
      serverNow: '2026-08-05T10:00:00.000Z',
      status: 'in_progress',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).not.toHaveProperty('deviceAllowed');
  });

  it('rejects unbounded internal result fields', () => {
    expect(
      parseQuizV2RawResult({
        answerKey: 'secret',
        attemptId: '11111111-1111-4111-8111-111111111111',
        availability: 'pending',
        availableAt: null,
      }).success
    ).toBe(false);
  });
});
