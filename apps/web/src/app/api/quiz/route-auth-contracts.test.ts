import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireQuizUser } from '@/app/api/quiz/_shared/route-helpers';
import { type AuthResult, authenticateApiRequest } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
  getBearerTokenFromRequest: (request: Request) => {
    const header = request.headers.get('Authorization') ?? '';
    return header.match(/^\s*bearer\s+(.+?)\s*$/i)?.[1]?.trim() || null;
  },
  hasBearerAuthScheme: (request: Request) =>
    /^\s*bearer(?:\s|$)/i.test(request.headers.get('Authorization') ?? ''),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

const USER_ID = 'user-1';

describe('quiz route mobile auth contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('authenticates bearer-token mobile requests with the scoped API auth helper', async () => {
    const request = new NextRequest('http://localhost/api/quiz/events', {
      headers: { Authorization: 'Bearer mobile-token' },
    });
    const scopedSupabase = {
      rpc: vi.fn(),
    } as unknown as NonNullable<AuthResult['supabase']>;
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase: scopedSupabase,
      user: { id: USER_ID } as NonNullable<AuthResult['user']>,
    });

    const result = await requireQuizUser(request);

    expect(result.response).toBeNull();
    expect(result.user).toEqual({ id: USER_ID });
    expect(result.supabase).toBe(scopedSupabase);
    expect(authenticateApiRequest).toHaveBeenCalledWith(request);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('rejects bearer-token mobile requests when scoped API auth fails', async () => {
    const request = new NextRequest('http://localhost/api/quiz/events', {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });

    const result = await requireQuizUser(request);

    expect(result.response?.status).toBe(401);
    expect(result.user).toBeNull();
    expect(result.supabase).toBeNull();
    expect(authenticateApiRequest).toHaveBeenCalledWith(request);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('returns 401 for cookie requests with no Supabase auth session', async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'Auth session missing!', status: 400 },
    });
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await requireQuizUser(
      new NextRequest('http://localhost/api/quiz/events')
    );
    const body = await result.response?.json();

    expect(result.response?.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
    expect(result.user).toBeNull();
    expect(result.supabase).toBeNull();
    expect(getUser).toHaveBeenCalled();
  });

  it('returns 503 when Supabase auth lookup fails for a service reason', async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: { message: 'Supabase is unavailable', status: 503 },
    });
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const result = await requireQuizUser(
      new NextRequest('http://localhost/api/quiz/events')
    );
    const body = await result.response?.json();

    expect(result.response?.status).toBe(503);
    expect(body).toEqual({
      code: 'auth_unavailable',
      error: 'Authentication lookup failed',
    });
    expect(result.user).toBeNull();
    expect(result.supabase).toBeNull();
    expect(getUser).toHaveBeenCalled();
  });
});
