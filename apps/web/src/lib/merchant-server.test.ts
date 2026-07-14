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

// The own-merchant read runs under the service role (S1), so the admin client
// factory must be mocked; fetchDashboardMerchant itself is mocked above, so the
// returned object is only a placeholder passed through to it.
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ tag: 'admin' })),
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

    const {
      ensurePermission,
      isMerchantPermissionRedirectError,
      NoMerchantAccessError,
    } = await loadModule();

    let rejection: unknown;
    try {
      await ensurePermission('products', 'view');
    } catch (error) {
      rejection = error;
    }

    expect(rejection).toBeInstanceOf(NoMerchantAccessError);
    expect(isMerchantPermissionRedirectError(rejection)).toBe(true);
  });

  it('throws a typed redirect error when staff lacks a permission', async () => {
    const user = { id: 'user-1', email: 'staff@example.com' };

    mocks.getUser.mockResolvedValue({
      data: { user },
      error: null,
    });
    mocks.fetchDashboardMerchant.mockResolvedValue({
      merchant: {
        id: 'merchant-1',
        business_name: 'Staff Store',
        slug: 'staff-store',
      },
      staffAccess: {
        isStaff: true,
        isOwner: false,
        role: 'viewer',
        permissions: { products: { view: true } },
      },
    });
    mocks.fetchPrimaryDomain.mockResolvedValue(null);

    const {
      ensurePermission,
      isMerchantPermissionRedirectError,
      MerchantPermissionDeniedError,
    } = await loadModule();

    let rejection: unknown;
    try {
      await ensurePermission('marketing', 'edit');
    } catch (error) {
      rejection = error;
    }

    expect(rejection).toBeInstanceOf(MerchantPermissionDeniedError);
    expect(isMerchantPermissionRedirectError(rejection)).toBe(true);
  });

  it('honors wildcard permission grants (settings:*) in ensurePermission', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'staff@example.com' } },
      error: null,
    });
    mocks.fetchDashboardMerchant.mockResolvedValue({
      merchant: { id: 'merchant-1', business_name: 'S', slug: 's' },
      staffAccess: {
        isStaff: true,
        isOwner: false,
        role: 'manager',
        permissions: { settings: { '*': true } },
      },
    });
    mocks.fetchPrimaryDomain.mockResolvedValue(null);

    const { ensurePermission } = await loadModule();

    // settings:'*' must satisfy settings:view (previously denied).
    const { merchant } = await ensurePermission('settings', 'view');
    expect(merchant.id).toBe('merchant-1');
  });

  it('honors the global wildcard grant (*:*) in ensurePermission', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'staff@example.com' } },
      error: null,
    });
    mocks.fetchDashboardMerchant.mockResolvedValue({
      merchant: { id: 'merchant-1', business_name: 'S', slug: 's' },
      staffAccess: {
        isStaff: true,
        isOwner: false,
        role: 'manager',
        permissions: { '*': { '*': true } },
      },
    });
    mocks.fetchPrimaryDomain.mockResolvedValue(null);

    const { ensurePermission } = await loadModule();

    const { merchant } = await ensurePermission('marketing', 'edit');
    expect(merchant.id).toBe('merchant-1');
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
