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
        formatCurrency={(amount) => `₦${amount}`}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Recent Orders' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Select all orders')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });
});
