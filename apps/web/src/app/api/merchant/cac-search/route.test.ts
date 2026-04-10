import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
  getUserAccess: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
}));

import { authenticateApiRequest, getUserAccess } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rate-limiter';
import { POST } from './route';

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json', ...headers }),
    nextUrl: new URL('http://localhost/api/merchant/cac-search'),
    json: vi.fn().mockResolvedValue(body),
    cookies: { get: vi.fn() },
  } as unknown as NextRequest;
}

const mockSupabase = {};

const mockUser = { id: 'user-1' };

const mockOwnerAccess = {
  merchantId: 'merchant-1',
  role: 'owner',
  isOwner: true,
  isStaff: false,
  permissions: {},
};

const mockStaffAccess = {
  ...mockOwnerAccess,
  role: 'staff',
  isOwner: false,
  isStaff: true,
};

describe('POST /api/merchant/cac-search', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
    vi.mocked(checkRateLimit).mockResolvedValue(true);
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: mockUser,
      error: null,
      supabase: mockSupabase,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.mocked(getUserAccess).mockResolvedValue(mockOwnerAccess);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });

    const req = makeRequest({ searchTerm: 'Baci Tech' });
    const res = await POST(req);

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({ error: expect.any(String) })
    );
  });

  it('returns 403 when CSRF fails', async () => {
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: false,
      response: undefined,
    });

    const req = makeRequest({ searchTerm: 'Baci Tech' });
    const res = await POST(req);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.any(String),
    });
  });

  it('returns 403 when user is not merchant owner', async () => {
    vi.mocked(getUserAccess).mockResolvedValue(mockStaffAccess);

    const req = makeRequest({ searchTerm: 'Baci Tech' });
    const res = await POST(req);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const req = makeRequest({ searchTerm: 'Baci Tech' });
    const res = await POST(req);

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.any(String),
    });
  });

  it('returns 400 when searchTerm is missing', async () => {
    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: 'Validation failed',
    });
  });

  it('returns 400 when searchTerm is too short', async () => {
    const req = makeRequest({ searchTerm: 'a' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 200 with company list on successful CAC search', async () => {
    const mockCompanies = [
      { approvedName: 'BACI TECHNOLOGIES LTD', rcNumber: 'RC123456' },
    ];
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockCompanies, success: true }),
    } as Response);

    const req = makeRequest({ searchTerm: 'Baci Tech' });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ searchTerm: 'Baci Tech' }),
      })
    );
    await expect(res.json()).resolves.toEqual({ companies: mockCompanies });
  });

  it.each([
    ['RC7389159', '7389159'],
    ['rc-7389159', '7389159'],
    ['BN123456', '123456'],
    ['bn 123456', '123456'],
  ])('normalizes %s before sending it to CAC', async (searchTerm, normalizedSearchTerm) => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], success: true }),
    } as Response);

    const req = makeRequest({ searchTerm });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ searchTerm: normalizedSearchTerm }),
      })
    );
  });

  it('returns 502 when CAC API returns a non-OK response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as Response);

    const req = makeRequest({ searchTerm: 'Baci Tech' });
    const res = await POST(req);

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({
      error: 'CAC search service unavailable',
    });
  });

  it('returns 500 when CAC API fetch throws', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const req = makeRequest({ searchTerm: 'Baci Tech' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({
      error: 'CAC search failed',
    });
  });
});
