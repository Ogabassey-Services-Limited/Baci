import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkCsrfProtection } from '@/lib/csrf';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

const USER_ID = 'user-1';
const EVENT_ID = '11111111-1111-1111-1111-111111111111';
const ATTEMPT_ID = '22222222-2222-2222-2222-222222222222';
const QUESTION_ID = '33333333-3333-3333-3333-333333333333';
const AWARD_ID = '44444444-4444-4444-4444-444444444444';

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

function mockAuthenticatedSupabase({
  rpcResult = { data: null, error: null },
  selectResult = { data: null, error: null },
}: {
  rpcResult?: { data: unknown; error: unknown };
  selectResult?: { data: unknown; error: unknown };
} = {}) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const queryBuilder = {
    eq: vi.fn(() => queryBuilder),
    maybeSingle: vi.fn().mockResolvedValue(selectResult),
    select: vi.fn(() => queryBuilder),
    single: vi.fn().mockResolvedValue(selectResult),
  };
  const from = vi.fn(() => queryBuilder);
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

  return { from, queryBuilder, rpc, supabase };
}

async function readJson(response: Response) {
  return JSON.parse(await response.text());
}

describe('quiz API route contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.QUIZ_PHASE = '1a';
    process.env.QUIZ_PRODUCTION_APPROVED = 'false';
    process.env.QUIZ_RPC_SERVER_SECRET = 'test-secret';
    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
  });

  it('starts an attempt only after auth and validated input, then maps the RPC result', async () => {
    const order: string[] = [];
    const mobileAttempt = {
      attemptId: ATTEMPT_ID,
      eventId: EVENT_ID,
      question: {
        id: QUESTION_ID,
        index: 1,
        options: [{ id: 'A', label: 'Option A' }],
        prompt: 'Question?',
        timeLimitSeconds: 30,
        total: 1,
      },
    };
    const rpcResult = {
      data: mobileAttempt,
      error: null,
    };
    const { rpc, supabase } = mockAuthenticatedSupabase({ rpcResult });
    supabase.auth.getUser.mockImplementation(() => {
      order.push('auth');
      return Promise.resolve({ data: { user: { id: USER_ID } }, error: null });
    });
    const request = {
      json: vi.fn(() => {
        order.push('json');
        return Promise.resolve({ eventId: EVENT_ID, integrityTier: 'device' });
      }),
    } as unknown as NextRequest;

    const { POST } = await import('@/app/api/quiz/attempts/start/route');
    const response = await POST(request);

    expect(order).toEqual(['auth', 'json']);
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual(mobileAttempt);
    expect(rpc).toHaveBeenCalledWith('start_quiz_attempt', {
      p_event_id: EVENT_ID,
      p_integrity_tier: 'device',
      p_route_proof: expect.objectContaining({
        issued_at: expect.any(String),
        proof_id: expect.any(String),
        scope: 'quiz_phase1a',
      }),
      p_user_id: USER_ID,
    });
  });

  it('returns 400 for invalid start payloads before RPC calls', async () => {
    const { rpc } = mockAuthenticatedSupabase();

    const { POST } = await import('@/app/api/quiz/attempts/start/route');
    const response = await POST(
      jsonRequest('http://localhost/api/quiz/attempts/start', {
        eventId: 'not-a-uuid',
        integrityTier: 'device',
      })
    );

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('submits an answer through the non-prize RPC contract', async () => {
    const mobileResult = {
      attemptId: ATTEMPT_ID,
      correctAnswers: 0,
      prizeEligible: false,
      status: 'completed',
      totalQuestions: 1,
    };
    const rpcResult = {
      data: mobileResult,
      error: null,
    };
    const { rpc } = mockAuthenticatedSupabase({ rpcResult });

    const { POST } = await import(
      '@/app/api/quiz/attempts/[attemptId]/answers/route'
    );
    const response = await POST(
      jsonRequest(`http://localhost/api/quiz/attempts/${ATTEMPT_ID}/answers`, {
        answer: 'A',
        clientAnsweredAt: '2026-05-16T10:00:00.000Z',
        integrityTier: 'strong',
        questionId: QUESTION_ID,
      }),
      { params: Promise.resolve({ attemptId: ATTEMPT_ID }) }
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual(mobileResult);
    expect(rpc).toHaveBeenCalledWith('submit_quiz_answer', {
      p_answer: 'A',
      p_attempt_id: ATTEMPT_ID,
      p_client_answered_at: '2026-05-16T10:00:00.000Z',
      p_integrity_tier: 'strong',
      p_question_id: QUESTION_ID,
      p_route_proof: expect.objectContaining({
        issued_at: expect.any(String),
        proof_id: expect.any(String),
        scope: 'quiz_phase1a',
      }),
      p_user_id: USER_ID,
    });
  });

  it('finalize awards fails closed in Phase 1a before prize RPC calls', async () => {
    const { rpc } = mockAuthenticatedSupabase({
      selectResult: {
        data: { compliance_verified: true, nlrc_permit_ref: 'NLRC-1' },
        error: null,
      },
    });

    const { POST } = await import(
      '@/app/api/quiz/attempts/[attemptId]/finalize-awards/route'
    );
    const response = await POST(
      jsonRequest(
        `http://localhost/api/quiz/attempts/${ATTEMPT_ID}/finalize-awards`,
        { eventId: EVENT_ID }
      ),
      { params: Promise.resolve({ attemptId: ATTEMPT_ID }) }
    );

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({
      code: 'quiz_production_not_approved',
      error: 'Quiz prizes are not approved for production use',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('claims grand prizes only after the production guard passes and includes server proof', async () => {
    process.env.QUIZ_PHASE = 'production';
    process.env.QUIZ_PRODUCTION_APPROVED = 'true';
    const { rpc } = mockAuthenticatedSupabase({
      rpcResult: {
        data: { claim_id: 'claim-1', status: 'claimed' },
        error: null,
      },
      selectResult: {
        data: { compliance_verified: true, nlrc_permit_ref: 'NLRC-1' },
        error: null,
      },
    });

    const { POST } = await import('@/app/api/quiz/prizes/grand/claim/route');
    const response = await POST(
      jsonRequest('http://localhost/api/quiz/prizes/grand/claim', {
        eventId: EVENT_ID,
      })
    );

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      claim: { claim_id: 'claim-1', status: 'claimed' },
    });
    expect(rpc).toHaveBeenCalledWith(
      'claim_quiz_grand_prize',
      expect.objectContaining({
        p_event_id: EVENT_ID,
        p_server_proof: expect.objectContaining({
          action: 'claim_grand_prize',
          signature: expect.any(String),
        }),
        p_user_id: USER_ID,
      })
    );
  });

  it('cash award claims fail closed before RPC when approval evidence is missing', async () => {
    process.env.QUIZ_PHASE = 'production';
    process.env.QUIZ_PRODUCTION_APPROVED = 'true';
    const { from, rpc } = mockAuthenticatedSupabase({
      selectResult: {
        data: {
          event_id: EVENT_ID,
          quiz_events: { compliance_verified: false, nlrc_permit_ref: null },
        },
        error: null,
      },
    });

    const { POST } = await import('@/app/api/quiz/awards/cash/claim/route');
    const response = await POST(
      jsonRequest('http://localhost/api/quiz/awards/cash/claim', {
        awardId: AWARD_ID,
      })
    );

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({
      code: 'quiz_production_not_approved',
      error: 'Quiz prizes are not approved for production use',
    });
    expect(from).toHaveBeenCalledWith('quiz_awards');
    expect(rpc).not.toHaveBeenCalled();
  });
});
