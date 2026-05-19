import { fireEvent, render, screen } from '@testing-library/react-native';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import type { OrdersListItemOrder } from './OrdersListItem';
import { OrdersListItem } from './OrdersListItem';

const colors = {
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  textSecondary: '#6b7280',
} as const;

const formatDate = () => '12 May 2026';

function buildOrder(overrides: Partial<OrdersListItemOrder> = {}): OrdersListItemOrder {
  return {
    id: 'order-1',
    shipping_status: 'shipped',
    subtotal: 40000,
    shipping_fee: 5000,
    discount_amount: 0,
    tax_amount: 2000,
    total: 47000,
    payment_status: 'paid',
    created_at: '2026-05-12T10:00:00.000Z',
    items_count: 2,
    items: [
      { product_name: 'iPhone 11 Pro Max', quantity: 1 },
      { product_name: 'AirPods', quantity: 1 },
    ],
    ...overrides,
  };
}

describe('OrdersListItem', () => {
  it('renders order details and handles press', () => {
    const onPress = jest.fn();
    const order = buildOrder();

    render(
      <OrdersListItem
        item={order}
        colors={colors}
        formatDate={formatDate}
        onPress={onPress}
      />
    );

    expect(screen.getByText('Shipped')).toBeTruthy();
    expect(screen.getByText('Placed 12 May 2026')).toBeTruthy();
    expect(screen.getByText('iPhone 11 Pro Max')).toBeTruthy();
    expect(screen.getByText('+1 more item')).toBeTruthy();
    expect(screen.getByText(formatNgnCurrency(47000))).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: /view details for order order-1/i }));
    expect(onPress).toHaveBeenCalledWith('order-1');
  });

  it('falls back to items_count narrative when items are missing', () => {
    render(
      <OrdersListItem
        item={buildOrder({ id: 'order-2', items: [], items_count: 3 })}
        colors={colors}
        formatDate={formatDate}
        onPress={jest.fn()}
      />
    );

    expect(screen.getByText('Order items')).toBeTruthy();
    expect(screen.getByText('3 items')).toBeTruthy();
  });

  it('shows single-item quantity without additional-items copy', () => {
    render(
      <OrdersListItem
        item={buildOrder({
          id: 'order-3',
          items: [{ product_name: 'Sony PlayStation 5', quantity: 2 }],
          items_count: 1,
        })}
        colors={colors}
        formatDate={formatDate}
        onPress={jest.fn()}
      />
    );

    expect(screen.getByText('Sony PlayStation 5')).toBeTruthy();
    expect(screen.getByText('2 items')).toBeTruthy();
    expect(screen.queryByText(/\+\d+ more item/i)).toBeNull();
  });

  it('shows zero-items fallback when order has no line items', () => {
    render(
      <OrdersListItem
        item={buildOrder({ id: 'order-4', items: [], items_count: 0 })}
        colors={colors}
        formatDate={formatDate}
        onPress={jest.fn()}
      />
    );

    expect(screen.getByText('0 items')).toBeTruthy();
  });

  it('maps shipping status to the expected customer-facing labels', () => {
    const { rerender } = render(
      <OrdersListItem
        item={buildOrder({ id: 'order-5', shipping_status: 'pending' })}
        colors={colors}
        formatDate={formatDate}
        onPress={jest.fn()}
      />
    );

    expect(screen.getByText('Order placed')).toBeTruthy();

    rerender(
      <OrdersListItem
        item={buildOrder({ id: 'order-6', shipping_status: 'delivered' })}
        colors={colors}
        formatDate={formatDate}
        onPress={jest.fn()}
      />
    );

    expect(screen.getByText('Delivered')).toBeTruthy();
  });
});
