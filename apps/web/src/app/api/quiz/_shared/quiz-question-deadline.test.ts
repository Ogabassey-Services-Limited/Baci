import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { attachQuizQuestionDeadline } from './quiz-question-deadline';

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

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

    const result = await attachQuizQuestionDeadline(
      supabase as never,
      {
        attemptId: 'attempt-1',
        eventEndsAt: '2026-07-08T12:05:00.000Z',
        question: { id: 'slot-1', prompt: 'Question?' },
      },
      'slot_id'
    );

    expect(result.response).toBeNull();
    expect(result.data).toEqual({
      attemptId: 'attempt-1',
      eventEndsAt: '2026-07-08T12:05:00.000Z',
      question: {
        deadlineAt: '2026-07-08T12:00:08.500Z',
        id: 'slot-1',
        prompt: 'Question?',
      },
    });
    expect(supabase.from).toHaveBeenCalledWith('quiz_attempt_questions');
    expect(queryBuilder.select).toHaveBeenCalledWith(
      'issued_at, time_limit_ms, attempt:quiz_attempts!inner(event:quiz_events!inner(ends_at))'
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith('attempt_id', 'attempt-1');
    expect(queryBuilder.eq).toHaveBeenCalledWith('slot_id', 'slot-1');
  });

  it('caps a late entrant question at the universal event end', async () => {
    const { queryBuilder, supabase } = mockSupabase({
      selectResult: {
        data: {
          attempt: { event: { ends_at: '2026-07-08T09:05:00.000Z' } },
          issued_at: '2026-07-08T09:04:55.000Z',
          time_limit_ms: 10_000,
        },
        error: null,
      },
    });

    const result = await attachQuizQuestionDeadline(
      supabase as never,
      {
        attemptId: 'attempt-1',
        eventEndsAt: '2026-07-08T09:05:00.000Z',
        question: { id: 'attempt-question-1', timeLimitSeconds: 10 },
      },
      'id'
    );

    expect(result.data).toEqual({
      attemptId: 'attempt-1',
      eventEndsAt: '2026-07-08T09:05:00.000Z',
      question: {
        deadlineAt: '2026-07-08T09:05:00.000Z',
        id: 'attempt-question-1',
        timeLimitSeconds: 10,
      },
    });
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'attempt-question-1');
  });

  it('leaves completed quiz responses without a next question unchanged', async () => {
    const { supabase } = mockSupabase();
    const payload = { attemptId: 'attempt-1', status: 'completed' };

    await expect(
      attachQuizQuestionDeadline(supabase as never, payload, 'slot_id')
    ).resolves.toEqual({ data: payload, response: null });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('keeps the successful mutation payload and attaches a fallback deadline when lookup fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-08T12:00:00.000Z'));
    const { supabase } = mockSupabase({
      selectResult: { data: null, error: { message: 'missing' } },
    });

    const result = await attachQuizQuestionDeadline(
      supabase as never,
      {
        attemptId: 'attempt-1',
        question: { id: 'slot-1', timeLimitSeconds: 5 },
      },
      'slot_id'
    );

    expect(result.response).toBeNull();
    expect(result.data).toEqual({
      attemptId: 'attempt-1',
      question: {
        deadlineAt: '2026-07-08T12:00:05.000Z',
        id: 'slot-1',
        timeLimitSeconds: 5,
      },
    });
    expect(logger.error).toHaveBeenCalledWith({
      attemptId: 'attempt-1',
      error: { message: 'missing' },
      message: 'Quiz question deadline lookup failed',
      questionId: 'slot-1',
    });
  });

  it('preserves an existing RPC deadline when the follow-up row is invalid', async () => {
    const { supabase } = mockSupabase({
      selectResult: {
        data: { issued_at: null, time_limit_ms: null },
        error: null,
      },
    });

    const result = await attachQuizQuestionDeadline(
      supabase as never,
      {
        attemptId: 'attempt-1',
        question: {
          deadlineAt: '2026-07-08T12:01:00.000Z',
          id: 'slot-1',
        },
      },
      'slot_id'
    );

    expect(result.response).toBeNull();
    expect(result.data).toEqual({
      attemptId: 'attempt-1',
      question: {
        deadlineAt: '2026-07-08T12:01:00.000Z',
        id: 'slot-1',
      },
    });
    expect(logger.error).toHaveBeenCalledWith({
      attemptId: 'attempt-1',
      message: 'Quiz question deadline row was invalid',
      questionId: 'slot-1',
    });
  });

  it('caps fallback deadlines when the database lookup fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-08T09:04:55.000Z'));
    const { supabase } = mockSupabase({
      selectResult: { data: null, error: { message: 'unavailable' } },
    });

    const result = await attachQuizQuestionDeadline(
      supabase as never,
      {
        attemptId: 'attempt-1',
        eventEndsAt: '2026-07-08T09:05:00.000Z',
        question: { id: 'attempt-question-1', timeLimitSeconds: 10 },
      },
      'id'
    );

    expect(result.data).toMatchObject({
      question: { deadlineAt: '2026-07-08T09:05:00.000Z' },
    });
  });
});
