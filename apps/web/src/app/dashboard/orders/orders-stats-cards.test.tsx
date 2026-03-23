import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OrdersStatsCards } from './orders-stats-cards';

describe('OrdersStatsCards', () => {
  it('renders the summary totals', () => {
    render(
      <OrdersStatsCards
        stats={{
          totalOrders: 10,
          completedOrders: 6,
          unpaidOrders: 4,
          urgentOrders: 2,
        }}
        statsLoading={false}
      />
    );

    expect(screen.getByText('Total Orders 🛍️')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Completed Orders ✅')).toBeInTheDocument();
  });

  it('shows loading indicators while stats are loading', () => {
    render(
      <OrdersStatsCards
        stats={{
          totalOrders: 0,
          completedOrders: 0,
          unpaidOrders: 0,
          urgentOrders: 0,
        }}
        statsLoading
      />
    );

    expect(screen.getAllByRole('img', { name: 'Loading' })).toHaveLength(3);
  });

  it('renders zero values without hiding the stat cards', () => {
    render(
      <OrdersStatsCards
        stats={{
          totalOrders: 0,
          completedOrders: 0,
          unpaidOrders: 0,
          urgentOrders: 0,
        }}
        statsLoading={false}
      />
    );

    expect(screen.getAllByText('0')).toHaveLength(3);
    expect(screen.getByText('Unpaid Orders 💸')).toBeInTheDocument();
  });
});
