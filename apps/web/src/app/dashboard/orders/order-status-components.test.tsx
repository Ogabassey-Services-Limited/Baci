import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Order } from './actions';
import { StatusBadge, StatusDropdown } from './order-status-components';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    orderNumber: 'ORD-001',
    customerName: 'Ada Lovelace',
    total: 12000,
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

describe('StatusBadge', () => {
  it('renders the provided status label', () => {
    render(<StatusBadge status="Pending" type="shipping" />);

    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});

describe('StatusDropdown', () => {
  it('renders a trigger button for the current shipping status', () => {
    render(<StatusDropdown order={makeOrder()} onStatusUpdate={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: /pending/i })
    ).toBeInTheDocument();
  });
});
