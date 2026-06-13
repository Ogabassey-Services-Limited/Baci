import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockToast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: vi.fn(),
}));

import LoyaltyProgramPage from './page';

const loyaltySettings = {
  enabled: true,
  program_name: 'Baci Rewards',
  points_per_currency: 1,
  points_currency_unit: 100,
  signup_bonus_points: 50,
  birthday_bonus_points: 25,
  review_bonus_points: 10,
  referral_bonus_points: 75,
  points_to_currency_ratio: 0.01,
  minimum_redemption_points: 500,
  maximum_redemption_percentage: 50,
  tiers: [
    {
      name: 'Bronze',
      minPoints: 0,
      multiplier: 1,
      perks: [],
    },
  ],
  points_expiry_days: 365,
};

describe('LoyaltyProgramPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/loyalty/settings') {
        return Promise.resolve({
          ok: true,
          json: async () => loyaltySettings,
        } as Response);
      }

      return Promise.resolve({
        ok: false,
        json: async () => ({}),
      } as Response);
    }) as typeof fetch;
  });

  it('renders loyalty settings without requiring unused customer stats', async () => {
    render(<LoyaltyProgramPage />);

    expect(
      await screen.findByRole('heading', { name: 'Loyalty Program' })
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Program Name' })).toHaveValue(
      'Baci Rewards'
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/loyalty/settings');
  });
});
