import './orders-screen-test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersSearchHeader } from './OrdersSearchHeader';
import { mockColors } from './orders-screen-test-utils';

describe('OrdersSearchHeader', () => {
  it('updates search text and selects paid plus fulfillment filters', () => {
    const onSearchChange = vi.fn();
    const onFilterSelect = vi.fn();

    render(
      <OrdersSearchHeader
        colors={mockColors}
        counts={{ all: 3, paid: 2, pending: 1 }}
        selectedFilter="all"
        onSearchChange={onSearchChange}
        onFilterSelect={onFilterSelect}
        searchQuery="phone"
      />
    );

    fireEvent.change(
      screen.getByPlaceholderText('Search orders or customers...'),
      {
        target: { value: 'tablet' },
      }
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Paid orders: 2' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Pending orders: 1' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Processing orders: 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onSearchChange).toHaveBeenCalledWith('tablet');
    expect(onFilterSelect).toHaveBeenCalledWith('paid');
    expect(onFilterSelect).toHaveBeenCalledWith('pending');
    expect(onFilterSelect).toHaveBeenCalledWith('processing');
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('keeps the search controls at a stable height', () => {
    render(
      <OrdersSearchHeader
        colors={mockColors}
        counts={{ all: 2, pending: 1 }}
        onSearchChange={vi.fn()}
        onFilterSelect={vi.fn()}
        searchQuery=""
        selectedFilter="all"
      />
    );

    const header = screen.getByTestId('orders-search-header');
    const searchBar = screen.getByTestId('orders-search-bar');

    expect(header.style.height).toBe('');
    expect(header.style.marginBottom).toBe('0px');
    expect(header.style.flexShrink).toBe('0');
    expect(searchBar.style.minHeight).toBe('56px');
  });

  it('matches the space above the filter pills to the list date gap', () => {
    render(
      <OrdersSearchHeader
        colors={mockColors}
        counts={{ all: 2, pending: 1 }}
        onSearchChange={vi.fn()}
        onFilterSelect={vi.fn()}
        searchQuery=""
        selectedFilter="all"
      />
    );

    expect(screen.getByTestId('orders-filter-row').style.marginTop).toBe(
      '16px'
    );
  });
});
