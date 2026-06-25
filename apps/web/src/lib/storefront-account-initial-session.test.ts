import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const {
  mockAuthGetUser,
  mockCreateClient,
  mockFrom,
  mockGetCachedMerchant,
  mockGetCachedMerchantByDomain,
  mockIsDomainIdentifier,
  mockMaybeSingle,
} = vi.hoisted(() => ({
  mockAuthGetUser: vi.fn(),
  mockCreateClient: vi.fn(),
  mockFrom: vi.fn(),
  mockGetCachedMerchant: vi.fn(),
  mockGetCachedMerchantByDomain: vi.fn(),
  mockIsDomainIdentifier: vi.fn(),
  mockMaybeSingle: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: mockGetCachedMerchant,
  getCachedMerchantByDomain: mockGetCachedMerchantByDomain,
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: mockIsDomainIdentifier,
}));

import { getStorefrontAccountInitialCustomer } from './storefront-account-initial-session';

function createSupabaseMock() {
  const eqUserId = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
  const eqMerchantId = vi.fn(() => ({ eq: eqUserId }));
  const select = vi.fn(() => ({ eq: eqMerchantId }));
  mockFrom.mockReturnValue({ select });

  return {
    auth: { getUser: mockAuthGetUser },
    from: mockFrom,
    select,
    eqMerchantId,
    eqUserId,
  };
}

describe('getStorefrontAccountInitialCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsDomainIdentifier.mockReturnValue(false);
    mockGetCachedMerchant.mockResolvedValue({ id: 'merchant-1' });
    mockGetCachedMerchantByDomain.mockResolvedValue({ id: 'merchant-domain' });
    mockAuthGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          user_metadata: { role: 'customer' },
        },
      },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'customer-1',
        first_name: 'Oga',
        last_name: 'Bassey',
        email: 'oga@example.com',
        saved_addresses: [],
        total_orders: 2,
        total_spent: 1000,
      },
      error: null,
    });
    mockCreateClient.mockResolvedValue(createSupabaseMock());
  });

  it('loads the current customer from the storefront slug before hydration', async () => {
    const customer = await getStorefrontAccountInitialCustomer('Ogabassey');

    expect(mockGetCachedMerchant).toHaveBeenCalledWith('ogabassey');
    expect(mockFrom).toHaveBeenCalledWith('customers');
    expect(customer).toMatchObject({
      email: 'oga@example.com',
      first_name: 'Oga',
      id: 'customer-1',
    });
  });

  it('uses domain merchant resolution for domain identifiers', async () => {
    mockIsDomainIdentifier.mockReturnValue(true);

    await getStorefrontAccountInitialCustomer('shop.ogabassey.com');

    expect(mockGetCachedMerchantByDomain).toHaveBeenCalledWith(
      'shop.ogabassey.com'
    );
    expect(mockGetCachedMerchant).not.toHaveBeenCalled();
  });

  it('returns null without querying customers when there is no auth user', async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    await expect(
      getStorefrontAccountInitialCustomer('ogabassey')
    ).resolves.toBeNull();

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('does not hydrate merchant accounts into customer storefront pages', async () => {
    mockAuthGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'merchant-user',
          user_metadata: { role: 'merchant' },
        },
      },
      error: null,
    });

    await expect(
      getStorefrontAccountInitialCustomer('ogabassey')
    ).resolves.toBeNull();

    expect(mockFrom).not.toHaveBeenCalled();
  });
});
