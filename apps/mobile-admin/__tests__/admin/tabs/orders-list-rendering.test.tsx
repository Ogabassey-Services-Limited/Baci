import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@/hooks/useOrders';
import { ordersScreenTestHarness as harness } from './orders-screen-test-harness';

describe('OrdersScreen list rendering and actions', () => {
  beforeEach(() => harness.reset());
  afterEach(() => harness.cleanup());

  it('alerts the user when an order status update fails', async () => {
    const mockOrders = [
      {
        id: 'order-1',
        created_at: '2026-06-09T12:00:00Z',
        shipping_status: 'pending',
        payment_status: 'paid',
        total: 10000,
        currency: 'NGN',
        order_number: 'ORD-1001',
        customer_name: 'John Doe',
        item_count: 2,
        payment_method: 'card',
        source: 'web',
      },
    ] as unknown as Order[];
    harness.mocks.useOrders.mockReturnValue({
      data: {
        pages: [{ orders: mockOrders, nextCursor: null }],
        pageParams: [null],
      },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      error: null,
    });
    harness.mocks.mutateAsync.mockRejectedValueOnce(new Error('network down'));
    harness.groupedDateMock.mockReturnValue([
      { title: 'Today', data: [mockOrders[0]] },
    ]);

    harness.render();

    fireEvent.click(
      screen.getByRole('button', {
        name: /Shipping status: Unfulfilled\. Tap to change status/i,
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Order' }));

    await waitFor(() => {
      expect(harness.mocks.mutateAsync).toHaveBeenCalledWith({
        orderId: 'order-1',
        status: 'processing',
      });
    });
    expect(harness.alert.alert).toHaveBeenCalledWith(
      'Could not update order status',
      'Check your connection and try again. If this continues, confirm your account has permission to update orders.'
    );
  });

  it('renders section headers and order items correctly in flat structure', () => {
    const mockOrders = [
      {
        id: 'order-1',
        created_at: '2026-06-09T12:00:00Z',
        shipping_status: 'pending',
        payment_status: 'paid',
        total: 10000,
        currency: 'NGN',
        order_number: 'ORD-1001',
        customer_name: 'John Doe',
        items_count: 2,
        payment_method: 'card',
        channel: 'web',
      },
      {
        id: 'order-2',
        created_at: '2026-06-08T12:00:00Z',
        shipping_status: 'shipped',
        payment_status: 'paid',
        total: 25000,
        currency: 'NGN',
        order_number: 'ORD-1002',
        customer_name: 'Jane Smith',
        items_count: 1,
        payment_method: 'transfer',
        channel: 'whatsapp',
      },
    ] as unknown as Order[];

    harness.mocks.useOrders.mockReturnValue({
      data: {
        pages: [{ orders: mockOrders, nextCursor: null }],
        pageParams: [null],
      },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      error: null,
    });
    harness.groupedDateMock.mockReturnValue([
      { title: 'Today', data: [mockOrders[0]] },
      { title: 'Yesterday', data: [mockOrders[1]] },
    ]);

    harness.render();

    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(screen.getByText('ORD-1001')).toBeTruthy();
    expect(screen.getByText('ORD-1002')).toBeTruthy();
    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getByText('Jane Smith')).toBeTruthy();
    expect(
      harness.mocks.flashListProps[harness.mocks.flashListProps.length - 1]
        ?.stickyHeaderIndices
    ).toBeUndefined();
  });

  it('renders pagination footer when isFetchingNextPage is true', () => {
    harness.mocks.useOrders.mockReturnValue({
      data: {
        pages: [{ orders: [], nextCursor: 'next-page' }],
        pageParams: [null],
      },
      isLoading: false,
      isFetching: false,
      isFetchingNextPage: true,
      hasNextPage: true,
      fetchNextPage: vi.fn(),
      error: null,
    });

    harness.render();

    expect(screen.getByText('loading')).toBeTruthy();
  });

  it('renders Gemma AI insights and actionable checklist TODOs', () => {
    harness.render();

    expect(screen.getByText('AI INSIGHTS')).toBeTruthy();
    expect(screen.getByText('Verify Pending Shipments')).toBeTruthy();
    expect(
      screen.getByText(
        'There are 503 unfulfilled orders. Shipped items prompt positive customer reviews.'
      )
    ).toBeTruthy();
    expect(screen.getByText('Fulfill outstanding pending orders')).toBeTruthy();
  });
});
