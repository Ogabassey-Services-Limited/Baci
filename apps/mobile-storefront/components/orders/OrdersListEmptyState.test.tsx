import { fireEvent, render, screen } from '@testing-library/react-native';
import { OrdersListEmptyState } from './OrdersListEmptyState';

const colors = {
  text: '#111827',
  textSecondary: '#6b7280',
} as const;

describe('OrdersListEmptyState', () => {
  it('renders the no-match state and clears search', () => {
    const onClearSearch = jest.fn();

    render(
      <OrdersListEmptyState
        colors={colors}
        hasOrders
        onClearSearch={onClearSearch}
        onStartShopping={jest.fn()}
      />
    );

    expect(screen.getByText('No matching orders')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /clear order search/i }));
    expect(onClearSearch).toHaveBeenCalledTimes(1);
  });

  it('renders the no-orders state and starts shopping', () => {
    const onStartShopping = jest.fn();

    render(
      <OrdersListEmptyState
        colors={colors}
        hasOrders={false}
        onClearSearch={jest.fn()}
        onStartShopping={onStartShopping}
      />
    );

    expect(screen.getByText('No orders yet')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /start shopping/i }));
    expect(onStartShopping).toHaveBeenCalledTimes(1);
  });
});
