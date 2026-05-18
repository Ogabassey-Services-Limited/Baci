import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type AuthResult, authenticateApiRequest } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { requireQuizUser } from './_shared/route-helpers';

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
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
});
