import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { OrderListFilterOption } from '@/lib/order-list-filters';
import { OrdersFilterBar } from './OrdersFilterBar';

const colors = {
  card: '#ffffff',
  border: '#e5e7eb',
  muted: '#f3f4f6',
  text: '#111827',
  textSecondary: '#6b7280',
} as const;

const filters: OrderListFilterOption[] = [
  { key: 'all', label: 'All', count: 12 },
  { key: 'active', label: 'Active', count: 4 },
];

describe('OrdersFilterBar', () => {
  it('renders every status filter with its count', () => {
    render(
      <OrdersFilterBar
        colors={colors}
        orderFilters={filters}
        selectedFilter="all"
        onSelectFilter={jest.fn()}
        bottomInset={0}
      />
    );

    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('calls onSelectFilter when a chip is pressed', () => {
    const onSelectFilter = jest.fn();

    render(
      <OrdersFilterBar
        colors={colors}
        orderFilters={filters}
        selectedFilter="all"
        onSelectFilter={onSelectFilter}
        bottomInset={0}
      />
    );

    fireEvent.press(
      screen.getByRole('button', { name: /filter orders by active/i })
    );
    expect(onSelectFilter).toHaveBeenCalledWith('active');
  });
});
