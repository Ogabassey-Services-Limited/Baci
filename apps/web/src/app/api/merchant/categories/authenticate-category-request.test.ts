import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthenticatedUser = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/mobile-auth', () => ({ getAuthenticatedUser }));

import { authenticateCategoryRequest } from './authenticate-category-request';

const request = new Request('https://baci.app/api/merchant/categories');

describe('authenticateCategoryRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the caller-scoped client for a valid session', async () => {
    const supabase = {};
    getAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-1' },
      supabase,
    });

    await expect(authenticateCategoryRequest(request)).resolves.toMatchObject({
      ok: true,
      auth: { userId: 'user-1', supabase },
    });
  });

  it.each([
    null,
    { user: null, supabase: {} },
  ])('returns 401 when auth resolves to %j', async (auth) => {
    getAuthenticatedUser.mockResolvedValue(auth);
    const result = await authenticateCategoryRequest(request);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });
});
