import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateClient = vi.fn();
const mockGetAdminMerchantUserDirectory = vi.fn();
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const MERCHANT_ID = '11111111-1111-4111-8111-111111111111';

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/admin-merchant-users', () => ({
  getAdminMerchantUserDirectory: (...args: unknown[]) =>
    mockGetAdminMerchantUserDirectory(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

const directoryResponse = {
  generatedAt: '2026-03-20T10:00:00.000Z',
  merchant: {
    businessName: 'Baci Store',
    createdAt: '2026-03-20T10:00:00.000Z',
    email: 'owner@example.com',
    id: MERCHANT_ID,
    isPublished: true,
    phone: '+2348000000000',
    planTier: 'pro',
    signupSource: 'web',
    slug: 'baci-store',
    updatedAt: '2026-03-21T10:00:00.000Z',
  },
  summary: {
    activeAdminAppInstallations: 1,
    activeStorefrontAppInstallations: 1,
    customerUsers: 1,
    staffUsers: 1,
    unmatchedAppUsers: 1,
    webUsers: 3,
  },
  users: {
    customers: [
      {
        activeAppInstallations: 1,
        appPlatforms: ['android'],
        createdAt: '2026-03-24T10:00:00.000Z',
        email: 'customer@example.com',
        id: 'customer-1',
        lastSeenAt: '2026-03-25T10:00:00.000Z',
        name: 'Customer One',
        role: 'customer',
        staffRole: null,
        status: 'active',
        surfaces: ['web', 'storefront_app'],
        userId: 'customer-user',
      },
    ],
    owner: {
      activeAppInstallations: 0,
      appPlatforms: [],
      createdAt: '2026-03-20T10:00:00.000Z',
      email: 'owner@example.com',
      id: 'owner-user',
      lastSeenAt: null,
      name: 'Baci Store',
      role: 'owner',
      staffRole: null,
      status: 'active',
      surfaces: ['web'],
      userId: 'owner-user',
    },
    staff: [
      {
        activeAppInstallations: 1,
        appPlatforms: ['ios'],
        createdAt: '2026-03-22T09:00:00.000Z',
        email: 'staff@example.com',
        id: 'staff-1',
        lastSeenAt: '2026-03-23T10:00:00.000Z',
        name: 'Staff User',
        role: 'staff',
        staffRole: 'manager',
        status: 'active',
        surfaces: ['web', 'admin_app'],
        userId: 'staff-user',
      },
    ],
    unmatchedAppUsers: [
      {
        activeAppInstallations: 1,
        appPlatforms: ['android'],
        createdAt: '2026-03-26T10:00:00.000Z',
        email: null,
        id: 'app-user-1',
        lastSeenAt: '2026-03-27T10:00:00.000Z',
        name: null,
        role: 'app_user',
        staffRole: null,
        status: 'app_registered',
        surfaces: ['admin_app'],
        userId: 'app-only-user',
      },
    ],
  },
};

import MerchantUsersPage from '@/app/admin/merchants/[merchantId]/page';

describe('MerchantUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue({ from: vi.fn() });
    mockGetAdminMerchantUserDirectory.mockResolvedValue({
      data: directoryResponse,
      error: null,
    });
  });

  it('renders the merchant identity and users across web and app surfaces', async () => {
    render(
      await MerchantUsersPage({
        params: Promise.resolve({
          merchantId: MERCHANT_ID,
        }),
      })
    );

    expect(mockGetAdminMerchantUserDirectory).toHaveBeenCalledWith(
      expect.anything(),
      MERCHANT_ID
    );
    expect(screen.getByRole('heading', { name: /baci store/i })).toBeVisible();
    expect(
      within(screen.getByRole('group', { name: 'Owner users' })).getAllByText(
        'owner@example.com'
      )
    ).toHaveLength(2);
    expect(screen.getByText('Staff User')).toBeVisible();
    expect(screen.getByText('Customer One')).toBeVisible();
    expect(screen.getByText('app-only-user')).toBeVisible();
    expect(screen.getAllByText('Admin app')).toHaveLength(2);
    expect(screen.getAllByText('Storefront app')).toHaveLength(1);
    expect(
      within(
        screen.getByRole('group', { name: 'Web users summary' })
      ).getByText('3')
    ).toBeVisible();
    expect(
      within(
        screen.getByRole('group', { name: 'Staff users summary' })
      ).getByText('1')
    ).toBeVisible();
    expect(
      within(
        screen.getByRole('group', { name: 'Admin app installations summary' })
      ).getByText('1')
    ).toBeVisible();
    expect(
      within(
        screen.getByRole('group', {
          name: 'Storefront app installations summary',
        })
      ).getByText('1')
    ).toBeVisible();
    expect(
      within(
        screen.getByRole('group', { name: 'App-only users summary' })
      ).getByText('1')
    ).toBeVisible();
    expect(screen.getByRole('link', { name: /email owner/i })).toHaveAttribute(
      'href',
      'mailto:owner@example.com'
    );
  });

  it('renders an empty state when a merchant has no staff or customers', async () => {
    mockGetAdminMerchantUserDirectory.mockResolvedValue({
      data: {
        ...directoryResponse,
        summary: {
          ...directoryResponse.summary,
          activeAdminAppInstallations: 0,
          activeStorefrontAppInstallations: 0,
          customerUsers: 0,
          staffUsers: 0,
          unmatchedAppUsers: 0,
          webUsers: 1,
        },
        users: {
          customers: [],
          owner: directoryResponse.users.owner,
          staff: [],
          unmatchedAppUsers: [],
        },
      },
      error: null,
    });

    render(
      await MerchantUsersPage({
        params: Promise.resolve({
          merchantId: MERCHANT_ID,
        }),
      })
    );

    expect(screen.getByText('No staff users yet')).toBeVisible();
    expect(screen.getByText('No customer users yet')).toBeVisible();
    expect(screen.getByText('No app-only users found')).toBeVisible();
  });

  it('omits the email owner action when the merchant has no email', async () => {
    mockGetAdminMerchantUserDirectory.mockResolvedValue({
      data: {
        ...directoryResponse,
        merchant: {
          ...directoryResponse.merchant,
          email: null,
        },
      },
      error: null,
    });

    render(
      await MerchantUsersPage({
        params: Promise.resolve({
          merchantId: MERCHANT_ID,
        }),
      })
    );

    expect(
      screen.queryByRole('link', { name: /email owner/i })
    ).not.toBeInTheDocument();
  });

  it('uses notFound when the merchant directory is missing', async () => {
    mockGetAdminMerchantUserDirectory.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      MerchantUsersPage({
        params: Promise.resolve({
          merchantId: MERCHANT_ID,
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalled();
  });

  it('uses notFound when the merchant id route param is invalid', async () => {
    await expect(
      MerchantUsersPage({
        params: Promise.resolve({
          merchantId: 'not-a-uuid',
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockNotFound).toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockGetAdminMerchantUserDirectory).not.toHaveBeenCalled();
  });
});
