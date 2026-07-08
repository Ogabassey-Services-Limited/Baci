import { describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { attachQuizQuestionDeadline } from './quiz-question-deadline';

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

function mockSupabase({
  selectResult = { data: null, error: null },
}: {
  selectResult?: { data: unknown; error: unknown };
} = {}) {
  const queryBuilder = {
    eq: vi.fn(() => queryBuilder),
    maybeSingle: vi.fn().mockResolvedValue(selectResult),
    select: vi.fn(() => queryBuilder),
  };
  const supabase = {
    from: vi.fn(() => queryBuilder),
  };
  return { queryBuilder, supabase };
}

describe('attachQuizQuestionDeadline', () => {
  it('attaches a DB-backed deadline to quiz question responses', async () => {
    const { queryBuilder, supabase } = mockSupabase({
      selectResult: {
        data: {
          issued_at: '2026-07-08T12:00:00.000Z',
          time_limit_ms: 8500,
        },
        error: null,
      },
    });

    const result = await attachQuizQuestionDeadline(supabase as never, {
      attemptId: 'attempt-1',
      question: { id: 'slot-1', prompt: 'Question?' },
    });

    expect(result.response).toBeNull();
    expect(result.data).toEqual({
      attemptId: 'attempt-1',
      question: {
        deadlineAt: '2026-07-08T12:00:08.500Z',
        id: 'slot-1',
        prompt: 'Question?',
      },
    });
    expect(supabase.from).toHaveBeenCalledWith('quiz_attempt_questions');
    expect(queryBuilder.select).toHaveBeenCalledWith(
      'issued_at, time_limit_ms'
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith('attempt_id', 'attempt-1');
    expect(queryBuilder.eq).toHaveBeenCalledWith('slot_id', 'slot-1');
  });

  it('leaves completed quiz responses without a next question unchanged', async () => {
    const { supabase } = mockSupabase();
    const payload = { attemptId: 'attempt-1', status: 'completed' };

    await expect(
      attachQuizQuestionDeadline(supabase as never, payload)
    ).resolves.toEqual({ data: payload, response: null });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('fails closed when the deadline row cannot be resolved', async () => {
    const { supabase } = mockSupabase({
      selectResult: { data: null, error: { message: 'missing' } },
    });

    const result = await attachQuizQuestionDeadline(supabase as never, {
      attemptId: 'attempt-1',
      question: { id: 'slot-1' },
    });

    expect(result.data).toBeNull();
    expect(result.response?.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith({
      attemptId: 'attempt-1',
      error: { message: 'missing' },
      message: 'Quiz question deadline lookup failed',
      questionId: 'slot-1',
    });
  });
});
