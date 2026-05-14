import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockRedeemReward: vi.fn(),
  mockToast: vi.fn(),
  mockUseLoyalty: vi.fn(),
  mockUseToast: vi.fn(),
}));

vi.mock('@/hooks/use-loyalty', () => ({
  useLoyalty: () => mocks.mockUseLoyalty(),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => mocks.mockUseToast(),
}));

import { RewardsCatalog } from './rewards-catalog';

function arrangeLoyalty(overrides = {}) {
  mocks.mockUseLoyalty.mockReturnValue({
    availableRewards: [],
    enrolled: true,
    getTierInfo: vi.fn((tier: string) => ({
      colors: { text: 'text-muted-foreground' },
      name: tier,
    })),
    loading: false,
    pointsBalance: 0,
    redeemReward: mocks.mockRedeemReward,
    tier: 'bronze',
    ...overrides,
  });
}

describe('RewardsCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockUseToast.mockReturnValue({ toast: mocks.mockToast });
    arrangeLoyalty();
  });

  it('renders without crashing', () => {
    render(<RewardsCatalog merchantId="m1" customerId="c1" />);
    expect(
      screen.getByRole('heading', { name: /no rewards available/i })
    ).toBeInTheDocument();
  });

  it('shows empty state when no rewards', () => {
    render(<RewardsCatalog merchantId="m1" customerId="c1" />);
    expect(
      screen.getByText(/check back later for new rewards/i)
    ).toBeInTheDocument();
  });

  it('shows a loading status while rewards are loading', () => {
    arrangeLoyalty({ loading: true });

    render(<RewardsCatalog merchantId="m1" customerId="c1" />);

    expect(
      screen.getByRole('status', { name: /loading rewards/i })
    ).toBeInTheDocument();
  });

  it('shows the enrollment prompt when the customer is not enrolled', () => {
    arrangeLoyalty({ enrolled: false });

    render(<RewardsCatalog merchantId="m1" customerId="c1" />);

    expect(
      screen.getByRole('heading', { name: /join to see rewards/i })
    ).toBeInTheDocument();
  });

  it('renders available rewards and handles redemption failures', async () => {
    const user = userEvent.setup();
    mocks.mockRedeemReward.mockResolvedValue({
      error: 'Not enough points',
      success: false,
    });
    arrangeLoyalty({
      availableRewards: [
        {
          description: 'Save on your next order',
          discount_type: 'percentage',
          discount_value: 10,
          id: 'reward-1',
          name: '10% off',
          points_required: 100,
          reward_type: 'discount',
        },
      ],
      pointsBalance: 250,
    });

    render(<RewardsCatalog merchantId="m1" customerId="c1" />);

    expect(
      screen.getByRole('heading', { name: /available rewards/i })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Redeem' }));

    expect(mocks.mockRedeemReward).toHaveBeenCalledWith('reward-1');
    expect(mocks.mockToast).toHaveBeenCalledWith({
      title: 'Redemption Failed',
      description: 'Not enough points',
      variant: 'destructive',
    });
  });
});
