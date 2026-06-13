import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ordersScreenTestHarness as harness } from './orders-screen-test-harness';

describe('OrdersScreen states and filters', () => {
  beforeEach(() => harness.reset());
  afterEach(() => {
    cleanup();
    harness.cleanup();
  });

  it('renders the merchant error state instead of the empty state', () => {
    harness.mocks.useMerchant.mockReturnValue({
      storeUrl: '',
      merchant: null,
      isLoading: false,
      error: new Error('merchant failed'),
    });

    harness.render();

    expect(screen.getByText('Failed to load store')).toBeTruthy();
    expect(
      screen.getByText(
        'We could not load your store context for this account. Try again or sign in again if the issue persists.'
      )
    ).toBeTruthy();
    expect(screen.queryByText('No orders found')).toBeNull();
  });

  it('renders the orders error state and retries the relevant queries', () => {
    harness.mocks.useOrders.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      error: new Error('orders failed'),
    });

    harness.render();

    expect(screen.getByText('Failed to load orders')).toBeTruthy();
    expect(screen.queryByText('No orders found')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(harness.mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant'],
    });
    expect(harness.mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['orders', 'merchant-1'],
    });
    expect(harness.mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['order-counts', 'merchant-1'],
    });
  });

  it('retries only the merchant query when merchant context is missing', () => {
    harness.mocks.useMerchant.mockReturnValue({
      storeUrl: '',
      merchant: null,
      isLoading: false,
      error: null,
    });
    harness.mocks.useOrders.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      error: new Error('orders failed'),
    });

    harness.render();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(harness.mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant'],
    });
    expect(harness.mocks.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ['orders', 'merchant-1'],
    });
    expect(harness.mocks.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ['order-counts', 'merchant-1'],
    });
  });

  it('keeps the empty state for a genuine zero-orders result', () => {
    harness.render();

    expect(screen.getByText('No orders found')).toBeTruthy();
    expect(
      screen.getByText('Orders will appear here when customers place them')
    ).toBeTruthy();
  });

  it('renders the insight card above search and keeps filters below search', () => {
    harness.mocks.useAiInsights.mockReturnValue({
      data: null,
      isLoading: false,
      refetch: vi.fn(),
    });
    harness.mocks.useOrderCounts.mockReturnValue({
      data: {
        all: 8,
        pending: 4,
        processing: 2,
        shipped: 1,
        delivered: 1,
        cancelled: 0,
        returned: 0,
      },
    });

    harness.render();

    const viewPendingButton = screen.getByLabelText('View 4 pending orders');
    const searchInput = screen.getByPlaceholderText(
      'Search orders or customers...'
    );
    const pendingFilter = screen.getByLabelText('Pending orders: 4');

    expect(
      viewPendingButton.compareDocumentPosition(searchInput) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      searchInput.compareDocumentPosition(pendingFilter) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
