import './orders-screen-test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersList } from './OrdersList';
import { mockColors } from './orders-screen-test-utils';

describe('OrdersList', () => {
  it('renders an error retry action when the list failed to load', () => {
    const onRefresh = vi.fn();

    render(
      <OrdersList
        colors={mockColors}
        data={[]}
        isFetchingNextPage={false}
        isRefreshing={false}
        listViewState={{
          status: 'error',
          title: 'Failed to load orders',
          message: 'Try again.',
        }}
        onEndReached={vi.fn()}
        onRefresh={onRefresh}
        onScroll={vi.fn()}
        renderItem={() => null}
        stickyHeaderIndices={[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByText('Failed to load orders')).toBeInTheDocument();
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('renders rows through the provided renderItem callback', () => {
    render(
      <OrdersList
        colors={mockColors}
        data={[{ type: 'header', id: 'header-today', title: 'Today' }]}
        isFetchingNextPage={false}
        isRefreshing={false}
        listViewState={{ status: 'ready' }}
        onEndReached={vi.fn()}
        onRefresh={vi.fn()}
        onScroll={vi.fn()}
        renderItem={({ item }) => <span>{item.id}</span>}
        stickyHeaderIndices={[0]}
      />
    );

    expect(screen.getByText('header-today')).toBeInTheDocument();
  });
});
