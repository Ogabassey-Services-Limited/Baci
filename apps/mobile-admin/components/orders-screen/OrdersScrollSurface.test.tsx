import './orders-screen-test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersScrollSurface } from './OrdersScrollSurface';
import { mockColors } from './orders-screen-test-utils';

describe('OrdersScrollSurface', () => {
  it('connects search, filter, date chip, and list refresh actions', () => {
    const onSearchChange = vi.fn();
    const onStatusSelect = vi.fn();
    const onClearDate = vi.fn();
    const onRefresh = vi.fn();

    render(
      <OrdersScrollSurface
        colors={mockColors}
        counts={{ all: 1, pending: 1 }}
        data={[]}
        dateChipLabel="Jun 1 - Jun 12"
        isFetchingNextPage={false}
        isRefreshing={false}
        listViewState={{ status: 'error', title: 'Failed', message: 'Retry.' }}
        onClearDate={onClearDate}
        onEndReached={vi.fn()}
        onRefresh={onRefresh}
        onSearchChange={onSearchChange}
        onStatusSelect={onStatusSelect}
        renderItem={() => null}
        searchQuery="iphone"
        statusFilter={undefined}
        stickyHeaderIndices={[]}
      />
    );

    fireEvent.change(
      screen.getByPlaceholderText('Search orders or customers...'),
      {
        target: { value: 'ipad' },
      }
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Pending orders: 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear date filter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onSearchChange).toHaveBeenCalledWith('ipad');
    expect(onStatusSelect).toHaveBeenCalledWith('pending');
    expect(onClearDate).toHaveBeenCalledOnce();
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
