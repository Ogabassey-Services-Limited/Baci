import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Order } from './actions';
import { OrdersListCard } from './orders-list-card';

vi.mock('./order-card', () => ({
  OrderCard: ({ order }: { order: { customerName: string } }) => (
    <div>{order.customerName}</div>
  ),
}));

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    orderNumber: 'ORD-001',
    customerName: 'Ada Lovelace',
    total: 25000,
    currency: 'NGN',
    shippingStatus: 'Pending',
    paymentStatus: 'Pending',
    paymentMethod: 'card',
    date: 'Mar 23, 2026',
    createdAt: Date.now(),
    source: 'website',
    items: [],
    ...overrides,
  };
}

describe('OrdersListCard', () => {
  it('renders the recent orders list and select-all control', () => {
    render(
      <OrdersListCard
        filteredOrders={[makeOrder()]}
        selectedOrders={new Set()}
        ordersLoading={false}
        ordersError={null}
        onSelectAll={vi.fn()}
        onSelectOrder={vi.fn()}
        onStatusUpdate={vi.fn()}
        onManageJumia={vi.fn()}
        onMarkPaid={vi.fn()}
        onMarkUnpaid={vi.fn()}
        onFulfillOrders={vi.fn()}
        onDeleteSelected={vi.fn()}
        formatCurrency={(amount) => `₦${amount}`}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Recent Orders' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Select all orders')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('renders a loading state while orders are being fetched', () => {
    render(
      <OrdersListCard
        filteredOrders={[]}
        selectedOrders={new Set()}
        ordersLoading
        ordersError={null}
        onSelectAll={vi.fn()}
        onSelectOrder={vi.fn()}
        onStatusUpdate={vi.fn()}
        onManageJumia={vi.fn()}
        onMarkPaid={vi.fn()}
        onMarkUnpaid={vi.fn()}
        onFulfillOrders={vi.fn()}
        onDeleteSelected={vi.fn()}
        formatCurrency={(amount) => `₦${amount}`}
      />
    );

    expect(screen.getByRole('img', { name: 'Loading' })).toBeInTheDocument();
  });

  it('renders an error state when the orders query fails', () => {
    render(
      <OrdersListCard
        filteredOrders={[]}
        selectedOrders={new Set()}
        ordersLoading={false}
        ordersError="Failed to load orders"
        onSelectAll={vi.fn()}
        onSelectOrder={vi.fn()}
        onStatusUpdate={vi.fn()}
        onManageJumia={vi.fn()}
        onMarkPaid={vi.fn()}
        onMarkUnpaid={vi.fn()}
        onFulfillOrders={vi.fn()}
        onDeleteSelected={vi.fn()}
        formatCurrency={(amount) => `₦${amount}`}
      />
    );

    expect(screen.getByText('Failed to Load Orders')).toBeInTheDocument();
    expect(
      screen.getByText(/Failed to load orders Please try again\./i)
    ).toBeInTheDocument();
  });

  it('renders an empty state when no orders match the current filters', () => {
    render(
      <OrdersListCard
        filteredOrders={[]}
        selectedOrders={new Set()}
        ordersLoading={false}
        ordersError={null}
        onSelectAll={vi.fn()}
        onSelectOrder={vi.fn()}
        onStatusUpdate={vi.fn()}
        onManageJumia={vi.fn()}
        onMarkPaid={vi.fn()}
        onMarkUnpaid={vi.fn()}
        onFulfillOrders={vi.fn()}
        onDeleteSelected={vi.fn()}
        formatCurrency={(amount) => `₦${amount}`}
      />
    );

    expect(screen.getByText('No orders found')).toBeInTheDocument();
    expect(
      screen.getByText('No orders match the current filters.')
    ).toBeInTheDocument();
  });
});
