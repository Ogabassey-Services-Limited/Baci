import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import Colors from '@/constants/Colors';
import type { Category } from '@/types/product';
import SearchScreenView from './SearchScreenView';

jest.mock('@/components/storefront/FilterBar', () => ({
  FilterBar: function MockFilterBar() {
    return null;
  },
}));

jest.mock('@/components/storefront/ProductCard', () => ({
  ProductCard: function MockProductCard() {
    return null;
  },
}));

jest.mock('@shopify/flash-list', () => ({
  FlashList: function MockFlashList() {
    return null;
  },
}));

const categories: Category[] = [
  { id: 'phones', name: 'Phones', slug: 'phones' },
];

function renderView(
  overrides: Partial<ComponentProps<typeof SearchScreenView>> = {}
) {
  const props: ComponentProps<typeof SearchScreenView> = {
    brandNames: [],
    categories,
    categoryNames: ['All', 'Phones'],
    colors: Colors.light,
    hasSearchQuery: false,
    isLoading: false,
    isOnline: true,
    maxPrice: 0,
    minPrice: 0,
    minRating: 0,
    onBack: jest.fn(),
    onCategoryPress: jest.fn(),
    onCategorySelect: jest.fn(),
    onClearQuery: jest.fn(),
    onPriceChange: jest.fn(),
    onProductPress: jest.fn(),
    onQueryChange: jest.fn(),
    onRecentSearch: jest.fn(),
    onSelectBrand: jest.fn(),
    onSelectCondition: jest.fn(),
    onSelectRating: jest.fn(),
    onSubmitQuery: jest.fn(),
    onViewModeChange: jest.fn(),
    products: [],
    query: '',
    recentSearches: ['iPhone 15 Pro'],
    selectedBrand: 'All',
    selectedCategory: 'All',
    selectedCondition: 'All',
    viewMode: 'grid',
    ...overrides,
  };

  return { props, ...render(<SearchScreenView {...props} />) };
}

describe('SearchScreenView', () => {
  it('supports search header actions without automatically focusing input', () => {
    const onBack = jest.fn();
    const onClearQuery = jest.fn();
    const onQueryChange = jest.fn();
    const onSubmitQuery = jest.fn();

    renderView({
      onBack,
      onClearQuery,
      onQueryChange,
      onSubmitQuery,
      query: 'phone',
    });

    const input = screen.getByLabelText('Search products');
    expect(input.props.autoFocus).toBeFalsy();
    fireEvent.changeText(input, 'laptop');
    fireEvent(input, 'submitEditing');
    fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    fireEvent.press(screen.getByRole('button', { name: 'Go back' }));

    expect(onQueryChange).toHaveBeenCalledWith('laptop');
    expect(onSubmitQuery).toHaveBeenCalledTimes(1);
    expect(onClearQuery).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders recent searches and popular categories as actions', () => {
    const onCategoryPress = jest.fn();
    const onRecentSearch = jest.fn();

    renderView({ onCategoryPress, onRecentSearch });

    fireEvent.press(
      screen.getByRole('button', { name: 'Recent search: iPhone 15 Pro' })
    );
    fireEvent.press(screen.getByRole('button', { name: 'Category: Phones' }));

    expect(onRecentSearch).toHaveBeenCalledWith('iPhone 15 Pro');
    expect(onCategoryPress).toHaveBeenCalledWith('phones');
  });

  it('renders an offline state while a query cannot be fetched', () => {
    renderView({ hasSearchQuery: true, isOnline: false, query: 'phone' });

    expect(screen.getByText("You're offline")).toBeTruthy();
    expect(
      screen.getByText('Connect to the internet to search products')
    ).toBeTruthy();
  });
});
