import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import type { Category } from '@/hooks';
import type { Product } from '@/types/product';
import { SearchDropdownList } from './SearchDropdownList';

jest.mock('@/components/ui/SafeImage', () => ({
  SafeImage: () => null,
}));

const categories: Category[] = [
  { id: 'cat-1', name: 'Phones', slug: 'phones' },
];

const products: Product[] = [
  {
    id: 'product-1',
    image: 'https://example.com/iphone.png',
    name: 'iPhone 14 Pro',
    price: 1200000,
    slug: 'iphone-14-pro',
  },
];

describe('SearchDropdownList', () => {
  it('renders idle recent/category state and triggers handlers', () => {
    const onSuggestionPress = jest.fn();
    const onCategoryPress = jest.fn();
    const onClearHistory = jest.fn();

    render(
      <SearchDropdownList
        categories={categories}
        colors={Colors.light}
        isLoading={false}
        onCategoryPress={onCategoryPress}
        onClearHistory={onClearHistory}
        onProductPress={() => {}}
        onSuggestionPress={onSuggestionPress}
        products={[]}
        query=""
        recentSearches={['iphone']}
      />
    );

    fireEvent.press(screen.getByLabelText('Search for iphone'));
    fireEvent.press(screen.getByLabelText('Browse Phones'));
    fireEvent.press(screen.getByText('Clear'));

    expect(onSuggestionPress).toHaveBeenCalledWith('iphone');
    expect(onCategoryPress).toHaveBeenCalledWith('phones');
    expect(onClearHistory).toHaveBeenCalled();
  });

  it('shows loading text while searching', () => {
    render(
      <SearchDropdownList
        categories={[]}
        colors={Colors.light}
        isLoading
        onCategoryPress={() => {}}
        onClearHistory={() => {}}
        onProductPress={() => {}}
        onSuggestionPress={() => {}}
        products={[]}
        query="ip"
        recentSearches={[]}
      />
    );

    expect(screen.getByText('Searching...')).toBeTruthy();
  });

  it('renders results and selects a product', () => {
    const onProductPress = jest.fn();

    render(
      <SearchDropdownList
        categories={[]}
        colors={Colors.light}
        isLoading={false}
        onCategoryPress={() => {}}
        onClearHistory={() => {}}
        onProductPress={onProductPress}
        onSuggestionPress={() => {}}
        products={products}
        query="iphone"
        recentSearches={[]}
      />
    );

    fireEvent.press(screen.getByLabelText(/iPhone 14 Pro/i));
    expect(onProductPress).toHaveBeenCalledWith(products[0]);
  });
});
