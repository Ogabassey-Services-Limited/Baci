import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import {
  createRouteProof,
  enforceCashAwardPrizeGuard,
  invalidInputResponse,
  parseJsonBody,
  prizeGuardErrorResponse,
  requireQuizCsrf,
  requireQuizUser,
  rpcErrorResponse,
} from '../../../_shared/route-helpers';

vi.mock('../../../_shared/route-helpers', () => ({
  createRouteProof: vi.fn(),
  enforceCashAwardPrizeGuard: vi.fn(),
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
const AWARD_ID = '44444444-4444-4444-4444-444444444444';

const rpc = vi.fn();
const supabase = { rpc };

function jsonRequest(body: unknown) {
  return new NextRequest('http://localhost/api/quiz/awards/cash/claim', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

async function readJson(response: Response) {
  return JSON.parse(await response.text());
}

describe('cash award claim route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpc.mockResolvedValue({
      data: { award_id: AWARD_ID, status: 'claimed' },
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
    vi.mocked(enforceCashAwardPrizeGuard).mockResolvedValue(undefined);
  });

  it('returns csrf failures before parsing JSON', async () => {
    const csrfResponse = NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403 }
    );
    vi.mocked(requireQuizCsrf).mockResolvedValue(csrfResponse);

    const { POST } = await import('./route');
    const response = await POST(jsonRequest({ awardId: AWARD_ID }));

    expect(response).toBe(csrfResponse);
    expect(parseJsonBody).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
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
    const response = await POST(jsonRequest({ awardId: AWARD_ID }));

    expect(response).toBe(authResponse);
    expect(parseJsonBody).not.toHaveBeenCalled();
    expect(enforceCashAwardPrizeGuard).not.toHaveBeenCalled();
    expect(createRouteProof).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns invalid JSON responses before guard or RPC work', async () => {
    const { POST } = await import('./route');
    const response = await POST(
      new NextRequest('http://localhost/api/quiz/awards/cash/claim', {
        body: '{bad-json',
        method: 'POST',
      })
    );

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: 'Invalid JSON body' });
    expect(enforceCashAwardPrizeGuard).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns validation errors before guard or RPC work', async () => {
    const { POST } = await import('./route');
    const response = await POST(jsonRequest({ awardId: 'not-a-uuid' }));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toMatchObject({
      error: 'Invalid input',
    });
    expect(invalidInputResponse).toHaveBeenCalledWith({
      awardId: expect.arrayContaining([expect.any(String)]),
    });
    expect(enforceCashAwardPrizeGuard).not.toHaveBeenCalled();
    expect(createRouteProof).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps prize guard failures before proof creation or RPC calls', async () => {
    const guardError = new Error('not approved');
    vi.mocked(enforceCashAwardPrizeGuard).mockRejectedValue(guardError);

    const { POST } = await import('./route');
    const response = await POST(jsonRequest({ awardId: AWARD_ID }));

    expect(response.status).toBe(403);
    expect(enforceCashAwardPrizeGuard).toHaveBeenCalledWith(supabase, AWARD_ID);
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
    const response = await POST(jsonRequest({ awardId: AWARD_ID }));

    expect(response.status).toBe(500);
    expect(await readJson(response)).toEqual({ error: 'Quiz request failed' });
    expect(enforceCashAwardPrizeGuard).toHaveBeenCalledWith(supabase, AWARD_ID);
    expect(createRouteProof).toHaveBeenCalledWith({
      action: 'claim_cash_award',
      payload: { award_id: AWARD_ID, user_id: USER_ID },
      subjectId: AWARD_ID,
      userId: USER_ID,
    });
    expect(logger.error).toHaveBeenCalledWith({
      awardId: AWARD_ID,
      error: expect.any(Error),
      event: 'claim_quiz_cash_award',
      message: 'claim_quiz_cash_award RPC failed',
      userId: USER_ID,
    });
    expect(rpcErrorResponse).toHaveBeenCalledTimes(1);
  });

  it('claims cash awards with the signed server proof', async () => {
    const { POST } = await import('./route');
    const response = await POST(jsonRequest({ awardId: AWARD_ID }));

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({
      claim: { award_id: AWARD_ID, status: 'claimed' },
    });
    expect(enforceCashAwardPrizeGuard).toHaveBeenCalledWith(supabase, AWARD_ID);
    expect(createRouteProof).toHaveBeenCalledWith({
      action: 'claim_cash_award',
      payload: { award_id: AWARD_ID, user_id: USER_ID },
      subjectId: AWARD_ID,
      userId: USER_ID,
    });
    expect(rpc).toHaveBeenCalledWith('claim_quiz_cash_award', {
      p_award_id: AWARD_ID,
      p_server_proof: { proof_id: 'proof-1' },
      p_user_id: USER_ID,
    });
  });
});
