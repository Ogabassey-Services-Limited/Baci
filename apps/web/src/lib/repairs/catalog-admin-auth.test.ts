import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authenticateApiRequest,
  checkCsrfProtection,
  getUserAccess,
  hasPermission,
} = vi.hoisted(() => ({
  authenticateApiRequest: vi.fn(),
  checkCsrfProtection: vi.fn(),
  getUserAccess: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
}));
vi.mock('@/lib/csrf', () => ({ checkCsrfProtection }));

import { authorizeRepairsRequest } from './catalog-admin-auth';

const request = new Request(
  'https://store.example/api/repairs/catalog/devices',
  {
    method: 'POST',
  }
);

const supabase = { from: vi.fn() };
const access = { merchantId: 'm-1', isOwner: true, permissions: {} };

beforeEach(() => {
  vi.clearAllMocks();
  authenticateApiRequest.mockResolvedValue({
    user: { id: 'u-1' },
    error: null,
    supabase,
  });
  checkCsrfProtection.mockResolvedValue({ valid: true });
  getUserAccess.mockResolvedValue(access);
  hasPermission.mockReturnValue(true);
});

describe('authorizeRepairsRequest', () => {
  it('returns ok with access and the scoped client on success', async () => {
    const result = await authorizeRepairsRequest(request, 'edit');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.access).toBe(access);
      expect(result.supabase).toBe(supabase);
    }
    expect(hasPermission).toHaveBeenCalledWith(access, 'repairs', 'edit');
  });

  it('returns 401 when unauthenticated', async () => {
    authenticateApiRequest.mockResolvedValue({
      user: null,
      error: 'nope',
      supabase: null,
    });
    const result = await authorizeRepairsRequest(request, 'view');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('returns the CSRF response when the token is invalid', async () => {
    checkCsrfProtection.mockResolvedValue({
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
    });
    const result = await authorizeRepairsRequest(request, 'edit');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it('returns 404 when the user has no merchant access', async () => {
    getUserAccess.mockResolvedValue(null);
    const result = await authorizeRepairsRequest(request, 'view');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(404);
    }
  });

  it('returns 403 when the repairs permission is missing', async () => {
    hasPermission.mockReturnValue(false);
    const result = await authorizeRepairsRequest(request, 'delete');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
    expect(hasPermission).toHaveBeenCalledWith(access, 'repairs', 'delete');
  });

  it('allows full_access.all staff even when hasPermission is false', async () => {
    hasPermission.mockReturnValue(false);
    getUserAccess.mockResolvedValue({
      merchantId: 'm-1',
      isOwner: false,
      permissions: { full_access: { all: true } },
    });
    const result = await authorizeRepairsRequest(request, 'delete');
    expect(result.ok).toBe(true);
  });

  it('allows repairs.all staff even when hasPermission is false', async () => {
    hasPermission.mockReturnValue(false);
    getUserAccess.mockResolvedValue({
      merchantId: 'm-1',
      isOwner: false,
      permissions: { repairs: { all: true } },
    });
    const result = await authorizeRepairsRequest(request, 'edit');
    expect(result.ok).toBe(true);
  });
});
