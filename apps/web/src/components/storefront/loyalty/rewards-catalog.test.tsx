import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RewardsCatalog } from './rewards-catalog';

const mockUseLoyalty = vi.fn();

vi.mock('@/hooks/use-loyalty', () => ({
  useLoyalty: (...args: unknown[]) => mockUseLoyalty(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function loyaltyStateWithReward(reward: Record<string, unknown>) {
  return {
    loading: false,
    enrolled: true,
    pointsBalance: 1000,
    tier: 'gold',
    availableRewards: [reward],
    redeemReward: vi.fn(),
    getTierInfo: () => ({
      colors: { text: 'text-amber-800' },
      benefits: [],
    }),
  };
}

const FIXED_DISCOUNT_REWARD = {
  id: 'reward-1',
  name: 'Flat discount',
  description: 'A flat-value discount reward',
  points_required: 500,
  reward_type: 'discount',
  discount_type: 'fixed',
  discount_value: 2000,
};

describe('RewardsCatalog', () => {
  it('renders a fixed-value discount reward label in NGN when no merchant currency is provided', () => {
    mockUseLoyalty.mockReturnValue(
      loyaltyStateWithReward(FIXED_DISCOUNT_REWARD)
    );

    render(<RewardsCatalog merchantId="merchant-1" customerId="customer-1" />);

    expect(screen.getByText('₦2,000 Off')).toBeInTheDocument();
  });

  it('renders a fixed-value discount reward label in the merchant payout currency for an INR merchant', () => {
    mockUseLoyalty.mockReturnValue(
      loyaltyStateWithReward(FIXED_DISCOUNT_REWARD)
    );

    render(
      <RewardsCatalog
        merchantId="merchant-1"
        customerId="customer-1"
        merchantCountry="IN"
        merchantPayoutCurrency="INR"
      />
    );

    expect(screen.getByText('₹2,000 Off')).toBeInTheDocument();
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument();
  });

  it('renders a percentage discount reward label unaffected by merchant currency', () => {
    mockUseLoyalty.mockReturnValue(
      loyaltyStateWithReward({
        id: 'reward-2',
        name: 'Percentage discount',
        description: 'A percentage-value discount reward',
        points_required: 300,
        reward_type: 'discount',
        discount_type: 'percentage',
        discount_value: 10,
      })
    );

    render(
      <RewardsCatalog
        merchantId="merchant-1"
        customerId="customer-1"
        merchantCountry="IN"
        merchantPayoutCurrency="INR"
      />
    );

    expect(screen.getByText('10% Off')).toBeInTheDocument();
  });
});
