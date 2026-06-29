import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => {
  const getUser = vi.fn();

  return {
    cookies: vi.fn(),
    createAnonClient: vi.fn(() => ({
      auth: { getUser },
    })),
    createClient: vi.fn(),
    createScopedClient: vi.fn((token: string) => ({ token })),
    getUser,
  };
});

vi.mock('next/headers', () => ({
  cookies: authMocks.cookies,
}));

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: authMocks.createAnonClient,
}));

vi.mock('@/lib/supabase/scoped', () => ({
  createScopedClient: authMocks.createScopedClient,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: authMocks.createClient,
}));

import { authenticateApiRequest, getBearerTokenFromRequest } from './api-auth';

describe('getBearerTokenFromRequest', () => {
  it('parses bearer authorization schemes case-insensitively', () => {
    expect(
      getBearerTokenFromRequest(
        new Request('https://example.com', {
          headers: { authorization: 'bearer mobile-token' },
        })
      )
    ).toBe('mobile-token');
    expect(
      getBearerTokenFromRequest(
        new Request('https://example.com', {
          headers: { authorization: 'Bearer mobile-token' },
        })
      )
    ).toBe('mobile-token');
  });

  it('rejects bearer headers without a token payload', () => {
    expect(
      getBearerTokenFromRequest(
        new Request('https://example.com', {
          headers: { authorization: 'Bearer' },
        })
      )
    ).toBeNull();
  });
});

describe('authenticateApiRequest', () => {
  beforeEach(() => {
    authMocks.cookies.mockReset();
    authMocks.createAnonClient.mockClear();
    authMocks.createClient.mockReset();
    authMocks.createScopedClient.mockClear();
    authMocks.getUser.mockReset();
  });

  it('authenticates lowercase bearer authorization as mobile token auth', async () => {
    authMocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    const result = await authenticateApiRequest(
      new Request('https://example.com', {
        headers: { authorization: 'bearer mobile-token' },
      })
    );

    expect(result.error).toBeNull();
    expect(result.user).toEqual({ id: 'user-1' });
    expect(authMocks.getUser).toHaveBeenCalledWith('mobile-token');
    expect(authMocks.createScopedClient).toHaveBeenCalledWith('mobile-token');
    expect(authMocks.cookies).not.toHaveBeenCalled();
  });
});
