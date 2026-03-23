import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Order } from './actions';
import { OrderCardDetails } from './order-card-details';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
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
    tracking_number: 'TRK-001',
    shipping_provider: 'Topship',
    items: [
      {
        id: 'item-1',
        name: 'Widget',
        quantity: 1,
        price: 25000,
      },
    ],
    ...overrides,
  };
}

describe('OrderCardDetails', () => {
  it('renders fulfillment and item details for the expanded card', () => {
    render(
      <OrderCardDetails
        order={makeOrder()}
        formatCurrency={(amount) => `₦${amount}`}
      />
    );

    expect(screen.getByText('Item Details')).toBeInTheDocument();
    expect(screen.getByText('Topship')).toBeInTheDocument();
    expect(screen.getByText('TRK-001')).toBeInTheDocument();
  });
});
