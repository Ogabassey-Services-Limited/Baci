import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateClient = vi.fn();
const mockGetAdminMerchantUserDirectory = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
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

import MerchantUsersPage from '@/app/admin/merchants/[merchantId]/page';

const MERCHANT_ID = '11111111-1111-4111-8111-111111111111';

describe('MerchantUsersPage error panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue({ from: vi.fn() });
  });

  it('renders a friendly error panel when the merchant directory query fails', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockGetAdminMerchantUserDirectory.mockResolvedValue({
      data: null,
      error: { message: 'database unavailable' },
    });

    render(
      await MerchantUsersPage({
        params: Promise.resolve({ merchantId: MERCHANT_ID }),
      })
    );

    expect(errorSpy).toHaveBeenCalledWith(
      '[Admin] Failed to load merchant users:',
      { error: 'database unavailable', merchantId: MERCHANT_ID }
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Merchant users could not load'
    );
    expect(
      screen.getByRole('link', { name: /back to merchants/i })
    ).toHaveAttribute('href', '/admin/merchants');

    errorSpy.mockRestore();
  });

  it('omits the email owner action when the merchant email is malformed', async () => {
    mockGetAdminMerchantUserDirectory.mockResolvedValue({
      data: {
        generatedAt: '2026-03-20T10:00:00.000Z',
        merchant: {
          businessName: 'Baci Store',
          createdAt: '2026-03-20T10:00:00.000Z',
          email: 'not-an-email',
          id: MERCHANT_ID,
          isPublished: true,
          phone: null,
          planTier: null,
          signupSource: null,
          slug: 'baci-store',
          updatedAt: null,
        },
        summary: {
          activeAdminAppInstallations: 0,
          activeStorefrontAppInstallations: 0,
          customerUsers: 0,
          staffUsers: 0,
          unmatchedAppUsers: 0,
          webUsers: 1,
        },
        users: {
          customers: [],
          owner: {
            activeAppInstallations: 0,
            appPlatforms: [],
            createdAt: null,
            email: 'not-an-email',
            id: 'owner-user',
            lastSeenAt: null,
            name: 'Baci Store',
            role: 'owner',
            staffRole: null,
            status: 'active',
            surfaces: ['web'],
            userId: 'owner-user',
          },
          staff: [],
          unmatchedAppUsers: [],
        },
      },
      error: null,
    });

    render(
      await MerchantUsersPage({
        params: Promise.resolve({ merchantId: MERCHANT_ID }),
      })
    );

    expect(
      screen.queryByRole('link', { name: /email owner/i })
    ).not.toBeInTheDocument();
  });
});
