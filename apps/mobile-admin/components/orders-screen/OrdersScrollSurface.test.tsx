import './orders-screen-test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersScrollSurface } from './OrdersScrollSurface';
import { mockColors } from './orders-screen-test-utils';

describe('OrdersScrollSurface', () => {
  it('connects search, filter, date chip, and list refresh actions', () => {
    const onSearchChange = vi.fn();
    const onFilterSelect = vi.fn();
    const onClearDate = vi.fn();
    const onRefresh = vi.fn();
    const onDismissInsight = vi.fn();

    render(
      <OrdersScrollSurface
        colors={mockColors}
        counts={{ all: 2, paid: 1, pending: 1 }}
        data={[]}
        dateChipLabel="Jun 1 - Jun 12"
        isFetchingNextPage={false}
        isRefreshing={false}
        listViewState={{ status: 'error', title: 'Failed', message: 'Retry.' }}
        onClearDate={onClearDate}
        onDismissInsight={onDismissInsight}
        onEndReached={vi.fn()}
        onRefresh={onRefresh}
        onSearchChange={onSearchChange}
        onFilterSelect={onFilterSelect}
        renderItem={() => null}
        searchQuery="iphone"
        selectedFilter="all"
      />
    );

    fireEvent.change(
      screen.getByPlaceholderText('Search orders or customers...'),
      {
        target: { value: 'ipad' },
      }
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Paid orders: 1' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Pending orders: 1' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Processing orders: 0' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear date filter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onSearchChange).toHaveBeenCalledWith('ipad');
    expect(onFilterSelect).toHaveBeenCalledWith('paid');
    expect(onFilterSelect).toHaveBeenCalledWith('pending');
    expect(onFilterSelect).toHaveBeenCalledWith('processing');
    expect(onClearDate).toHaveBeenCalledOnce();
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('dismisses insights only after a deliberate downward scroll', () => {
    const onDismissInsight = vi.fn();

    render(
      <OrdersScrollSurface
        colors={mockColors}
        counts={{ all: 1, pending: 1 }}
        data={[{ type: 'header', id: 'header-today', title: 'Today' }]}
        dateChipLabel={null}
        isFetchingNextPage={false}
        isRefreshing={false}
        listViewState={{ status: 'ready' }}
        onClearDate={vi.fn()}
        onDismissInsight={onDismissInsight}
        onEndReached={vi.fn()}
        onRefresh={vi.fn()}
        onSearchChange={vi.fn()}
        onFilterSelect={vi.fn()}
        renderItem={({ item }) => <span>{item.id}</span>}
        searchQuery=""
        selectedFilter="all"
      />
    );

    const list = screen.getByTestId('orders-list-content');
    Object.defineProperty(list, 'scrollTop', { configurable: true, value: 24 });
    fireEvent.scroll(list);

    expect(onDismissInsight).not.toHaveBeenCalled();

    Object.defineProperty(list, 'scrollTop', { configurable: true, value: 64 });
    fireEvent.scroll(list);

    expect(onDismissInsight).toHaveBeenCalledOnce();
  });
});
