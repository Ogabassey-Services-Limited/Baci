import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OrdersStatsCards, OrdersUrgentAlert } from './orders-stats-cards';

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
});

describe('OrdersUrgentAlert', () => {
  it('calls the resolve handler when the resolve button is clicked', async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();

    render(
      <OrdersUrgentAlert
        showAlert
        stats={{
          totalOrders: 10,
          completedOrders: 6,
          unpaidOrders: 4,
          urgentOrders: 2,
        }}
        statsLoading={false}
        onDismiss={vi.fn()}
        onResolve={onResolve}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Click to resolve' }));

    expect(onResolve).toHaveBeenCalledOnce();
  });
});
