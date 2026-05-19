import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import {
  createRouteProof,
  enforceEventPrizeGuard,
  invalidInputResponse,
  parseJsonBody,
  prizeGuardErrorResponse,
  requireQuizCsrf,
  requireQuizUser,
  rpcErrorResponse,
} from '../../../_shared/route-helpers';

vi.mock('../../../_shared/route-helpers', () => ({
  createRouteProof: vi.fn(),
  enforceEventPrizeGuard: vi.fn(),
  invalidInputResponse: vi.fn((details: unknown) =>
    NextResponse.json({ details, error: 'Invalid input' }, { status: 400 })
  ),
  parseJsonBody: vi.fn(async (request: Request) => {
    try {
      return { body: await request.json(), response: null };
    } catch {
      return {
        body: null,
        response: NextResponse.json(
          { error: 'Invalid JSON body' },
          { status: 400 }
        ),
      };
    }
  }),
  prizeGuardErrorResponse: vi.fn(() =>
    NextResponse.json(
      {
        code: 'quiz_production_not_approved',
        error: 'quiz_production_not_approved',
      },
      { status: 403 }
    )
  ),
  requireQuizCsrf: vi.fn(),
  requireQuizUser: vi.fn(),
  rpcErrorResponse: vi.fn(() =>
    NextResponse.json({ error: 'Quiz request failed' }, { status: 500 })
  ),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const USER_ID = 'user-1';
const EVENT_ID = '11111111-1111-1111-1111-111111111111';
const ATTEMPT_ID = '22222222-2222-2222-2222-222222222222';

const rpc = vi.fn();
const supabase = { rpc };

function jsonRequest(body: unknown) {
  return new NextRequest(
    `http://localhost/api/quiz/attempts/${ATTEMPT_ID}/finalize-awards`,
    {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }
  );
}

function context(attemptId = ATTEMPT_ID) {
  return { params: Promise.resolve({ attemptId }) };
}

describe('finalize awards route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({
      data: [{ award_id: 'award-1', status: 'issued' }],
      error: null,
    });
    vi.mocked(requireQuizUser).mockResolvedValue({
      response: null,
      supabase,
      user: { id: USER_ID },
    } as never);
    vi.mocked(requireQuizCsrf).mockResolvedValue(null);
    vi.mocked(createRouteProof).mockReturnValue({
      proof: { proof_id: 'proof-1' },
      response: null,
    } as never);
    vi.mocked(enforceEventPrizeGuard).mockResolvedValue({
      merchantId: 'merchant-1',
    });
  });

  it('returns auth failures before parsing JSON or guard work', async () => {
    const authResponse = NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
    vi.mocked(requireQuizUser).mockResolvedValue({
      response: authResponse,
    } as never);

    const { POST } = await import('./route');
    const response = await POST(jsonRequest({ eventId: EVENT_ID }), context());

    expect(response).toBe(authResponse);
    expect(parseJsonBody).not.toHaveBeenCalled();
    expect(enforceEventPrizeGuard).not.toHaveBeenCalled();
    expect(createRouteProof).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns csrf failures before parsing JSON', async () => {
    const csrfResponse = NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    );
    vi.mocked(requireQuizCsrf).mockResolvedValue(csrfResponse);

    const { POST } = await import('./route');
    const response = await POST(jsonRequest({ eventId: EVENT_ID }), context());

    expect(response).toBe(csrfResponse);
    expect(parseJsonBody).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns invalid attempt params before parsing JSON', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest({ eventId: EVENT_ID }),
      context('not-a-uuid')
    );

    expect(response.status).toBe(400);
    expect(invalidInputResponse).toHaveBeenCalledWith({
      attemptId: expect.arrayContaining([expect.any(String)]),
    });
    expect(parseJsonBody).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns invalid JSON responses before guard or RPC work', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new NextRequest(
        `http://localhost/api/quiz/attempts/${ATTEMPT_ID}/finalize-awards`,
        {
          body: '{bad-json',
          method: 'POST',
        }
      ),
      context()
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid JSON body' });
    expect(enforceEventPrizeGuard).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns validation errors before guard or RPC work', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest({ eventId: 'not-a-uuid' }),
      context()
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: 'Invalid input',
    });
    expect(invalidInputResponse).toHaveBeenCalledWith({
      eventId: expect.arrayContaining([expect.any(String)]),
    });
    expect(enforceEventPrizeGuard).not.toHaveBeenCalled();
    expect(createRouteProof).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps prize guard failures before proof creation or RPC calls', async () => {
    const guardError = new Error('not approved');
    vi.mocked(enforceEventPrizeGuard).mockRejectedValue(guardError);

    const { POST } = await import('./route');
    const response = await POST(jsonRequest({ eventId: EVENT_ID }), context());

    expect(response.status).toBe(403);
    expect(enforceEventPrizeGuard).toHaveBeenCalledWith(supabase, EVENT_ID);
    expect(prizeGuardErrorResponse).toHaveBeenCalledWith(guardError);
    expect(createRouteProof).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps RPC errors after guard and proof creation', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: new Error('rpc-fail'),
    });

    const { POST } = await import('./route');
    const response = await POST(jsonRequest({ eventId: EVENT_ID }), context());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Quiz request failed' });
    expect(enforceEventPrizeGuard).toHaveBeenCalledWith(supabase, EVENT_ID);
    expect(createRouteProof).toHaveBeenCalledWith({
      action: 'finalize_awards',
      payload: {
        attempt_id: ATTEMPT_ID,
        event_id: EVENT_ID,
        user_id: USER_ID,
      },
      subjectId: EVENT_ID,
      userId: USER_ID,
    });
    expect(logger.error).toHaveBeenCalledWith({
      attemptId: ATTEMPT_ID,
      error: expect.any(Error),
      event: 'finalize_quiz_awards',
      eventId: EVENT_ID,
      message: 'finalize_quiz_awards RPC failed',
      userId: USER_ID,
    });
    expect(rpcErrorResponse).toHaveBeenCalledTimes(1);
  });

  it('finalizes quiz awards with the signed server proof', async () => {
    const { POST } = await import('./route');
    const response = await POST(jsonRequest({ eventId: EVENT_ID }), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      awards: [{ award_id: 'award-1', status: 'issued' }],
    });
    expect(enforceEventPrizeGuard).toHaveBeenCalledWith(supabase, EVENT_ID);
    expect(createRouteProof).toHaveBeenCalledWith({
      action: 'finalize_awards',
      payload: {
        attempt_id: ATTEMPT_ID,
        event_id: EVENT_ID,
        user_id: USER_ID,
      },
      subjectId: EVENT_ID,
      userId: USER_ID,
    });
    expect(rpc).toHaveBeenCalledWith('finalize_quiz_awards', {
      p_attempt_id: ATTEMPT_ID,
      p_event_id: EVENT_ID,
      p_server_proof: { proof_id: 'proof-1' },
      p_user_id: USER_ID,
    });
  });
});
