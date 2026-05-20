import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkCsrfProtection } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

const ATTEMPT_ID = '22222222-2222-2222-2222-222222222222';
const QUESTION_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = 'user-1';
const ORIGINAL_QUIZ_RPC_SERVER_SECRET = process.env.QUIZ_RPC_SERVER_SECRET;

function jsonRequest(body: unknown) {
  return new NextRequest(
    `http://localhost/api/quiz/attempts/${ATTEMPT_ID}/answers`,
    {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }
  );
}

function mockReplaySupabase({
  attemptResult,
}: {
  attemptResult: { data: unknown; error: unknown };
}) {
  const attemptBuilder = {
    eq: vi.fn(() => attemptBuilder),
    maybeSingle: vi.fn().mockResolvedValue(attemptResult),
    select: vi.fn(() => attemptBuilder),
  };
  const from = vi.fn((table: string) => {
    if (table === 'quiz_attempts') return attemptBuilder;
    throw new Error(`Unexpected table: ${table}`);
  });
  const rpc = vi.fn().mockResolvedValue({
    data: null,
    error: {
      code: 'QZ004',
      message: 'quiz attempt question is not answerable',
    },
  });
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: USER_ID } },
        error: null,
      }),
    },
    from,
    rpc,
  };

  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { attemptBuilder, rpc };
}

describe('submit quiz answer replay recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.QUIZ_RPC_SERVER_SECRET = 'test-secret';
    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
  });

  afterEach(() => {
    if (ORIGINAL_QUIZ_RPC_SERVER_SECRET === undefined) {
      delete process.env.QUIZ_RPC_SERVER_SECRET;
      return;
    }
    process.env.QUIZ_RPC_SERVER_SECRET = ORIGINAL_QUIZ_RPC_SERVER_SECRET;
  });

  it('recovers completed results for replayed answer submissions', async () => {
    const { attemptBuilder, rpc } = mockReplaySupabase({
      attemptResult: {
        data: {
          status: 'submitted',
          quiz_attempt_questions: [
            {
              quiz_attempt_answers: [{ score_delta: 1 }],
            },
            {
              quiz_attempt_answers: [{ score_delta: 0 }],
            },
          ],
        },
        error: null,
      },
    });

    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest({
        answer: 'A',
        integrityTier: 'strong',
        questionId: QUESTION_ID,
      }),
      { params: Promise.resolve({ attemptId: ATTEMPT_ID }) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      attemptId: ATTEMPT_ID,
      correctAnswers: 1,
      prizeEligible: false,
      status: 'completed',
      totalQuestions: 2,
    });
    expect(rpc).toHaveBeenCalledWith(
      'submit_quiz_answer',
      expect.objectContaining({ p_attempt_id: ATTEMPT_ID })
    );
    expect(attemptBuilder.select).toHaveBeenCalledWith(
      'id, status, quiz_attempt_questions(id, quiz_attempt_answers(score_delta))'
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns a recoverable conflict when replay state cannot be completed', async () => {
    mockReplaySupabase({
      attemptResult: {
        data: {
          status: 'started',
          quiz_attempt_questions: [{ quiz_attempt_answers: [] }],
        },
        error: null,
      },
    });

    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest({
        answer: 'A',
        integrityTier: 'strong',
        questionId: QUESTION_ID,
      }),
      { params: Promise.resolve({ attemptId: ATTEMPT_ID }) }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: 'quiz_attempt_not_answerable',
      error: 'Quiz answer is no longer accepted for this attempt',
    });
    expect(logger.error).not.toHaveBeenCalled();
  });
});
