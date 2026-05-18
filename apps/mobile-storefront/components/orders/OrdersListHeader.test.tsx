import { fireEvent, render, screen } from '@testing-library/react-native';
import type { OrderListFilterOption } from '@/lib/order-list-filters';
import { OrdersListHeader } from './OrdersListHeader';

const colors = {
  card: '#ffffff',
  border: '#e5e7eb',
  muted: '#f3f4f6',
  text: '#111827',
  textSecondary: '#6b7280',
  placeholder: '#9ca3af',
} as const;

const filters: OrderListFilterOption[] = [
  { key: 'all', label: 'All', count: 12 },
  { key: 'active', label: 'Active', count: 4 },
];

describe('OrdersListHeader', () => {
  it('renders filters and search input', () => {
    render(
      <OrdersListHeader
        colors={colors}
        orderFilters={filters}
        selectedFilter="all"
        onSelectFilter={jest.fn()}
        searchQuery=""
        onSearchQueryChange={jest.fn()}
        filteredOrdersCount={12}
      />
    );

    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search orders, items, or status')).toBeTruthy();
  });

  it('calls onSelectFilter when a chip is pressed', () => {
    const onSelectFilter = jest.fn();

    render(
      <OrdersListHeader
        colors={colors}
        orderFilters={filters}
        selectedFilter="all"
        onSelectFilter={onSelectFilter}
        searchQuery=""
        onSearchQueryChange={jest.fn()}
        filteredOrdersCount={12}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: /filter orders by active/i }));
    expect(onSelectFilter).toHaveBeenCalledWith('active');
  });

  it('updates and clears search query', () => {
    const onSearchQueryChange = jest.fn();

    render(
      <OrdersListHeader
        colors={colors}
        orderFilters={filters}
        selectedFilter="all"
        onSelectFilter={jest.fn()}
        searchQuery="sony"
        onSearchQueryChange={onSearchQueryChange}
        filteredOrdersCount={1}
      />
    );

    fireEvent.changeText(
      screen.getByPlaceholderText('Search orders, items, or status'),
      'playstation'
    );
    expect(onSearchQueryChange).toHaveBeenCalledWith('playstation');

    fireEvent.press(screen.getByRole('button', { name: /clear order search/i }));
    expect(onSearchQueryChange).toHaveBeenCalledWith('');
    expect(screen.getByText('1 match')).toBeTruthy();
  });
});
