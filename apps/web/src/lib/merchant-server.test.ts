import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  fetchDashboardMerchant: vi.fn(),
  fetchPrimaryDomain: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}));

vi.mock('@/hooks/merchant', () => ({
  fetchDashboardMerchant: mocks.fetchDashboardMerchant,
  fetchPrimaryDomain: mocks.fetchPrimaryDomain,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mocks.getUser,
    },
  })),
}));

function loadModule() {
  vi.resetModules();
  return import('./merchant-server');
}

describe('merchant-server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({});
  });

  it('returns no merchant data when the user is unauthenticated', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { getMerchantForUser } = await loadModule();
    const result = await getMerchantForUser();

    expect(result).toEqual({
      merchant: null,
      merchantLookupStatus: 'unauthenticated',
      staffAccess: {
        isStaff: false,
        isOwner: false,
        role: null,
        permissions: {},
      },
      user: null,
    });
    expect(mocks.fetchDashboardMerchant).not.toHaveBeenCalled();
  });

  it('marks the lookup as errored when auth.getUser fails', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Auth refresh failed'),
    });

    const { getMerchantForUser } = await loadModule();
    const result = await getMerchantForUser();

    expect(result).toEqual({
      merchant: null,
      merchantLookupStatus: 'error',
      staffAccess: {
        isStaff: false,
        isOwner: false,
        role: null,
        permissions: {},
      },
      user: null,
    });
    expect(mocks.fetchDashboardMerchant).not.toHaveBeenCalled();
  });

  it('reuses the validated dashboard merchant query and attaches the primary domain', async () => {
    const user = { id: 'user-1', email: 'owner@example.com' };
    const merchant = {
      id: 'merchant-1',
      business_name: 'Owner Store',
      slug: 'owner-store',
    };

    mocks.getUser.mockResolvedValue({
      data: { user },
      error: null,
    });
    mocks.fetchDashboardMerchant.mockResolvedValue({
      merchant: { ...merchant },
      staffAccess: {
        isStaff: false,
        isOwner: true,
        role: null,
        permissions: { full_access: { all: true } },
      },
    });
    mocks.fetchPrimaryDomain.mockResolvedValue('owner.example.com');

    const { getMerchantForUser } = await loadModule();
    const result = await getMerchantForUser();

    expect(mocks.fetchDashboardMerchant).toHaveBeenCalledWith(
      expect.any(Object),
      'user-1'
    );
    expect(mocks.fetchPrimaryDomain).toHaveBeenCalledWith(
      expect.any(Object),
      'merchant-1'
    );
    expect(result.user).toEqual(user);
    expect(result.merchant).toMatchObject({
      ...merchant,
      custom_domain: 'owner.example.com',
    });
    expect(result.merchantLookupStatus).toBe('found');
    expect(result.staffAccess.isOwner).toBe(true);
  });

  it('throws from ensurePermission when no merchant access is available', async () => {
    const user = { id: 'user-1', email: 'owner@example.com' };

    mocks.getUser.mockResolvedValue({
      data: { user },
      error: null,
    });
    mocks.fetchDashboardMerchant.mockResolvedValue({
      merchant: null,
      staffAccess: {
        isStaff: false,
        isOwner: false,
        role: null,
        permissions: {},
      },
    });
    mocks.fetchPrimaryDomain.mockResolvedValue(null);

    const { ensurePermission } = await loadModule();

    await expect(ensurePermission('products', 'view')).rejects.toThrow(
      'No merchant access'
    );
  });

  it('marks the lookup as errored when the rich merchant query fails', async () => {
    const user = { id: 'user-1', email: 'owner@example.com' };

    mocks.getUser.mockResolvedValue({
      data: { user },
      error: null,
    });
    mocks.fetchDashboardMerchant.mockRejectedValue(
      new Error('Could not find the trust_profile column in the schema cache')
    );
    mocks.fetchPrimaryDomain.mockResolvedValue(null);

    const { getMerchantForUser } = await loadModule();
    const result = await getMerchantForUser();

    expect(result.user).toEqual(user);
    expect(result.merchant).toBeNull();
    expect(result.staffAccess).toEqual({
      isStaff: false,
      isOwner: false,
      role: null,
      permissions: {},
    });
    expect(mocks.fetchPrimaryDomain).not.toHaveBeenCalled();
    expect(result.merchantLookupStatus).toBe('error');
  });
});
