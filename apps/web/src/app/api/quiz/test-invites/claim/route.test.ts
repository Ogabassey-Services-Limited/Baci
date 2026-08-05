import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseJsonBody,
  requireQuizCsrf,
  requireQuizUser,
} from '@/app/api/quiz/_shared/route-helpers';
import { logger } from '@/lib/logger';
import { POST } from './route';

vi.mock('@/app/api/quiz/_shared/route-helpers', async () => {
  const actual = await vi.importActual<
    typeof import('@/app/api/quiz/_shared/route-helpers')
  >('@/app/api/quiz/_shared/route-helpers');
  return {
    ...actual,
    parseJsonBody: vi.fn(),
    requireQuizCsrf: vi.fn(),
    requireQuizUser: vi.fn(),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn() },
}));

const token = 'a'.repeat(48);

function request() {
  return new NextRequest('https://shop.example/api/quiz/test-invites/claim', {
    method: 'POST',
  });
}

function authenticated(rpc = vi.fn()) {
  vi.mocked(requireQuizUser).mockResolvedValue({
    authMethod: 'bearer',
    response: null,
    supabase: { rpc },
    user: { id: '00000000-0000-4000-8000-000000000001' },
  } as never);
  return rpc;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireQuizCsrf).mockResolvedValue(null);
  vi.mocked(parseJsonBody).mockResolvedValue({
    body: { token },
    response: null,
  });
});

describe('POST /api/quiz/test-invites/claim', () => {
  it('checks authentication before CSRF or body parsing', async () => {
    const unauthorized = NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
    vi.mocked(requireQuizUser).mockResolvedValue({
      response: unauthorized,
    } as never);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(requireQuizCsrf).not.toHaveBeenCalled();
    expect(parseJsonBody).not.toHaveBeenCalled();
  });

  it('requires CSRF before parsing the invite token', async () => {
    authenticated();
    const rejected = NextResponse.json({ error: 'CSRF' }, { status: 403 });
    vi.mocked(requireQuizCsrf).mockResolvedValue(rejected);

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(parseJsonBody).not.toHaveBeenCalled();
  });

  it('redeems a bounded token and returns only the event id', async () => {
    const rpc = authenticated(
      vi.fn().mockResolvedValue({
        data: '00000000-0000-4000-8000-000000000002',
        error: null,
      })
    );

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      eventId: '00000000-0000-4000-8000-000000000002',
    });
    expect(rpc).toHaveBeenCalledWith('redeem_quiz_test_invite_v2', {
      p_token: token,
    });
  });

  it('maps expired, revoked, used, and unknown invites identically without logging the token', async () => {
    authenticated(
      vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'QZ404', message: 'quiz_invite_unavailable' },
      })
    );

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: 'QUIZ_TEST_INVITE_UNAVAILABLE',
      error: 'This quiz invitation is invalid or no longer available.',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.not.objectContaining({ token })
    );
  });

  it('rejects malformed or oversized tokens before the RPC', async () => {
    const rpc = authenticated();
    vi.mocked(parseJsonBody).mockResolvedValue({
      body: { token: 'short' },
      response: null,
    });

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
