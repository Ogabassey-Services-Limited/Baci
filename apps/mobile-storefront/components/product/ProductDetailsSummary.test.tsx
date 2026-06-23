import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { baseProduct } from '@/lib/product-route/product-detail-screen.fixtures';
import { formatPrice } from '@/types/product';
import { ProductDetailsSummary } from './ProductDetailsSummary';

jest.mock('@react-native-vector-icons/ionicons', () => {
  const { Text } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');

  return function MockIonicons({ name }: { name: string }) {
    return <Text>{name}</Text>;
  };
});

describe('ProductDetailsSummary', () => {
  it('renders product identity, review stats, and discounted price context', () => {
    render(
      <ProductDetailsSummary
        colors={Colors.light}
        effectiveComparePrice={620000}
        effectivePrice={552000}
        product={{
          ...baseProduct,
          brand: 'Apple',
          condition: 'New',
          rating: 4,
          review_count: 9,
        }}
        reviewStats={{
          average_rating: 4.6,
          rating_distribution: {},
          review_count: 12,
        }}
      />
    );

    expect(screen.getByText('Apple')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText(baseProduct.name)).toBeTruthy();
    expect(screen.getByText('4.6 (12 reviews)')).toBeTruthy();
    expect(screen.getByText(formatPrice(552000))).toBeTruthy();
    expect(screen.getByText(formatPrice(620000))).toBeTruthy();
  });

  it('falls back to product rating copy and hides invalid compare prices', () => {
    render(
      <ProductDetailsSummary
        colors={Colors.light}
        effectiveComparePrice={500000}
        effectivePrice={552000}
        product={{
          ...baseProduct,
          rating: 4,
          review_count: 9,
        }}
        reviewStats={null}
      />
    );

    expect(screen.getByText('4 (9 reviews)')).toBeTruthy();
    expect(screen.getByText(formatPrice(552000))).toBeTruthy();
    expect(screen.queryByText(formatPrice(500000))).toBeNull();
  });

  it('shows no-review copy when neither review stats nor product rating exist', () => {
    render(
      <ProductDetailsSummary
        colors={Colors.light}
        effectiveComparePrice={undefined}
        effectivePrice={552000}
        product={{ ...baseProduct, rating: undefined, review_count: undefined }}
        reviewStats={null}
      />
    );

    expect(screen.getByText('No reviews yet')).toBeTruthy();
  });
});
