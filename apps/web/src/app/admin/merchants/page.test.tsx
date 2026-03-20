'use client';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiGet = vi.fn();
const mockToast = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}));

import MerchantsPage from './page';

const merchantsResponse = {
  data: [
    {
      merchant_id: 'merchant-1',
      business_name: 'Baci Store',
      email: 'owner@example.com',
      joined_at: '2026-03-20T10:00:00.000Z',
      total_gmv: 400,
      total_orders: 2,
      last_order_date: '2026-03-19',
      active_days: 2,
      health_status: 'healthy' as const,
    },
  ],
  generatedAt: '2026-03-20T10:00:00.000Z',
};

describe('Admin merchants page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue(merchantsResponse);
  });

  it('loads merchant rows through the admin API route', async () => {
    render(<MerchantsPage />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        '/api/admin/merchants?sortBy=gmv'
      );
    });

    expect(await screen.findByText('Baci Store')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
  });

  it('re-fetches the admin merchant list when the refresh button is clicked', async () => {
    const user = userEvent.setup();
    render(<MerchantsPage />);

    await screen.findByText('Baci Store');
    await user.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledTimes(2);
    });
  });
});
