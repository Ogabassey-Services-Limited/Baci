import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersFiltersBar } from './orders-filters-bar';

describe('OrdersFiltersBar', () => {
  it('renders the search input and filter buttons', () => {
    render(
      <OrdersFiltersBar
        searchTerm=""
        onSearchChange={vi.fn()}
        paymentFilter="All"
        onPaymentFilterChange={vi.fn()}
        shippingFilter="All"
        onShippingFilterChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole('searchbox', { name: 'Search orders' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /payment status/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /shipping status/i })
    ).toBeInTheDocument();
  });

  it('forwards search input changes', () => {
    const onSearchChange = vi.fn();

    render(
      <OrdersFiltersBar
        searchTerm=""
        onSearchChange={onSearchChange}
        paymentFilter="All"
        onPaymentFilterChange={vi.fn()}
        shippingFilter="All"
        onShippingFilterChange={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search orders' }), {
      target: { value: 'Ada' },
    });

    expect(onSearchChange).toHaveBeenCalledWith('Ada');
  });
});
