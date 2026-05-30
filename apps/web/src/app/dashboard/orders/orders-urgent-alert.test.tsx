import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OrdersUrgentAlert } from './orders-urgent-alert';

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

  it('shows the loading state even when urgent orders are not yet known', () => {
    render(
      <OrdersUrgentAlert
        showAlert
        stats={{
          totalOrders: 0,
          completedOrders: 0,
          unpaidOrders: 0,
          urgentOrders: 0,
        }}
        statsLoading
        onDismiss={vi.fn()}
        onResolve={vi.fn()}
      />
    );

    expect(screen.getByText('Checking orders…')).toBeInTheDocument();
  });
});
