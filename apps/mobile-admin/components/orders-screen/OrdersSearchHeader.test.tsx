import './orders-screen-test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersSearchHeader } from './OrdersSearchHeader';
import { mockColors } from './orders-screen-test-utils';

describe('OrdersSearchHeader', () => {
  it('updates search text and selects a status filter', () => {
    const onSearchChange = vi.fn();
    const onStatusSelect = vi.fn();

    render(
      <OrdersSearchHeader
        colors={mockColors}
        counts={{ all: 2, pending: 1 }}
        onSearchChange={onSearchChange}
        onStatusSelect={onStatusSelect}
        searchHeaderStyle={{}}
        searchQuery="phone"
        statusFilter={undefined}
      />
    );

    fireEvent.change(
      screen.getByPlaceholderText('Search orders or customers...'),
      {
        target: { value: 'tablet' },
      }
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Pending orders: 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onSearchChange).toHaveBeenCalledWith('tablet');
    expect(onStatusSelect).toHaveBeenCalledWith('pending');
    expect(onSearchChange).toHaveBeenCalledWith('');
  });
});
