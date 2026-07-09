import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ slug: 'test-store' })),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/contexts/customer-auth-context', () => ({
  useCustomerAuth: vi.fn(() => ({ customer: null })),
}));

vi.mock('@/hooks/use-loyalty', () => ({
  useLoyalty: vi.fn(() => ({
    enrolled: false,
    loading: false,
    recentTransactions: [],
    getTierInfo: vi.fn(),
    tier: null,
  })),
}));

vi.mock('@/components/storefront/loyalty/loyalty-enrollment-form', () => ({
  LoyaltyEnrollmentForm: vi.fn(() => null),
}));

vi.mock('@/components/storefront/loyalty/loyalty-status-card', () => ({
  LoyaltyStatusCard: vi.fn(() => null),
}));

vi.mock('@/components/storefront/loyalty/rewards-catalog', () => ({
  RewardsCatalog: vi.fn(() => null),
}));

const useMerchantSafeMock = vi.fn();
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => useMerchantSafeMock(),
}));

const { default: RewardsPage } = await import('./page');

describe('RewardsPage', () => {
  it('renders sr-only H1 in loading state when no merchant is in context yet', () => {
    useMerchantSafeMock.mockReturnValue(null);

    render(<RewardsPage />);

    // merchantId derives from context; null context -> loading branch renders sr-only H1
    const h1 = screen.queryByRole('heading', { level: 1, hidden: true });
    expect(h1).not.toBeNull();
    expect(h1?.textContent).toBe('Rewards');
    expect(h1?.className).toContain('sr-only');
  });

  it('renders the sign-in prompt once merchant context resolves and no customer is signed in', () => {
    useMerchantSafeMock.mockReturnValue({
      merchant: {
        id: 'merchant-1',
        business_name: 'Test Store',
        country: 'NG',
        payout_currency: 'NGN',
      },
      loading: false,
    });

    render(<RewardsPage />);

    const heading = screen.getByRole('heading', {
      level: 1,
      name: /rewards program/i,
    });
    expect(heading).toBeDefined();

    const signInLink = screen.getByRole('link', {
      name: /sign in to continue/i,
    });
    expect(signInLink).toHaveAttribute(
      'href',
      '/test-store/account/login?redirect=/test-store/pages/rewards'
    );
  });
});
