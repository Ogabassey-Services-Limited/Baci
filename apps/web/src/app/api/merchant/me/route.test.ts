import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
  fetchDashboardMerchant: vi.fn(),
  fetchPrimaryDomain: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: vi.fn(), set: vi.fn() }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createServerClient(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mocks.createAdminClient(),
}));

vi.mock('@/hooks/merchant/queries', () => ({
  fetchDashboardMerchant: (...args: unknown[]) =>
    mocks.fetchDashboardMerchant(...args),
  fetchPrimaryDomain: (...args: unknown[]) => mocks.fetchPrimaryDomain(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { GET } from './route';

const ADMIN_CLIENT = { tag: 'admin' };

function makeRequest(): Parameters<typeof GET>[0] {
  return {} as unknown as Parameters<typeof GET>[0];
}

const ownerStaffAccess = {
  isStaff: false,
  isOwner: true,
  role: 'owner',
  permissions: {},
};

describe('GET /api/merchant/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
    });
    mocks.createAdminClient.mockReturnValue(ADMIN_CLIENT);
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mocks.fetchDashboardMerchant.mockResolvedValue({
      merchant: { id: 'merchant-1', business_name: 'Baci Store' },
      staffAccess: ownerStaffAccess,
    });
    mocks.fetchPrimaryDomain.mockResolvedValue(null);
  });

  it('returns 401 when the request is unauthenticated', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    // The no-store/private cache invariant must hold on error paths too.
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('Cache-Control')).toContain('private');
    expect(mocks.fetchDashboardMerchant).not.toHaveBeenCalled();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it('returns 401 when getUser reports an auth error', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error('bad jwt'),
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    expect(mocks.fetchDashboardMerchant).not.toHaveBeenCalled();
  });

  it('resolves the owner merchant via the service-role client scoped to the session user', async () => {
    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      merchant: { id: 'merchant-1', business_name: 'Baci Store' },
      staffAccess: ownerStaffAccess,
    });
    // Ownership is enforced by passing the SESSION user id, never client input.
    expect(mocks.fetchDashboardMerchant).toHaveBeenCalledWith(
      ADMIN_CLIENT,
      'user-123'
    );
    // Per-user secret payload must never be cached by a shared cache/CDN.
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('Cache-Control')).toContain('private');
  });

  it('attaches the primary custom domain when present', async () => {
    mocks.fetchPrimaryDomain.mockResolvedValueOnce('shop.example.com');

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(body.merchant.custom_domain).toBe('shop.example.com');
    expect(mocks.fetchPrimaryDomain).toHaveBeenCalledWith(
      ADMIN_CLIENT,
      'merchant-1'
    );
  });

  it('returns the staff access payload for an active staff member', async () => {
    const staffAccess = {
      isStaff: true,
      isOwner: false,
      role: 'manager',
      permissions: { settings: { view: true } },
    };
    mocks.fetchDashboardMerchant.mockResolvedValueOnce({
      merchant: { id: 'merchant-9' },
      staffAccess,
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.staffAccess).toEqual(staffAccess);
  });

  it('returns a null merchant (not an error) when the user has no dashboard merchant', async () => {
    mocks.fetchDashboardMerchant.mockResolvedValueOnce({
      merchant: null,
      staffAccess: { isStaff: false, isOwner: false, role: null },
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect((await response.json()).merchant).toBeNull();
    expect(mocks.fetchPrimaryDomain).not.toHaveBeenCalled();
  });

  it('returns 500 when the dashboard lookup throws', async () => {
    mocks.fetchDashboardMerchant.mockRejectedValueOnce(new Error('db down'));

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Internal server error' });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(response.headers.get('Cache-Control')).toContain('private');
  });
});
