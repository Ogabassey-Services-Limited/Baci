import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { OrdersListHeader } from './OrdersListHeader';

const colors = {
  card: '#ffffff',
  border: '#e5e7eb',
  muted: '#f3f4f6',
  text: '#111827',
  textSecondary: '#6b7280',
  placeholder: '#9ca3af',
} as const;

describe('OrdersListHeader', () => {
  it('renders the search input', () => {
    render(
      <OrdersListHeader
        colors={colors}
        searchQuery=""
        onSearchQueryChange={jest.fn()}
        filteredOrdersCount={12}
      />
    );

    expect(
      screen.getByPlaceholderText('Search orders, items, or status')
    ).toBeTruthy();
  });

  it('updates and clears search query', () => {
    const onSearchQueryChange = jest.fn();

    render(
      <OrdersListHeader
        colors={colors}
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

    fireEvent.press(
      screen.getByRole('button', { name: /clear order search/i })
    );
    expect(onSearchQueryChange).toHaveBeenCalledWith('');
    expect(screen.getByText('1 match')).toBeTruthy();
  });
});
