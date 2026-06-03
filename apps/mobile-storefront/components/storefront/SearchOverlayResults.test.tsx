import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import type { Product } from '@/types/product';
import { SearchOverlayResults } from './SearchOverlayResults';

jest.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
  }: {
    data: Product[];
    renderItem: ({ item }: { item: Product }) => unknown;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    return (
      <>
        {data.map((item) => (
          <React.Fragment key={item.id}>{renderItem({ item })}</React.Fragment>
        ))}
      </>
    );
  },
}));

const product: Product = {
  id: 'product-1',
  name: 'Redmi Note 14',
  slug: 'redmi-note-14',
  brand: 'Xiaomi',
  price: 220000,
} as Product;

describe('SearchOverlayResults', () => {
  it('renders no results state for empty searches', () => {
    render(
      <SearchOverlayResults
        colors={Colors.light}
        hasSearchQuery
        isLoading={false}
        onProductPress={jest.fn()}
        products={[]}
      />
    );

    expect(screen.getByText('No results found')).toBeTruthy();
  });

  it('renders result rows and handles product press', () => {
    const onProductPress = jest.fn();

    render(
      <SearchOverlayResults
        colors={Colors.light}
        hasSearchQuery
        isLoading={false}
        onProductPress={onProductPress}
        products={[product]}
      />
    );

    fireEvent.press(
      screen.getByRole('button', {
        name: 'View product Redmi Note 14 by Xiaomi',
      })
    );

    expect(onProductPress).toHaveBeenCalledWith(product);
  });
});
