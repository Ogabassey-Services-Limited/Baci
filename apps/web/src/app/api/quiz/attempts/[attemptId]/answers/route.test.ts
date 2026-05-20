import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';
const QUESTION_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = 'user-1';
const ORIGINAL_QUIZ_RPC_SERVER_SECRET = process.env.QUIZ_RPC_SERVER_SECRET;

function jsonRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(
    `http://localhost/api/quiz/attempts/${ATTEMPT_ID}/answers`,
    {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...headers },
      method: 'POST',
    }
  );
}

function mockAuthenticatedSupabase({
  rpcResult = {
    data: { attemptId: ATTEMPT_ID, status: 'completed' },
    error: null,
  },
  user = { id: USER_ID },
}: {
  rpcResult?: { data: unknown; error: unknown };
  user?: { id: string } | null;
} = {}) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    rpc,
  };

  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { rpc };
}

describe('submit quiz answer route', () => {
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

  it('returns 401 before RPC calls when authentication is missing', async () => {
    const { rpc } = mockAuthenticatedSupabase({ user: null });

    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest({
        answer: 'A',
        integrityTier: 'device',
        questionId: QUESTION_ID,
      }),
      { params: Promise.resolve({ attemptId: ATTEMPT_ID }) }
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns 403 before RPC calls when CSRF validation fails', async () => {
    const { rpc } = mockAuthenticatedSupabase();
    vi.mocked(checkCsrfProtection).mockResolvedValueOnce({ valid: false });

    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest({
        answer: 'A',
        integrityTier: 'device',
        questionId: QUESTION_ID,
      }),
      { params: Promise.resolve({ attemptId: ATTEMPT_ID }) }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'CSRF validation failed',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('validates route params before calling the submit RPC', async () => {
    const { rpc } = mockAuthenticatedSupabase();

    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest({
        answer: 'A',
        integrityTier: 'device',
        questionId: QUESTION_ID,
      }),
      { params: Promise.resolve({ attemptId: 'not-a-uuid' }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'Invalid input' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('validates the answer body before calling the submit RPC', async () => {
    const { rpc } = mockAuthenticatedSupabase();

    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest({
        answer: '',
        integrityTier: 'device',
        questionId: 'not-a-uuid',
      }),
      { params: Promise.resolve({ attemptId: ATTEMPT_ID }) }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'Invalid input' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('passes validated answer input through the submit RPC', async () => {
    const { rpc } = mockAuthenticatedSupabase();

    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest({
        answer: 'A',
        clientAnsweredAt: '2026-05-16T10:00:00.000Z',
        integrityTier: 'strong',
        questionId: QUESTION_ID,
      }),
      { params: Promise.resolve({ attemptId: ATTEMPT_ID }) }
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      'submit_quiz_answer',
      expect.objectContaining({
        p_answer: 'A',
        p_attempt_id: ATTEMPT_ID,
        p_client_answered_at: '2026-05-16T10:00:00.000Z',
        p_integrity_tier: 'strong',
        p_question_id: QUESTION_ID,
        p_user_id: USER_ID,
      })
    );
  });

  it('accepts bearer-token mobile submissions through scoped API auth', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { attemptId: ATTEMPT_ID, status: 'completed' },
      error: null,
    });
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase: { rpc } as never,
      user: { id: USER_ID } as never,
    });

    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest(
        {
          answer: 'A',
          clientAnsweredAt: '2026-05-16T10:00:00.000Z',
          integrityTier: 'strong',
          questionId: QUESTION_ID,
        },
        { Authorization: 'Bearer mobile-token' }
      ),
      { params: Promise.resolve({ attemptId: ATTEMPT_ID }) }
    );

    expect(response.status).toBe(200);
    expect(authenticateApiRequest).toHaveBeenCalledWith(
      expect.any(NextRequest)
    );
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      'submit_quiz_answer',
      expect.objectContaining({
        p_attempt_id: ATTEMPT_ID,
        p_user_id: USER_ID,
      })
    );
  });

  it('rejects invalid bearer-token mobile submissions before RPC', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });

    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest(
        {
          answer: 'A',
          integrityTier: 'strong',
          questionId: QUESTION_ID,
        },
        { Authorization: 'Bearer invalid-token' }
      ),
      { params: Promise.resolve({ attemptId: ATTEMPT_ID }) }
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('returns 500 when the submit RPC reports an error', async () => {
    const { rpc } = mockAuthenticatedSupabase({
      rpcResult: { data: null, error: { message: 'RPC failed' } },
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

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Quiz request failed' });
    expect(rpc).toHaveBeenCalledWith(
      'submit_quiz_answer',
      expect.objectContaining({
        p_answer: 'A',
        p_attempt_id: ATTEMPT_ID,
        p_integrity_tier: 'strong',
        p_question_id: QUESTION_ID,
      })
    );
    expect(logger.error).toHaveBeenCalledWith({
      attemptId: ATTEMPT_ID,
      error: { message: 'RPC failed' },
      event: 'submit_quiz_answer',
      message: 'submit_quiz_answer RPC failed',
      questionId: QUESTION_ID,
      userId: USER_ID,
    });
  });

  it('maps expected non-replay quiz RPC errors to client responses', async () => {
    const { rpc } = mockAuthenticatedSupabase({
      rpcResult: {
        data: null,
        error: { code: 'QZ010', message: 'quiz route proof required' },
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

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      code: 'QUIZ_ROUTE_PROOF_REQUIRED',
      error: 'Quiz request is not authorized',
    });
    expect(rpc).toHaveBeenCalledWith(
      'submit_quiz_answer',
      expect.objectContaining({
        p_attempt_id: ATTEMPT_ID,
        p_question_id: QUESTION_ID,
      })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});
