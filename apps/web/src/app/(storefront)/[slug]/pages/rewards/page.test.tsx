import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ slug: 'test-store' })),
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

const { default: RewardsPage } = await import('./page');

describe('RewardsPage', () => {
  it('renders sr-only H1 in loading state (merchantId null on mount)', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: null, business_name: '' }),
    });

    render(<RewardsPage />);

    // merchantId starts null before fetch resolves -> loading branch renders sr-only H1
    const h1 = screen.queryByRole('heading', { level: 1, hidden: true });
    expect(h1).not.toBeNull();
    expect(h1?.textContent).toBe('Rewards');
    expect(h1?.className).toContain('sr-only');
  });
});
