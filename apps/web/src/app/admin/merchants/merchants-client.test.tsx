import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthFilter, MerchantStats } from './merchant-stats-grid';

const mockApiGet = vi.fn();
const mockToast = vi.fn();

vi.mock('@/lib/api-client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('./merchant-stats-grid', () => ({
  MerchantStatsGrid: ({
    activeFilter,
    onFilterChange,
    stats,
  }: {
    activeFilter: HealthFilter;
    onFilterChange: (filter: HealthFilter) => void;
    stats: MerchantStats;
  }) => (
    <div>
      <span>active-filter:{activeFilter}</span>
      <span>stats-total:{stats.total}</span>
      <span>stats-at-risk:{stats.atRisk}</span>
      <button type="button" onClick={() => onFilterChange('at_risk')}>
        Filter at risk
      </button>
    </div>
  ),
}));

vi.mock('./merchant-table', () => ({
  MerchantTable: ({
    merchants,
  }: {
    merchants: Array<{ business_name: string | null; merchant_id: string }>;
  }) => (
    <div>
      <span>table-count:{merchants.length}</span>
      {merchants.map((merchant) => (
        <p key={merchant.merchant_id}>{merchant.business_name}</p>
      ))}
    </div>
  ),
}));

import { MerchantsClient } from './merchants-client';

Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
  configurable: true,
  value: () => false,
});
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: () => undefined,
});

const merchantRows = [
  {
    active_days: 10,
    business_name: 'Baci Store',
    email: 'owner@example.com',
    health_status: 'healthy',
    joined_at: '2026-03-20T10:00:00.000Z',
    last_order_date: '2026-03-24T10:00:00.000Z',
    merchant_id: 'merchant-1',
    total_gmv: 1200,
    total_orders: 12,
  },
  {
    active_days: 1,
    business_name: 'Quiet Store',
    email: 'quiet@example.com',
    health_status: 'at_risk',
    joined_at: '2026-03-21T10:00:00.000Z',
    last_order_date: null,
    merchant_id: 'merchant-2',
    total_gmv: 50,
    total_orders: 1,
  },
] as const;

describe('MerchantsClient', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockToast.mockReset();
    mockApiGet.mockResolvedValue({
      data: merchantRows,
      generatedAt: '2026-03-24T10:00:00.000Z',
    });
  });

  it('fetches merchants, renders stats, and filters by search and health', async () => {
    const user = userEvent.setup();

    render(
      <MerchantsClient
        initialHealthFilter="all"
        initialMerchants={[...merchantRows]}
      />
    );

    expect(screen.getByText('Baci Store')).toBeVisible();
    expect(screen.getByText('Quiet Store')).toBeVisible();
    expect(screen.getByText('stats-total:2')).toBeVisible();
    expect(screen.getByText('stats-at-risk:1')).toBeVisible();
    expect(screen.getByText('Showing 2 of 2 merchants')).toBeVisible();

    await user.type(
      screen.getByPlaceholderText('Search merchants...'),
      'quiet'
    );

    expect(screen.getByText('table-count:1')).toBeVisible();
    expect(screen.queryByText('Baci Store')).not.toBeInTheDocument();
    expect(screen.getByText('Quiet Store')).toBeVisible();

    await user.clear(screen.getByPlaceholderText('Search merchants...'));
    await user.click(screen.getByRole('button', { name: 'Filter at risk' }));

    expect(screen.getByText('active-filter:at_risk')).toBeVisible();
    expect(screen.getByText('table-count:1')).toBeVisible();
    expect(screen.getByText('Quiet Store')).toBeVisible();
  });

  it('shows an error toast when fetching merchants fails', async () => {
    const user = userEvent.setup();
    mockApiGet.mockRejectedValue(new Error('network failed'));

    render(<MerchantsClient initialHealthFilter="all" initialMerchants={[]} />);

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Failed to load merchant data.',
          variant: 'destructive',
        })
      );
    });
    expect(screen.getByText('No merchants found')).toBeVisible();
  });

  it('refetches merchants when the sort changes', async () => {
    const user = userEvent.setup();

    render(
      <MerchantsClient
        initialHealthFilter="all"
        initialMerchants={[...merchantRows]}
      />
    );

    expect(screen.getByText('Baci Store')).toBeVisible();

    await user.click(screen.getByRole('combobox', { name: /sort merchants/i }));
    await user.click(
      await screen.findByRole('option', { name: 'Most Orders' })
    );

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        '/api/admin/merchants?sortBy=orders'
      );
    });
  });
});
