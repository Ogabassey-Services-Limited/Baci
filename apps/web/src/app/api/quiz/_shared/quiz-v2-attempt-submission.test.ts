import { describe, expect, it, vi } from 'vitest';
import { enrichQuizV2AttemptWithSubmissionTime } from './quiz-v2-attempt-submission';

const terminalAttempt = {
  attemptId: 'attempt-1',
  status: 'submitted_pending_results',
};

describe('enrichQuizV2AttemptWithSubmissionTime', () => {
  it('attaches the authoritative submission time for terminal attempts', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: '2026-09-03T08:00:12.345Z',
      error: null,
    });

    const result = await enrichQuizV2AttemptWithSubmissionTime(
      { rpc },
      terminalAttempt
    );

    expect(result).toEqual({
      attempt: {
        ...terminalAttempt,
        submittedAt: '2026-09-03T08:00:12.345Z',
      },
      error: null,
    });
    expect(rpc).toHaveBeenCalledWith('get_quiz_attempt_submission_time_v2', {
      p_attempt_id: 'attempt-1',
    });
  });

  it('does not issue a lookup while an attempt is still playable', async () => {
    const rpc = vi.fn();
    const attempt = { ...terminalAttempt, status: 'in_progress' };

    const result = await enrichQuizV2AttemptWithSubmissionTime(
      { rpc },
      attempt
    );

    expect(result).toEqual({ attempt, error: null });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns lookup failures so terminal routes can fail closed', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('temporary lookup failure'),
    });

    const result = await enrichQuizV2AttemptWithSubmissionTime(
      { rpc },
      terminalAttempt
    );

    expect(result).toEqual({
      attempt: terminalAttempt,
      error: expect.any(Error),
    });
  });
});
